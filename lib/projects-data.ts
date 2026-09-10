// ---------------------------------------------------------------------------
// Server-only data helper for the editor's project list.
//
// The proxy in `proxy.ts` already redirects unauthenticated visitors, so
// `userId` is expected to be present in practice; the `auth()` null check
// is defense in depth and keeps the function total (returns an empty pair
// instead of throwing).
//
// `owned` lists projects where the user is the owner. `shared` lists
// projects the user has been invited to as a collaborator — matched by
// `ProjectCollaborator.email === currentUserEmail` (both sides lowercased
// so casing doesn't break the match). The shared list is empty when the
// user has no verified primary email or no collaborator rows reference it.
// ---------------------------------------------------------------------------

import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { slugify, type Project } from "@/lib/projects";
import { cacheGet, cacheSet, projectsCacheKey, PROJECTS_TTL_SECONDS } from "@/lib/redis";

export type ProjectsForUser = {
  owned: Project[];
  shared: Project[];
};

export async function getProjectsForCurrentUser(): Promise<ProjectsForUser> {
  const { userId } = await auth();
  if (!userId) {
    return { owned: [], shared: [] };
  }

  const user = await currentUser();
  // Match invites against every address on the Clerk user — a project shared
  // with a secondary email must still show up in the shared tab.
  const emails = (user?.emailAddresses ?? [])
    .map((ea) => ea.emailAddress.toLowerCase())
    .filter((address) => address.length > 0);
  const email = emails[0] ?? "";

  // Cache-aside (spec 33): keyed by Clerk userId, which uniquely identifies
  // the viewer, so one user can never read another's cached row. Fail-open:
  // a miss (or disabled/down Redis) runs the Prisma queries below.
  const key = projectsCacheKey(userId);
  const cached = await cacheGet<ProjectsForUser>(key);
  if (cached) return cached;

  const [ownedRows, sharedRows] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
    email.length > 0
      ? prisma.project.findMany({
          where: { collaborators: { some: { email: { in: emails } } } },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, ownerId: true },
        })
      : Promise.resolve([] as { id: string; name: string; ownerId: string }[]),
  ]);

  const owned: Project[] = ownedRows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: slugify(row.name),
    ownerId: userId,
    isOwner: true,
  }));

  const shared: Project[] = sharedRows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: slugify(row.name),
    ownerId: row.ownerId,
    isOwner: false,
  }));

  const result: ProjectsForUser = { owned, shared };
  await cacheSet(key, result, PROJECTS_TTL_SECONDS);
  return result;
}
