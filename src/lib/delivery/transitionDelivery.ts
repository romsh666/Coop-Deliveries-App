import { Prisma, type DeliveryStatus } from "@prisma/client";
import { prisma } from "../db";
import { apiError } from "../apiError";
import type { SessionPayload } from "../auth";
import { requireRole, requireOwnCentre } from "../session";


const ALLOWED_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  RECORDED: ["VERIFIED", "REJECTED"],
  VERIFIED: ["PAID", "REJECTED"],
  PAID: [],
  REJECTED: [],
};

interface TransitionOptions {
  deliveryId: string;
  targetStatus: DeliveryStatus;
  session: SessionPayload;
  comment: string | null;
}


export async function transitionDelivery({
  deliveryId,
  targetStatus,
  session,
  comment,
}: TransitionOptions) {
  if (targetStatus === "REJECTED" && (!comment || comment.trim().length === 0)) {
    throw apiError("COMMENT_REQUIRED", "A comment is required when rejecting a delivery.");
  }

  return prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) {
      throw apiError("NOT_FOUND", "Delivery not found.");
    }

    const allowedNextStatuses = ALLOWED_TRANSITIONS[delivery.status];
    if (!allowedNextStatuses.includes(targetStatus)) {
      throw apiError(
        "INVALID_STATUS_TRANSITION",
        `Cannot move a delivery from ${delivery.status} to ${targetStatus}.`
      );
    }

    
    if (targetStatus === "VERIFIED") {
      requireRole(session, "MANAGER", "ADMIN");
      if (delivery.recordedById === session.userId) {
        throw apiError(
          "CANNOT_VERIFY_OWN_ENTRY",
          "You cannot verify a delivery you recorded yourself."
        );
      }
    } else if (targetStatus === "REJECTED") {
      requireRole(session, "MANAGER", "ADMIN");
    } else if (targetStatus === "PAID") {
      requireRole(session, "MANAGER", "ADMIN");
    }
    requireOwnCentre(session, delivery.centreId);

    
    const result = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "Delivery"
      SET "status" = ${targetStatus}::"DeliveryStatus", "updatedAt" = now()
      WHERE "id" = ${deliveryId} AND "status" = ${delivery.status}::"DeliveryStatus"
      RETURNING id
    `);

    if (result.length === 0) {
      
      
      throw apiError(
        "INVALID_STATUS_TRANSITION",
        "This delivery's status changed before this action could complete. Refresh and try again."
      );
    }

    await tx.auditLogEntry.create({
      data: {
        deliveryId,
        fromStatus: delivery.status,
        toStatus: targetStatus,
        performedById: session.userId,
        comment,
      },
    });

    return tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
  });
}
