import type { DashboardStatus } from "@/lib/invoiceStatus";

const STYLES: Record<DashboardStatus, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "bg-red-50 text-red-700 ring-red-600/20" },
  sent: { label: "Sent", className: "bg-blue-50 text-blue-700 ring-blue-600/20" },
  draft: { label: "Draft", className: "bg-zinc-100 text-zinc-700 ring-zinc-500/20" },
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  void: { label: "Void", className: "bg-transparent text-zinc-400 ring-zinc-300" },
};

export default function StatusBadge({ status }: { status: DashboardStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {label}
    </span>
  );
}
