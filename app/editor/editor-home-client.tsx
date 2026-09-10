"use client";

import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWorkspaceUI } from "@/components/editor/workspace-ui-context";

// ---------------------------------------------------------------------------
// Editor home empty-state. The navbar, sidebar, and project dialogs all live
// in the persistent `WorkspaceShell` above — this component is only the
// centered main content, and reaches the shared create dialog through the
// workspace UI context.
// ---------------------------------------------------------------------------

function EditorHomeClient() {
  const { dialogs } = useWorkspaceUI();

  return (
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
  );
}

export { EditorHomeClient };
