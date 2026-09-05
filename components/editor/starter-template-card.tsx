"use client";

import { Button } from "@/components/ui/button";
import { SHAPES } from "@/lib/canvas/shape-definitions";
import { NODE_COLORS, type NodeShape } from "@/types/canvas";
import { type CanvasTemplate, type TemplateNode } from "@/components/editor/starter-templates";

// ---------------------------------------------------------------------------
// Single template card (spec 18). Renders the template's name, description,
// node count, a lightweight inline-SVG preview, and an Import button.
//
// The preview mirrors the visual convention in
// `components/editor/canvas/shape-drag-preview.tsx` and
// `components/editor/canvas/canvas-node.tsx`: CSS-radii shapes for
// rectangle/circle/pill, inline SVG polygon/path for diamond/hexagon/cylinder.
// Three consumers of the same ~20-line shape vocabulary is still below the
// bar for extraction — a shared helper would force the live renderer to
// accept the same props as a static preview, which isn't free.
//
// No labels in the preview — the card name and description carry that
// information, and labels at this scale would be unreadable. The viewBox
// is computed from node centers ± their `SHAPES` width/height / 2 with 16px
// of padding so a tight layout still has breathing room.
// ---------------------------------------------------------------------------

const STROKE = "var(--surface-border)";
const ARROW_MARKER_ID = "starter-template-arrow";

function fillFor(color: TemplateNode["color"]): string {
  return NODE_COLORS.find((c) => c.name === color)?.fill ?? NODE_COLORS[0].fill;
}

type ShapeDrawArgs = {
  shape: NodeShape;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

function ShapeDrawing({ shape, x, y, width, height, fill }: ShapeDrawArgs) {
  const halfW = width / 2;
  const halfH = height / 2;
  const common = {
    fill,
    stroke: STROKE,
    strokeWidth: 1.25,
    vectorEffect: "non-scaling-stroke" as const,
  };

  if (shape === "rectangle") {
    return <rect x={x - halfW} y={y - halfH} width={width} height={height} rx={8} {...common} />;
  }
  if (shape === "pill") {
    return (
      <rect x={x - halfW} y={y - halfH} width={width} height={height} rx={halfH} {...common} />
    );
  }
  if (shape === "circle") {
    return <ellipse cx={x} cy={y} rx={halfW} ry={halfH} {...common} />;
  }
  if (shape === "diamond") {
    return (
      <polygon
        points={`${x},${y - halfH} ${x + halfW},${y} ${x},${y + halfH} ${x - halfW},${y}`}
        strokeLinejoin="round"
        {...common}
      />
    );
  }
  if (shape === "hexagon") {
    // Mirrors `canvas-node.tsx`: inner notches at width*0.25 from the
    // vertical edges. Points are listed top-left, top-right, right, bottom-
    // right, bottom-left, left.
    const notch = halfW * 0.5; // 0.25 of width
    return (
      <polygon
        points={`${x - halfW + notch},${y - halfH} ${x + halfW - notch},${y - halfH} ${x + halfW},${y} ${x + halfW - notch},${y + halfH} ${x - halfW + notch},${y + halfH} ${x - halfW},${y}`}
        strokeLinejoin="round"
        {...common}
      />
    );
  }
  // cylinder: top arc + sides + bottom arc, then the elliptical top.
  const rx = halfW;
  const ry = halfH * (15 / 55); // ~27% of height for the elliptical caps
  const path = `M ${x - rx},${y - halfH + ry} L ${x - rx},${y + halfH - ry} A ${rx},${ry} 0 0,0 ${x + rx},${y + halfH - ry} L ${x + rx},${y - halfH + ry} Z`;
  return (
    <>
      <path d={path} strokeLinejoin="round" {...common} />
      <ellipse
        cx={x}
        cy={y - halfH + ry}
        rx={rx}
        ry={ry}
        fill={fill}
        stroke={STROKE}
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

function TemplatePreview({ template }: { template: CanvasTemplate }) {
  // Compute bounds from each node's visual bounding box (center ± half-dim).
  // For the hexagon/cylinder shapes the visual box is still the SHAPES
  // width/height — the polygon vertices fall inside that rectangle.
  const sized = template.nodes.map((n) => {
    const def = SHAPES.find((s) => s.name === n.shape);
    const width = def?.width ?? 160;
    const height = def?.height ?? 80;
    return { ...n, width, height };
  });
  const minX = Math.min(...sized.map((n) => n.x - n.width / 2));
  const minY = Math.min(...sized.map((n) => n.y - n.height / 2));
  const maxX = Math.max(...sized.map((n) => n.x + n.width / 2));
  const maxY = Math.max(...sized.map((n) => n.y + n.height / 2));
  const PAD = 16;
  const nodeByKey = new Map(sized.map((n) => [n.key, n]));

  return (
    <svg
      className="block h-full w-full"
      viewBox={`${minX - PAD} ${minY - PAD} ${maxX - minX + PAD * 2} ${maxY - minY + PAD * 2}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <marker
          id={ARROW_MARKER_ID}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-secondary)" />
        </marker>
      </defs>

      {/* Edges first so nodes paint over them. */}
      {template.edges.map((e) => {
        const s = nodeByKey.get(e.source);
        const t = nodeByKey.get(e.target);
        if (!s || !t) return null;
        return (
          <line
            key={`${e.source}-${e.target}`}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke="var(--text-secondary)"
            strokeWidth={1.25}
            markerEnd={`url(#${ARROW_MARKER_ID})`}
          />
        );
      })}

      {/* Nodes. */}
      {sized.map((n) => (
        <ShapeDrawing
          key={n.key}
          shape={n.shape}
          x={n.x}
          y={n.y}
          width={n.width}
          height={n.height}
          fill={fillFor(n.color)}
        />
      ))}
    </svg>
  );
}

type StarterTemplateCardProps = {
  template: CanvasTemplate;
  onImport: (template: CanvasTemplate) => void;
  disabled: boolean;
};

function StarterTemplateCard({ template, onImport, disabled }: StarterTemplateCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-copy-primary">{template.name}</h3>
        <span className="shrink-0 text-xs text-copy-muted">{template.nodes.length} nodes</span>
      </div>
      <p className="line-clamp-2 text-xs text-copy-secondary">{template.description}</p>
      <div className="h-40 w-full overflow-hidden rounded-xl border border-surface-border bg-base">
        <TemplatePreview template={template} />
      </div>
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={disabled}
        onClick={() => onImport(template)}
      >
        Import
      </Button>
    </div>
  );
}

export { StarterTemplateCard };
export type { StarterTemplateCardProps };
