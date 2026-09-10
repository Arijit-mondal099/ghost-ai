// ---------------------------------------------------------------------------
// Server-only Upstash Redis cache (spec 33).
//
// Cache-aside for hot project metadata only: access checks, project lists,
// collaborator lists, spec lists. Prisma stays the source of truth; Vercel
// Blob stays the artifact store. The cache is a read accelerator, never an
// authority.
//
// Fail-open everywhere: every Redis call runs under a 750ms timeout inside
// try/catch. On any error (missing env, network, timeout, 5xx) the helper
// logs a server-side warning with the key + operation and the caller falls
// through to the existing Prisma path. Cache errors never change HTTP
// status codes.
//
// SDK notes (per the upstash-redis-js skill): credentials only via
// `Redis.fromEnv()`; native JS types auto-serialize (no manual
// JSON.stringify/parse); every `set` passes `ex` in seconds; keys live
// under the `ghost:` namespace.
// ---------------------------------------------------------------------------

import "server-only";

import { Redis } from "@upstash/redis";

const CACHE_TIMEOUT_MS = 750;
const ACCESS_VERSION_TTL_SECONDS = 24 * 60 * 60;

export const ACCESS_TTL_SECONDS = 60;
export const PROJECTS_TTL_SECONDS = 60;
export const COLLABS_TTL_SECONDS = 60;
export const SPECS_TTL_SECONDS = 120;

const TIMED_OUT: unique symbol = Symbol("redis-timeout");

export function isCacheEnabled(): boolean {
  return (
    (process.env["UPSTASH_REDIS_REST_URL"] ?? "").length > 0 &&
    (process.env["UPSTASH_REDIS_REST_TOKEN"] ?? "").length > 0
  );
}

interface GlobalForRedis {
  redisGlobal?: Redis;
}

const globalRef = globalThis as typeof globalThis & GlobalForRedis;

function getClient(): Redis | null {
  if (!isCacheEnabled()) return null;
  if (globalRef.redisGlobal) return globalRef.redisGlobal;
  try {
    const client = Redis.fromEnv();
    globalRef.redisGlobal = client;
    return client;
  } catch (error) {
    console.warn("[redis] failed to create client", error);
    return null;
  }
}

async function withTimeout<T>(
  work: Promise<T>,
  op: string,
  key: string,
): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  try {
    return await Promise.race([
      work,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[redis] ${op} timed out key=${key}`);
          resolve(TIMED_OUT);
        }, CACHE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const result = await withTimeout(client.get<T>(key), "get", key);
    if (result === TIMED_OUT) return null;
    return result ?? null;
  } catch (error) {
    console.warn(`[redis] get failed key=${key}`, error);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, exSeconds: number): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await withTimeout(client.set(key, value, { ex: exSeconds }), "set", key);
  } catch (error) {
    console.warn(`[redis] set failed key=${key}`, error);
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const client = getClient();
  if (!client) return;
  try {
    await withTimeout(client.del(...keys), "del", keys.join(","));
  } catch (error) {
    console.warn(`[redis] del failed keys=${keys.join(",")}`, error);
  }
}

export function accessVersionKey(projectId: string): string {
  return `ghost:accessver:${projectId}`;
}

export function accessCacheKey(projectId: string, userId: string, version: string): string {
  return `ghost:access:${projectId}:${userId}:v${version}`;
}

export function projectsCacheKey(userId: string): string {
  return `ghost:projects:${userId}`;
}

export function collabsCacheKey(projectId: string): string {
  return `ghost:collabs:${projectId}`;
}

export function specsCacheKey(projectId: string): string {
  return `ghost:specs:${projectId}`;
}

// Generation counter for access-key invalidation (no key scans). Returns
// the counter as a string, "0" when the counter key is absent (healthy
// Redis, never bumped), or null when caching must be skipped entirely
// (disabled, timed out, errored) so callers avoid a second stalled call.
export async function getAccessVersion(projectId: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const key = accessVersionKey(projectId);
  try {
    const result = await withTimeout(client.get<number>(key), "get", key);
    if (result === TIMED_OUT) return null;
    if (result === null || result === undefined) return "0";
    return String(result);
  } catch (error) {
    console.warn(`[redis] getAccessVersion failed key=${key}`, error);
    return null;
  }
}

// Bumped on every membership change (invite/remove) and on project
// rename/delete. Old versioned access keys simply miss from here on.
export async function bumpAccessVersion(projectId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  const key = accessVersionKey(projectId);
  try {
    const result = await withTimeout(client.incr(key), "incr", key);
    if (result === TIMED_OUT) return;
    // Refresh the counter TTL so dead projects don't leak counter keys.
    await withTimeout(client.expire(key, ACCESS_VERSION_TTL_SECONDS), "expire", key);
  } catch (error) {
    console.warn(`[redis] bumpAccessVersion failed key=${key}`, error);
  }
}
