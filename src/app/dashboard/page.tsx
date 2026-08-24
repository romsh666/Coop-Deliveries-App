"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch, ClientApiError } from "@/lib/apiClient";
import { LoadingState, ErrorState } from "@/components/States";
import { PRODUCE_LABELS, formatKg, formatRwf } from "@/types";
import type { Centre, ProduceType } from "@/types";

interface StockResponse {
  centre: { id: string; name: string; location: string };
  stockByProduce: Array<{ produceType: ProduceType; quantityKg: string | number; capacityKg: number }>;
  todaysIntakeKg: string | number;
  todaysDeliveryCount: number;
  weeksValueCollectedRwf: number;
}

function CentreDashboardInner() {
  const [centres, setCentres] = useState<Centre[]>([]);
  const [selectedCentreId, setSelectedCentreId] = useState("");
  const [stock, setStock] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ centres: Centre[] }>("/api/centres")
      .then((d) => {
        setCentres(d.centres);
        if (d.centres.length > 0) setSelectedCentreId(d.centres[0]!.id);
      })
      .catch((err) => setError(err instanceof ClientApiError ? err.message : "Could not load centres."));
  }, []);

  async function loadStock(centreId: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<StockResponse>(`/api/centres/${centreId}/stock`);
      setStock(data);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not load stock levels.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedCentreId) loadStock(selectedCentreId);
  }, [selectedCentreId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-primary-700">Centre dashboard</h1>
        <select
          value={selectedCentreId}
          onChange={(e) => setSelectedCentreId(e.target.value)}
          className="min-h-[40px] rounded-md border border-line px-2 text-sm"
          aria-label="Select centre"
        >
          {centres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={() => loadStock(selectedCentreId)} />}

      {!loading && !error && stock && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-white p-4">
              <p className="text-sm text-ink/60">Today's intake</p>
              <p className="ticket-figure text-2xl font-bold text-primary-700">
                {formatKg(stock.todaysIntakeKg)}
              </p>
              <p className="text-xs text-ink/50">{stock.todaysDeliveryCount} deliveries today</p>
            </div>
            <div className="rounded-lg border border-line bg-white p-4">
              <p className="text-sm text-ink/60">Value collected this week</p>
              <p className="ticket-figure text-2xl font-bold text-primary-700">
                {formatRwf(stock.weeksValueCollectedRwf)}
              </p>
              <p className="text-xs text-ink/50">Verified &amp; paid deliveries</p>
            </div>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
              Stock vs. capacity
            </h2>
            <div className="flex flex-col gap-3">
              {stock.stockByProduce.map((s) => {
                const qty = typeof s.quantityKg === "string" ? Number(s.quantityKg) : s.quantityKg;
                const pct = Math.min(100, (qty / s.capacityKg) * 100);
                const nearFull = pct >= 90;
                return (
                  <div key={s.produceType} className="rounded-lg border border-line bg-white p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{PRODUCE_LABELS[s.produceType]}</span>
                      <span className="ticket-figure text-ink/60">
                        {formatKg(qty)} / {formatKg(s.capacityKg)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full ${nearFull ? "bg-status-rejected" : "bg-primary-600"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {nearFull && (
                      <p className="mt-1 text-xs font-medium text-status-rejected">
                        Nearing capacity — plan collection or transfer soon.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function CentreDashboardPage() {
  return (
    <RequireAuth allow={["MANAGER", "ADMIN"]}>
      <CentreDashboardInner />
    </RequireAuth>
  );
}
