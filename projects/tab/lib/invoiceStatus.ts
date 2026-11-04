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
