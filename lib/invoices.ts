import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { type DashboardInvoice, compareUrgency, getStatus } from "@/lib/invoiceStatus";

// Safety cap for auto-pagination. Stripe returns 100 per page, so this is at
// most 10 API calls. Past this size a local database starts to make sense.
const MAX_INVOICES = 1000;

/**
 * Fetch every invoice from Stripe (the source of truth), sorted most urgent
 * first. Also returns the `now` used to decide "overdue", so the page can
 * show relative times ("Reminded 2 days ago") against the same clock.
 */
export async function listInvoices(): Promise<{ invoices: DashboardInvoice[]; now: number }> {
  // autoPagingToArray follows `has_more` and fetches page after page for us.
  const [regular, clocked] = await Promise.all([
    stripe.invoices.list({ limit: 100 }).autoPagingToArray({ limit: MAX_INVOICES }),
    listTestClockInvoices(),
  ]);

  const now = Math.floor(Date.now() / 1000);
  const invoices = [...regular, ...clocked].map((inv) => toRow(inv, now)).sort(compareUrgency);
  return { invoices, now };
}

/**
 * TEST MODE ONLY. invoices.list silently leaves out invoices whose customer
 * is attached to a test clock, which is how we fake overdue invoices (see
 * README). Filtering by customer does include them, so walk
 * clocks → customers → invoices. A few extra API calls, only in test mode.
 */
async function listTestClockInvoices(): Promise<Stripe.Invoice[]> {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) return [];

  const clocks = await stripe.testHelpers.testClocks.list({ limit: 100 }).autoPagingToArray({ limit: 100 });
  const customers = (
    await Promise.all(
      clocks.map((c) => stripe.customers.list({ test_clock: c.id, limit: 100 }).autoPagingToArray({ limit: 100 })),
    )
  ).flat();
  const perCustomer = await Promise.all(
    customers.map((c) => stripe.invoices.list({ customer: c.id, limit: 100 }).autoPagingToArray({ limit: 100 })),
  );
  return perCustomer.flat();
}

function toRow(inv: Stripe.Invoice, now: number): DashboardInvoice {
  const t = inv.status_transitions;
  return {
    id: inv.id!,
    number: inv.number,
    // customer_name/email are copied onto the invoice, so no extra API call
    // per customer is needed.
    clientName: inv.customer_name ?? inv.customer_email ?? "Unknown client",
    // Tab puts the description on the line item, not invoice.description.
    // The list response includes the first page of lines.
    description: inv.description ?? inv.lines.data[0]?.description ?? "",
    amountCents: inv.total,
    currency: inv.currency,
    dueDate: inv.due_date,
    status: getStatus(inv.status, inv.due_date, now),
    closedAt: t.paid_at ?? t.voided_at ?? t.marked_uncollectible_at,
    created: inv.created,
    hostedUrl: inv.hosted_invoice_url ?? null,
    lastReminderAt: parseTimestamp(inv.metadata?.[REMINDER_KEYS.sentAt]),
  };
}

/** Metadata keys the remind route writes. Metadata values are always strings. */
export const REMINDER_KEYS = {
  sentAt: "last_reminder_at", // Unix seconds, as a string
  message: "reminder_message",
  tone: "reminder_tone",
} as const;

function parseTimestamp(value: string | undefined): number | null {
  const n = Number(value);
  return value && Number.isFinite(n) ? n : null;
}
