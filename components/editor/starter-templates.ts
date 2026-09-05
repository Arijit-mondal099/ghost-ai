// Starter-template library (spec 18).
//
// Three pre-built diagrams (microservices, CI/CD pipeline, event-driven
// system) that a user can pick from a modal to replace the current canvas.
// The data is RSC-eligible: pure module with no React, no DOM, no
// `"use client"`. The load hook (`useCanvasTemplateLoad`) and modal
// (`StarterTemplatesModal`) are the only client-side consumers.
//
// Coordinates are visual centers. Each node's `width` / `height` are read
// from `SHAPES` in `lib/canvas/shape-definitions.ts` at load time so the
// data file stays small and the per-shape dimensions stay in one place.

import { type NodeColor, type NodeShape } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateNode = {
  key: string;
  label: string;
  color: NodeColor;
  shape: NodeShape;
  x: number;
  y: number;
};

export type TemplateEdge = {
  source: string;
  target: string;
  label?: string;
};

export type CanvasTemplate = {
  id: string;
  name: string;
  description: string;
  nodes: ReadonlyArray<TemplateNode>;
  edges: ReadonlyArray<TemplateEdge>;
};

type TemplateMeta = { id: string; name: string; description: string };
type TemplateBody = { nodes: TemplateNode[]; edges: TemplateEdge[] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTemplate(meta: TemplateMeta, body: TemplateBody): CanvasTemplate {
  return { ...meta, nodes: body.nodes, edges: body.edges };
}

// Dev-only sanity check: every edge source/target must resolve to a node
// key. Production bundles drop the call site entirely (the import below is
// only referenced inside the body of this function, and the function itself
// is only called in development). Tree-shaking handles the rest.
function assertTemplateWellFormed(t: CanvasTemplate): void {
  if (process.env.NODE_ENV === "production") return;
  const keys = new Set(t.nodes.map((n) => n.key));
  for (const e of t.edges) {
    if (!keys.has(e.source)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[starter-templates] ${t.id}: edge source "${e.source}" does not match a node key`,
      );
    }
    if (!keys.has(e.target)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[starter-templates] ${t.id}: edge target "${e.target}" does not match a node key`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const microservices = buildTemplate(
  {
    id: "microservices",
    name: "Microservices",
    description: "API gateway routing to three service backends with a shared database.",
  },
  {
    nodes: [
      { key: "client", label: "Client", color: "blue", shape: "rectangle", x: 80, y: 40 },
      { key: "gateway", label: "API Gateway", color: "purple", shape: "hexagon", x: 320, y: 40 },
      { key: "auth", label: "Auth", color: "neutral", shape: "cylinder", x: 160, y: 220 },
      { key: "users", label: "Users", color: "neutral", shape: "cylinder", x: 320, y: 220 },
      { key: "orders", label: "Orders", color: "neutral", shape: "cylinder", x: 480, y: 220 },
      { key: "db", label: "Database", color: "neutral", shape: "cylinder", x: 320, y: 380 },
    ],
    edges: [
      { source: "client", target: "gateway" },
      { source: "gateway", target: "auth" },
      { source: "gateway", target: "users" },
      { source: "gateway", target: "orders" },
      { source: "orders", target: "db" },
    ],
  },
);

const ciCdPipeline = buildTemplate(
  {
    id: "ci-cd-pipeline",
    name: "CI/CD Pipeline",
    description: "Commit, build, test, stage, and ship to production with notifications.",
  },
  {
    nodes: [
      { key: "commit", label: "Commit", color: "blue", shape: "circle", x: 80, y: 40 },
      { key: "build", label: "Build", color: "blue", shape: "rectangle", x: 280, y: 40 },
      { key: "test", label: "Test", color: "orange", shape: "diamond", x: 480, y: 40 },
      { key: "stage", label: "Stage", color: "orange", shape: "rectangle", x: 280, y: 220 },
      { key: "prod", label: "Production", color: "green", shape: "rectangle", x: 480, y: 220 },
      { key: "notify", label: "Notify", color: "neutral", shape: "pill", x: 680, y: 130 },
    ],
    edges: [
      { source: "commit", target: "build" },
      { source: "build", target: "test" },
      { source: "test", target: "stage" },
      { source: "stage", target: "prod" },
      { source: "prod", target: "notify", label: "deploy" },
    ],
  },
);

const eventDrivenSystem = buildTemplate(
  {
    id: "event-driven-system",
    name: "Event-Driven System",
    description: "A producer publishes to a topic; three consumers fan out and write to a sink.",
  },
  {
    nodes: [
      { key: "producer", label: "Producer", color: "blue", shape: "rectangle", x: 80, y: 40 },
      { key: "topic", label: "Topic", color: "purple", shape: "hexagon", x: 320, y: 40 },
      {
        key: "consumer-a",
        label: "Consumer A",
        color: "green",
        shape: "rectangle",
        x: 160,
        y: 220,
      },
      {
        key: "consumer-b",
        label: "Consumer B",
        color: "green",
        shape: "rectangle",
        x: 320,
        y: 220,
      },
      {
        key: "consumer-c",
        label: "Consumer C",
        color: "green",
        shape: "rectangle",
        x: 480,
        y: 220,
      },
      { key: "sink", label: "Sink", color: "neutral", shape: "cylinder", x: 320, y: 380 },
    ],
    edges: [
      { source: "producer", target: "topic" },
      { source: "topic", target: "consumer-a" },
      { source: "topic", target: "consumer-b" },
      { source: "topic", target: "consumer-c" },
      { source: "consumer-a", target: "sink" },
      { source: "consumer-b", target: "sink" },
      { source: "consumer-c", target: "sink" },
    ],
  },
);

export const CANVAS_TEMPLATES: ReadonlyArray<CanvasTemplate> = [
  microservices,
  ciCdPipeline,
  eventDrivenSystem,
];

// Dev-only validation. The call sites are inside dev guards, so the
// production bundle never runs the assertions.
if (process.env.NODE_ENV !== "production") {
  for (const t of CANVAS_TEMPLATES) assertTemplateWellFormed(t);
}
