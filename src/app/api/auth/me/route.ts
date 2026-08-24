import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { errorResponse } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { id: true, email: true, name: true, role: true, centreId: true },
    });
    return NextResponse.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}
