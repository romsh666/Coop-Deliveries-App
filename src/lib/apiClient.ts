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
