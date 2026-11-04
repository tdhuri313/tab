import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { type InvoiceDraft, toCents, validateDraft } from "@/lib/parseInvoice";

/**
 * POST /api/invoices
 * Body: InvoiceDraft. Creates (or reuses) a Stripe customer, builds a one-line
 * invoice, finalizes it, emails it, and returns the hosted invoice link.
 */
export async function POST(request: Request) {
  // 1. Read and re-validate the body. The browser already validated, but
  //    anyone can call this URL directly, so the server checks again.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const draft = pickDraft(body);
  const errors = validateDraft(draft);
  if (Object.keys(errors).length > 0) {
    return Response.json({ error: "Some fields are invalid.", fields: errors }, { status: 400 });
  }

  const email = draft.email.trim().toLowerCase();
  const amountCents = toCents(draft.amount);
  // End of the due day, in UTC, as a Unix timestamp (seconds). Stripe needs the
  // due date to be in the future, so "due today" still works.
  const [y, m, d] = draft.dueDate.split("-").map(Number);
  const dueDateUnix = Math.floor(Date.UTC(y, m - 1, d, 23, 59, 59) / 1000);

  let invoiceId: string | null = null;
  let finalized = false;

  try {
    // 2. Reuse an existing customer with this email, or create one.
    //    (customers.list is consistent immediately; customers.search can lag.)
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customer =
      existing.data[0] ?? (await stripe.customers.create({ name: draft.name.trim(), email }));

    // 3. Create an empty draft invoice. "exclude" means it won't sweep in any
    //    leftover pending items on this customer, only the one we add next.
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: "send_invoice",
      due_date: dueDateUnix,
      currency: "usd",
      pending_invoice_items_behavior: "exclude",
      auto_advance: false,
    });
    invoiceId = invoice.id!;

    // 4. Attach the single line item directly to this invoice.
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoiceId,
      amount: amountCents,
      currency: "usd",
      // "logo design" → "Logo design". Only the first letter, so "iOS app" stays as typed.
      description: capitalizeFirst(draft.description.trim()),
    });

    // 5. Finalize (locks it and assigns a number + hosted URL), then email it.
    await stripe.invoices.finalizeInvoice(invoiceId);
    finalized = true;
    const sent = await stripe.invoices.sendInvoice(invoiceId);

    return Response.json({
      id: sent.id,
      number: sent.number,
      url: sent.hosted_invoice_url,
    });
  } catch (err) {
    // If we failed before finalizing, delete the half-built draft so it
    // doesn't clutter the Stripe dashboard. (Finalized invoices can't be deleted.)
    if (invoiceId && !finalized) {
      await stripe.invoices.del(invoiceId).catch(() => {});
    }

    if (err instanceof Stripe.errors.StripeError) {
      console.error("Stripe error:", err.type, err.message);
      return Response.json({ error: err.message }, { status: 502 });
    }
    console.error(err);
    return Response.json({ error: "Something went wrong creating the invoice." }, { status: 500 });
  }
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pull only the fields we expect out of an unknown body, as strings. */
function pickDraft(body: unknown): InvoiceDraft {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    name: str(b.name),
    email: str(b.email),
    amount: str(b.amount),
    description: str(b.description),
    dueDate: str(b.dueDate),
  };
}
