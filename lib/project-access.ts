// ---------------------------------------------------------------------------
// Server-only access helpers for the editor workspace page.
//
// The proxy in `proxy.ts` already gates `/editor` via `auth.protect()`, so
// `getCurrentIdentity` returning null is the rare defense-in-depth path
// (page-level redirect). `getAccessibleProject` collapses the "missing" and
// "unauthorized" cases into a single null because the spec routes both
// outcomes to the same `AccessDenied` surface — if a future spec needs to
// distinguish 404 from 403, this is the seam.
// ---------------------------------------------------------------------------

import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import {
  ACCESS_TTL_SECONDS,
  accessCacheKey,
  cacheGet,
  cacheSet,
  getAccessVersion,
} from "@/lib/redis";

export type CurrentIdentity = {
  userId: string;
  email: string;
  emails: string[];
};

export type AccessibleProject = {
  id: string;
  name: string;
  ownerId: string;
};

export async function getCurrentIdentity(): Promise<CurrentIdentity | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  // Collect every address, not just the primary — a collaborator invited via
  // a secondary email must still pass the access check below.
  const emails = (user?.emailAddresses ?? [])
    .map((ea) => ea.emailAddress.toLowerCase())
    .filter((address) => address.length > 0);
  const email = emails[0] ?? "";
  if (!email) return null;

  return { userId, email, emails };
}

export async function getAccessibleProject(
  roomId: string,
  identity: CurrentIdentity,
): Promise<AccessibleProject | null> {
  if (roomId.trim().length === 0) return null;

  // Cache-aside (spec 33): the key is versioned by the project's access
  // generation counter, so invite/remove/rename/delete bumps invalidate
  // without key scans. `version === null` (disabled/down) skips the cache
  // entirely and falls through to Prisma. Only hits are stored — a null
  // (no access) is never cached.
  const version = await getAccessVersion(roomId);
  const key = version === null ? null : accessCacheKey(roomId, identity.userId, version);
  if (key) {
    const cached = await cacheGet<AccessibleProject>(key);
    if (cached) return cached;
  }

  const fresh = await prisma.project.findFirst({
    where: {
      id: roomId,
      OR: [
        { ownerId: identity.userId },
        { collaborators: { some: { email: { in: identity.emails } } } },
      ],
    },
    select: { id: true, name: true, ownerId: true },
  });

  if (key && fresh) {
    await cacheSet(key, fresh, ACCESS_TTL_SECONDS);
  }
  return fresh;
}
