"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/authContext";
import { apiFetch, ClientApiError } from "@/lib/apiClient";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { PRODUCE_LABELS, formatKg, formatRwf } from "@/types";
import type { DeliveryListItem, DeliveryStatus, ProduceType, Centre } from "@/types";

interface DeliveriesResponse {
  deliveries: DeliveryListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function DeliveriesListInner() {
  const { user } = useAuth();
  const [status, setStatus] = useState<DeliveryStatus | "">("");
  const [produceType, setProduceType] = useState<ProduceType | "">("");
  const [centreId, setCentreId] = useState("");
  const [page, setPage] = useState(1);

  const [centres, setCentres] = useState<Centre[]>([]);
  const [data, setData] = useState<DeliveriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "CLERK") {
      apiFetch<{ centres: Centre[] }>("/api/centres")
        .then((d) => setCentres(d.centres))
        .catch(() => {});
    }
  }, [user]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (status) params.set("status", status);
      if (produceType) params.set("produceType", produceType);
      if (centreId) params.set("centreId", centreId);
      const result = await apiFetch<DeliveriesResponse>(`/api/deliveries?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not load deliveries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, produceType, centreId, page]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-primary-700">Deliveries</h1>

      <div className="flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as DeliveryStatus | "");
          }}
          className="min-h-[40px] rounded-md border border-line px-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="RECORDED">Recorded</option>
          <option value="VERIFIED">Verified</option>
          <option value="PAID">Paid</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <select
          value={produceType}
          onChange={(e) => {
            setPage(1);
            setProduceType(e.target.value as ProduceType | "");
          }}
          className="min-h-[40px] rounded-md border border-line px-2 text-sm"
          aria-label="Filter by produce"
        >
          <option value="">All produce</option>
          <option value="COFFEE_CHERRIES">Coffee cherries</option>
          <option value="MAIZE">Maize</option>
          <option value="BEANS">Beans</option>
        </select>

        {user?.role !== "CLERK" && (
          <select
            value={centreId}
            onChange={(e) => {
              setPage(1);
              setCentreId(e.target.value);
            }}
            className="min-h-[40px] rounded-md border border-line px-2 text-sm"
            aria-label="Filter by centre"
          >
            <option value="">All centres</option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data && data.deliveries.length === 0 && (
        <EmptyState title="No deliveries match these filters" hint="Try widening your filters." />
      )}

      {!loading && !error && data && data.deliveries.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink/60">
                  <th className="px-3 py-2">Farmer</th>
                  <th className="px-3 py-2">Produce</th>
                  <th className="px-3 py-2 text-right">Net weight</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-3 py-2">
                      <Link href={`/deliveries/${d.id}`} className="font-medium text-primary-700 hover:underline">
                        {d.farmer.name}
                      </Link>
                      <div className="text-xs text-ink/50">{d.farmer.membershipNumber}</div>
                    </td>
                    <td className="px-3 py-2">
                      {PRODUCE_LABELS[d.produceType]} · Grade {d.grade}
                    </td>
                    <td className="ticket-figure px-3 py-2 text-right">{formatKg(d.netWeightKg)}</td>
                    <td className="ticket-figure px-3 py-2 text-right">{formatRwf(d.amountRwf)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-3 py-2 text-ink/60">{d.deliveryDate.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-ink/60">
            <span>
              Page {data.pagination.page} of {Math.max(data.pagination.totalPages, 1)} ·{" "}
              {data.pagination.total} total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="min-h-[36px] rounded-md border border-line px-3 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => (data.pagination.totalPages > p ? p + 1 : p))}
                disabled={page >= data.pagination.totalPages}
                className="min-h-[36px] rounded-md border border-line px-3 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DeliveriesListPage() {
  return (
    <RequireAuth>
      <DeliveriesListInner />
    </RequireAuth>
  );
}
