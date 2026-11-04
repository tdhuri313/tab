import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import StatusBadge from "@/components/StatusBadge";
import { listInvoices } from "@/lib/invoices";
import type { DashboardInvoice } from "@/lib/invoiceStatus";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * GET /invoices — every invoice in Stripe, most urgent first.
 *
 * With cacheComponents on, the static parts (header) are prerendered and the
 * Stripe data streams in at request time inside <Suspense>. Nothing is
 * cached, so a just-sent invoice shows up on the very next load.
 */
export default function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-zinc-500">Most urgent first.</p>
        </div>
        <Link href="/" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
          New invoice
        </Link>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <InvoiceTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function InvoiceTable({ searchParams }: { searchParams: SearchParams }) {
  // Tell Next this must run per request (we read the clock to decide "overdue").
  await connection();
  const { sent } = await searchParams;
  const sentId = typeof sent === "string" ? sent : undefined;

  let invoices: DashboardInvoice[];
  try {
    invoices = await listInvoices();
  } catch (err) {
    console.error("Failed to list invoices:", err);
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        Couldn&apos;t load invoices from Stripe. Try refreshing.
      </p>
    );
  }

  const justSent = sentId ? invoices.find((i) => i.id === sentId) : undefined;

  return (
    <div className="space-y-4">
      {justSent && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Invoice {justSent.number ?? ""} sent to {justSent.clientName}.
        </p>
      )}

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          No invoices yet.{" "}
          <Link href="/" className="font-medium text-zinc-900 underline underline-offset-2">
            Send your first one
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs font-medium text-zinc-500">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="hidden px-4 py-3 sm:table-cell">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {invoices.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} highlight={inv.id === sentId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InvoiceRow({ invoice: inv, highlight }: { invoice: DashboardInvoice; highlight: boolean }) {
  const muted = inv.status === "void";
  return (
    <tr className={`${highlight ? "bg-emerald-50/60" : ""} ${muted ? "text-zinc-400" : ""}`}>
      <td className="px-4 py-3">
        {/* Link to Stripe's hosted page (drafts don't have one yet). */}
        {inv.hostedUrl ? (
          <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
            {inv.clientName}
          </a>
        ) : (
          <span className="font-medium">{inv.clientName}</span>
        )}
        {inv.number && <div className="text-xs text-zinc-400">{inv.number}</div>}
        {/* On phones the description column is hidden, so show it here instead. */}
        <div className="text-xs text-zinc-500 sm:hidden">{inv.description}</div>
      </td>
      <td className="hidden max-w-xs truncate px-4 py-3 sm:table-cell">{inv.description}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatMoney(inv.amountCents, inv.currency)}</td>
      <td className="whitespace-nowrap px-4 py-3">{inv.dueDate ? formatDueDate(inv.dueDate) : "—"}</td>
      <td className="px-4 py-3">
        <StatusBadge status={inv.status} />
      </td>
    </tr>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="Loading invoices">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-zinc-100" />
      ))}
    </div>
  );
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/**
 * The API route stores "due Friday" as Friday 23:59:59 *UTC*. Formatting in
 * UTC shows Friday for everyone; formatting in local time would show Saturday
 * for anyone east of UTC.
 */
function formatDueDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
