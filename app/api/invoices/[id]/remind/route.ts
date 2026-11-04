import Stripe from "stripe";
import { REMINDER_KEYS } from "@/lib/invoices";
import { validateReminder } from "@/lib/reminders";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/invoices/:id/remind
 * Body: { tone, message, idempotencyKey }
 *
 * The ONLY place a reminder is sent. The dashboard calls it only when the
 * user clicks Approve. Opening the panel or switching tone never hits it.
 *
 * Note: Stripe's re-sent email is its standard invoice email. The custom
 * message is stored in metadata as a record; the client doesn't see it.
 * In test mode Stripe sends no email at all (but still fires invoice.sent).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^in_[A-Za-z0-9]+$/.test(id)) {
    return Response.json({ error: "That isn't an invoice id." }, { status: 400 });
  }

  // 1. Validate the body. The browser checked already, but anyone can call this URL.
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    body = typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const { tone, message, idempotencyKey } = body;
  const problem = validateReminder(tone, message);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(idempotencyKey)) {
    return Response.json({ error: "Missing or invalid idempotencyKey." }, { status: 400 });
  }

  // 2. Re-check with Stripe that it's still overdue. It may have been paid or
  //    voided while the panel was open, and we must never nag about those.
  let invoice: Stripe.Invoice;
  try {
    invoice = await stripe.invoices.retrieve(id);
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.statusCode === 404) {
      return Response.json({ error: "Invoice not found." }, { status: 404 });
    }
    console.error("Failed to load invoice for reminder:", err);
    return Response.json({ error: "Couldn't load the invoice from Stripe." }, { status: 502 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (invoice.status !== "open") {
    return Response.json({ error: `This invoice is ${invoice.status} now, so no reminder was sent.` }, { status: 409 });
  }
  if (invoice.due_date === null || invoice.due_date >= now) {
    return Response.json({ error: "This invoice isn't overdue, so no reminder was sent." }, { status: 409 });
  }

  // 3. Send. The idempotency key is made once per opened panel, so a double
  //    click or a network retry replays this result instead of sending twice.
  try {
    await stripe.invoices.sendInvoice(id, {}, { idempotencyKey: `remind-${id}-${idempotencyKey}` });
  } catch (err) {
    console.error("Failed to send reminder:", err);
    const msg = err instanceof Stripe.errors.StripeError ? err.message : "Something went wrong sending the reminder.";
    return Response.json({ error: msg }, { status: 502 });
  }

  // 4. Record it. Done after sending: if this fails, a reminder DID go out,
  //    so say so honestly rather than reporting "nothing happened".
  const sentAt = Math.floor(Date.now() / 1000);
  try {
    await stripe.invoices.update(id, {
      metadata: {
        [REMINDER_KEYS.sentAt]: String(sentAt),
        [REMINDER_KEYS.message]: (message as string).trim(),
        [REMINDER_KEYS.tone]: tone as string,
      },
    });
  } catch (err) {
    console.error("Reminder sent but metadata update failed:", err);
    return Response.json(
      { error: "The reminder was sent, but saving it to the invoice failed.", sent: true },
      { status: 502 },
    );
  }

  return Response.json({ sent: true, lastReminderAt: sentAt });
}
