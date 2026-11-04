/**
 * Pure helpers for the dashboard: what badge an invoice gets, and what order
 * rows appear in. No Stripe import here, so this file is safe to use from
 * both server and client components (and easy to test with plain objects).
 */

export type DashboardStatus = "overdue" | "sent" | "draft" | "paid" | "void";

/** One dashboard row. Timestamps are Unix seconds, like Stripe's. */
export type DashboardInvoice = {
  id: string;
  number: string | null;
  clientName: string;
  description: string;
  amountCents: number;
  currency: string;
  dueDate: number | null;
  status: DashboardStatus;
  /** When it was paid / voided, for ordering the bottom groups. */
  closedAt: number | null;
  created: number;
  hostedUrl: string | null;
  /** Stripe's PDF download link (finalized invoices only). */
  pdfUrl: string | null;
  /** When the last reminder was approved and sent (from invoice metadata). */
  lastReminderAt: number | null;
};

/**
 * Stripe status → dashboard status. "Overdue" isn't a Stripe status; it's an
 * open invoice whose due date has passed, so it depends on the current time.
 * Void and uncollectible both mean "not getting paid", so they share a badge.
 */
export function getStatus(
  stripeStatus: string | null,
  dueDate: number | null,
  nowSeconds: number,
): DashboardStatus {
  switch (stripeStatus) {
    case "paid":
      return "paid";
    case "open":
      return dueDate !== null && dueDate < nowSeconds ? "overdue" : "sent";
    case "void":
    case "uncollectible":
      return "void";
    default:
      return "draft";
  }
}

// Lower number = higher on the page.
const RANK: Record<DashboardStatus, number> = { overdue: 0, sent: 1, draft: 2, paid: 3, void: 4 };

/**
 * Most urgent first:
 *   Overdue (most overdue first) → Sent (soonest due first) → Draft →
 *   Paid (most recently paid first) → Void (most recent first).
 * Use with Array.prototype.sort.
 */
export function compareUrgency(a: DashboardInvoice, b: DashboardInvoice): number {
  if (a.status !== b.status) return RANK[a.status] - RANK[b.status];

  if (a.status === "paid" || a.status === "void") {
    // Newest closed first.
    const diff = (b.closedAt ?? b.created) - (a.closedAt ?? a.created);
    if (diff !== 0) return diff;
  } else {
    // Earliest due date first (for overdue, that's the most overdue).
    // Invoices with no due date sink to the bottom of their group.
    const aDue = a.dueDate ?? Infinity;
    const bDue = b.dueDate ?? Infinity;
    if (aDue !== bDue) return aDue - bDue;
  }

  // Tie-breaker so the order is stable: newest created first.
  return b.created - a.created;
}

export const STATUS_LABEL: Record<DashboardStatus, string> = {
  overdue: "Overdue",
  sent: "Sent",
  draft: "Draft",
  paid: "Paid",
  void: "Void",
};

export type Totals = { cents: number; count: number };

export type InvoiceSummary = {
  /** Open invoices, overdue or not. */
  outstanding: Totals;
  overdue: Totals;
  /** Paid since the 1st of the current month (UTC, like due dates). */
  paidThisMonth: Totals;
  currency: string;
};

/**
 * Totals for the dashboard stat cards and the home-page pill. Only invoices
 * in `currency` count: Tab only creates USD invoices, and adding dollars to
 * euros would give a meaningless number.
 */
export function summarize(invoices: DashboardInvoice[], nowSeconds: number, currency = "usd"): InvoiceSummary {
  const now = new Date(nowSeconds * 1000);
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;

  const summary: InvoiceSummary = {
    outstanding: { cents: 0, count: 0 },
    overdue: { cents: 0, count: 0 },
    paidThisMonth: { cents: 0, count: 0 },
    currency,
  };
  const add = (t: Totals, inv: DashboardInvoice) => {
    t.cents += inv.amountCents;
    t.count += 1;
  };

  for (const inv of invoices) {
    if (inv.currency !== currency) continue;
    if (inv.status === "sent" || inv.status === "overdue") add(summary.outstanding, inv);
    if (inv.status === "overdue") add(summary.overdue, inv);
    if (inv.status === "paid" && inv.closedAt !== null && inv.closedAt >= monthStart) add(summary.paidThisMonth, inv);
  }
  return summary;
}
