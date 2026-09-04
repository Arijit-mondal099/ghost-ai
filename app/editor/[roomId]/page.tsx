import { redirect } from "next/navigation";

import { EditorWorkspaceClient } from "@/app/editor/[roomId]/editor-workspace-client";
import { AccessDenied } from "@/components/editor/access-denied";
import { getCurrentIdentity, getAccessibleProject } from "@/lib/project-access";
import { getProjectsForCurrentUser } from "@/lib/projects-data";

// ---------------------------------------------------------------------------
// Per-project workspace. Server component: decides access before rendering
// anything so the chrome doesn't flash to a signed-in user who shouldn't be
// in this room.
//
// Auth is enforced by `proxy.ts` — unauthenticated visitors never reach
// this page. The page-level `getCurrentIdentity` null check is defense in
// depth and keeps the function total.
// ---------------------------------------------------------------------------

async function EditorRoomPage({ params }: PageProps<"/editor/[roomId]">) {
  const { roomId } = await params;

  const identity = await getCurrentIdentity();
  if (!identity) {
    redirect("/sign-in");
  }

  const project = await getAccessibleProject(roomId, identity);
  if (!project) {
    return <AccessDenied />;
  }

  const isOwner = project.ownerId === identity.userId;

  const { owned, shared } = await getProjectsForCurrentUser();
  const projects = [...owned, ...shared];

  return (
    <EditorWorkspaceClient
      project={{ id: project.id, name: project.name }}
      projects={projects}
      isOwner={isOwner}
    />
  );
}

export default EditorRoomPage;
