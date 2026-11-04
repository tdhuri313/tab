import "server-only";
import { Redis } from "@upstash/redis";
import type Stripe from "stripe";

/**
 * A tiny feed of recent payment events, stored in Upstash Redis.
 *
 * Why a store at all? On Vercel, each request can run on a different
 * serverless instance with its own memory, so the webhook can't just hand
 * the event to the browser's request. It writes here; /api/events reads here.
 *
 * Stripe is still the source of truth for invoices. This only remembers
 * "something happened" long enough for open dashboards to notice.
 */

export type PaymentEvent = {
  id: string; // Stripe event id (evt_...), used to de-duplicate
  kind: "paid" | "payment_failed";
  invoiceId: string;
  clientName: string;
  amountCents: number;
  currency: string;
  created: number; // Unix seconds, from Stripe
};

const FEED_KEY = "payment-events";
const KEEP = 50; // older entries are trimmed on every write
const RETURN = 20; // how many the poll endpoint returns

// Created on first use rather than at import time, so `next build` doesn't
// need Redis credentials. fromEnv() accepts both the Vercel Marketplace names
// (KV_REST_API_URL / KV_REST_API_TOKEN) and Upstash's (UPSTASH_REDIS_REST_*).
let client: Redis | null = null;
function redis() {
  client ??= Redis.fromEnv();
  return client;
}

/** Turn a verified Stripe event into the small payload the dashboard needs. */
export function toPaymentEvent(event: Stripe.InvoicePaidEvent | Stripe.InvoicePaymentFailedEvent): PaymentEvent {
  const inv = event.data.object;
  const paid = event.type === "invoice.paid";
  // Fixed key order matters: Redis compares members as strings, so the same
  // event must always serialize identically for ZADD NX to spot a retry.
  return {
    id: event.id,
    kind: paid ? "paid" : "payment_failed",
    invoiceId: inv.id!,
    clientName: inv.customer_name ?? inv.customer_email ?? "A client",
    amountCents: paid ? inv.amount_paid : inv.amount_remaining,
    currency: inv.currency,
    created: event.created,
  };
}

/** Save an event. Safe to call twice for the same event (Stripe retries). */
export async function recordPaymentEvent(e: PaymentEvent): Promise<void> {
  // NX = only add if this exact member isn't already in the set.
  await redis().zadd(FEED_KEY, { nx: true }, { score: e.created, member: JSON.stringify(e) });
  // Keep only the newest KEEP entries (ranks are lowest score first, so
  // remove from rank 0 up to KEEP+1 from the end).
  await redis().zremrangebyrank(FEED_KEY, 0, -(KEEP + 1));
}

/** Newest events first. One Redis command, so polling stays cheap. */
export async function listRecentPaymentEvents(): Promise<PaymentEvent[]> {
  // Upstash parses JSON members back into objects automatically.
  return redis().zrange<PaymentEvent[]>(FEED_KEY, 0, RETURN - 1, { rev: true });
}
