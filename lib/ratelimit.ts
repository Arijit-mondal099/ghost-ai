// ---------------------------------------------------------------------------
// Server-only Upstash rate limiting (spec 34).
//
// Sliding-window pre-gate for expensive server surfaces: AI generation
// routes (tier `ai`, 10 req / 60 s) and Liveblocks token minting (tier
// `liveblocks`, 120 req / 60 s). Reuses the Spec 33 Redis env vars via
// `Redis.fromEnv()` — no new credentials.
//
// Fail-open everywhere: when disabled (no env vars) or when Redis throws,
// times out, or 5xxs, the caller allows the request. Limiter errors never
// change HTTP status codes.
//
// The Redis singleton below intentionally duplicates the ~15-line lazy
// pattern from `lib/redis.ts` (rather than importing its private
// `getClient()`) so cache and limiter can evolve independently.
// ---------------------------------------------------------------------------

import "server-only";

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const RATELIMIT_TIMEOUT_MS = 750;

export type RateLimitTier = "ai" | "liveblocks";

export type RateLimitDecision =
  | { ok: true; limit?: undefined; remaining?: undefined; reset?: undefined }
  | { ok: boolean; limit: number; remaining: number; reset: number };

const TIMED_OUT: unique symbol = Symbol("ratelimit-timeout");

export function isRateLimitEnabled(): boolean {
  return (
    (process.env["UPSTASH_REDIS_REST_URL"] ?? "").length > 0 &&
    (process.env["UPSTASH_REDIS_REST_TOKEN"] ?? "").length > 0
  );
}

interface GlobalForRateLimit {
  ratelimitRedisGlobal?: Redis;
  aiLimiterGlobal?: Ratelimit;
  liveblocksLimiterGlobal?: Ratelimit;
}

const globalRef = globalThis as typeof globalThis & GlobalForRateLimit;

function getRedis(): Redis | null {
  if (!isRateLimitEnabled()) return null;
  if (globalRef.ratelimitRedisGlobal) return globalRef.ratelimitRedisGlobal;
  try {
    const client = Redis.fromEnv();
    globalRef.ratelimitRedisGlobal = client;
    return client;
  } catch (error) {
    console.warn("[ratelimit] failed to create client", error);
    return null;
  }
}

function getLimiter(tier: RateLimitTier): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (tier === "ai") {
    if (!globalRef.aiLimiterGlobal) {
      globalRef.aiLimiterGlobal = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "60 s"),
        prefix: "ghost:ratelimit:ai",
        analytics: false,
      });
    }
    return globalRef.aiLimiterGlobal;
  }
  if (!globalRef.liveblocksLimiterGlobal) {
    globalRef.liveblocksLimiterGlobal = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, "60 s"),
      prefix: "ghost:ratelimit:liveblocks",
      analytics: false,
    });
  }
  return globalRef.liveblocksLimiterGlobal;
}

export async function checkRateLimit(
  tier: RateLimitTier,
  identifier: string,
): Promise<RateLimitDecision> {
  const limiter = getLimiter(tier);
  // Disabled (no env vars) behaves identically to Redis-down: pure
  // pass-through, zero errors.
  if (!limiter) return { ok: true };
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  try {
    const result = await Promise.race([
      limiter.limit(identifier),
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[ratelimit] limit timed out tier=${tier} identifier=${identifier}`);
          resolve(TIMED_OUT);
        }, RATELIMIT_TIMEOUT_MS);
      }),
    ]);
    if (result === TIMED_OUT) return { ok: true };
    return {
      ok: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.warn(`[ratelimit] limit failed tier=${tier} identifier=${identifier}`, error);
    return { ok: true };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// Per-identity key segment: `user:{userId}` when authed, else `ip:{ip}`.
// Keeps keys bounded (lowercased, truncated) and PII-free beyond what auth
// already holds. Since every guarded route checks the limiter after auth,
// the IP branch is a safety net — 401s return before quota is consumed.
export function resolveRateLimitIdentifier(userId: string | null, request: Request): string {
  if (userId && userId.length > 0) return `user:${userId}`.toLowerCase().slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  const ip = forwarded.length > 0 ? forwarded : realIp;
  if (ip.length === 0) return "ip:unknown";
  return `ip:${ip}`.toLowerCase().slice(0, 64);
}
