import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/session";
import { apiError, errorResponse } from "@/lib/apiError";
import { publishPriceListSchema } from "@/lib/validation";

/**
 * Publishing NEVER updates or deletes an existing PriceList/PriceListEntry
 * row — it always inserts a new PriceList with its own effectiveFrom date.
 * This is what guarantees "publishing a new price list must never change
 * what an already-recorded delivery is worth": past deliveries hold a hard
 * foreign key (Delivery.priceListId) to the specific PriceList row they were
 * priced against, and that row is immutable once created.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "ADMIN");

    const body = await req.json();
    const parsed = publishPriceListSchema.safeParse(body);
    if (!parsed.success) {
      throw apiError("VALIDATION_ERROR", "Invalid price list.", parsed.error.flatten());
    }
    const { effectiveFrom, entries } = parsed.data;

    const priceList = await prisma.priceList.create({
      data: {
        effectiveFrom: new Date(effectiveFrom),
        publishedById: session.userId,
        entries: { create: entries },
      },
      include: { entries: true },
    });

    return NextResponse.json({ priceList }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET() {
  try {
    await requireSession();
    const priceLists = await prisma.priceList.findMany({
      orderBy: { effectiveFrom: "desc" },
      include: { entries: true, publishedBy: { select: { name: true } } },
    });
    return NextResponse.json({ priceLists });
  } catch (err) {
    return errorResponse(err);
  }
}
