/**
 * Proves the core pricing-over-time rule from the brief: "A delivery must
 * be paid at the price that was in effect on the delivery date, not the
 * price in effect today. Publishing a new price list must never change
 * what an already-recorded delivery is worth."
 *
 * This is a database-backed test (not a pure unit test) because the rule
 * is enforced by a real lookup against persisted PriceList rows, and because
 * the second half of the test (recording, then publishing a newer list, then
 * re-reading) is precisely the scenario a pure function can't demonstrate on
 * its own — it depends on what's actually stored.
 *
 * Requires a real Postgres database — see README.md "Running tests".
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { recordDelivery } from "@/lib/delivery/recordDelivery";
import { getEffectivePriceList } from "@/lib/priceList/getEffectivePriceList";

describe("Pricing is locked to the price list effective on the delivery date", () => {
  let centre: { id: string };
  let admin: { id: string };
  let clerk: { id: string };
  let farmer: { id: string };

  beforeAll(async () => {
    centre = await prisma.centre.create({ data: { name: "Pricing Test Centre", location: "Kigali" } });
    await prisma.centreCapacity.create({
      data: { centreId: centre.id, produceType: "BEANS", capacityKg: 100_000 },
    });
    await prisma.centreStock.create({
      data: { centreId: centre.id, produceType: "BEANS", quantityKg: 0 },
    });

    const passwordHash = await hashPassword("Test1234!");
    admin = await prisma.user.create({
      data: { email: "pricing-admin@test.local", passwordHash, name: "Pricing Admin", role: "ADMIN" },
    });
    clerk = await prisma.user.create({
      data: {
        email: "pricing-clerk@test.local",
        passwordHash,
        name: "Pricing Clerk",
        role: "CLERK",
        centreId: centre.id,
      },
    });
    farmer = await prisma.farmer.create({
      data: { membershipNumber: "PRICING-TEST-1", name: "Pricing Test Farmer" },
    });

    // The brief's worked example: a January list at 900/kg for Beans Grade A.
    await prisma.priceList.create({
      data: {
        effectiveFrom: new Date("2026-01-01"),
        publishedById: admin.id,
        entries: { create: [{ produceType: "BEANS", grade: "A", pricePerKgRwf: 900 }] },
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { performedById: clerk.id } });
    await prisma.delivery.deleteMany({ where: { centreId: centre.id } });
    await prisma.priceListEntry.deleteMany({});
    await prisma.priceList.deleteMany({});
    await prisma.centreStock.deleteMany({ where: { centreId: centre.id } });
    await prisma.centreCapacity.deleteMany({ where: { centreId: centre.id } });
    await prisma.farmer.deleteMany({ where: { id: farmer.id } });
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, clerk.id] } } });
    await prisma.centre.deleteMany({ where: { id: centre.id } });
    await prisma.$disconnect();
  });

  it("prices a March delivery at the January rate (900/kg), and a later price change does not touch it", async () => {
    // Record a delivery dated 10 March, before any newer list exists.
    const marchDelivery = await recordDelivery({
      farmerId: farmer.id,
      centreId: centre.id,
      produceType: "BEANS",
      grade: "A",
      grossWeightKg: 100,
      tareWeightKg: 0,
      deliveryDate: new Date("2026-03-10"),
      recordedById: clerk.id,
    });

    expect(marchDelivery.pricePerKgRwf).toBe(900);
    expect(marchDelivery.amountRwf).toBe(90_000);

    // Now publish a new list effective 1 April at a different rate.
    await prisma.priceList.create({
      data: {
        effectiveFrom: new Date("2026-04-01"),
        publishedById: admin.id,
        entries: { create: [{ produceType: "BEANS", grade: "A", pricePerKgRwf: 1_100 }] },
      },
    });

    // Re-fetch the March delivery from the database — its stored price must
    // be untouched by the new publication.
    const reloaded = await prisma.delivery.findUniqueOrThrow({ where: { id: marchDelivery.id } });
    expect(reloaded.pricePerKgRwf).toBe(900);
    expect(reloaded.amountRwf).toBe(90_000);

    // And a NEW delivery dated after 1 April correctly picks up the new rate.
    const { entry: aprilEntry } = await getEffectivePriceList(new Date("2026-04-15"), "BEANS", "A");
    expect(aprilEntry.pricePerKgRwf).toBe(1_100);

    // While a delivery dated before 1 April, looked up again after the new
    // list exists, still resolves to the January rate — proving the lookup
    // itself (not just the stored row) is date-correct, not "always latest".
    const { entry: marchEntryAfterRepublish } = await getEffectivePriceList(
      new Date("2026-03-10"),
      "BEANS",
      "A"
    );
    expect(marchEntryAfterRepublish.pricePerKgRwf).toBe(900);
  });
});
