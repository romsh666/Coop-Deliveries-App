import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession, requireRole, requireOwnCentre } from "@/lib/session";
import { apiError, errorResponse } from "@/lib/apiError";
import { recordDeliverySchema, deliveryListQuerySchema } from "@/lib/validation";
import { recordDelivery } from "@/lib/delivery/recordDelivery";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "CLERK", "ADMIN"); // admins can record too; managers do not record deliveries

    const body = await req.json();
    const parsed = recordDeliverySchema.safeParse(body);
    if (!parsed.success) {
      throw apiError("VALIDATION_ERROR", "Invalid delivery input.", parsed.error.flatten());
    }
    const { farmerId, centreId, produceType, grade, grossWeightKg, tareWeightKg, deliveryDate } =
      parsed.data;

    // Server-side enforcement, not just a hidden UI control: a clerk may
    // only record at their own assigned centre.
    requireOwnCentre(session, centreId);

    const delivery = await recordDelivery({
      farmerId,
      centreId,
      produceType,
      grade,
      grossWeightKg,
      tareWeightKg,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
      recordedById: session.userId,
    });

    return NextResponse.json({ delivery }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();

    const url = new URL(req.url);
    const parsed = deliveryListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      throw apiError("VALIDATION_ERROR", "Invalid query parameters.", parsed.error.flatten());
    }
    const { centreId, farmerId, produceType, status, dateFrom, dateTo, page, pageSize } = parsed.data;

    // Role-based scoping happens here, server-side, regardless of what the
    // client asked for — a clerk cannot widen their own scope by omitting
    // centreId or passing a different one.
    const where: Prisma.DeliveryWhereInput = {};
    if (session.role === "CLERK") {
      where.centreId = session.centreId ?? "__no_centre_assigned__";
    } else if (centreId) {
      where.centreId = centreId;
    }
    if (farmerId) where.farmerId = farmerId;
    if (produceType) where.produceType = produceType;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.deliveryDate = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const [total, deliveries] = await prisma.$transaction([
      prisma.delivery.count({ where }),
      prisma.delivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          farmer: { select: { id: true, name: true, membershipNumber: true } },
          centre: { select: { id: true, name: true } },
          recordedBy: { select: { id: true, name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      deliveries,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
