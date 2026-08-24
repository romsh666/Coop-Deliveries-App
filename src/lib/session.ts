import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { AUTH_COOKIE_NAME, verifySession, type SessionPayload } from "./auth";
import { apiError } from "./apiError";

/**
 * Reads and verifies the session cookie for the current request. Throws a
 * 401 ApiError if there is no valid session — callers should let this
 * propagate up to the route's try/catch -> errorResponse().
 *
 * This is the ONLY source of truth for "who is calling". Nothing in this
 * app trusts a role or centreId sent in a request body.
 */
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

/**
 * Throws a 403 ApiError unless the session's role is one of `roles`.
 * Always call requireSession() first; this only checks role, not identity.
 */
export function requireRole(session: SessionPayload, ...roles: Role[]): void {
  if (!roles.includes(session.role)) {
    throw apiError(
      "FORBIDDEN",
      `This action requires one of the following roles: ${roles.join(", ")}.`
    );
  }
}

/**
 * Throws a 403 ApiError unless the clerk's assigned centre matches
 * `centreId`. Managers/admins are not centre-restricted and always pass.
 */
export function requireOwnCentre(session: SessionPayload, centreId: string): void {
  if (session.role === "CLERK" && session.centreId !== centreId) {
    throw apiError(
      "WRONG_CENTRE",
      "Clerks may only act on deliveries at their assigned centre."
    );
  }
}
