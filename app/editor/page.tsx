import { EditorHomeClient } from "@/app/editor/editor-home-client";
import { getProjectsForCurrentUser } from "@/lib/projects-data";

// ---------------------------------------------------------------------------
// Editor home. Server component: fetches the user's projects via Prisma
// (through `getProjectsForCurrentUser`) and hands the list to the client
// child. The child owns the sidebar open/close state and the dialog hook.
//
// Auth is enforced by `proxy.ts` — unauthenticated visitors never reach
// this page. The server-side `auth()` call inside the data helper is
// defense in depth and keeps the function total.
// ---------------------------------------------------------------------------

async function EditorPage() {
  const { owned, shared } = await getProjectsForCurrentUser();
  const initialProjects = [...owned, ...shared];

  return <EditorHomeClient initialProjects={initialProjects} />;
}

export default EditorPage;
