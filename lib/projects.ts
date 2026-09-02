// ---------------------------------------------------------------------------
// UI-side project shape. The actual row lives in Prisma (`prisma/models/
// project.prisma`); the server-side helper in `lib/projects-data.ts` maps
// the Prisma row into this shape for the sidebar and dialogs.
//
// `isOwner` is the runtime projection of `ownerId` against the signed-in
// user. The server fills it in when it returns the list. `collaborators?`
// is reserved for the future shared-projects spec.
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
