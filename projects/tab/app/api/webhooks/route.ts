import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { recordPaymentEvent, toPaymentEvent } from "@/lib/paymentEvents";

/**
 * POST /api/webhooks — Stripe calls this when something happens.
 *
 * 1. Prove the request really came from Stripe (signature check).
 * 2. For invoice.paid / invoice.payment_failed, save a small event to Redis.
 * 3. Reply 2xx quickly. Any non-2xx makes Stripe retry later, which is what
 *    we want if Redis was briefly down, and what we don't want for events we
 *    simply don't care about (those get 200 too).
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is missing. Add it to your environment.");
    return Response.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe-Signature header." }, { status: 400 });
  }

  // The signature is computed over the exact bytes Stripe sent, so read the
  // raw text. request.json() + JSON.stringify could change spacing and break it.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.warn("Rejected webhook with bad signature:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    try {
      await recordPaymentEvent(toPaymentEvent(event));
    } catch (err) {
      // 500 → Stripe retries with backoff, so a short Redis outage loses nothing.
      console.error("Failed to record payment event:", err);
      return Response.json({ error: "Couldn't record event." }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
