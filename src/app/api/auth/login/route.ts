import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword, signSession, AUTH_COOKIE_NAME } from "@/lib/auth";
import { apiError, errorResponse } from "@/lib/apiError";
import { loginSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw apiError("VALIDATION_ERROR", "Invalid email or password format.", parsed.error.flatten());
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    // Deliberately identical error for "no such user" and "wrong password"
    // so the endpoint doesn't leak which emails are registered.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw apiError("UNAUTHENTICATED", "Invalid email or password.");
    }

    const token = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      centreId: user.centreId,
    });

    cookies().set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12h, matches TOKEN_TTL in auth.ts
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, centreId: user.centreId },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
