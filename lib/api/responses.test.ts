import { describe, expect, test } from "bun:test";

import {
  badRequest,
  forbidden,
  HttpError,
  json,
  noContent,
  notFound,
  planLimitExceeded,
  rateLimited,
  unauthorized,
} from "@/lib/api/responses";

describe("HttpError + json", () => {
  test("carries status/code/message", () => {
    const err = new HttpError(403, "FORBIDDEN", "nope");
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("nope");
  });

  test("json sets content-type and round-trips", async () => {
    const res = json({ hello: "world" }, { status: 201 });
    expect(res.status).toBe(201);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(await res.json()).toEqual({ hello: "world" });
  });
});

describe("status shortcuts", () => {
  test("shapes", async () => {
    expect((await unauthorized().json()) as unknown).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
    expect(notFound().status).toBe(404);
    expect(badRequest("INVALID_BODY", "bad").status).toBe(400);
    expect(noContent().status).toBe(204);
  });

  test("planLimitExceeded keeps details flat inside error", async () => {
    const res = planLimitExceeded({ currentPlan: "free", limit: 3 });
    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      error: { code: string; currentPlan: string; limit: number };
    };
    expect(body.error.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(body.error.currentPlan).toBe("free");
    expect(body.error.limit).toBe(3);
  });

  test("rateLimited sets 429 + headers", async () => {
    const reset = Date.now() + 5000;
    const res = rateLimited(10, 0, reset, 7);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("7");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
