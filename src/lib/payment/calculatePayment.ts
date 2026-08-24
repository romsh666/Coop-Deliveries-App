/**
 * Pure payment calculation module.
 *
 * No database access. Given the raw inputs of a delivery plus the matching
 * price list entry, returns the computed net weight and payment amount, or
 * a structured error. This is the single source of truth for the money math
 * and is unit tested directly against every worked example in the brief.
 *
 * Design decisions (see NOTES.md):
 * - Weight (gross/tare/net) is stored and returned as a decimal number of
 *   kilograms, to gram precision (3 decimal places). The brief's prose said
 *   "store weights as integers", but its own worked example uses fractional
 *   kg (45.5 / 2.5) — confirmed with the person giving this assessment that
 *   decimal weights are fine, so weight is never forced to a whole number.
 * - Money (amountRwf) is still strictly integer RWF, per the brief, and is
 *   computed from integer-gram arithmetic (grams * price / 1000, rounded
 *   once) rather than by first converting to a float kg value and
 *   multiplying — this keeps the money calculation exact and avoids
 *   compounding floating-point error, even though display-facing weight
 *   values are decimals.
 */

export type ProduceType = "COFFEE_CHERRIES" | "MAIZE" | "BEANS";
export type Grade = "A" | "B" | "C";

export interface DeliveryInput {
  produceType: ProduceType;
  grade: Grade;
  /** Kilograms. May carry up to 3 decimal places (scale precision). */
  grossWeightKg: number;
  /** Kilograms. May carry up to 3 decimal places (scale precision). */
  tareWeightKg: number;
}

export interface PriceListEntryInput {
  produceType: ProduceType;
  grade: Grade;
  pricePerKgRwf: number;
}

export type PaymentCalculationError =
  | { code: "INVALID_NET_WEIGHT"; message: string }
  | { code: "NO_PRICE_FOR_GRADE"; message: string };

export type PaymentCalculationResult =
  | {
      ok: true;
      netWeightKg: number;
      pricePerKgRwf: number;
      amountRwf: number;
    }
  | {
      ok: false;
      error: PaymentCalculationError;
    };

/** Converts a kg value (possibly fractional) to whole integer grams. */
function kgToGrams(kg: number): number {
  // Round to nearest gram first so floating-point representation noise
  // (e.g. 45.5 stored as 45.49999999999999) never leaks into the integer math.
  return Math.round(kg * 1000);
}

export function calculatePayment(
  delivery: DeliveryInput,
  priceListEntries: PriceListEntryInput[]
): PaymentCalculationResult {
  const grossGrams = kgToGrams(delivery.grossWeightKg);
  const tareGrams = kgToGrams(delivery.tareWeightKg);
  const netGrams = grossGrams - tareGrams;

  if (netGrams <= 0) {
    return {
      ok: false,
      error: {
        code: "INVALID_NET_WEIGHT",
        message: `Net weight must be greater than zero (gross ${delivery.grossWeightKg}kg - tare ${delivery.tareWeightKg}kg).`,
      },
    };
  }

  const matchingEntry = priceListEntries.find(
    (e) => e.produceType === delivery.produceType && e.grade === delivery.grade
  );

  if (!matchingEntry) {
    return {
      ok: false,
      error: {
        code: "NO_PRICE_FOR_GRADE",
        message: `No price is set for ${delivery.produceType} grade ${delivery.grade} in the applicable price list.`,
      },
    };
  }

  // Net weight for storage/display: exact decimal kg (grams / 1000).
  const netWeightKg = netGrams / 1000;

  // Money: computed directly from integer grams, divided by 1000 and
  // rounded ONCE to the nearest whole RWF — never derived from the
  // (already-divided) netWeightKg float above, so no rounding error can
  // compound between the two.
  const amountRwf = Math.round((netGrams * matchingEntry.pricePerKgRwf) / 1000);

  return {
    ok: true,
    netWeightKg,
    pricePerKgRwf: matchingEntry.pricePerKgRwf,
    amountRwf,
  };
}
