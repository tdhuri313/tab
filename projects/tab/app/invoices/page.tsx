import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Check, Doc, Plus } from "@/components/icons";
import LiveInvoiceUpdates from "@/components/LiveInvoiceUpdates";
import ReminderPanel from "@/components/ReminderPanel";
import RowMenu from "@/components/RowMenu";
import SiteHeader from "@/components/SiteHeader";
import StatusBadge from "@/components/StatusBadge";
import StatusFilter, { type StatusFilterValue } from "@/components/StatusFilter";
import { btnPrimary, card, eyebrow } from "@/components/ui";
import { formatMoney, formatTimeAgo } from "@/lib/format";
import { listInvoices } from "@/lib/invoices";
import { type DashboardInvoice, type InvoiceSummary, STATUS_LABEL, summarize } from "@/lib/invoiceStatus";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const FILTERS: StatusFilterValue[] = ["all", "overdue", "sent", "draft", "paid", "void"];

/**
 * GET /invoices — every invoice in Stripe, most urgent first.
 *
 * With cacheComponents on, the static parts (header) are prerendered and the
 * Stripe data streams in at request time inside <Suspense>. Nothing is
 * cached, so a just-sent invoice shows up on the very next load.
 */
export default function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <SiteHeader bordered />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={`${eyebrow} text-ink-muted`}>Your workspace</p>
            <h1 className="mt-1 text-4xl tracking-tight">Invoices</h1>
          </div>
          <Link href="/new" className={`${btnPrimary} px-5 py-3`}>
            <Plus />
            New invoice
          </Link>
        </div>

        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard searchParams={searchParams} />
        </Suspense>

        {/* Polls for webhook events; refreshes the table and shows toasts. */}
        <LiveInvoiceUpdates />
      </main>
    </>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  // Tell Next this must run per request (we read the clock to decide "overdue").
  await connection();
  const { sent, status } = await searchParams;
  const sentId = typeof sent === "string" ? sent : undefined;
  const filter = FILTERS.find((f) => f === status) ?? "all";

  let invoices: DashboardInvoice[];
  let now: number;
  try {
    ({ invoices, now } = await listInvoices());
  } catch (err) {
    console.error("Failed to list invoices:", err);
    return (
      <p role="alert" className="rounded-control bg-danger-soft px-4 py-3 text-sm text-danger">
        Couldn&apos;t load invoices from Stripe. Try refreshing.
      </p>
    );
  }

  if (invoices.length === 0) return <EmptyState />;

  const justSent = sentId ? invoices.find((i) => i.id === sentId) : undefined;
  const shown = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f, f === "all" ? invoices.length : invoices.filter((i) => i.status === f).length]),
  ) as Record<StatusFilterValue, number>;

  return (
    <div className="space-y-5">
      {justSent && <SentBanner clientName={justSent.clientName} />}

      {/* Stats always cover every invoice, whatever the filter. */}
      <StatCards summary={summarize(invoices, now)} />

      <section aria-labelledby="invoice-table-title" className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <h2 id="invoice-table-title" className="text-lg font-semibold">
            {filter === "all" ? "All invoices" : `${STATUS_LABEL[filter]} invoices`}
          </h2>
          <StatusFilter key={filter} value={filter} counts={counts} sent={sentId} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={`${eyebrow} border-y border-line bg-canvas text-ink-muted`}>
              <tr>
                <th className="px-5 py-3 font-semibold sm:px-6">Client</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">Description</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Reminders</span>
                </th>
                <th className="py-3 pr-4">
                  <span className="sr-only">More actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} highlight={inv.id === sentId} now={now} />
              ))}
            </tbody>
          </table>
        </div>

        {shown.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-ink-muted">
            No {STATUS_LABEL[filter as Exclude<StatusFilterValue, "all">].toLowerCase()} invoices right now.
          </p>
        )}
      </section>
    </div>
  );
}

function SentBanner({ clientName }: { clientName: string }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-card border border-aqua bg-aqua-soft px-5 py-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-purple text-white">
        <Check />
      </span>
      <div>
        <p className="font-semibold text-navy">Invoice sent to {clientName}</p>
        <p className="text-sm text-ink-muted">We&apos;ll let you know when it&apos;s paid.</p>
      </div>
    </div>
  );
}

function StatCards({ summary: s }: { summary: InvoiceSummary }) {
  const money = (cents: number) => formatMoney(cents, s.currency, { short: true });
  const invoicesNote = (n: number) => `${n} ${n === 1 ? "invoice" : "invoices"}`;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard dot="bg-purple" label="Outstanding" value={money(s.outstanding.cents)}>
        <span className="text-ink-muted">{invoicesNote(s.outstanding.count)}</span>
      </StatCard>
      <StatCard dot="bg-danger" label="Overdue" value={money(s.overdue.cents)}>
        {s.overdue.count > 0 ? (
          <span className="text-danger">
            {s.overdue.count} {s.overdue.count === 1 ? "needs" : "need"} attention
          </span>
        ) : (
          <span className="text-ink-muted">All caught up</span>
        )}
      </StatCard>
      <StatCard dot="bg-navy" label="Paid this month" value={money(s.paidThisMonth.cents)}>
        <span className="text-ink-muted">{invoicesNote(s.paidThisMonth.count)}</span>
      </StatCard>
    </div>
  );
}

function StatCard({ dot, label, value, children }: { dot: string; label: string; value: string; children: React.ReactNode }) {
  return (
    <div className={`${card} px-5 py-4`}>
      <p className="flex items-center gap-2 text-sm font-medium text-ink-muted">
        <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-2 text-xs">{children}</p>
    </div>
  );
}

function InvoiceRow({ invoice: inv, highlight, now }: { invoice: DashboardInvoice; highlight: boolean; now: number }) {
  const muted = inv.status === "void";
  return (
    <tr className={highlight ? "bg-aqua-soft" : "transition-colors hover:bg-canvas"}>
      <td className="px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          <Avatar name={inv.clientName} />
          <div className="min-w-0">
            <div className={`font-semibold ${muted ? "text-ink-muted" : ""}`}>{inv.clientName}</div>
            {inv.number && <div className="text-xs text-ink-muted">{inv.number}</div>}
            {/* On phones the description column is hidden, so show it here instead. */}
            <div className="text-xs text-ink-muted sm:hidden">{inv.description}</div>
          </div>
        </div>
      </td>
      <td className="hidden max-w-xs truncate px-4 py-3.5 text-ink-muted sm:table-cell">{inv.description}</td>
      <td className={`whitespace-nowrap px-4 py-3.5 font-semibold tabular-nums ${muted ? "text-ink-muted" : ""}`}>
        {formatMoney(inv.amountCents, inv.currency, { short: true })}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-ink-muted">{inv.dueDate ? formatDueDate(inv.dueDate, now) : "—"}</td>
      <td className="px-4 py-3.5">
        <StatusBadge status={inv.status} />
      </td>
      <td className="px-4 py-3.5">
        {inv.status === "overdue" && inv.dueDate !== null && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ReminderPanel
              invoiceId={inv.id}
              invoiceNumber={inv.number}
              clientName={inv.clientName}
              amountCents={inv.amountCents}
              currency={inv.currency}
              description={inv.description}
              dueDate={inv.dueDate}
            />
            {inv.lastReminderAt !== null && (
              <span className="whitespace-nowrap text-xs text-ink-muted">Reminded {formatTimeAgo(inv.lastReminderAt, now)}</span>
            )}
          </div>
        )}
      </td>
      <td className="py-3.5 pr-4 text-right">
        <RowMenu invoiceId={inv.id} clientName={inv.clientName} hostedUrl={inv.hostedUrl} pdfUrl={inv.pdfUrl} />
      </td>
    </tr>
  );
}

/** Initials tile. The color comes from the name, so a client keeps the same one across loads. */
function Avatar({ name }: { name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => [...word][0] ?? "")
      .join("")
      .toUpperCase() || "?";
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const tone = hash % 2 === 0 ? "bg-aqua/45" : "bg-lavender/70";

  return (
    <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-control text-xs font-bold text-navy ${tone}`}>
      {initials}
    </span>
  );
}

function EmptyState() {
  return (
    <section className={`${card} flex flex-col items-center px-6 py-16 text-center`}>
      <span className="grid size-14 place-items-center rounded-card bg-lavender-soft text-purple">
        <Doc className="size-6" />
      </span>
      <h2 className="mt-5 text-2xl tracking-tight">No invoices yet</h2>
      <p className="mt-2 max-w-sm text-ink-muted">Bill your first client in one sentence. We&apos;ll handle the rest.</p>
      <Link href="/new" className={`${btnPrimary} mt-6 px-5 py-3`}>
        <Plus />
        New invoice
      </Link>
      <p className="mt-6 rounded-control bg-canvas px-4 py-2 text-xs text-ink-muted">
        Try: &ldquo;Bill Sarah Lee sarah@email.com $400 for logo design due Friday&rdquo;
      </p>
    </section>
  );
}

function DashboardSkeleton() {
  const block = "rounded-lg bg-lavender-soft motion-safe:animate-pulse";
  return (
    <div className="space-y-5" aria-label="Loading invoices">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={`${card} h-[7.5rem] p-5`}>
            <div className={`${block} h-4 w-24`} />
            <div className={`${block} mt-3 h-8 w-32`} />
          </div>
        ))}
      </div>
      <div className={`${card} space-y-3 p-5`}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${block} h-10`} />
        ))}
      </div>
    </div>
  );
}

/**
 * The API route stores "due Friday" as Friday 23:59:59 *UTC*. Formatting in
 * UTC shows Friday for everyone; formatting in local time would show Saturday
 * for anyone east of UTC. The year only appears when it isn't this year.
 */
function formatDueDate(unixSeconds: number, nowSeconds: number) {
  const due = new Date(unixSeconds * 1000);
  const sameYear = due.getUTCFullYear() === new Date(nowSeconds * 1000).getUTCFullYear();
  return due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
