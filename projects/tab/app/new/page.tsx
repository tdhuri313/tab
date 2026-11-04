"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Doc, Sparkle } from "@/components/icons";
import PreviewCard from "@/components/PreviewCard";
import SiteHeader from "@/components/SiteHeader";
import { btnPrimary, btnText, card, eyebrow, input } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { type InvoiceDraft, parseInvoice, toCents } from "@/lib/parseInvoice";

// The page is a small state machine: type → review → (sending). Once it's sent
// we navigate to the dashboard, which shows the confirmation.
type Step =
  | { kind: "input" }
  | { kind: "preview"; draft: InvoiceDraft; sending: boolean; error?: string };

const EXAMPLE = "Bill Sarah Lee sarah@email.com $400 for logo design due Friday";

// With cacheComponents on, Next doesn't unmount this page when you leave it:
// it hides it in a React <Activity>, so useState survives the round trip.
// Keying the composer on bfcacheId gives us the reset rules we want:
//   - Link / router.push to "/new" (e.g. "New invoice") → new id → fresh composer
//   - browser Back/Forward → same id → the draft is restored
export default function NewInvoicePage() {
  const { bfcacheId } = useRouter();

  return (
    <>
      <SiteHeader bordered>
        <Link href="/invoices" className={`${btnText} px-1 text-sm`}>
          Invoices
          <ArrowRight />
        </Link>
      </SiteHeader>

      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <Composer key={bfcacheId} />
        <p className="mt-6 text-center text-sm text-ink-muted">No templates. No accounting jargon. Just get paid.</p>
      </main>
    </>
  );
}

function Composer() {
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>({ kind: "input" });
  const router = useRouter();

  // Set once an invoice is sent. When Activity hides the page (we're
  // navigating to the dashboard), the layout-effect cleanup runs and clears
  // the composer, so pressing Back doesn't show a sent invoice stuck on
  // "Sending…". Resetting here rather than before router.push keeps the
  // button in its "Sending…" state until the dashboard actually appears.
  const sent = useRef(false);
  useLayoutEffect(() => {
    return () => {
      if (sent.current) {
        sent.current = false;
        setText("");
        setStep({ kind: "input" });
      }
    };
  }, []);

  // Live parse for the "Recognized" chips. Same parser as the Preview step,
  // so the chips show exactly what the preview will be pre-filled with.
  const recognized = useMemo(() => (text.trim() ? parseInvoice(text) : null), [text]);

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
      sent.current = true;
      // Keep the button in its "Sending…" state while the dashboard loads.
      // ?sent= lets the dashboard highlight the new row.
      router.push(`/invoices?sent=${encodeURIComponent(data.id)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't send the invoice.";
      setStep({ kind: "preview", draft, sending: false, error: message });
    }
  }

  return (
    <>
      {step.kind === "input" && (
        <form onSubmit={handleParse} className={`${card} p-6 sm:p-10`}>
          <p className={`${eyebrow} flex items-center gap-2.5 text-purple`}>
            <span className="grid size-7 place-items-center rounded-lg bg-lavender-soft">
              <Doc />
            </span>
            New invoice
          </p>
          <h1 id="compose-title" className="mt-5 text-3xl tracking-tight sm:text-[2rem]">
            Who are you billing?
          </h1>
          <p id="compose-hint" className="mt-3 text-ink-muted">
            Tell us like you&apos;d tell a friend. We&apos;ll take care of the form.
          </p>

          <textarea
            autoFocus
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter submits; Shift+Enter makes a new line.
              if (e.key === "Enter" && !e.shiftKey) handleParse(e);
            }}
            placeholder={EXAMPLE}
            aria-labelledby="compose-title"
            aria-describedby="compose-hint"
            className={`${input} mt-7 resize-none px-5 py-4 text-lg leading-relaxed`}
          />

          <RecognizedChips draft={recognized} />

          <div className="mt-7 flex items-center justify-between gap-4">
            <button type="button" onClick={() => setText(EXAMPLE)} className={`${btnText} px-1 text-sm`}>
              <Sparkle />
              Use example
            </button>
            <button type="submit" disabled={!text.trim()} className={`${btnPrimary} px-5 py-3`}>
              Preview invoice
              <ArrowRight />
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
            <p role="alert" className="rounded-control bg-danger-soft px-4 py-3 text-sm text-danger">
              {step.error}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** The chips under the textarea: whatever the parser has found so far. */
function RecognizedChips({ draft }: { draft: InvoiceDraft | null }) {
  const items: [label: string, value: string][] = draft
    ? [
        ["Client", draft.name],
        ["Email", draft.email],
        ["Amount", draft.amount && formatMoney(toCents(draft.amount), "usd", { short: true })],
        ["Due", draft.dueDate && formatChipDate(draft.dueDate)],
        ["For", draft.description],
      ]
    : [];
  const found = items.filter(([, value]) => value);

  return (
    <div className="mt-4 flex min-h-7 flex-wrap items-center gap-2 text-xs">
      <span className={`${eyebrow} mr-1 flex items-center gap-1.5 text-ink-muted`}>
        <Sparkle className="size-3.5" />
        Recognized
      </span>
      {found.length === 0 ? (
        <span className="text-ink-muted">Nothing yet. Try a name, an email, an amount, and a date.</span>
      ) : (
        found.map(([label, value]) => (
          <span key={label} className="inline-flex items-center gap-1.5 rounded-md bg-lavender-soft px-2 py-1">
            <span className="text-ink-muted">{label}</span>
            <span className="max-w-[14rem] truncate font-semibold text-purple">{value}</span>
          </span>
        ))
      )}
    </div>
  );
}

/** "2026-11-06" → "Fri, Nov 6" (local calendar day, same as the date input). */
function formatChipDate(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
