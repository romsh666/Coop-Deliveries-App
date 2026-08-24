import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { errorResponse } from "@/lib/apiError";

export async function GET() {
  try {
    await requireSession();
    const centres = await prisma.centre.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ centres });
  } catch (err) {
    return errorResponse(err);
  }
}
