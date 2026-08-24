import { Prisma, type ProduceType, type Grade } from "@prisma/client";
import { prisma } from "../db";
import { apiError } from "../apiError";
import { calculatePayment } from "../payment/calculatePayment";
import { getEffectivePriceList } from "../priceList/getEffectivePriceList";

export interface RecordDeliveryInput {
  farmerId: string;
  centreId: string;
  produceType: ProduceType;
  grade: Grade;
  grossWeightKg: number;
  tareWeightKg: number;
  deliveryDate: Date;
  recordedById: string;
}

/**
 * Records a delivery. Runs every business rule from the brief and performs
 * the insert transactionally, including the capacity check.
 *
 * Concurrency safety for capacity (brief: "Two deliveries arriving at the
 * same moment must not both slip past a centre's capacity limit... handle
 * this at the database level"):
 *
 * We do NOT read CentreStock.quantityKg in application code, compare it to
 * capacity, and then issue a separate UPDATE — that read-check-write pattern
 * has a race window between two concurrent transactions. Instead the stock
 * increment and the capacity check happen in a single atomic UPDATE
 * statement:
 *
 *   UPDATE "CentreStock" SET "quantityKg" = "quantityKg" + $net
 *   WHERE ... AND "quantityKg" + $net <= capacityKg
 *
 * Postgres guarantees this UPDATE's WHERE clause and SET both see the same
 * consistent row version, and row-level locking during the UPDATE serializes
 * concurrent attempts against the same (centreId, produceType) row — the
 * second transaction simply waits for the first to commit, then evaluates
 * the condition against the now-updated value. If it fails, 0 rows are
 * affected and we know unambiguously that capacity would be exceeded.
 */
export async function recordDelivery(input: RecordDeliveryInput) {
  const {
    farmerId,
    centreId,
    produceType,
    grade,
    grossWeightKg,
    tareWeightKg,
    deliveryDate,
    recordedById,
  } = input;

  return prisma.$transaction(async (tx) => {
    // 1. Farmer must exist and be an active member.
    const farmer = await tx.farmer.findUnique({ where: { id: farmerId } });
    if (!farmer) {
      throw apiError("VALIDATION_ERROR", "Farmer not found.");
    }
    if (farmer.membershipStatus === "SUSPENDED") {
      throw apiError(
        "FARMER_SUSPENDED",
        `${farmer.name} (${farmer.membershipNumber}) has a suspended membership and cannot deliver produce.`
      );
    }

    // 2. Resolve the price list effective on the delivery date and compute
    //    the payment via the pure calculation module.
    const { priceList, entry } = await getEffectivePriceList(deliveryDate, produceType, grade, tx);

    const calculation = calculatePayment(
      { produceType, grade, grossWeightKg, tareWeightKg },
      [{ produceType: entry.produceType, grade: entry.grade, pricePerKgRwf: entry.pricePerKgRwf }]
    );

    if (!calculation.ok) {
      throw apiError(
        calculation.error.code === "INVALID_NET_WEIGHT" ? "INVALID_NET_WEIGHT" : "NO_PRICE_FOR_DATE",
        calculation.error.message
      );
    }

    const { netWeightKg, pricePerKgRwf, amountRwf } = calculation;

    // 3. Atomic, capacity-checked stock increment (see docstring above).
    const updated = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "CentreStock" cs
      SET "quantityKg" = cs."quantityKg" + ${netWeightKg}
      FROM "CentreCapacity" cc
      WHERE cs."centreId" = ${centreId}
        AND cs."produceType" = ${produceType}::"ProduceType"
        AND cc."centreId" = cs."centreId"
        AND cc."produceType" = cs."produceType"
        AND cs."quantityKg" + ${netWeightKg} <= cc."capacityKg"
      RETURNING cs.id
    `);

    if (updated.length === 0) {
      // Either capacity would be exceeded, or this centre/produceType
      // combination has no configured capacity/stock row at all.
      const capacity = await tx.centreCapacity.findUnique({
        where: { centreId_produceType: { centreId, produceType } },
      });
      if (!capacity) {
        throw apiError(
          "CENTRE_CAPACITY_EXCEEDED",
          `No storage capacity is configured for ${produceType} at this centre.`
        );
      }
      throw apiError(
        "CENTRE_CAPACITY_EXCEEDED",
        `Recording this delivery would exceed the centre's ${produceType} storage capacity of ${capacity.capacityKg}kg.`
      );
    }

    // 4. Insert the delivery, priced against the exact price list resolved
    //    above (hard FK — see schema.prisma comment on Delivery.priceListId).
    const delivery = await tx.delivery.create({
      data: {
        farmerId,
        centreId,
        produceType,
        grade,
        // Stored at gram precision (Decimal(10,3)) per the clarified rule:
        // weights may be fractional, just never floating-point-imprecise.
        grossWeightKg,
        tareWeightKg,
        netWeightKg,
        priceListId: priceList.id,
        pricePerKgRwf,
        amountRwf,
        deliveryDate,
        status: "RECORDED",
        recordedById,
      },
    });

    // 5. Audit trail.
    await tx.auditLogEntry.create({
      data: {
        deliveryId: delivery.id,
        fromStatus: null,
        toStatus: "RECORDED",
        performedById: recordedById,
        comment: null,
      },
    });

    return delivery;
  });
}
