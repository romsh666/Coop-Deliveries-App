"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/authContext";
import { apiFetch, ClientApiError } from "@/lib/apiClient";
import { Button } from "@/components/Button";
import { PRODUCE_LABELS, formatKg, formatRwf } from "@/types";
import type { DeliveryQuote, Farmer, ProduceType, Grade } from "@/types";

const PRODUCE_OPTIONS: ProduceType[] = ["COFFEE_CHERRIES", "MAIZE", "BEANS"];
const GRADE_OPTIONS: Grade[] = ["A", "B", "C"];

function RecordDeliveryForm() {
  const { user } = useAuth();

  // Farmer lookup
  const [membershipNumber, setMembershipNumber] = useState("");
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [farmerLookupError, setFarmerLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Delivery fields
  const [produceType, setProduceType] = useState<ProduceType>("MAIZE");
  const [grade, setGrade] = useState<Grade>("A");
  const [grossWeightKg, setGrossWeightKg] = useState("");
  const [tareWeightKg, setTareWeightKg] = useState("");

  // Live quote
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  // Submission
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function lookupFarmer(e: React.FormEvent) {
    e.preventDefault();
    if (!membershipNumber.trim()) return;
    setLookingUp(true);
    setFarmerLookupError(null);
    setFarmer(null);
    try {
      const data = await apiFetch<{ farmer: Farmer }>(
        `/api/farmers?membershipNumber=${encodeURIComponent(membershipNumber.trim())}`
      );
      setFarmer(data.farmer);
    } catch (err) {
      setFarmerLookupError(
        err instanceof ClientApiError ? err.message : "Could not look up this farmer. Try again."
      );
    } finally {
      setLookingUp(false);
    }
  }

  // Live calculation as the clerk types.
  useEffect(() => {
    const gross = Number(grossWeightKg);
    const tare = Number(tareWeightKg);
    if (!grossWeightKg || !tareWeightKg || Number.isNaN(gross) || Number.isNaN(tare)) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoting(true);
      setQuoteError(null);
      try {
        const data = await apiFetch<{ quote: DeliveryQuote }>("/api/deliveries/quote", {
          method: "POST",
          body: JSON.stringify({ produceType, grade, grossWeightKg: gross, tareWeightKg: tare }),
          signal: controller.signal,
        });
        setQuote(data.quote);
      } catch (err) {
        if (err instanceof ClientApiError) {
          setQuote(null);
          setQuoteError(err.message);
        }
      } finally {
        setQuoting(false);
      }
    }, 350); // debounce while typing

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [produceType, grade, grossWeightKg, tareWeightKg]);

  const canSubmit =
    !!farmer &&
    farmer.membershipStatus === "ACTIVE" &&
    !!quote &&
    !submitting &&
    !!user?.centreId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmer || !user?.centreId) return;
    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await apiFetch("/api/deliveries", {
        method: "POST",
        body: JSON.stringify({
          farmerId: farmer.id,
          centreId: user.centreId,
          produceType,
          grade,
          grossWeightKg: Number(grossWeightKg),
          tareWeightKg: Number(tareWeightKg),
        }),
      });
      setSuccessMessage(`Delivery recorded for ${farmer.name}.`);
      // Reset weight fields for the next delivery; keep farmer selected in
      // case the same farmer is delivering multiple lots today.
      setGrossWeightKg("");
      setTareWeightKg("");
      setQuote(null);
    } catch (err) {
      setSubmitError(
        err instanceof ClientApiError ? err.message : "Could not record this delivery. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!user?.centreId) {
    return (
      <div className="rounded-lg border border-status-rejected/30 bg-red-50 p-4 text-status-rejected">
        Your account isn't assigned to a collection centre, so you can't record deliveries. Ask an
        admin to assign you to a centre.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24 sm:pb-6">
      <h1 className="text-lg font-bold text-primary-700">Record a delivery</h1>

      {/* Farmer lookup */}
      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">Farmer</h2>
        <form onSubmit={lookupFarmer} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="membershipNumber" className="sr-only">
            Membership number
          </label>
          <input
            id="membershipNumber"
            value={membershipNumber}
            onChange={(e) => setMembershipNumber(e.target.value)}
            placeholder="Membership number (e.g. MEM-1001)"
            className="min-h-[44px] flex-1 rounded-md border border-line px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
          />
          <Button type="submit" variant="secondary" disabled={lookingUp}>
            {lookingUp ? "Looking up…" : "Look up"}
          </Button>
        </form>

        {farmerLookupError && (
          <p role="alert" className="mt-2 text-sm text-status-rejected">
            {farmerLookupError}
          </p>
        )}

        {farmer && (
          <div
            className={`mt-3 rounded-md border p-3 text-sm ${
              farmer.membershipStatus === "SUSPENDED"
                ? "border-status-rejected/40 bg-red-50"
                : "border-primary-100 bg-primary-50"
            }`}
          >
            <p className="font-semibold">{farmer.name}</p>
            <p className="text-ink/60">{farmer.membershipNumber}</p>
            {farmer.membershipStatus === "SUSPENDED" && (
              <p className="mt-1 font-medium text-status-rejected">
                This membership is suspended — deliveries cannot be recorded for this farmer.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Delivery details */}
      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">
          Delivery details
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="produceType" className="mb-1 block text-sm font-medium">
                Produce
              </label>
              <select
                id="produceType"
                value={produceType}
                onChange={(e) => setProduceType(e.target.value as ProduceType)}
                className="min-h-[44px] w-full rounded-md border border-line px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
              >
                {PRODUCE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {PRODUCE_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="grade" className="mb-1 block text-sm font-medium">
                Grade
              </label>
              <select
                id="grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value as Grade)}
                className="min-h-[44px] w-full rounded-md border border-line px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="grossWeightKg" className="mb-1 block text-sm font-medium">
                Gross weight (kg)
              </label>
              <input
                id="grossWeightKg"
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={grossWeightKg}
                onChange={(e) => setGrossWeightKg(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-line px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
              />
            </div>
            <div>
              <label htmlFor="tareWeightKg" className="mb-1 block text-sm font-medium">
                Tare weight (kg)
              </label>
              <input
                id="tareWeightKg"
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={tareWeightKg}
                onChange={(e) => setTareWeightKg(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-line px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
              />
            </div>
          </div>

          {/* Live ticket — the signature element. Shown before submission
              so the clerk can tell the farmer the figure up front. */}
          <div className="rounded-card border-2 border-dashed border-amber-500/60 bg-amber-100/40 p-4">
            {quoting && <p className="text-sm text-ink/60">Calculating…</p>}
            {quoteError && (
              <p role="alert" className="text-sm font-medium text-status-rejected">
                {quoteError}
              </p>
            )}
            {quote && !quoteError && (
              <dl className="ticket-figure grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-ink/60">Net weight</dt>
                <dd className="text-right font-semibold">{formatKg(quote.netWeightKg)}</dd>
                <dt className="text-ink/60">Price / kg</dt>
                <dd className="text-right font-semibold">{formatRwf(quote.pricePerKgRwf)}</dd>
                <dt className="pt-2 text-base font-bold text-primary-700">Amount due</dt>
                <dd className="pt-2 text-right text-base font-bold text-primary-700">
                  {formatRwf(quote.amountRwf)}
                </dd>
              </dl>
            )}
            {!quote && !quoteError && !quoting && (
              <p className="text-sm text-ink/50">
                Enter gross and tare weight to see the payment amount.
              </p>
            )}
          </div>

          {submitError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-rejected">
              {submitError}
            </p>
          )}
          {successMessage && (
            <p role="status" className="rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-700">
              {successMessage}
            </p>
          )}

          {/* Fixed to the bottom on small screens so it's reachable with one
              thumb without scrolling, per the brief. */}
          <div className="sm:static fixed inset-x-0 bottom-0 border-t border-line bg-white p-4 sm:border-0 sm:bg-transparent sm:p-0">
            <Button type="submit" disabled={!canSubmit} className="w-full">
              {submitting ? "Recording…" : "Record delivery"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function RecordDeliveryPage() {
  return (
    <RequireAuth allow={["CLERK", "ADMIN"]}>
      <RecordDeliveryForm />
    </RequireAuth>
  );
}
