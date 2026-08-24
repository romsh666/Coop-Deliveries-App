"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/authContext";
import { apiFetch, ClientApiError } from "@/lib/apiClient";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { Button } from "@/components/Button";
import type { Farmer } from "@/types";

function RegisterFarmerForm({ onRegistered }: { onRegistered: () => void }) {
  const [membershipNumber, setMembershipNumber] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/farmers", {
        method: "POST",
        body: JSON.stringify({ membershipNumber, name, phone: phone || null }),
      });
      setMembershipNumber("");
      setName("");
      setPhone("");
      setOpen(false);
      onRegistered();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not register this farmer.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Register a farmer
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">
        Register a new farmer
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="reg-membership" className="mb-1 block text-sm font-medium">
            Membership number
          </label>
          <input
            id="reg-membership"
            required
            value={membershipNumber}
            onChange={(e) => setMembershipNumber(e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-line px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
          />
        </div>
        <div>
          <label htmlFor="reg-name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id="reg-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-line px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
          />
        </div>
        <div>
          <label htmlFor="reg-phone" className="mb-1 block text-sm font-medium">
            Phone (optional)
          </label>
          <input
            id="reg-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-line px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-status-rejected">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Registering…" : "Register farmer"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FarmersListInner() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const data = await apiFetch<{ farmers: Farmer[] }>(`/api/farmers${params}`);
      setFarmers(data.farmers);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not load farmers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-primary-700">Farmers</h1>
        {user?.role === "ADMIN" && <RegisterFarmerForm onRegistered={load} />}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or membership number"
        className="min-h-[44px] w-full max-w-sm rounded-md border border-line px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
        aria-label="Search farmers"
      />

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && farmers.length === 0 && (
        <EmptyState title="No farmers found" hint="Try a different search term." />
      )}

      {!loading && !error && farmers.length > 0 && (
        <div className="flex flex-col gap-2">
          {farmers.map((f) => (
            <Link
              key={f.id}
              href={`/farmers/${f.id}`}
              className="flex items-center justify-between rounded-lg border border-line bg-white p-3 hover:border-primary-400"
            >
              <div>
                <p className="font-medium">{f.name}</p>
                <p className="text-sm text-ink/60">{f.membershipNumber}</p>
              </div>
              {f.membershipStatus === "SUSPENDED" && (
                <span className="rounded-sm bg-red-100 px-2 py-0.5 text-xs font-semibold uppercase text-status-rejected">
                  Suspended
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FarmersListPage() {
  return (
    <RequireAuth>
      <FarmersListInner />
    </RequireAuth>
  );
}
