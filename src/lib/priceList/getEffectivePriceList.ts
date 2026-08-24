import { prisma } from "../db";
import { apiError } from "../apiError";
import type { ProduceType, Grade } from "@prisma/client";
import type { Prisma } from "@prisma/client";

/**
 * Finds the price list that applies to a given delivery date: the most
 * recently published list whose effectiveFrom is on or before that date.
 * Publishing a newer list later never changes this lookup for a past date,
 * because we always filter by effectiveFrom <= deliveryDate and take the
 * latest match — old deliveries keep pointing at the priceListId they were
 * originally assigned (see Delivery.priceListId), so this function is only
 * ever consulted at record-time, never re-run against historical deliveries.
 *
 * Accepts an optional transaction client so it can run inside the same
 * transaction as the delivery insert.
 */
export async function getEffectivePriceList(
  deliveryDate: Date,
  produceType: ProduceType,
  grade: Grade,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  const priceList = await tx.priceList.findFirst({
    where: { effectiveFrom: { lte: deliveryDate } },
    orderBy: { effectiveFrom: "desc" },
    include: { entries: true },
  });

  if (!priceList) {
    throw apiError(
      "NO_PRICE_FOR_DATE",
      `No price list is effective on or before ${deliveryDate.toISOString().slice(0, 10)}.`
    );
  }

  const entry = priceList.entries.find(
    (e) => e.produceType === produceType && e.grade === grade
  );

  if (!entry) {
    throw apiError(
      "NO_PRICE_FOR_DATE",
      `The price list effective ${priceList.effectiveFrom.toISOString().slice(0, 10)} has no entry for ${produceType} grade ${grade}.`
    );
  }

  return { priceList, entry };
}
