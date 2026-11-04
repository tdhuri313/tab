"use client";

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

  const set = (field: keyof InvoiceDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...draft, [field]: e.target.value });

  return (
    <form
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !sending) onConfirm();
      }}
    >
      <h2 className="mb-4 text-sm font-medium text-zinc-500">Check the details</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" error={errors.name}>
          <input className={inputClass(errors.name)} value={draft.name} onChange={set("name")} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" className={inputClass(errors.email)} value={draft.email} onChange={set("email")} />
        </Field>
        <Field label="Amount (USD)" error={errors.amount}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
            <input
              inputMode="decimal"
              className={`${inputClass(errors.amount)} pl-7`}
              value={draft.amount}
              onChange={set("amount")}
            />
          </div>
        </Field>
        <Field label="Due date" error={errors.dueDate}>
          <input type="date" className={inputClass(errors.dueDate)} value={draft.dueDate} onChange={set("dueDate")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" error={errors.description}>
            <input className={inputClass(errors.description)} value={draft.description} onChange={set("description")} />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <button type="button" onClick={onBack} disabled={sending} className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50">
          Edit text
        </button>
        <button
          type="submit"
          disabled={!valid || sending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "Sending…" : "Send invoice"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function inputClass(error?: string) {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10 ${
    error ? "border-red-300 bg-red-50/40" : "border-zinc-300"
  }`;
}
