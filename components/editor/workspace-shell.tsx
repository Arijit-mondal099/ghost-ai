"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { LayoutTemplateIcon, Share2Icon, SparklesIcon } from "lucide-react";

import {
  CanvasSaveButton,
  CreateProjectDialog,
  DeleteProjectDialog,
  EditorNavbar,
  ProjectSidebar,
  RenameProjectDialog,
  ShareProjectDialog,
  UpgradePlanDialog,
} from "@/components/editor";
import { WorkspaceUIProvider, useWorkspaceUI } from "@/components/editor/workspace-ui-context";
import { Button } from "@/components/ui/button";
import { useShareDialog } from "@/hooks/use-share-dialog";
import type { BillingSummary } from "@/lib/billing";
import type { Project } from "@/lib/projects";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Persistent editor chrome for `app/editor/layout.tsx`. Owns the navbar,
// left project sidebar, and all project/share dialogs — everything that must
// stay mounted (and keep its state, e.g. sidebar open) while the user hops
// between rooms. The layout above never depends on the room id, so room
// switches reload only `{children}` (home empty-state or per-room canvas)
// while this chrome — sidebar included — stays fixed on screen.
//
// The current room resolves client-side from `useParams()` against the
// projects list (which carries each project's name + ownership), so no
// per-room server fetch suspends this tree. The mounted room page also
// reports its gate-checked name + ownership through `activeRoom`, which wins
// over the list lookup — the list can lag one navigation behind (e.g. right
// after creating a project, before the layout refetch lands), while the
// page gate is authoritative for the room on screen. Room actions (Save /
// Share / Templates / AI) render only when either source matches — on the
// home route, or for a room the viewer cannot access, the navbar falls back
// to the plain home chrome. The page-level access gate stays authoritative;
// this lookup only drives labels and dialog modes.
//
// The Share button opens the share dialog (spec 09). The dialog is
// read-only for collaborators — `isOwner` comes from the server-filled
// project list, so the client cannot escalate it. `useUser()` from Clerk
// supplies the signed-in user's emails so the dialog can render a "You"
// badge next to the viewer's own row in the collaborator list. The emails
// are only used for a client-side label match; no server trust boundary
// depends on them.
// ---------------------------------------------------------------------------

type WorkspaceShellProps = {
  projects: Project[];
  billing?: BillingSummary;
  children: ReactNode;
};

function WorkspaceShellInner({
  billing,
  children,
}: {
  billing?: BillingSummary;
  children: ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const ui = useWorkspaceUI();
  const { dialogs } = ui;
  const params = useParams();
  const roomId = typeof params.roomId === "string" ? params.roomId : undefined;
  const current = useMemo(
    () =>
      roomId
        ? ui.activeRoom?.id === roomId
          ? { name: ui.activeRoom.name, isOwner: ui.activeRoom.isOwner }
          : ([...dialogs.ownedProjects, ...dialogs.sharedProjects].find((p) => p.id === roomId) ??
            null)
        : null,
    [dialogs.ownedProjects, dialogs.sharedProjects, roomId, ui.activeRoom],
  );
  // Room chrome (project name, Save/Share/Templates/AI) only for a room the
  // viewer can see in their lists. The layout fetch + page gate stay
  // authoritative — this just keeps labels honest.
  const inRoom = current !== null;
  const { user } = useUser();
  const share = useShareDialog({ projectId: roomId ?? "" });
  // A room switch invalidates the open dialog's rows — close it rather than
  // show the previous room's collaborators.
  useEffect(() => {
    share.close();
  }, [roomId, share.close]);
  // Prefer the user's address that actually appears in the collaborator list
  // (an invite may target a secondary email); fall back to the primary.
  const allUserEmails = user?.emailAddresses?.map((ea) => ea.emailAddress) ?? [];
  const currentUserEmail =
    allUserEmails.find((address) =>
      share.collaborators.some((row) => row.email.toLowerCase() === address.toLowerCase()),
    ) ??
    allUserEmails[0] ??
    null;

  return (
    <div className="flex h-dvh flex-col bg-base">
      <EditorNavbar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((open) => !open)}
        center={current?.name}
        showUserButton={!inRoom}
        rightActions={
          inRoom ? (
            <>
              <CanvasSaveButton status={ui.saveStatus} onSave={ui.requestSave} />
              <Button variant="outline" size="sm" onClick={share.open} aria-label="Share project">
                <Share2Icon />
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => ui.setTemplatesOpen(true)}
                aria-label="Open starter templates"
              >
                <LayoutTemplateIcon />
                Templates
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => ui.setAiOpen(!ui.isAiOpen)}
                aria-label={ui.isAiOpen ? "Close AI sidebar" : "Open AI sidebar"}
                aria-expanded={ui.isAiOpen}
              >
                <SparklesIcon />
                AI
              </Button>
            </>
          ) : undefined
        }
      />
      <ProjectSidebar
        isOpen={isSidebarOpen}
        ownedProjects={dialogs.ownedProjects}
        sharedProjects={dialogs.sharedProjects}
        currentRoomId={roomId}
        billing={billing}
        onClose={() => setIsSidebarOpen(false)}
        onCreate={dialogs.openCreate}
        onRename={dialogs.openRename}
        onDelete={dialogs.openDelete}
      />

      <main
        className={cn(
          "flex h-full w-full flex-1 items-center justify-center transition-all duration-200",
          isSidebarOpen ? "pl-72" : "pl-0",
          ui.isAiOpen ? "pr-80" : "pr-0",
        )}
      >
        {children}
      </main>

      <CreateProjectDialog
        open={dialogs.isCreateOpen}
        formName={dialogs.formName}
        isSubmitting={dialogs.isSubmitting}
        onOpenChange={(open) => {
          if (!open) dialogs.closeDialog();
        }}
        onFormNameChange={dialogs.setFormName}
        onSubmit={() => void dialogs.submitCreate()}
      />
      <RenameProjectDialog
        project={dialogs.renameTarget}
        open={dialogs.isRenameOpen}
        formName={dialogs.formName}
        isSubmitting={dialogs.isSubmitting}
        onOpenChange={(open) => {
          if (!open) dialogs.closeDialog();
        }}
        onFormNameChange={dialogs.setFormName}
        onSubmit={() => void dialogs.submitRename()}
      />
      <UpgradePlanDialog
        open={dialogs.isUpgradeOpen}
        upgrade={dialogs.upgrade}
        onOpenChange={(open) => {
          if (!open) dialogs.closeUpgrade();
        }}
      />
      <DeleteProjectDialog
        project={dialogs.deleteTarget}
        open={dialogs.isDeleteOpen}
        isSubmitting={dialogs.isSubmitting}
        onOpenChange={(open) => {
          if (!open) dialogs.closeDialog();
        }}
        onSubmit={() => void dialogs.submitConfirmDelete()}
      />
      <ShareProjectDialog
        isOpen={share.isOpen}
        isOwner={current?.isOwner ?? false}
        isLoading={share.isLoading}
        isInviting={share.isInviting}
        isRemovingId={share.isRemovingId}
        isCopied={share.isCopied}
        formEmail={share.formEmail}
        errorMessage={share.errorMessage}
        owner={share.owner}
        collaborators={share.collaborators}
        currentUserEmail={currentUserEmail}
        onOpenChange={(open) => {
          if (!open) share.close();
        }}
        onFormEmailChange={share.setFormEmail}
        onSubmitInvite={() => void share.submitInvite()}
        onRemove={(id) => void share.submitRemove(id)}
        onCopyLink={() => void share.copyLink()}
      />
    </div>
  );
}

function WorkspaceShell({ projects, billing, children }: WorkspaceShellProps) {
  return (
    <WorkspaceUIProvider projects={projects}>
      <WorkspaceShellInner billing={billing}>{children}</WorkspaceShellInner>
    </WorkspaceUIProvider>
  );
}

export { WorkspaceShell };
export type { WorkspaceShellProps };
