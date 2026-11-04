"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MAX_MESSAGE, type ReminderTone, TONES, buildReminder, daysLate, validateReminder } from "@/lib/reminders";

type Props = {
  invoiceId: string;
  invoiceNumber: string | null;
  clientName: string;
  amountCents: number;
  currency: string;
  description: string;
  dueDate: number;
};

const TONE_LABEL: Record<ReminderTone, string> = { friendly: "Friendly", firm: "Firm" };

/**
 * "Remind" button + a modal to review, edit, and approve a reminder.
 * Nothing is sent until Approve: opening, switching tone, and editing are all
 * local state. Only approve() talks to the server.
 */
export default function ReminderPanel(props: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<ReminderTone>("friendly");
  const [message, setMessage] = useState("");
  const [facts, setFacts] = useState<Parameters<typeof buildReminder>[1] | null>(null);
  // One key per opened panel, so a double click can't send twice.
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the email went out but recording it failed. Hides Approve so
  // the user doesn't send a second one trying to "fix" it.
  const [sentButUnrecorded, setSentButUnrecorded] = useState(false);

  // Sync React state with the native <dialog> (which gives us focus trapping
  // and Esc-to-close for free).
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function openPanel() {
    // Days late is computed at click time, not render time, so it's fresh.
    const f = {
      clientName: props.clientName,
      amountCents: props.amountCents,
      currency: props.currency,
      description: props.description,
      daysLate: daysLate(props.dueDate, Math.floor(Date.now() / 1000)),
    };
    setFacts(f);
    setTone("friendly");
    setMessage(buildReminder("friendly", f));
    setIdempotencyKey(crypto.randomUUID());
    setError(null);
    setSentButUnrecorded(false);
    setOpen(true);
  }

  function changeTone(next: ReminderTone) {
    if (next === tone || !facts) return;
    const edited = message !== buildReminder(tone, facts);
    if (edited && !window.confirm(`Replace your edits with the ${TONE_LABEL[next]} message?`)) return;
    setTone(next);
    setMessage(buildReminder(next, facts));
  }

  async function approve() {
    if (sending || sentButUnrecorded) return;
    const problem = validateReminder(tone, message);
    if (problem) return setError(problem);

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${props.invoiceId}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, message, idempotencyKey }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; sent?: boolean };

      if (res.ok) {
        setOpen(false);
        router.refresh(); // re-fetch the table so "Reminded just now" shows
        return;
      }
      setError(data.error ?? "Something went wrong.");
      if (data.sent) setSentButUnrecorded(true);
      // 409 = paid/voided/not overdue meanwhile; refresh so the row catches up.
      if (res.status === 409) router.refresh();
    } catch {
      setError("Network error. Nothing was confirmed as sent; try again.");
    } finally {
      setSending(false);
    }
  }

  const tooLong = message.trim().length > MAX_MESSAGE;

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Remind
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`remind-title-${props.invoiceId}`}
        // Esc / backdrop close → keep React state in sync. Block it mid-send.
        onCancel={(e) => {
          if (sending) e.preventDefault();
        }}
        onClose={() => setOpen(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-900/40"
      >
        {open && facts && (
          <form
            method="dialog"
            className="space-y-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              approve();
            }}
          >
            <div>
              <h2 id={`remind-title-${props.invoiceId}`} className="text-base font-semibold">
                Remind {props.clientName}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {props.invoiceNumber ? `${props.invoiceNumber} · ` : ""}
                {facts.daysLate} {facts.daysLate === 1 ? "day" : "days"} late
              </p>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-zinc-500">Tone</legend>
              <div className="inline-flex rounded-lg border border-zinc-200 p-0.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tone === t}
                    onClick={() => changeTone(t)}
                    disabled={sending}
                    className={`rounded-md px-3 py-1 text-sm ${
                      tone === t ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {TONE_LABEL[t]}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className="mb-1.5 flex justify-between text-xs font-medium text-zinc-500">
                <span>Message</span>
                <span className={tooLong ? "text-red-600" : ""}>
                  {message.trim().length}/{MAX_MESSAGE}
                </span>
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={9}
                disabled={sending || sentButUnrecorded}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
              />
            </label>

            <p className="text-xs text-zinc-500">
              Approving re-sends the Stripe invoice email and saves this message on the invoice.
            </p>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (sentButUnrecorded) router.refresh();
                }}
                disabled={sending}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
              >
                {sentButUnrecorded ? "Close" : "Cancel"}
              </button>
              {!sentButUnrecorded && (
                <button
                  type="submit"
                  disabled={sending || tooLong || !message.trim()}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Approve & send"}
                </button>
              )}
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
