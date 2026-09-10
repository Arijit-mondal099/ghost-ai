"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { CanvasSaveStatus } from "@/hooks/use-canvas-autosave";
import { useProjectActions, type UseProjectActionsResult } from "@/hooks/use-project-actions";
import type { Project } from "@/lib/projects";

// ---------------------------------------------------------------------------
// Workspace UI channel for the persistent editor chrome (`app/editor/
// layout.tsx` → `WorkspaceShell`, which never unmounts on room switches)
// and its children (home empty-state, per-room canvas).
//
// The provider owns everything the chrome needs so any descendant can reach
// it without prop drilling:
//   - Project dialogs (create/rename/delete) + derived project lists, so
//     the home "New Project" CTA and the sidebar actions share one source.
//   - AI sidebar + templates modal open states (navbar toggles ↔ panels that
//     live inside the per-room canvas' RoomProvider).
//   - Canvas save channel (navbar Save button ↔ in-canvas autosave hook,
//     which lives inside RoomProvider where the graph exists).
//
// Sidebar open state stays local to the shell — nothing below needs it — so
// it is not part of this context.
// ---------------------------------------------------------------------------

type ActiveRoom = {
  id: string;
  name: string;
  isOwner: boolean;
};

type WorkspaceUIValue = {
  dialogs: UseProjectActionsResult;
  activeRoom: ActiveRoom | null;
  setActiveRoom: (room: ActiveRoom | null) => void;
  isAiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  isTemplatesOpen: boolean;
  setTemplatesOpen: (open: boolean) => void;
  saveStatus: CanvasSaveStatus;
  setSaveStatus: (status: CanvasSaveStatus) => void;
  saveRequestVersion: number;
  requestSave: () => void;
};

const WorkspaceUIContext = createContext<WorkspaceUIValue | null>(null);

function WorkspaceUIProvider({ projects, children }: { projects: Project[]; children: ReactNode }) {
  const dialogs = useProjectActions(projects);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [isAiOpen, setAiOpen] = useState(false);
  const [isTemplatesOpen, setTemplatesOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<CanvasSaveStatus>("idle");
  const [saveRequestVersion, setSaveRequestVersion] = useState(0);
  const requestSave = useCallback(() => setSaveRequestVersion((v) => v + 1), []);

  const value = useMemo<WorkspaceUIValue>(
    () => ({
      dialogs,
      activeRoom,
      setActiveRoom,
      isAiOpen,
      setAiOpen,
      isTemplatesOpen,
      setTemplatesOpen,
      saveStatus,
      setSaveStatus,
      saveRequestVersion,
      requestSave,
    }),
    [dialogs, activeRoom, isAiOpen, isTemplatesOpen, saveStatus, saveRequestVersion, requestSave],
  );

  return <WorkspaceUIContext.Provider value={value}>{children}</WorkspaceUIContext.Provider>;
}

function useWorkspaceUI(): WorkspaceUIValue {
  const value = useContext(WorkspaceUIContext);
  if (!value) throw new Error("useWorkspaceUI must be used inside WorkspaceUIProvider");
  return value;
}

export { WorkspaceUIProvider, useWorkspaceUI };
export type { ActiveRoom, WorkspaceUIValue };
