import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail loudly at boot rather than silently signing tokens with `undefined`.
  throw new Error("JWT_SECRET environment variable is not set.");
}
const secretKey = new TextEncoder().encode(JWT_SECRET);

const TOKEN_TTL = "12h";
export const AUTH_COOKIE_NAME = "coop_session";

export interface SessionPayload {
  userId: string;
  email: string;
  role: Role;
  centreId: string | null;
  [key: string]: unknown; // required for jose's JWTPayload compatibility
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as SessionPayload;
  } catch {
    // Expired, malformed, or wrong signature — all treated as "not logged in".
    return null;
  }
}
