// Canvas-domain types.
//
// The 8-node palette and 6-shape vocabulary are defined once here so that the
// later node-renderer, palette picker, and custom-edge specs can all import
// from a single source of truth. Hex values come from .claude/context/ui-context.md;
// this file is the only place they should appear in the canvas surface.

// ---------------------------------------------------------------------------
// Color and shape vocabularies
// ---------------------------------------------------------------------------

export const NODE_COLORS = [
  { name: "neutral", fill: "#1F1F1F", text: "#EDEDED" },
  { name: "blue", fill: "#10233D", text: "#52A8FF" },
  { name: "purple", fill: "#2E1938", text: "#BF7AF0" },
  { name: "orange", fill: "#331B00", text: "#FF990A" },
  { name: "red", fill: "#3C1618", text: "#FF6166" },
  { name: "pink", fill: "#3A1726", text: "#F75F8F" },
  { name: "green", fill: "#0F2E18", text: "#62C073" },
  { name: "teal", fill: "#062822", text: "#0AC7B4" },
] as const;

export const NODE_SHAPES = [
  "rectangle",
  "diamond",
  "circle",
  "pill",
  "cylinder",
  "hexagon",
] as const;

export type NodeColor = (typeof NODE_COLORS)[number]["name"];
export type NodeShape = (typeof NODE_SHAPES)[number];

// The neutral pair is the documented default (ui-context.md line 67).
export const DEFAULT_NODE_COLOR: NodeColor = "neutral";
export const DEFAULT_NODE_SHAPE: NodeShape = "rectangle";

// ---------------------------------------------------------------------------
// Custom node and edge type names
//
// These are the keys used in React Flow's `nodeTypes` / `edgeTypes` maps in a
// later spec. Defining them as `const` here lets the `CanvasNode` / `CanvasEdge`
// type aliases reference the literal without a separate string-literal union,
// and lets consumers register custom renderers by importing the constant.
// ---------------------------------------------------------------------------

export const canvasNode = "canvasNode";
export const canvasEdge = "canvasEdge";

// ---------------------------------------------------------------------------
// Node and edge data shapes
// ---------------------------------------------------------------------------

// Fields the spec owns today. Later specs (custom node rendering, AI prompts,
// palette picker) will extend this object.
export type CanvasNodeData = {
  label: string;
  color: NodeColor;
  shape: NodeShape;
};

export type CanvasNode = import("@xyflow/react").Node<CanvasNodeData, typeof canvasNode>;

// Inline edge labels (spec 16). Empty string is the "no label" state — the
// edge renderer shows a faint "Label" hint on selected edges in that case.
export type CanvasEdgeData = { label: string };

export type CanvasEdge = import("@xyflow/react").Edge<CanvasEdgeData, typeof canvasEdge>;
