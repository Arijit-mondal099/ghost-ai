import { redirect } from "next/navigation";

import { RoomCanvas } from "@/app/editor/[roomId]/room-canvas";
import { AccessDenied } from "@/components/editor/access-denied";
import { getCurrentIdentity, getAccessibleProject } from "@/lib/project-access";

// ---------------------------------------------------------------------------
// Per-project workspace page. Server component: decides access before
// rendering anything so the canvas doesn't flash to a signed-in user who
// shouldn't be in this room. Project data and chrome live in the editor
// layout above (which never suspends on room switches) — the page only
// gates and mounts the per-room canvas, so room-to-room navigation reloads
// just this subtree while the sidebar stays fixed.
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

  // Ownership is computed server-side so the shell's Share dialog mode never
  // depends on client-derivable data. The name + flag travel with the canvas
  // so the navbar is correct the moment this room commits.
  const isOwner = project.ownerId === identity.userId;

  return <RoomCanvas roomId={roomId} roomName={project.name} isOwner={isOwner} />;
}

export default EditorRoomPage;
