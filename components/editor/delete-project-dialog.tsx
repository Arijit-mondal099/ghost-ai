"use client";

import { EditorDialog } from "@/components/editor/dialog";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/projects";

// ---------------------------------------------------------------------------
// Delete project confirmation. No form, no input. The Content's close
// button is suppressed (`showCloseButton={false}`) so destructive flows
// aren't dismissed casually — the user has to make an explicit choice.
// ---------------------------------------------------------------------------

type DeleteProjectDialogProps = {
  project: Project | null;
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
};

function DeleteProjectDialog({
  project,
  open,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: DeleteProjectDialogProps) {
  return (
    <EditorDialog.Root open={open} onOpenChange={onOpenChange}>
      <EditorDialog.Content showCloseButton={false}>
        <EditorDialog.Header>
          <h3 className="text-lg font-medium">Delete project</h3>
          <EditorDialog.Description>
            Are you sure you want to delete{" "}
            <span className="font-medium text-copy-primary">{project?.name ?? "this project"}</span>
            {"?"}
          </EditorDialog.Description>
        </EditorDialog.Header>
        <EditorDialog.Footer>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onSubmit} disabled={isSubmitting}>
            Delete
          </Button>
        </EditorDialog.Footer>
      </EditorDialog.Content>
    </EditorDialog.Root>
  );
}

export { DeleteProjectDialog };
export type { DeleteProjectDialogProps };
