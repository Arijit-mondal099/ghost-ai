import { EditorHomeClient } from "@/app/editor/editor-home-client";

// ---------------------------------------------------------------------------
// Editor home. Slim server component: the layout above owns the projects
// fetch and the persistent chrome (navbar + sidebar + dialogs). The page is
// only the centered empty-state, which opens the shared create dialog
// through the workspace UI context.
// ---------------------------------------------------------------------------

function EditorPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <EditorHomeClient />
    </div>
  );
}

export default EditorPage;
