import { WorkspaceShell } from "@/components/editor/workspace-shell";
import { getBillingSummaryForCurrentUser, getProjectsForCurrentUser } from "@/lib/projects-data";

// ---------------------------------------------------------------------------
// Editor layout. Server component: fetches the user's projects once via
// Prisma (through `getProjectsForCurrentUser`) and hands the list to the
// persistent `WorkspaceShell` chrome (navbar + sidebar + dialogs).
//
// This layout depends only on the viewer — never on the room id — so it is
// fetched once and reused across room-to-room navigations without
// suspending. The sidebar therefore stays mounted, open, and interactive
// while only the page subtree below reloads.
//
// Auth is enforced by `proxy.ts` — unauthenticated visitors never reach
// this layout. The server-side `auth()` call inside the data helper is
// defense in depth and keeps the function total.
// ---------------------------------------------------------------------------

async function EditorLayout({ children }: { children: React.ReactNode }) {
  // Fail-open billing: if the summary query rejects, the editor still renders
  // with the project list — the navbar/sidebar fall back to the free upsell
  // when `billing` is undefined.
  const [{ owned, shared }, billing] = await Promise.all([
    getProjectsForCurrentUser(),
    getBillingSummaryForCurrentUser().catch((error) => {
      console.warn("Billing summary unavailable, rendering without plan usage:", error);
      return undefined;
    }),
  ]);
  const projects = [...owned, ...shared];

  return (
    <WorkspaceShell projects={projects} billing={billing}>
      {children}
    </WorkspaceShell>
  );
}

export default EditorLayout;
