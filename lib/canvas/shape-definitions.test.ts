import { describe, expect, test } from "bun:test";

import { generateShapeNodeId, SHAPE_DRAG_MIME, SHAPES } from "@/lib/canvas/shape-definitions";

describe("shape-definitions", () => {
  test("exposes six shapes with positive dims and unique names", () => {
    expect(SHAPES).toHaveLength(6);
    const names = SHAPES.map((s) => s.name);
    expect(new Set(names).size).toBe(6);
    for (const s of SHAPES) {
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
    }
    expect(SHAPE_DRAG_MIME).toBe("application/x-ghost-shape");
  });

  test("generateShapeNodeId follows shape-ts-counter pattern", () => {
    const first = generateShapeNodeId("rectangle");
    const second = generateShapeNodeId("rectangle");
    expect(first.startsWith("rectangle-")).toBe(true);
    expect(/^rectangle-\d+-\d+$/.test(first)).toBe(true);
    expect(/^rectangle-\d+-\d+$/.test(second)).toBe(true);
    expect(first === second).toBe(false);
    const n1 = Number(first.split("-").pop());
    const n2 = Number(second.split("-").pop());
    expect(n2).toBeGreaterThan(n1);
  });
});
