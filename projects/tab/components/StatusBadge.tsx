import { type DashboardStatus, STATUS_LABEL } from "@/lib/invoiceStatus";

const STYLES: Record<DashboardStatus, string> = {
  overdue: "bg-status-overdue-bg text-status-overdue-fg",
  sent: "bg-status-sent-bg text-status-sent-fg",
  draft: "bg-status-draft-bg text-status-draft-fg",
  paid: "bg-status-paid-bg text-status-paid-fg",
  void: "bg-transparent text-status-void-fg ring-1 ring-inset ring-line-strong",
};

export default function StatusBadge({ status }: { status: DashboardStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
