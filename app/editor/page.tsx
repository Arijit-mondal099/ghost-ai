"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import {
  CreateProjectDialog,
  DeleteProjectDialog,
  EditorNavbar,
  ProjectSidebar,
  RenameProjectDialog,
} from "@/components/editor";
import { Button } from "@/components/ui/button";
import { useProjectDialogs } from "@/hooks/use-project-dialogs";

function EditorPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const dialogs = useProjectDialogs();

  return (
    <div className="flex h-dvh flex-col bg-base">
      <EditorNavbar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen((open) => !open)} />
      <ProjectSidebar
        isOpen={isSidebarOpen}
        ownedProjects={dialogs.ownedProjects}
        sharedProjects={dialogs.sharedProjects}
        onClose={() => setIsSidebarOpen(false)}
        onCreate={dialogs.openCreate}
        onRename={dialogs.openRename}
        onDelete={dialogs.openDelete}
      />
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <h1 className="text-xl font-medium text-copy-primary">
            Create a project or open an existing one
          </h1>
          <p className="text-sm text-copy-muted">
            Start a new architecture workspace, or choose a project from the sidebar.
          </p>
          <Button onClick={dialogs.openCreate} className="mt-1">
            <PlusIcon />
            New Project
          </Button>
        </div>
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
      <DeleteProjectDialog
        project={dialogs.deleteTarget}
        open={dialogs.isDeleteOpen}
        isSubmitting={dialogs.isSubmitting}
        onOpenChange={(open) => {
          if (!open) dialogs.closeDialog();
        }}
        onSubmit={() => void dialogs.submitConfirmDelete()}
      />
    </div>
  );
}

export default EditorPage;
