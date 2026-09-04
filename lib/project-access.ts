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

export type CurrentIdentity = {
  userId: string;
  email: string;
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
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  return { userId, email };
}

export async function getAccessibleProject(
  roomId: string,
  identity: CurrentIdentity,
): Promise<AccessibleProject | null> {
  if (roomId.trim().length === 0) return null;

  return prisma.project.findFirst({
    where: {
      id: roomId,
      OR: [{ ownerId: identity.userId }, { collaborators: { some: { email: identity.email } } }],
    },
    select: { id: true, name: true, ownerId: true },
  });
}
