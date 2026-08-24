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

    
    const delivery = await tx.delivery.create({
      data: {
        farmerId,
        centreId,
        produceType,
        grade,
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
