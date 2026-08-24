import { describe, it, expect } from "vitest";
import { calculatePayment, type PriceListEntryInput } from "../calculatePayment";


const AUGUST_PRICE_LIST: PriceListEntryInput[] = [
  { produceType: "COFFEE_CHERRIES", grade: "A", pricePerKgRwf: 650 },
  { produceType: "COFFEE_CHERRIES", grade: "B", pricePerKgRwf: 500 },
  { produceType: "COFFEE_CHERRIES", grade: "C", pricePerKgRwf: 380 },
  { produceType: "MAIZE", grade: "A", pricePerKgRwf: 450 },
  { produceType: "MAIZE", grade: "B", pricePerKgRwf: 380 },
  { produceType: "MAIZE", grade: "C", pricePerKgRwf: 300 },
  { produceType: "BEANS", grade: "A", pricePerKgRwf: 900 },
  { produceType: "BEANS", grade: "B", pricePerKgRwf: 750 },
  { produceType: "BEANS", grade: "C", pricePerKgRwf: 600 },
];


const MAIZE_ONLY_PRICE_LIST: PriceListEntryInput[] = [
  { produceType: "MAIZE", grade: "A", pricePerKgRwf: 450 },
];

describe("calculatePayment — worked examples from the brief", () => {
  it("Coffee cherries, Grade A, gross 120kg, tare 5kg -> net 115kg, 74,750 RWF", () => {
    const result = calculatePayment(
      { produceType: "COFFEE_CHERRIES", grade: "A", grossWeightKg: 120, tareWeightKg: 5 },
      AUGUST_PRICE_LIST
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.netWeightKg).toBe(115);
      expect(result.amountRwf).toBe(74_750);
    }
  });

  it("Maize, Grade B, gross 200kg, tare 10kg -> net 190kg, 72,200 RWF", () => {
    const result = calculatePayment(
      { produceType: "MAIZE", grade: "B", grossWeightKg: 200, tareWeightKg: 10 },
      AUGUST_PRICE_LIST
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.netWeightKg).toBe(190);
      expect(result.amountRwf).toBe(72_200);
    }
  });

  it("Beans, Grade C, gross 45.5kg, tare 2.5kg -> net 43kg, 25,800 RWF", () => {
    const result = calculatePayment(
      { produceType: "BEANS", grade: "C", grossWeightKg: 45.5, tareWeightKg: 2.5 },
      AUGUST_PRICE_LIST
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.netWeightKg).toBe(43);
      expect(result.amountRwf).toBe(25_800);
    }
  });

  it("Maize, Grade A, gross 50kg, tare 50kg -> rejected, net weight is zero", () => {
    const result = calculatePayment(
      { produceType: "MAIZE", grade: "A", grossWeightKg: 50, tareWeightKg: 50 },
      AUGUST_PRICE_LIST
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_NET_WEIGHT");
    }
  });

  it("Beans, Grade A, delivered 10 March (priced with the list effective then) -> 900/kg", () => {
    
    
    
    
    const JANUARY_LIST: PriceListEntryInput[] = [
      { produceType: "BEANS", grade: "A", pricePerKgRwf: 900 },
    ];
    const result = calculatePayment(
      { produceType: "BEANS", grade: "A", grossWeightKg: 100, tareWeightKg: 0 },
      JANUARY_LIST
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pricePerKgRwf).toBe(900);
      expect(result.amountRwf).toBe(90_000);
    }
  });
});

describe("calculatePayment — edge cases", () => {
  it("rejects when tare weight is greater than gross weight", () => {
    const result = calculatePayment(
      { produceType: "MAIZE", grade: "A", grossWeightKg: 40, tareWeightKg: 45 },
      AUGUST_PRICE_LIST
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_NET_WEIGHT");
    }
  });

  it("rejects when tare weight equals gross weight exactly", () => {
    const result = calculatePayment(
      { produceType: "MAIZE", grade: "A", grossWeightKg: 30, tareWeightKg: 30 },
      AUGUST_PRICE_LIST
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_NET_WEIGHT");
    }
  });

  it("preserves a fractional net weight exactly, to gram precision", () => {
    
    
    
    const result = calculatePayment(
      { produceType: "MAIZE", grade: "A", grossWeightKg: 20.7, tareWeightKg: 10.3 },
      AUGUST_PRICE_LIST
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.netWeightKg).toBe(10.4);
      expect(result.amountRwf).toBe(4_680); 
    }
  });

  it("computes an exact amount for a net weight with 3 decimal places (gram precision)", () => {
    
    const result = calculatePayment(
      { produceType: "MAIZE", grade: "A", grossWeightKg: 15.234, tareWeightKg: 5.001 },
      AUGUST_PRICE_LIST
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.netWeightKg).toBeCloseTo(10.233, 3);
    
      expect(result.amountRwf).toBe(4_605);
    }
  });

  it("rejects a net weight that is a tiny positive fraction of a gram (rounds to zero grams)", () => {
    
    const result = calculatePayment(
      { produceType: "MAIZE", grade: "A", grossWeightKg: 10.0001, tareWeightKg: 10.0000 },
      AUGUST_PRICE_LIST
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_NET_WEIGHT");
    }
  });

  it("returns NO_PRICE_FOR_GRADE when the price list has no entry for the produce/grade", () => {
    const result = calculatePayment(
      { produceType: "BEANS", grade: "A", grossWeightKg: 100, tareWeightKg: 10 },
      MAIZE_ONLY_PRICE_LIST
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_PRICE_FOR_GRADE");
    }
  });

  it("does not lose precision on large deliveries", () => {
    const result = calculatePayment(
      { produceType: "COFFEE_CHERRIES", grade: "A", grossWeightKg: 999, tareWeightKg: 1 },
      AUGUST_PRICE_LIST
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.netWeightKg).toBe(998);
      expect(result.amountRwf).toBe(998 * 650);
    }
  });
});
