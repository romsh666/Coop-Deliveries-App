import type { DeliveryStatus } from "@/types";
import { STATUS_LABELS } from "@/types";

const STYLES: Record<DeliveryStatus, string> = {
  RECORDED: "bg-line text-ink",
  VERIFIED: "bg-amber-100 text-amber-600",
  PAID: "bg-primary-100 text-primary-700",
  REJECTED: "bg-red-100 text-status-rejected",
};

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
