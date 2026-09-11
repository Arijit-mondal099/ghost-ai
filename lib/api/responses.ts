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

type ErrorBody = { error: { code: string; message: string } & Record<string, unknown> };

export function json<T>(data: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

function errorBody(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): Response {
  const body: ErrorBody = { error: { code, message, ...details } };
  return json(body, { status });
}

export const unauthorized = (message = "Authentication required") =>
  errorBody(401, "UNAUTHENTICATED", message);

export const forbidden = (
  message = "You do not own this resource",
  details?: Record<string, unknown>,
) => errorBody(403, "FORBIDDEN", message, details);

/** 403 for plan-limit rejections — details stay flat inside `error`. */
export const planLimitExceeded = (details: Record<string, unknown>) =>
  errorBody(
    403,
    "PLAN_LIMIT_EXCEEDED",
    typeof details.message === "string" ? details.message : "Project limit exceeded for your plan",
    details,
  );

export const notFound = (message = "Resource not found") => errorBody(404, "NOT_FOUND", message);

export const badRequest = (code: string, message: string) => errorBody(400, code, message);

export const noContent = (): Response => new Response(null, { status: 204 });

export const rateLimited = (
  limit: number,
  remaining: number,
  resetMs: number,
  retryAfterSec?: number,
): Response => {
  const retryAfter = retryAfterSec ?? Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
  return json(
    { error: { code: "RATE_LIMITED", message: "Too many requests, please retry shortly" } },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(resetMs),
      },
    },
  );
};
