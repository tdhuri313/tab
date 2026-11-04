import * as chrono from "chrono-node";

/**
 * The editable invoice fields. Everything is a string because that's what
 * form inputs hold; the server converts amount → cents and dueDate → a
 * timestamp after validating.
 */
export type InvoiceDraft = {
  name: string;
  email: string;
  amount: string; // dollars, e.g. "400" or "400.50"
  description: string;
  dueDate: string; // "YYYY-MM-DD" (the format <input type="date"> uses)
};

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// "$400", "$ 1,250.50"
const DOLLAR_RE = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/;
// "400 dollars", "400 usd" (fallback when there's no $)
const WORD_AMOUNT_RE = /\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(?:dollars|usd)\b/i;
const LEADING_VERB_RE = /^\s*(bill|invoice|charge|send)\b\s*/i;
const TRAILING_DATE_WORD_RE = /\s*\b(due|by|on|before)\s*$/i;
// Commas etc. left at the edges of a chunk, e.g. "logo design," from
// "for logo design, due Friday" or a lone "," between two removed tokens.
const EDGE_PUNCT_RE = /^[\s,;:.]+|[\s,;:.]+$/g;

// Placeholder left where we cut a token out, so the leftover text stays split
// into separate chunks instead of running together.
const GAP = "|";

/** Turns free text like "Bill Sarah Lee sarah@email.com $400 for logo design due Friday" into a draft. */
export function parseInvoice(text: string, now: Date = new Date()): InvoiceDraft {
  let rest = text;

  // 1. Email
  const emailMatch = rest.match(EMAIL_RE);
  const email = emailMatch ? emailMatch[0].replace(/[.,;]+$/, "") : "";
  if (emailMatch) rest = rest.replace(emailMatch[0], GAP);

  // 2. Amount (prefer "$400"; fall back to "400 dollars")
  const amountMatch = rest.match(DOLLAR_RE) ?? rest.match(WORD_AMOUNT_RE);
  let amount = "";
  if (amountMatch) {
    const whole = amountMatch[1].replace(/,/g, "");
    amount = amountMatch[2] ? `${whole}.${amountMatch[2].padEnd(2, "0")}` : whole;
    rest = rest.replace(amountMatch[0], GAP);
  }

  // 3. Due date. Done after removing the email/amount so chrono can't mistake
  // "400" for part of a date. forwardDate makes "Friday" mean the *next* Friday.
  const dateResult = chrono.parse(rest, now, { forwardDate: true })[0];
  const dueDate = dateResult ? toDateInputValue(dateResult.start.date()) : "";
  if (dateResult) rest = rest.replace(dateResult.text, GAP);

  // 4. What's left looks like "Sarah Lee | | for logo design due |".
  //    Name = first chunk; description = the chunk starting with "for".
  rest = rest.replace(LEADING_VERB_RE, "");
  const chunks = rest
    .split(GAP)
    // Strip punctuation both before and after removing "due", so
    // "design, due" and "design due," both end up as "design".
    .map((c) => c.replace(EDGE_PUNCT_RE, "").replace(TRAILING_DATE_WORD_RE, "").replace(EDGE_PUNCT_RE, ""))
    .filter(Boolean);

  const forIndex = chunks.findIndex((c) => /^for\b/i.test(c));
  const nameChunk = chunks.find((_, i) => i !== forIndex) ?? "";
  const descriptionChunk =
    forIndex >= 0
      ? chunks[forIndex].replace(/^for\s+/i, "")
      : chunks.filter((c) => c !== nameChunk).join(" ");

  return {
    name: nameChunk,
    email,
    amount,
    description: descriptionChunk,
    dueDate,
  };
}

/**
 * Returns a map of field → error message. Empty object means valid.
 * Used by the preview card (to show problems and disable Confirm) and by the
 * server route (which must never trust the browser).
 */
export function validateDraft(d: InvoiceDraft, now: Date = new Date()): Partial<Record<keyof InvoiceDraft, string>> {
  const errors: Partial<Record<keyof InvoiceDraft, string>> = {};

  if (!d.name.trim()) errors.name = "Add the client's name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) errors.email = "Enter a valid email.";

  if (!/^\d+(\.\d{1,2})?$/.test(d.amount.trim())) errors.amount = "Enter an amount like 400 or 400.50.";
  else if (toCents(d.amount) < 50) errors.amount = "Stripe's minimum is $0.50.";

  if (!d.description.trim()) errors.description = "Say what the invoice is for.";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)) errors.dueDate = "Pick a due date.";
  else if (d.dueDate < toDateInputValue(now)) errors.dueDate = "Due date can't be in the past.";

  return errors;
}

/** "400.5" → 40050. Only call on a string that passed validateDraft. */
export function toCents(amount: string): number {
  const [whole, frac = ""] = amount.trim().split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Date → "YYYY-MM-DD" using the *local* calendar day (toISOString would use UTC and can be off by one). */
function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
