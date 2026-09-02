// ---------------------------------------------------------------------------
// Server-only data helper for the editor's project list.
//
// The proxy in `proxy.ts` already redirects unauthenticated visitors, so
// `userId` is expected to be present in practice; the `auth()` null check
// is defense in depth and keeps the function total (returns an empty pair
// instead of throwing).
//
// `shared` is intentionally empty for now — there is no collaborators
// endpoint yet. The future spec that introduces the shared-projects data
// shape fills in this query.
// ---------------------------------------------------------------------------

import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { slugify, type Project } from "@/lib/projects";

export type ProjectsForUser = {
  owned: Project[];
  shared: Project[];
};

export async function getProjectsForCurrentUser(): Promise<ProjectsForUser> {
  const { userId } = await auth();
  if (!userId) {
    return { owned: [], shared: [] };
  }

  const rows = await prisma.project.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  const owned: Project[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: slugify(row.name),
    ownerId: userId,
    isOwner: true,
  }));

  return { owned, shared: [] };
}
