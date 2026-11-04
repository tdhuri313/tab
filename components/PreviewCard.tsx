"use client";

import { useEffect, useRef } from "react";
import { Check, Send } from "@/components/icons";
import { btnPrimary, btnText, card, eyebrow, input } from "@/components/ui";
import { type InvoiceDraft, validateDraft } from "@/lib/parseInvoice";

type Props = {
  draft: InvoiceDraft;
  onChange: (draft: InvoiceDraft) => void;
  onConfirm: () => void;
  onBack: () => void;
  sending: boolean;
};

/** Editable preview of the parsed invoice. The parent owns the state; this just renders and reports edits. */
export default function PreviewCard({ draft, onChange, onConfirm, onBack, sending }: Props) {
  const errors = validateDraft(draft);
  const valid = Object.keys(errors).length === 0;

  // The textarea that had focus is gone, so move focus to this step's heading
  // (keyboard and screen-reader users land at the top of the new content).
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const set = (field: keyof InvoiceDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...draft, [field]: e.target.value });

  return (
    <form
      className={`${card} p-6 sm:p-10`}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !sending) onConfirm();
      }}
    >
      <p className={`${eyebrow} flex items-center gap-2.5 text-purple`}>
        <span className="grid size-7 place-items-center rounded-lg bg-lavender-soft">
          <Check />
        </span>
        Almost ready
      </p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-5 text-3xl tracking-tight focus-visible:outline-none sm:text-[2rem]">
        Check the details
      </h1>
      <p className="mt-3 text-ink-muted">Everything look right? You can edit any field.</p>

      <div className="mt-8 grid gap-5 border-t border-line pt-8 sm:grid-cols-2">
        <Field label="Client name" error={errors.name}>
          <input className={fieldClass} aria-invalid={!!errors.name} value={draft.name} onChange={set("name")} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" className={fieldClass} aria-invalid={!!errors.email} value={draft.email} onChange={set("email")} />
        </Field>
        <Field label="Amount (USD)" error={errors.amount}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy">$</span>
            <input
              inputMode="decimal"
              className={`${input} py-2.5 pl-7 pr-3.5`}
              aria-invalid={!!errors.amount}
              value={draft.amount}
              onChange={set("amount")}
            />
          </div>
        </Field>
        <Field label="Due date" error={errors.dueDate}>
          <input type="date" className={fieldClass} aria-invalid={!!errors.dueDate} value={draft.dueDate} onChange={set("dueDate")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" error={errors.description}>
            <input className={fieldClass} aria-invalid={!!errors.description} value={draft.description} onChange={set("description")} />
          </Field>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-6">
        <button type="button" onClick={onBack} disabled={sending} className={`${btnText} px-1 text-sm`}>
          Edit sentence
        </button>
        <button type="submit" disabled={!valid || sending} className={`${btnPrimary} px-5 py-3`}>
          {sending ? (
            "Sending…"
          ) : (
            <>
              Send invoice
              <Send />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

const fieldClass = `${input} px-3.5 py-2.5`;

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink-muted">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-danger">{error}</span>}
    </label>
  );
}
