/**
 * API-level tests for the four rejected paths required by the brief:
 *   1. Zero net weight is rejected by the record-delivery endpoint.
 *   2. A suspended farmer is rejected by the record-delivery endpoint.
 *   3. A clerk calling the verify endpoint directly gets 403, even with a
 *      valid token (proves authorization is enforced server-side, not just
 *      hidden in the UI).
 *   4. A clerk requesting another centre's deliveries does not receive them.
 *
 * These call the actual exported route handlers (POST/GET from route.ts),
 * not just the service layer underneath them, so they exercise real
 * request parsing, session verification, and error-response shaping.
 *
 * Requires a real Postgres database migrated with the Prisma schema —
 * point DATABASE_URL (and JWT_SECRET) at a disposable test database before
 * running. See README.md "Running tests".
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signSession } from "@/lib/auth";

// next/headers' cookies() only works inside a real Next.js request context.
// We stub it so route handlers can read a session cookie during tests.
let currentCookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      name === "coop_session" && currentCookieValue ? { value: currentCookieValue } : undefined,
    set: () => {},
    delete: () => {},
  }),
}));

// Imported AFTER the mock above so the handlers pick up the mocked cookies().
const { POST: recordDeliveryHandler, GET: listDeliveriesHandler } = await import(
  "../deliveries/route"
);
const { POST: verifyHandler } = await import("../deliveries/[id]/verify/route");

async function loginAs(userId: string, email: string, role: "CLERK" | "MANAGER" | "ADMIN", centreId: string | null) {
  currentCookieValue = await signSession({ userId, email, role, centreId });
}

describe("Delivery API — rejected paths", () => {
  let centreA: { id: string };
  let centreB: { id: string };
  let clerkA: { id: string; email: string };
  let clerkB: { id: string; email: string };
  let activeFarmer: { id: string };
  let suspendedFarmer: { id: string };

  beforeAll(async () => {
    centreA = await prisma.centre.create({ data: { name: "Test Centre A", location: "Kigali" } });
    centreB = await prisma.centre.create({ data: { name: "Test Centre B", location: "Huye" } });

    await prisma.centreCapacity.create({
      data: { centreId: centreA.id, produceType: "MAIZE", capacityKg: 10_000 },
    });
    await prisma.centreStock.create({
      data: { centreId: centreA.id, produceType: "MAIZE", quantityKg: 0 },
    });

    const passwordHash = await hashPassword("Test1234!");
    clerkA = await prisma.user.create({
      data: {
        email: "clerkA@test.local",
        passwordHash,
        name: "Clerk A",
        role: "CLERK",
        centreId: centreA.id,
      },
    });
    clerkB = await prisma.user.create({
      data: {
        email: "clerkB@test.local",
        passwordHash,
        name: "Clerk B",
        role: "CLERK",
        centreId: centreB.id,
      },
    });

    const admin = await prisma.user.create({
      data: { email: "admin@test.local", passwordHash, name: "Admin", role: "ADMIN" },
    });

    await prisma.priceList.create({
      data: {
        effectiveFrom: new Date("2020-01-01"),
        publishedById: admin.id,
        entries: { create: [{ produceType: "MAIZE", grade: "A", pricePerKgRwf: 450 }] },
      },
    });

    activeFarmer = await prisma.farmer.create({
      data: { membershipNumber: "TEST-ACTIVE-1", name: "Active Farmer", membershipStatus: "ACTIVE" },
    });
    suspendedFarmer = await prisma.farmer.create({
      data: { membershipNumber: "TEST-SUSPENDED-1", name: "Suspended Farmer", membershipStatus: "SUSPENDED" },
    });
  });

  afterAll(async () => {
    // Clean up everything created in this suite, respecting FK order.
    await prisma.auditLogEntry.deleteMany({ where: { performedById: { in: [clerkA.id, clerkB.id] } } });
    await prisma.delivery.deleteMany({ where: { centreId: { in: [centreA.id, centreB.id] } } });
    await prisma.priceListEntry.deleteMany({});
    await prisma.priceList.deleteMany({});
    await prisma.centreStock.deleteMany({ where: { centreId: { in: [centreA.id, centreB.id] } } });
    await prisma.centreCapacity.deleteMany({ where: { centreId: { in: [centreA.id, centreB.id] } } });
    await prisma.farmer.deleteMany({ where: { id: { in: [activeFarmer.id, suspendedFarmer.id] } } });
    await prisma.user.deleteMany({ where: { email: { in: ["clerkA@test.local", "clerkB@test.local", "admin@test.local"] } } });
    await prisma.centre.deleteMany({ where: { id: { in: [centreA.id, centreB.id] } } });
    await prisma.$disconnect();
  });

  it("rejects a delivery with zero net weight (gross == tare)", async () => {
    await loginAs(clerkA.id, clerkA.email, "CLERK", centreA.id);

    const req = new NextRequest("http://localhost/api/deliveries", {
      method: "POST",
      body: JSON.stringify({
        farmerId: activeFarmer.id,
        centreId: centreA.id,
        produceType: "MAIZE",
        grade: "A",
        grossWeightKg: 50,
        tareWeightKg: 50,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await recordDeliveryHandler(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("INVALID_NET_WEIGHT");
  });

  it("rejects a delivery from a suspended farmer", async () => {
    await loginAs(clerkA.id, clerkA.email, "CLERK", centreA.id);

    const req = new NextRequest("http://localhost/api/deliveries", {
      method: "POST",
      body: JSON.stringify({
        farmerId: suspendedFarmer.id,
        centreId: centreA.id,
        produceType: "MAIZE",
        grade: "A",
        grossWeightKg: 100,
        tareWeightKg: 10,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await recordDeliveryHandler(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("FARMER_SUSPENDED");
  });

  it("returns 403 when a clerk calls the verify endpoint directly", async () => {
    // Record a real delivery first (as clerkA), then have clerkA try to
    // verify it directly via HTTP, bypassing any UI restriction.
    await loginAs(clerkA.id, clerkA.email, "CLERK", centreA.id);
    const recordReq = new NextRequest("http://localhost/api/deliveries", {
      method: "POST",
      body: JSON.stringify({
        farmerId: activeFarmer.id,
        centreId: centreA.id,
        produceType: "MAIZE",
        grade: "A",
        grossWeightKg: 100,
        tareWeightKg: 10,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const recordRes = await recordDeliveryHandler(recordReq);
    const { delivery } = await recordRes.json();
    expect(recordRes.status).toBe(201);

    const verifyReq = new NextRequest(`http://localhost/api/deliveries/${delivery.id}/verify`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const verifyRes = await verifyHandler(verifyReq, { params: { id: delivery.id } });
    const verifyJson = await verifyRes.json();

    expect(verifyRes.status).toBe(403);
    expect(verifyJson.error.code).toBe("FORBIDDEN");
  });

  it("does not return another centre's deliveries to a clerk", async () => {
    // A delivery exists at Centre A (recorded above). Clerk B, assigned to
    // Centre B, must not see it — even if they explicitly ask for centreId=A.
    await loginAs(clerkB.id, clerkB.email, "CLERK", centreB.id);

    const listReq = new NextRequest(
      `http://localhost/api/deliveries?centreId=${centreA.id}`,
      { method: "GET" }
    );
    const listRes = await listDeliveriesHandler(listReq);
    const listJson = await listRes.json();

    expect(listRes.status).toBe(200);
    // Every returned delivery (if any) must belong to Centre B, never A —
    // the server ignores the requested centreId and scopes by the clerk's
    // own assigned centre.
    for (const d of listJson.deliveries) {
      expect(d.centreId).toBe(centreB.id);
    }
  });
});
