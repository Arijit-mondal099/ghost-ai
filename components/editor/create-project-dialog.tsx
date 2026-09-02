"use client";

import { EditorDialog } from "@/components/editor/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/projects";

// ---------------------------------------------------------------------------
// Create project dialog. Controlled by the page-level
// `useProjectDialogs` hook so the home "New Project" CTA and the sidebar
// "New Project" button share the same open handler.
//
// The slug preview is recomputed from the form name each render. No
// debounce — the derivation is cheap and only runs while the dialog is open.
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
  const slug = slugify(formName);
  return (
    <EditorDialog.Root open={open} onOpenChange={onOpenChange}>
      <EditorDialog.Content>
        <EditorDialog.Header>
          <EditorDialog.Title>Create project</EditorDialog.Title>
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
          <p className="text-xs text-copy-muted">
            Slug: <span className="font-mono text-copy-secondary">{slug || "—"}</span>
          </p>
          <EditorDialog.Footer>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formName.trim() || isSubmitting}>
              Create
            </Button>
          </EditorDialog.Footer>
        </form>
      </EditorDialog.Content>
    </EditorDialog.Root>
  );
}

export { CreateProjectDialog };
export type { CreateProjectDialogProps };
