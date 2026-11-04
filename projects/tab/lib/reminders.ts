/**
 * Reminder text for overdue invoices. Pure functions, no Stripe import, so
 * the browser (to pre-fill the editor) and the server (to validate what was
 * approved) share the exact same rules.
 */

import { formatMoney } from "@/lib/format";

export type ReminderTone = "friendly" | "firm";
export const TONES: ReminderTone[] = ["friendly", "firm"];

/**
 * Stripe metadata values max out at 500 characters, and the approved message
 * is stored in metadata, so the editor and the server both enforce this.
 */
export const MAX_MESSAGE = 500;

// Keep long descriptions from eating the whole 500-character budget.
const MAX_DESCRIPTION_IN_MESSAGE = 120;

export type ReminderFacts = {
  clientName: string;
  amountCents: number;
  currency: string;
  description: string;
  daysLate: number;
};

/** The pre-written message for a tone. The user can edit it before approving. */
export function buildReminder(tone: ReminderTone, f: ReminderFacts): string {
  const amount = formatMoney(f.amountCents, f.currency, { short: true });
  const what = f.description ? `${truncate(f.description, MAX_DESCRIPTION_IN_MESSAGE)} (${amount})` : amount;
  const days = `${f.daysLate} ${f.daysLate === 1 ? "day" : "days"}`;
  const firstName = f.clientName.trim().split(/\s+/)[0] || "there";

  if (tone === "friendly") {
    return [
      `Hi ${firstName},`,
      "",
      `Just a friendly reminder that the invoice for ${what} was due ${days} ago. ` +
        "If you've already sent payment, thank you, and please ignore this note. " +
        "Otherwise, you can pay any time using the link in the invoice email.",
      "",
      "Thanks so much!",
    ].join("\n");
  }

  return [
    `Hi ${firstName},`,
    "",
    `The invoice for ${what} is now ${days} overdue. ` +
      "Please arrange payment as soon as possible using the link in the invoice email. " +
      "If there's a problem with the invoice, reply and let me know so we can sort it out.",
    "",
    "Thank you.",
  ].join("\n");
}

/**
 * Whole days past the due date, rounded up, minimum 1. Due dates are
 * 23:59:59 UTC, so one second past due is already "1 day late", and noon two
 * days later is "2 days late".
 */
export function daysLate(dueDate: number, nowSeconds: number): number {
  return Math.max(1, Math.ceil((nowSeconds - dueDate) / 86_400));
}

/** Returns an error message, or null if the tone and message are OK to send. */
export function validateReminder(tone: unknown, message: unknown): string | null {
  if (tone !== "friendly" && tone !== "firm") return "Pick a tone.";
  if (typeof message !== "string" || !message.trim()) return "The message can't be empty.";
  if (message.trim().length > MAX_MESSAGE) return `Keep the message under ${MAX_MESSAGE} characters.`;
  return null;
}

function truncate(s: string, max: number) {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}
