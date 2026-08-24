import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireOwnCentre } from "@/lib/session";
import { apiError, errorResponse } from "@/lib/apiError";

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfWeek(d: Date): Date {
  // Monday-start week.
  const copy = startOfDay(d);
  const day = copy.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireOwnCentre(session, params.id);

    const centre = await prisma.centre.findUnique({
      where: { id: params.id },
      include: { capacities: true, stock: true },
    });
    if (!centre) {
      throw apiError("NOT_FOUND", "Centre not found.");
    }

    const stockByProduce = centre.capacities.map((cap) => {
      const stockRow = centre.stock.find((s) => s.produceType === cap.produceType);
      return {
        produceType: cap.produceType,
        quantityKg: stockRow ? Number(stockRow.quantityKg) : 0,
        capacityKg: cap.capacityKg,
      };
    });

    const today = startOfDay(new Date());
    const weekStart = startOfWeek(new Date());

    const [todaysIntake, weeksDeliveries] = await Promise.all([
      prisma.delivery.aggregate({
        where: { centreId: params.id, deliveryDate: { gte: today }, status: { not: "REJECTED" } },
        _sum: { netWeightKg: true },
        _count: true,
      }),
      prisma.delivery.aggregate({
        where: {
          centreId: params.id,
          deliveryDate: { gte: weekStart },
          status: { in: ["VERIFIED", "PAID"] },
        },
        _sum: { amountRwf: true },
      }),
    ]);

    return NextResponse.json({
      centre: { id: centre.id, name: centre.name, location: centre.location },
      stockByProduce,
      todaysIntakeKg: todaysIntake._sum.netWeightKg ? Number(todaysIntake._sum.netWeightKg) : 0,
      todaysDeliveryCount: todaysIntake._count,
      weeksValueCollectedRwf: weeksDeliveries._sum.amountRwf ?? 0,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
