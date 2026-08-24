import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { AUTH_COOKIE_NAME, verifySession, type SessionPayload } from "./auth";
import { apiError } from "./apiError";


export async function requireSession(): Promise<SessionPayload> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    throw apiError("UNAUTHENTICATED", "You must be logged in.");
  }
  const session = await verifySession(token);
  if (!session) {
    throw apiError("UNAUTHENTICATED", "Your session is invalid or has expired.");
  }
  return session;
}


export function requireRole(session: SessionPayload, ...roles: Role[]): void {
  if (!roles.includes(session.role)) {
    throw apiError(
      "FORBIDDEN",
      `This action requires one of the following roles: ${roles.join(", ")}.`
    );
  }
}


export function requireOwnCentre(session: SessionPayload, centreId: string): void {
  if (session.role === "CLERK" && session.centreId !== centreId) {
    throw apiError(
      "WRONG_CENTRE",
      "Clerks may only act on deliveries at their assigned centre."
    );
  }
}
