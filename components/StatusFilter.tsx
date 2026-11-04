"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "@/components/icons";
import { type DashboardStatus, STATUS_LABEL } from "@/lib/invoiceStatus";

export type StatusFilterValue = DashboardStatus | "all";

const ORDER: DashboardStatus[] = ["overdue", "sent", "draft", "paid", "void"];

type Props = {
  value: StatusFilterValue;
  counts: Record<StatusFilterValue, number>;
  /** Kept in the URL so the "Invoice sent" banner survives filtering. */
  sent?: string;
};

/**
 * "All statuses" dropdown. It only changes the URL (?status=overdue); the
 * server page does the filtering, so a filtered view can be shared or reloaded.
 */
export default function StatusFilter({ value, counts, sent }: Props) {
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams();
    if (e.target.value !== "all") params.set("status", e.target.value);
    if (sent) params.set("sent", sent);
    const qs = params.toString();
    router.replace(qs ? `/invoices?${qs}` : "/invoices", { scroll: false });
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Filter by status</span>
      {/* Uncontrolled so the new choice shows right away while the server re-renders. */}
      <select
        defaultValue={value}
        onChange={onChange}
        className="cursor-pointer appearance-none rounded-control border border-line-strong bg-white py-2 pl-3.5 pr-9 text-sm font-medium text-navy transition-colors hover:bg-lavender-soft"
      >
        <option value="all">All statuses ({counts.all})</option>
        {ORDER.filter((s) => counts[s] > 0 || s === value).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]} ({counts[s]})
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-ink-muted" />
    </label>
  );
}
