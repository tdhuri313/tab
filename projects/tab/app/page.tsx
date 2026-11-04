"use client";

import { useState } from "react";
import PreviewCard from "@/components/PreviewCard";
import { type InvoiceDraft, parseInvoice } from "@/lib/parseInvoice";

// The page is a small state machine: type → review → (sending) → done.
type Step =
  | { kind: "input" }
  | { kind: "preview"; draft: InvoiceDraft; sending: boolean; error?: string }
  | { kind: "success"; url: string; number: string | null; email: string };

const EXAMPLE = "Bill Sarah Lee sarah@email.com $400 for logo design due Friday";

export default function Home() {
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>({ kind: "input" });

  function handleParse(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setStep({ kind: "preview", draft: parseInvoice(text), sending: false });
  }

  async function handleConfirm(draft: InvoiceDraft) {
    setStep({ kind: "preview", draft, sending: true });
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the invoice.");
      setStep({ kind: "success", url: data.url, number: data.number, email: draft.email });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't send the invoice.";
      setStep({ kind: "preview", draft, sending: false, error: message });
    }
  }

  function startOver() {
    setText("");
    setStep({ kind: "input" });
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Tab</h1>
      <p className="mb-8 mt-1 text-sm text-zinc-500">Describe the invoice in a sentence. We'll do the rest.</p>

      {step.kind === "input" && (
        <form onSubmit={handleParse} className="space-y-3">
          <textarea
            autoFocus
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter submits; Shift+Enter makes a new line.
              if (e.key === "Enter" && !e.shiftKey) handleParse(e);
            }}
            placeholder={EXAMPLE}
            className="w-full resize-none rounded-xl border border-zinc-300 bg-white p-4 text-base outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setText(EXAMPLE)} className="text-xs text-zinc-500 underline-offset-2 hover:underline">
              Use example
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
            >
              Preview
            </button>
          </div>
        </form>
      )}

      {step.kind === "preview" && (
        <div className="space-y-3">
          <PreviewCard
            draft={step.draft}
            sending={step.sending}
            onChange={(draft) => setStep({ kind: "preview", draft, sending: false })}
            onConfirm={() => handleConfirm(step.draft)}
            onBack={() => setStep({ kind: "input" })}
          />
          {step.error && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {step.error}
            </p>
          )}
        </div>
      )}

      {step.kind === "success" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="font-medium text-emerald-900">
            Invoice {step.number ?? ""} sent to {step.email}
          </p>
          <a href={step.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all text-sm text-emerald-800 underline">
            {step.url}
          </a>
          <div>
            <button onClick={startOver} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-100">
              New invoice
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
