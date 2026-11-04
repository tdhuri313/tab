import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { type DashboardInvoice, compareUrgency, getStatus } from "@/lib/invoiceStatus";

// Safety cap for auto-pagination. Stripe returns 100 per page, so this is at
// most 10 API calls. Past this size a local database starts to make sense.
const MAX_INVOICES = 1000;

/** Fetch every invoice from Stripe (the source of truth), sorted most urgent first. */
export async function listInvoices(): Promise<DashboardInvoice[]> {
  // autoPagingToArray follows `has_more` and fetches page after page for us.
  const invoices = await stripe.invoices.list({ limit: 100 }).autoPagingToArray({ limit: MAX_INVOICES });

  const now = Math.floor(Date.now() / 1000);
  return invoices.map((inv) => toRow(inv, now)).sort(compareUrgency);
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
  };
}
