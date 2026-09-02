// ---------------------------------------------------------------------------
// Project model + mock data for the editor sidebar and project dialogs.
//
// Shape mirrors the eventual Prisma model: one owner (Clerk user id),
// optional collaborators. `isOwner` is the runtime projection of `ownerId`
// against the signed-in user; for the mock data we hardcode it.
//
// Real auth (and `ownerId` from Clerk) lands in a later spec. Until then we
// keep the runtime field `isOwner` so the UI can render owned vs shared
// without depending on a session.
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  isOwner: boolean;
  collaborators?: { id: string }[];
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const mockProjects: Project[] = [
  {
    id: "p1",
    name: "Auth Service Redesign",
    slug: "auth-service-redesign",
    ownerId: "user_1",
    isOwner: true,
  },
  {
    id: "p2",
    name: "Event Pipeline",
    slug: "event-pipeline",
    ownerId: "user_1",
    isOwner: true,
  },
  {
    id: "p3",
    name: "Platform Roadmap",
    slug: "platform-roadmap",
    ownerId: "user_2",
    isOwner: false,
    collaborators: [{ id: "user_1" }],
  },
];
