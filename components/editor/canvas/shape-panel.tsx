"use client";

import {
  CircleIcon,
  CylinderIcon,
  DiamondIcon,
  HexagonIcon,
  PillIcon,
  RectangleHorizontalIcon,
} from "lucide-react";

import { SHAPES, SHAPE_DRAG_MIME, type ShapeDefinition } from "@/lib/canvas/shape-definitions";

// ---------------------------------------------------------------------------
// Floating pill toolbar that sits at the bottom-center of the canvas. Each
// shape is a draggable button; on `dragstart` it serialises its own
// `ShapeDefinition` (name + width + height) to the `SHAPE_DRAG_MIME` slot of
// the dataTransfer so the canvas wrapper's drop handler can read it without
// cross-talk from unrelated drags (e.g. a text selection on the page).
//
// The panel is purely a drag source — no open/close, no selected shape, no
// tooltips beyond the native `title` attribute. Adding state would violate
// the simplicity-first rule without a spec ask.
// ---------------------------------------------------------------------------

const ICONS: Record<ShapeDefinition["name"], React.ComponentType<{ className?: string }>> = {
  rectangle: RectangleHorizontalIcon,
  diamond: DiamondIcon,
  circle: CircleIcon,
  pill: PillIcon,
  cylinder: CylinderIcon,
  hexagon: HexagonIcon,
};

function ShapePanel() {
  return (
    <div className="pointer-events-auto fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-3xl border border-surface-border bg-elevated/95 px-2 py-2 shadow-lg backdrop-blur-md">
        {SHAPES.map((shape) => {
          const Icon = ICONS[shape.name];
          return (
            <button
              key={shape.name}
              type="button"
              draggable
              aria-label={`Add ${shape.name}`}
              title={shape.name}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(SHAPE_DRAG_MIME, JSON.stringify(shape));
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-copy-secondary transition-colors hover:bg-subtle hover:text-copy-primary"
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { ShapePanel };
