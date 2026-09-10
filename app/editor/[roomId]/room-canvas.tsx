"use client";

import { useEffect, useState } from "react";

import { AISidebar, CanvasRoom, StarterTemplatesModal } from "@/components/editor";
import { useWorkspaceUI } from "@/components/editor/workspace-ui-context";

// ---------------------------------------------------------------------------
// Per-room canvas for `[roomId]/page.tsx`. Remounts on every room switch —
// only this subtree shows a loading state (the `CanvasConnecting` drafting
// loader inside `CanvasRoom`), while the shell chrome in the layout stays
// put.
//
// `StarterTemplatesModal` and `AISidebar` render as `CanvasRoom` children so
// their Liveblocks hooks resolve the room context (see `CanvasRoomProps`);
// their open states live in the shell-owned `WorkspaceUIContext` because the
// toggle buttons sit in the layout navbar.
// ---------------------------------------------------------------------------

function RoomCanvas({
  roomId,
  roomName,
  isOwner,
}: {
  roomId: string;
  roomName: string;
  isOwner: boolean;
}) {
  // Bumped after each successful template import so the in-canvas fit
  // trigger (`CanvasTemplateFitOnLoad`) can fire `fitView()` once the new
  // nodes/edges are in storage.
  const [templateFitVersion, setTemplateFitVersion] = useState(0);
  const ui = useWorkspaceUI();
  const { setActiveRoom, setAiOpen, setTemplatesOpen, setSaveStatus } = ui;

  // A fresh room gets fresh UI state: never inherit the previous room's AI
  // sidebar, templates modal, or save status through the persistent shell.
  // The gate-checked name + ownership is reported up at the same time so the
  // shell navbar is correct the moment this room commits — even when the
  // shell's project list lags one navigation behind (e.g. just created).
  useEffect(() => {
    setActiveRoom({ id: roomId, name: roomName, isOwner });
    setAiOpen(false);
    setTemplatesOpen(false);
    setSaveStatus("idle");
  }, [roomId, roomName, isOwner, setActiveRoom, setAiOpen, setTemplatesOpen, setSaveStatus]);

  return (
    <CanvasRoom
      roomId={roomId}
      templateFitVersion={templateFitVersion}
      saveRequestVersion={ui.saveRequestVersion}
      onSaveStatusChange={ui.setSaveStatus}
    >
      {/* Rendered inside <RoomProvider> so `useMutation` inside
          `useCanvasTemplateLoad` resolves the room context. The Radix
          Dialog portal keeps the visual position unchanged. */}
      <StarterTemplatesModal
        open={ui.isTemplatesOpen}
        onOpenChange={ui.setTemplatesOpen}
        onImported={() => setTemplateFitVersion((v) => v + 1)}
      />
      {/* The AI sidebar also lives here (it is `fixed`, so the visual
          position is unchanged): `useDesignAgent` listens for the
          room-wide AI_STATUS feed via `useEventListener`, which needs
          the room context. */}
      <AISidebar
        isOpen={ui.isAiOpen}
        onClose={() => ui.setAiOpen(false)}
        projectId={roomId}
        roomId={roomId}
      />
    </CanvasRoom>
  );
}

export { RoomCanvas };
