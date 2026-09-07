"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { LayoutTemplateIcon, Share2Icon, SparklesIcon } from "lucide-react";

import {
  AISidebar,
  CanvasRoom,
  CanvasSaveButton,
  CreateProjectDialog,
  DeleteProjectDialog,
  EditorNavbar,
  ProjectSidebar,
  RenameProjectDialog,
  ShareProjectDialog,
  StarterTemplatesModal,
} from "@/components/editor";
import { Button } from "@/components/ui/button";
import { useProjectActions } from "@/hooks/use-project-actions";
import { useShareDialog } from "@/hooks/use-share-dialog";
import { type CanvasSaveStatus } from "@/hooks/use-canvas-autosave";
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
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  // Bumped after each successful template import so the in-canvas fit
  // trigger (`CanvasTemplateFitOnLoad`) can fire `fitView()` once the new
  // nodes/edges are in storage.
  const [templateFitVersion, setTemplateFitVersion] = useState(0);
  // Autosave status reported up from the in-canvas hook (spec 21); the
  // navbar Save button lives outside `RoomProvider` where the graph is
  // unavailable, so status travels via callback and manual saves via a
  // version counter the hook watches.
  const [saveStatus, setSaveStatus] = useState<CanvasSaveStatus>("idle");
  const [saveRequestVersion, setSaveRequestVersion] = useState(0);
  const { user } = useUser();
  const dialogs = useProjectActions(projects);
  const share = useShareDialog({ projectId: project.id });
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
        center={project.name}
        showUserButton={false}
        rightActions={
          <>
            <CanvasSaveButton
              status={saveStatus}
              onSave={() => setSaveRequestVersion((v) => v + 1)}
            />
            <Button variant="outline" size="sm" onClick={share.open} aria-label="Share project">
              <Share2Icon />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTemplatesOpen(true)}
              aria-label="Open starter templates"
            >
              <LayoutTemplateIcon />
              Templates
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAiSidebarOpen((open) => !open)}
              aria-label={isAiSidebarOpen ? "Close AI sidebar" : "Open AI sidebar"}
              aria-expanded={isAiSidebarOpen}
            >
              <SparklesIcon />
              AI
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
          "flex h-full w-full flex-1 items-center justify-center transition-all duration-200",
          isSidebarOpen ? "pl-72" : "pl-0",
          isAiSidebarOpen ? "pr-80" : "pr-0",
        )}
      >
        <CanvasRoom
          roomId={project.id}
          templateFitVersion={templateFitVersion}
          saveRequestVersion={saveRequestVersion}
          onSaveStatusChange={setSaveStatus}
        >
          {/* Rendered inside <RoomProvider> so `useMutation` inside
              `useCanvasTemplateLoad` resolves the room context. The Radix
              Dialog portal keeps the visual position unchanged. */}
          <StarterTemplatesModal
            open={isTemplatesOpen}
            onOpenChange={setIsTemplatesOpen}
            onImported={() => setTemplateFitVersion((v) => v + 1)}
          />
        </CanvasRoom>
      </main>

      <AISidebar isOpen={isAiSidebarOpen} onClose={() => setIsAiSidebarOpen(false)} />

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
