"use client";

import { EditorDialog } from "@/components/editor/dialog";
import { Button } from "@/components/ui/button";
import { CANVAS_TEMPLATES, type CanvasTemplate } from "@/components/editor/starter-templates";
import { StarterTemplateCard } from "@/components/editor/starter-template-card";
import { useCanvasTemplateLoad } from "@/hooks/use-canvas-template-load";

// ---------------------------------------------------------------------------
// Starter-templates modal (spec 18).
//
// Lists the curated `CANVAS_TEMPLATES` array in a scrollable grid. Each card
// previews its diagram and has an Import button. The modal owns the load
// mutation (`useCanvasTemplateLoad`) and chains the side effects in this
// order so the workspace client can fire a fit on the freshly-written
// canvas:
//
//   1. `await loadTemplate(template)` — clears the canvas, inserts nodes
//      and edges, yields one microtask so React Flow can reconcile.
//   2. `onImported()` — bumps a numeric version in the parent, which
//      triggers the in-canvas fit trigger.
//   3. `onOpenChange(false)` — closes the modal.
//
// Errors are intentionally swallowed (and logged) — a failed import is not
// a state the user can recover from by retrying inside the modal; the
// canvas is either fully replaced or untouched because the mutation is
// atomic. This mirrors the simplicity of `useCanvasDrop` which also does
// not surface failures.
// ---------------------------------------------------------------------------

type StarterTemplatesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

function StarterTemplatesModal({ open, onOpenChange, onImported }: StarterTemplatesModalProps) {
  const { loadTemplate, isLoading } = useCanvasTemplateLoad();

  const handleImport = async (template: CanvasTemplate): Promise<void> => {
    try {
      await loadTemplate(template);
      onImported();
      onOpenChange(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[starter-templates] failed to import template", error);
    }
  };

  return (
    <EditorDialog.Root open={open} onOpenChange={onOpenChange}>
      <EditorDialog.Content className="sm:max-w-2xl">
        <EditorDialog.Header>
          <h3 className="text-lg font-medium">Start from a template</h3>
          <EditorDialog.Description>
            Pick a starting diagram. This replaces the current canvas.
          </EditorDialog.Description>
        </EditorDialog.Header>

        {CANVAS_TEMPLATES.length === 0 ? (
          <p className="py-8 text-center text-sm text-copy-muted">No templates available yet.</p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto p-1 sm:grid-cols-2">
            {CANVAS_TEMPLATES.map((template) => (
              <StarterTemplateCard
                key={template.id}
                template={template}
                onImport={(t) => void handleImport(t)}
                disabled={isLoading}
              />
            ))}
          </div>
        )}

        <EditorDialog.Footer>
          <EditorDialog.Close asChild>
            <Button type="button" variant="ghost" disabled={isLoading}>
              Cancel
            </Button>
          </EditorDialog.Close>
        </EditorDialog.Footer>
      </EditorDialog.Content>
    </EditorDialog.Root>
  );
}

export { StarterTemplatesModal };
export type { StarterTemplatesModalProps };
