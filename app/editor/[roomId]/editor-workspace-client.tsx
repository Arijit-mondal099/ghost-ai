"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Share2Icon, SparklesIcon, XIcon } from "lucide-react";

import {
  CreateProjectDialog,
  DeleteProjectDialog,
  EditorNavbar,
  ProjectSidebar,
  RenameProjectDialog,
  ShareProjectDialog,
} from "@/components/editor";
import { Button } from "@/components/ui/button";
import { useProjectActions } from "@/hooks/use-project-actions";
import { useShareDialog } from "@/hooks/use-share-dialog";
import type { Project } from "@/lib/projects";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Client child for the per-project workspace. Owns the two sidebar
// open/close states. Renders the chrome: top navbar (project name + share
// + AI toggle + user button), left project sidebar (current room
// highlighted), centered canvas placeholder, and the right AI sidebar
// placeholder.
//
// The Share button opens the share dialog (spec 09). The dialog is
// read-only for collaborators — `isOwner` is computed server-side in
// `app/editor/[roomId]/page.tsx` so the client cannot escalate it.
// `useUser()` from Clerk supplies the signed-in user's primary email so
// the dialog can render a "You" badge next to the viewer's own row in
// the collaborator list. The email is only used for a client-side label
// match; no server trust boundary depends on it.
// ---------------------------------------------------------------------------

type EditorWorkspaceClientProps = {
  project: { id: string; name: string };
  projects: Project[];
  isOwner: boolean;
};

function EditorWorkspaceClient({ project, projects, isOwner }: EditorWorkspaceClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const { user } = useUser();
  const currentUserEmail = user?.emailAddresses[0]?.emailAddress ?? null;
  const dialogs = useProjectActions(projects);
  const share = useShareDialog({ projectId: project.id });

  return (
    <div className="flex h-dvh flex-col bg-base">
      <EditorNavbar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((open) => !open)}
        center={project.name}
        rightActions={
          <>
            <Button variant="outline" size="sm" onClick={share.open} aria-label="Share project">
              <Share2Icon />
              Share
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsAiSidebarOpen((open) => !open)}
              aria-label={isAiSidebarOpen ? "Close AI sidebar" : "Open AI sidebar"}
              aria-expanded={isAiSidebarOpen}
            >
              <SparklesIcon />
            </Button>
          </>
        }
      />
      <ProjectSidebar
        isOpen={isSidebarOpen}
        ownedProjects={dialogs.ownedProjects}
        sharedProjects={dialogs.sharedProjects}
        currentRoomId={project.id}
        onClose={() => setIsSidebarOpen(false)}
        onCreate={dialogs.openCreate}
        onRename={dialogs.openRename}
        onDelete={dialogs.openDelete}
      />

      <main
        className={cn(
          "flex flex-1 items-center justify-center px-6 transition-all duration-200",
          isSidebarOpen ? "pl-72" : "pl-0",
          isAiSidebarOpen ? "pr-80" : "pr-0",
        )}
      >
        <p className="text-sm text-copy-muted">Canvas</p>
      </main>

      <aside
        inert={!isAiSidebarOpen}
        aria-hidden={!isAiSidebarOpen}
        className={cn(
          "fixed right-0 top-14 bottom-0 z-40 flex w-80 flex-col border-l border-surface-border bg-base/95 backdrop-blur-md transition-transform duration-200",
          isAiSidebarOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <span className="text-sm font-medium text-copy-primary">AI</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsAiSidebarOpen(false)}
            aria-label="Close AI sidebar"
          >
            <XIcon />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-copy-muted">AI chat coming soon.</p>
        </div>
      </aside>

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
        isOwner={isOwner}
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

export { EditorWorkspaceClient };
export type { EditorWorkspaceClientProps };
