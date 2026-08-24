import { Prisma, type DeliveryStatus } from "@prisma/client";
import { prisma } from "../db";
import { apiError } from "../apiError";
import type { SessionPayload } from "../auth";
import { requireRole, requireOwnCentre } from "../session";

// The only transitions the state machine permits, keyed by current status.
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

/**
 * Applies a status transition to a delivery, enforcing:
 * - the allowed-transition state machine
 * - "a clerk cannot verify their own entry"
 * - "comment required on rejection"
 * - atomic, race-safe transition so the same delivery can never be paid
 *   twice (or verified twice) even if two requests land at the same instant
 *
 * Concurrency safety: the actual status flip is a single conditional UPDATE
 * (`WHERE status = <expected current status>`), the same pattern used for
 * centre capacity in recordDelivery.ts. If a duplicate "pay" click fires a
 * second request before the first commits, the second UPDATE's WHERE clause
 * no longer matches (status is already PAID) and 0 rows are affected — we
 * detect that and return a clean INVALID_STATUS_TRANSITION error instead of
 * paying twice. This is enforced at the database level, not by an
 * application-level read-then-write check.
 */
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

    // Role + ownership rules per action.
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

    // Atomic conditional transition — see docstring.
    const result = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "Delivery"
      SET "status" = ${targetStatus}::"DeliveryStatus", "updatedAt" = now()
      WHERE "id" = ${deliveryId} AND "status" = ${delivery.status}::"DeliveryStatus"
      RETURNING id
    `);

    if (result.length === 0) {
      // Someone else changed the status between our read and our write
      // (e.g. a double-click race). Fail cleanly rather than double-apply.
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
