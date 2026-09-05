// Shape vocabulary + per-shape defaults for the bottom shape panel.
//
// Six shapes are exposed: rectangle, diamond, circle, pill, cylinder, hexagon.
// The default sizes follow spec 12 step 3 (rectangle wider than tall, circle
// square, diamond slightly larger for the diagonal label) and sensible
// proportions for the rest. Both the shape panel component and the drop hook
// import this file so the drag source and the drop target agree on width/height
// without a second source of truth.
//
// IDs follow the spec's required `${shape}-${Date.now()}-${counter}` pattern.
// The counter is a module-level `Partial<Record>` — it lives for the tab
// lifetime and is intentionally not persisted. The timestamp makes collisions
// impossible across tabs even if the counter reset; the counter keeps IDs
// human-grep-able in DevTools (rectangle-…-1, -2, -3, …).
//
// Pure data + a pure function: no React, no DOM, no `"use client"`. Reachable
// from server code as well as client.

export const SHAPE_DRAG_MIME = "application/x-ghost-shape";

export const SHAPES = [
  { name: "rectangle", width: 160, height: 80 },
  { name: "diamond", width: 160, height: 120 },
  { name: "circle", width: 120, height: 120 },
  { name: "pill", width: 180, height: 80 },
  { name: "cylinder", width: 140, height: 110 },
  { name: "hexagon", width: 180, height: 110 },
] as const;

export type ShapeName = (typeof SHAPES)[number]["name"];
export type ShapeDefinition = (typeof SHAPES)[number];

const counters: Partial<Record<ShapeName, number>> = {};

export function generateShapeNodeId(shape: ShapeName): string {
  counters[shape] = (counters[shape] ?? 0) + 1;
  return `${shape}-${Date.now()}-${counters[shape]}`;
}
