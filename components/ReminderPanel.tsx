"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Close, Send } from "@/components/icons";
import { btnOutline, btnPrimary, btnSecondary, eyebrow, input } from "@/components/ui";
import { formatMoney } from "@/lib/format";
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
 * "Remind" button + a side drawer to review, edit, and approve a reminder.
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
  const titleId = `remind-title-${props.invoiceId}`;

  function close() {
    setOpen(false);
    if (sentButUnrecorded) router.refresh();
  }

  return (
    <>
      <button type="button" onClick={openPanel} className={`${btnOutline} px-4 py-1.5 text-sm`}>
        Remind
        <span className="sr-only"> {props.clientName}</span>
      </button>

      {/*
        Still a native modal <dialog> (focus trap, Esc, inert page behind it),
        just pinned to the right edge as a drawer.
      */}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // Esc / backdrop close → keep React state in sync. Block it mid-send.
        onCancel={(e) => {
          if (sending) e.preventDefault();
        }}
        onClose={() => setOpen(false)}
        className="m-0 ml-auto h-dvh max-h-none w-full max-w-md bg-white p-0 text-navy shadow-pop backdrop:bg-navy/30 backdrop:backdrop-blur-sm motion-safe:animate-drawer-in"
      >
        {open && facts && (
          <form
            method="dialog"
            className="flex h-full flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              approve();
            }}
          >
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-7">
              <div>
                <p className={`${eyebrow} text-ink-muted`}>Payment reminder</p>
                <h2 id={titleId} className="mt-1.5 text-2xl tracking-tight">
                  Send a gentle nudge
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={sending}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-control text-ink-muted transition-colors hover:bg-lavender-soft hover:text-navy disabled:opacity-50"
              >
                <Close className="size-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
              <dl className="grid grid-cols-3 gap-4 rounded-card border border-line px-5 py-4">
                <Fact label="Client">
                  {props.clientName}
                  {props.invoiceNumber && (
                    <span className="block text-xs font-normal text-ink-muted">{props.invoiceNumber}</span>
                  )}
                </Fact>
                <Fact label="Amount">{formatMoney(props.amountCents, props.currency, { short: true })}</Fact>
                <Fact label="Late by">
                  {facts.daysLate} {facts.daysLate === 1 ? "day" : "days"}
                </Fact>
              </dl>

              <div role="group" aria-labelledby={`${titleId}-tone`} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p id={`${titleId}-tone`} className="text-sm font-semibold">
                    Tone
                  </p>
                  <p className="text-xs text-ink-muted">Choose how direct you&apos;d like to be.</p>
                </div>
                <div className="inline-flex rounded-control bg-lavender/60 p-1">
                  {TONES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={tone === t}
                      onClick={() => changeTone(t)}
                      disabled={sending}
                      className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                        tone === t ? "bg-white text-purple shadow-card" : "text-purple hover:bg-white/50"
                      }`}
                    >
                      {TONE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 flex justify-between text-sm">
                  <span className="font-semibold">Message</span>
                  <span className={`text-xs ${tooLong ? "text-danger" : "text-ink-muted"}`}>
                    {message.trim().length}/{MAX_MESSAGE}
                  </span>
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={9}
                  disabled={sending || sentButUnrecorded}
                  aria-invalid={tooLong}
                  className={`${input} px-4 py-3 text-sm leading-relaxed disabled:opacity-70`}
                />
              </label>

              <div className="flex gap-3 rounded-card bg-aqua-soft px-4 py-3.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white text-navy">
                  <Check className="size-3.5" />
                </span>
                <div className="text-xs">
                  <p className="text-sm font-semibold">Nothing sends until you approve.</p>
                  <p className="mt-0.5 text-ink-muted">
                    Approving re-sends the Stripe invoice email and saves this message on the invoice.
                  </p>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-control bg-danger-soft px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
              <button type="button" onClick={close} disabled={sending} className={`${btnSecondary} px-5 py-2.5`}>
                {sentButUnrecorded ? "Close" : "Cancel"}
              </button>
              {!sentButUnrecorded && (
                <button type="submit" disabled={sending || tooLong || !message.trim()} className={`${btnPrimary} px-5 py-2.5`}>
                  {sending ? (
                    "Sending…"
                  ) : (
                    <>
                      Approve &amp; send
                      <Send />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold">{children}</dd>
    </div>
  );
}
