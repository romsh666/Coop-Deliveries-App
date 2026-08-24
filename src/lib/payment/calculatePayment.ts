export type ProduceType = "COFFEE_CHERRIES" | "MAIZE" | "BEANS";
export type Grade = "A" | "B" | "C";

export interface DeliveryInput {
  produceType: ProduceType;
  grade: Grade;
  grossWeightKg: number;
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


function kgToGrams(kg: number): number {

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

  
  const netWeightKg = netGrams / 1000;

  
  
  
  
  const amountRwf = Math.round((netGrams * matchingEntry.pricePerKgRwf) / 1000);

  return {
    ok: true,
    netWeightKg,
    pricePerKgRwf: matchingEntry.pricePerKgRwf,
    amountRwf,
  };
}
