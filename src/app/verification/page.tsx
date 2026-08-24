"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch, ClientApiError } from "@/lib/apiClient";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { Button } from "@/components/Button";
import { PRODUCE_LABELS, formatKg, formatRwf } from "@/types";
import type { DeliveryListItem } from "@/types";

interface DeliveriesResponse {
  deliveries: DeliveryListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function RejectDialog({
  deliveryId,
  onDone,
  onCancel,
}: {
  deliveryId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!comment.trim()) {
      setError("A comment is required when rejecting a delivery.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/deliveries/${deliveryId}/reject`, {
        method: "POST",
        body: JSON.stringify({ comment }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not reject this delivery.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-lg bg-white p-4 sm:rounded-lg">
        <h3 className="font-semibold">Reject delivery</h3>
        <label htmlFor="reject-comment" className="mb-1 mt-3 block text-sm font-medium">
          Reason (required)
        </label>
        <textarea
          id="reject-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-line p-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-status-rejected">
            {error}
          </p>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={submitting}>
            {submitting ? "Rejecting…" : "Reject delivery"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function VerificationQueueInner() {
  const [data, setData] = useState<DeliveriesResponse | null>(null);
  const [payableData, setPayableData] = useState<DeliveriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [recorded, verified] = await Promise.all([
        apiFetch<DeliveriesResponse>("/api/deliveries?status=RECORDED&pageSize=50"),
        apiFetch<DeliveriesResponse>("/api/deliveries?status=VERIFIED&pageSize=50"),
      ]);
      setData(recorded);
      setPayableData(verified);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not load the verification queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/deliveries/${id}/verify`, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (err) {
      setActionError(
        err instanceof ClientApiError ? err.message : "Could not verify this delivery."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function pay(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/deliveries/${id}/pay`, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (err) {
      setActionError(
        err instanceof ClientApiError ? err.message : "Could not release payment for this delivery."
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-primary-700">Verification queue</h1>

      {actionError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-rejected">
          {actionError}
        </p>
      )}

      {data && data.deliveries.length === 0 && (
        <EmptyState title="Nothing waiting for verification" hint="New deliveries will appear here." />
      )}

      <div className="flex flex-col gap-3">
        {data?.deliveries.map((d) => (
          <div key={d.id} className="rounded-lg border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link href={`/deliveries/${d.id}`} className="font-semibold text-primary-700 hover:underline">
                  {d.farmer.name}
                </Link>
                <p className="text-sm text-ink/60">
                  {d.farmer.membershipNumber} · {d.centre.name}
                </p>
                <p className="mt-1 text-sm">
                  {PRODUCE_LABELS[d.produceType]} · Grade {d.grade} ·{" "}
                  <span className="ticket-figure">{formatKg(d.netWeightKg)}</span>
                </p>
                <p className="ticket-figure text-base font-bold text-primary-700">
                  {formatRwf(d.amountRwf)}
                </p>
                <p className="text-xs text-ink/50">Recorded by {d.recordedBy.name}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  disabled={busyId === d.id}
                  onClick={() => approve(d.id)}
                >
                  {busyId === d.id ? "Approving…" : "Approve"}
                </Button>
                <Button
                  variant="danger"
                  disabled={busyId === d.id}
                  onClick={() => setRejectingId(d.id)}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rejectingId && (
        <RejectDialog
          deliveryId={rejectingId}
          onCancel={() => setRejectingId(null)}
          onDone={() => {
            setRejectingId(null);
            load();
          }}
        />
      )}

      <section className="mt-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
          Verified — awaiting payment
        </h2>
        {payableData && payableData.deliveries.length === 0 && (
          <EmptyState title="Nothing waiting for payment" />
        )}
        <div className="flex flex-col gap-3">
          {payableData?.deliveries.map((d) => (
            <div key={d.id} className="rounded-lg border border-line bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/deliveries/${d.id}`} className="font-semibold text-primary-700 hover:underline">
                    {d.farmer.name}
                  </Link>
                  <p className="text-sm text-ink/60">
                    {d.farmer.membershipNumber} · {d.centre.name}
                  </p>
                  <p className="ticket-figure text-base font-bold text-primary-700">
                    {formatRwf(d.amountRwf)}
                  </p>
                </div>
                <Button variant="primary" disabled={busyId === d.id} onClick={() => pay(d.id)}>
                  {busyId === d.id ? "Releasing…" : "Release payment"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function VerificationQueuePage() {
  return (
    <RequireAuth allow={["MANAGER", "ADMIN"]}>
      <VerificationQueueInner />
    </RequireAuth>
  );
}
