export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ClientApiError extends Error {
  code: string;
  details?: unknown;
  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.code = shape.code;
    this.details = shape.details;
  }
}

/**
 * Thin fetch wrapper: always sends/receives JSON, always includes cookies
 * (for the session), and always throws a typed ClientApiError with the
 * server's machine-readable code on failure — so UI code can branch on
 * `err.code` (e.g. show a field-level message for VALIDATION_ERROR) rather
 * than parsing strings.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const errShape = (body as { error?: ApiErrorShape })?.error;
    throw new ClientApiError(
      errShape ?? { code: "UNKNOWN_ERROR", message: `Request failed with status ${res.status}.` }
    );
  }

  return body as T;
}
