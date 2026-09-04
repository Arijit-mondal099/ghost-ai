"use client";

import { EditorDialog } from "@/components/editor/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project } from "@/lib/projects";

// ---------------------------------------------------------------------------
// Rename project dialog. The current name is shown in the description so
// the user has context (especially useful when the visible row label has
// been truncated by `truncate`). The input auto-focuses and selects all
// text on focus so a quick edit is a single keystroke away. Enter submits.
// ---------------------------------------------------------------------------

type RenameProjectDialogProps = {
  project: Project | null;
  open: boolean;
  formName: string;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFormNameChange: (name: string) => void;
  onSubmit: () => void;
};

function RenameProjectDialog({
  project,
  open,
  formName,
  isSubmitting,
  onOpenChange,
  onFormNameChange,
  onSubmit,
}: RenameProjectDialogProps) {
  const trimmed = formName.trim();
  const isUnchanged = project ? trimmed === project.name : true;
  const canSubmit = trimmed.length > 0 && !isUnchanged && !isSubmitting;

  return (
    <EditorDialog.Root open={open} onOpenChange={onOpenChange}>
      <EditorDialog.Content>
        <EditorDialog.Header>
          <h3 className="text-lg font-medium">Rename project</h3>
          <EditorDialog.Description>
            Current name: <span className="text-copy-primary">{project?.name ?? "—"}</span>
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
            value={formName}
            onChange={(event) => onFormNameChange(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            placeholder="Project name"
            className="bg-surface text-copy-primary placeholder:text-copy-muted"
          />
          <EditorDialog.Footer>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Save
            </Button>
          </EditorDialog.Footer>
        </form>
      </EditorDialog.Content>
    </EditorDialog.Root>
  );
}

export { RenameProjectDialog };
export type { RenameProjectDialogProps };
