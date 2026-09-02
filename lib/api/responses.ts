// ---------------------------------------------------------------------------
// Shared HTTP response helpers for route handlers.
//
// All errors are returned as { error: { code, message } } with
// Content-Type: application/json. Success payloads are returned bare (no
// { data } wrapper) so the wire shape stays simple.
// ---------------------------------------------------------------------------

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "HttpError";
  }
}

type ErrorBody = { error: { code: string; message: string } };

export function json<T>(data: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

function errorBody(status: number, code: string, message: string): Response {
  const body: ErrorBody = { error: { code, message } };
  return json(body, { status });
}

export const unauthorized = (message = "Authentication required") =>
  errorBody(401, "UNAUTHENTICATED", message);

export const forbidden = (message = "You do not own this resource") =>
  errorBody(403, "FORBIDDEN", message);

export const notFound = (message = "Resource not found") => errorBody(404, "NOT_FOUND", message);

export const badRequest = (code: string, message: string) => errorBody(400, code, message);

export const noContent = (): Response => new Response(null, { status: 204 });
