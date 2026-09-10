"use client";

import { LoaderCircleIcon } from "lucide-react";

import { EditorDialog } from "@/components/editor/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Create project dialog. Controlled by the workspace UI context so the home
// "New Project" CTA and the sidebar "New Project" button share the same
// open handler. Name only — the workspace URL uses the server-generated
// project id, so no slug preview is shown.
// ---------------------------------------------------------------------------

type CreateProjectDialogProps = {
  open: boolean;
  formName: string;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFormNameChange: (name: string) => void;
  onSubmit: () => void;
};

function CreateProjectDialog({
  open,
  formName,
  isSubmitting,
  onOpenChange,
  onFormNameChange,
  onSubmit,
}: CreateProjectDialogProps) {
  return (
    <EditorDialog.Root open={open} onOpenChange={onOpenChange}>
      <EditorDialog.Content>
        <EditorDialog.Header>
          <h3 className="text-lg font-medium">Create project</h3>
          <EditorDialog.Description>
            Give your architecture workspace a name.
          </EditorDialog.Description>
        </EditorDialog.Header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex flex-col gap-3"
        >
          <Input
            autoFocus
            placeholder="My new project"
            value={formName}
            onChange={(event) => onFormNameChange(event.target.value)}
            className="bg-surface text-copy-primary placeholder:text-copy-muted"
          />
          <EditorDialog.Footer>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formName.trim() || isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
              ) : null}
              {isSubmitting ? "Creating…" : "Create"}
            </Button>
          </EditorDialog.Footer>
        </form>
      </EditorDialog.Content>
    </EditorDialog.Root>
  );
}

export { CreateProjectDialog };
export type { CreateProjectDialogProps };
