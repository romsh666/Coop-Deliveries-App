import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { apiError, errorResponse } from "@/lib/apiError";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const delivery = await prisma.delivery.findUnique({
      where: { id: params.id },
      include: {
        farmer: true,
        centre: true,
        recordedBy: { select: { id: true, name: true } },
        priceList: true,
        auditEntries: {
          orderBy: { createdAt: "asc" },
          include: { performedBy: { select: { id: true, name: true } } },
        },
      },
    });

    if (!delivery) {
      throw apiError("NOT_FOUND", "Delivery not found.");
    }

    // A clerk requesting another centre's delivery must not receive it —
    // enforced here even though the list endpoint already scopes by centre.
    if (session.role === "CLERK" && delivery.centreId !== session.centreId) {
      throw apiError("WRONG_CENTRE", "You do not have access to this delivery.");
    }

    return NextResponse.json({ delivery });
  } catch (err) {
    return errorResponse(err);
  }
}
