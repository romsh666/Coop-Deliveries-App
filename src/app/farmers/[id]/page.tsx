"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/authContext";
import { apiFetch, ClientApiError } from "@/lib/apiClient";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { PRODUCE_LABELS, formatKg, formatRwf } from "@/types";
import type { Farmer, DeliveryStatus, ProduceType, Grade } from "@/types";

interface FarmerProfileResponse {
  farmer: Farmer & {
    deliveries: Array<{
      id: string;
      produceType: ProduceType;
      grade: Grade;
      netWeightKg: string | number;
      amountRwf: number;
      status: DeliveryStatus;
      deliveryDate: string;
      centre: { name: string };
    }>;
  };
  totalEarningsRwf: number;
}

function FarmerProfileInner() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<FarmerProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [membershipActionError, setMembershipActionError] = useState<string | null>(null);
  const [updatingMembership, setUpdatingMembership] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<FarmerProfileResponse>(`/api/farmers/${params.id}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not load this farmer.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function toggleMembership() {
    if (!data) return;
    const nextStatus = data.farmer.membershipStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setUpdatingMembership(true);
    setMembershipActionError(null);
    try {
      await apiFetch(`/api/farmers/${params.id}/membership`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await load();
    } catch (err) {
      setMembershipActionError(
        err instanceof ClientApiError ? err.message : "Could not update membership status."
      );
    } finally {
      setUpdatingMembership(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const { farmer, totalEarningsRwf } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-primary-700">{farmer.name}</h1>
          <p className="text-sm text-ink/60">{farmer.membershipNumber}</p>
          {farmer.phone && <p className="text-sm text-ink/60">{farmer.phone}</p>}
        </div>
        <div className="flex items-center gap-2">
          {farmer.membershipStatus === "SUSPENDED" ? (
            <span className="rounded-sm bg-red-100 px-2 py-1 text-xs font-semibold uppercase text-status-rejected">
              Suspended
            </span>
          ) : (
            <span className="rounded-sm bg-primary-100 px-2 py-1 text-xs font-semibold uppercase text-primary-700">
              Active
            </span>
          )}
          {user?.role === "ADMIN" && (
            <Button
              variant={farmer.membershipStatus === "ACTIVE" ? "danger" : "primary"}
              disabled={updatingMembership}
              onClick={toggleMembership}
            >
              {updatingMembership
                ? "Updating…"
                : farmer.membershipStatus === "ACTIVE"
                  ? "Suspend membership"
                  : "Reactivate membership"}
            </Button>
          )}
        </div>
      </div>

      {membershipActionError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-rejected">
          {membershipActionError}
        </p>
      )}

      <div className="rounded-lg border border-primary-100 bg-primary-50 p-4">
        <p className="text-sm text-ink/60">Total paid to date</p>
        <p className="ticket-figure text-2xl font-bold text-primary-700">
          {formatRwf(totalEarningsRwf)}
        </p>
      </div>

      {(user?.role === "CLERK" || user?.role === "ADMIN") && farmer.membershipStatus === "ACTIVE" && (
        <Link href="/deliveries/record">
          <Button variant="secondary">Record a new delivery</Button>
        </Link>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
          Delivery history
        </h2>
        {farmer.deliveries.length === 0 && (
          <EmptyState title="No deliveries recorded yet" />
        )}
        <div className="flex flex-col gap-2">
          {farmer.deliveries.map((d) => (
            <Link
              key={d.id}
              href={`/deliveries/${d.id}`}
              className="flex items-center justify-between rounded-lg border border-line bg-white p-3 hover:border-primary-400"
            >
              <div>
                <p className="font-medium">
                  {PRODUCE_LABELS[d.produceType]} · Grade {d.grade}
                </p>
                <p className="text-sm text-ink/60">
                  {d.centre.name} · {d.deliveryDate.slice(0, 10)}
                </p>
              </div>
              <div className="text-right">
                <p className="ticket-figure font-semibold">{formatRwf(d.amountRwf)}</p>
                <p className="ticket-figure text-xs text-ink/50">{formatKg(d.netWeightKg)}</p>
                <StatusBadge status={d.status} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function FarmerProfilePage() {
  return (
    <RequireAuth>
      <FarmerProfileInner />
    </RequireAuth>
  );
}
