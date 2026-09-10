import { CanvasConnecting } from "@/components/loading";

// ---------------------------------------------------------------------------
// Per-room loading state. Scoped to the page subtree only: the editor layout
// above (navbar + sidebar) never suspends on room switches, so it stays
// fixed on screen while just the canvas area drafts. No navbar or sidebar
// skeleton here by design.
// ---------------------------------------------------------------------------

function EditorRoomLoading() {
  return <CanvasConnecting label="Opening workspace" />;
}

export default EditorRoomLoading;
