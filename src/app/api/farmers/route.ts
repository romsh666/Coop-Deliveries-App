import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/session";
import { apiError, errorResponse } from "@/lib/apiError";
import { registerFarmerSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "ADMIN");

    const body = await req.json();
    const parsed = registerFarmerSchema.safeParse(body);
    if (!parsed.success) {
      throw apiError("VALIDATION_ERROR", "Invalid farmer details.", parsed.error.flatten());
    }

    const existing = await prisma.farmer.findUnique({
      where: { membershipNumber: parsed.data.membershipNumber },
    });
    if (existing) {
      throw apiError("DUPLICATE_MEMBERSHIP_NUMBER", "A farmer with this membership number already exists.");
    }

    const farmer = await prisma.farmer.create({ data: parsed.data });
    return NextResponse.json({ farmer }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}


export async function GET(req: NextRequest) {
  try {
    await requireSession(); // any authenticated role may look up a farmer

    const url = new URL(req.url);
    const membershipNumber = url.searchParams.get("membershipNumber");
    const search = url.searchParams.get("search");

    if (membershipNumber) {
      const farmer = await prisma.farmer.findUnique({ where: { membershipNumber } });
      if (!farmer) {
        throw apiError("NOT_FOUND", "No farmer found with that membership number.");
      }
      return NextResponse.json({ farmer });
    }

    const farmers = await prisma.farmer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { membershipNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      take: 50,
    });

    return NextResponse.json({ farmers });
  } catch (err) {
    return errorResponse(err);
  }
}
