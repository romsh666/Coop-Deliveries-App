import { prisma } from "../db";
import { apiError } from "../apiError";
import type { ProduceType, Grade } from "@prisma/client";
import type { Prisma } from "@prisma/client";


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
