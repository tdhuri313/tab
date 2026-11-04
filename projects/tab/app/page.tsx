import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowRight, Sparkle } from "@/components/icons";
import SiteHeader from "@/components/SiteHeader";
import { btnPrimary, btnText, eyebrow } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { listInvoices } from "@/lib/invoices";
import { summarize } from "@/lib/invoiceStatus";

/**
 * GET / — the start screen. Everything here is static (prerendered) except
 * the "who owes you" pill, which reads Stripe at request time inside
 * <Suspense> so it never holds up the rest of the page.
 */
export default function StartPage() {
  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden">
      <Blobs />
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pb-16 pt-8 text-center sm:pt-12">
        <p
          className={`${eyebrow} inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-4 py-1.5 text-purple`}
        >
          <Sparkle className="size-3.5" />
          Invoicing, without the paperwork
        </p>

        <h1 className="mt-6 text-5xl leading-[1.05] tracking-tight text-navy sm:text-7xl">Let&apos;s check who owes you.</h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
          Bill a client in one sentence. We&apos;ll send the invoice, track the payment, and help you follow up.
        </p>

        <ExampleSentence />

        <Link href="/new" className={`${btnPrimary} mt-8 px-6 py-3.5`}>
          Send your first invoice
          <ArrowRight />
        </Link>
        <Link href="/invoices" className={`${btnText} mt-5 px-1 text-sm`}>
          See my invoices
        </Link>

        {/* Fixed height so the page doesn't jump when the pill streams in. */}
        <div className="mt-6 h-8">
          <Suspense fallback={null}>
            <OwedPill />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

/** Soft aqua + lavender glow behind the hero. Purely decorative. */
function Blobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -left-24 top-16 size-[36rem] rounded-full bg-aqua/40 blur-[120px] sm:left-[10%]" />
      <div className="absolute -right-24 top-64 size-[34rem] rounded-full bg-lavender/60 blur-[120px] sm:right-[8%]" />
    </div>
  );
}

/**
 * The "this is how you'd type it" illustration from the design. It's an
 * example, not an input, so it isn't focusable; screen readers just hear the
 * sentence.
 */
function ExampleSentence() {
  const chip = "rounded-md bg-lavender/60 px-2 py-0.5 font-semibold";
  return (
    <p className="mt-10 flex w-full max-w-2xl flex-wrap items-center justify-center gap-x-1.5 gap-y-2 rounded-card border border-line bg-white/80 px-6 py-5 text-lg text-navy shadow-card backdrop-blur">
      <span className="sr-only">For example: </span>
      Bill <span className={chip}>Sarah Lee</span> <span className={chip}>$400</span> for{" "}
      <span className={chip}>logo design</span> due <span className={chip}>Friday</span>
      <span aria-hidden className="ml-1 inline-block h-6 w-0.5 bg-purple motion-safe:animate-caret" />
    </p>
  );
}

/** "2 overdue · $650 outstanding", from real Stripe invoices. Hidden if nothing is owed or Stripe fails. */
async function OwedPill() {
  await connection(); // per request, never prerendered

  let summary;
  try {
    const { invoices, now } = await listInvoices();
    summary = summarize(invoices, now);
  } catch (err) {
    console.error("Start page: failed to list invoices:", err);
    return null;
  }

  const { outstanding, overdue, currency } = summary;
  if (outstanding.count === 0) return null;

  return (
    <Link
      href="/invoices"
      className="inline-flex items-center gap-2 rounded-full bg-aqua-soft px-4 py-1.5 text-xs text-navy transition-colors hover:bg-aqua/50"
    >
      {overdue.count > 0 && <span aria-hidden className="size-1.5 rounded-full bg-danger" />}
      <strong className="font-semibold">{overdue.count > 0 ? `${overdue.count} overdue` : `${outstanding.count} open`}</strong>
      <span aria-hidden>·</span>
      {formatMoney(outstanding.cents, currency, { short: true })} outstanding
    </Link>
  );
}
