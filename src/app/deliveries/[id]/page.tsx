"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch, ClientApiError } from "@/lib/apiClient";
import { LoadingState, ErrorState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { PRODUCE_LABELS, STATUS_LABELS, formatKg, formatRwf } from "@/types";
import type { DeliveryStatus, ProduceType, Grade } from "@/types";

interface DeliveryDetail {
  id: string;
  produceType: ProduceType;
  grade: Grade;
  grossWeightKg: string | number;
  tareWeightKg: string | number;
  netWeightKg: string | number;
  pricePerKgRwf: number;
  amountRwf: number;
  status: DeliveryStatus;
  deliveryDate: string;
  farmer: { id: string; name: string; membershipNumber: string };
  centre: { id: string; name: string };
  recordedBy: { id: string; name: string };
  auditEntries: Array<{
    id: string;
    fromStatus: DeliveryStatus | null;
    toStatus: DeliveryStatus;
    comment: string | null;
    createdAt: string;
    performedBy: { name: string };
  }>;
}

function DeliveryDetailInner() {
  const params = useParams<{ id: string }>();
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ delivery: DeliveryDetail }>(`/api/deliveries/${params.id}`);
      setDelivery(data.delivery);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not load this delivery.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!delivery) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-primary-700">
          {PRODUCE_LABELS[delivery.produceType]} · Grade {delivery.grade}
        </h1>
        <StatusBadge status={delivery.status} />
      </div>

      <section className="rounded-lg border border-line bg-white p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink/60">Farmer</dt>
            <dd className="font-medium">{delivery.farmer.name}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Membership no.</dt>
            <dd className="font-medium">{delivery.farmer.membershipNumber}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Centre</dt>
            <dd className="font-medium">{delivery.centre.name}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Gross weight</dt>
            <dd className="ticket-figure font-medium">{formatKg(delivery.grossWeightKg)}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Tare weight</dt>
            <dd className="ticket-figure font-medium">{formatKg(delivery.tareWeightKg)}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Net weight</dt>
            <dd className="ticket-figure font-medium">{formatKg(delivery.netWeightKg)}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Price / kg</dt>
            <dd className="ticket-figure font-medium">{formatRwf(delivery.pricePerKgRwf)}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Amount</dt>
            <dd className="ticket-figure font-bold text-primary-700">{formatRwf(delivery.amountRwf)}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Delivery date</dt>
            <dd className="font-medium">{delivery.deliveryDate.slice(0, 10)}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Recorded by</dt>
            <dd className="font-medium">{delivery.recordedBy.name}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">History</h2>
        <ol className="flex flex-col gap-2">
          {delivery.auditEntries.map((entry) => (
            <li key={entry.id} className="rounded-md border border-line bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {entry.fromStatus ? `${STATUS_LABELS[entry.fromStatus]} → ` : ""}
                  {STATUS_LABELS[entry.toStatus]}
                </span>
                <span className="text-xs text-ink/50">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-ink/60">by {entry.performedBy.name}</p>
              {entry.comment && <p className="mt-1 italic text-ink/70">"{entry.comment}"</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default function DeliveryDetailPage() {
  return (
    <RequireAuth>
      <DeliveryDetailInner />
    </RequireAuth>
  );
}
