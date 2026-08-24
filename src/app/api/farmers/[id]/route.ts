import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { apiError, errorResponse } from "@/lib/apiError";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();

    const farmer = await prisma.farmer.findUnique({
      where: { id: params.id },
      include: {
        deliveries: {
          orderBy: { deliveryDate: "desc" },
          include: { centre: { select: { name: true } } },
        },
      },
    });

    if (!farmer) {
      throw apiError("NOT_FOUND", "Farmer not found.");
    }

    const totalEarningsRwf = farmer.deliveries
      .filter((d) => d.status === "PAID")
      .reduce((sum, d) => sum + d.amountRwf, 0);

    return NextResponse.json({ farmer, totalEarningsRwf });
  } catch (err) {
    return errorResponse(err);
  }
}
