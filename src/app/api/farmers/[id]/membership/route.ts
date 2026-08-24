import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/session";
import { apiError, errorResponse } from "@/lib/apiError";
import { setMembershipStatusSchema } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "ADMIN");

    const body = await req.json();
    const parsed = setMembershipStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw apiError("VALIDATION_ERROR", "Invalid membership status.", parsed.error.flatten());
    }

    const farmer = await prisma.farmer.findUnique({ where: { id: params.id } });
    if (!farmer) {
      throw apiError("NOT_FOUND", "Farmer not found.");
    }

    const updated = await prisma.farmer.update({
      where: { id: params.id },
      data: { membershipStatus: parsed.data.status },
    });

    return NextResponse.json({ farmer: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
