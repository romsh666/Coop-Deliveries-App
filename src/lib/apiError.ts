import { NextResponse } from "next/server";

/**
 * Every business-rule failure in this app returns one of these codes so the
 * frontend (and API tests) can branch on `error.code` rather than parsing
 * message strings. New codes should be added here, not invented inline.
 */
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INVALID_NET_WEIGHT"
  | "NO_PRICE_FOR_DATE"
  | "NO_PRICE_FOR_GRADE"
  | "FARMER_SUSPENDED"
  | "CENTRE_CAPACITY_EXCEEDED"
  | "WRONG_CENTRE"
  | "CANNOT_VERIFY_OWN_ENTRY"
  | "INVALID_STATUS_TRANSITION"
  | "COMMENT_REQUIRED"
  | "DUPLICATE_MEMBERSHIP_NUMBER"
  | "DUPLICATE_EMAIL";

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Central mapping so every ApiError gets a sensible default HTTP status
// without callers having to remember one everywhere they throw.
const DEFAULT_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  INVALID_NET_WEIGHT: 400,
  NO_PRICE_FOR_DATE: 400,
  NO_PRICE_FOR_GRADE: 400,
  FARMER_SUSPENDED: 400,
  CENTRE_CAPACITY_EXCEEDED: 409,
  WRONG_CENTRE: 403,
  CANNOT_VERIFY_OWN_ENTRY: 403,
  INVALID_STATUS_TRANSITION: 409,
  COMMENT_REQUIRED: 400,
  DUPLICATE_MEMBERSHIP_NUMBER: 409,
  DUPLICATE_EMAIL: 409,
};

export function apiError(code: ApiErrorCode, message: string, details?: unknown): ApiError {
  return new ApiError(code, message, DEFAULT_STATUS[code], details);
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status }
    );
  }
  // Anything unexpected is a genuine 500 — but the brief only requires
  // business-rule failures to avoid 500s, so an unhandled exception here is
  // legitimately a bug we want logged and visible, not swallowed.
  console.error("Unhandled API error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}
