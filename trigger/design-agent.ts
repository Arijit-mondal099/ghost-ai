// ---------------------------------------------------------------------------
// Design agent task (spec 24 — full AI logic).
//
// A user prompt becomes real-time canvas updates:
//
//   1. Broadcast `AI_STATUS` ("start") so every client shows AI activity.
//   2. Read the current canvas via `getStorageDocument(roomId, "json")` so the
//      model extends the existing design instead of duplicating it.
//   3. Ask Groq (`qwen/qwen3.6-27b`, JSON-only prompt + `extractOpsJson`
//      recovery — no JSON mode) for an op list covering the 7
//      spec actions: add/move/resize/update-data/delete node, add/delete edge.
//   4. Validate every op server-side (shape/color allow-lists, position
//      clamps, edge-endpoint resolution) and apply via `mutateStorage` with
//      `new LiveObject(…)` — the server analogue of the client
//      `LiveObject.from(node)` write pattern. Append-only: maps are never
//      cleared.
//   5. Broadcast `processing` before writes and `complete` (or `error`) after,
//      so the shared RoomEvent status feed reflects task progress, and persist
//      the same payload to the `aiStatus` Storage key so late joiners replay
//      it on mount. Clients clear the simulated AI presence on `complete`/`error`.
//
// Self-contained by design: shape/color/dimension vocabularies are duplicated
// from `types/canvas.ts` + `lib/canvas/shape-definitions.ts` (cited below)
// because the Trigger.dev bundle cannot rely on the app's `@/` path alias.
// Registered via `trigger.config.ts` (`dirs: ["./trigger"]`).
// ---------------------------------------------------------------------------

import { Liveblocks, LiveMap, LiveObject, type JsonObject, type Lson } from "@liveblocks/node";
import { logger, task } from "@trigger.dev/sdk";
import Groq from "groq-sdk";

export type DesignAgentPayload = {
  prompt: string;
  roomId: string;
  projectId: string;
};

type DesignAgentResult =
  | { ok: true; addedNodes: number; addedEdges: number; appliedOps: number; warnings: string[] }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Vocabulary (mirrors `types/canvas.ts` NODE_SHAPES + NODE_COLORS and
// `lib/canvas/shape-definitions.ts` SHAPES — duplicated so this file has no
// `@/` imports; see header note).
// ---------------------------------------------------------------------------

const NODE_SHAPES = ["rectangle", "diamond", "circle", "pill", "cylinder", "hexagon"] as const;
const NODE_COLORS = [
  "neutral",
  "blue",
  "purple",
  "orange",
  "red",
  "pink",
  "green",
  "teal",
] as const;
const SHAPE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  rectangle: { width: 160, height: 80 },
  diamond: { width: 160, height: 120 },
  circle: { width: 120, height: 120 },
  pill: { width: 180, height: 80 },
  cylinder: { width: 140, height: 110 },
  hexagon: { width: 180, height: 110 },
};
const DEFAULT_SHAPE = "rectangle";
const DEFAULT_COLOR = "neutral";

// MarkerEnd for new edges. Plain JSON matching what
// `hooks/use-canvas-template-load.ts` writes via `MarkerType.ArrowClosed`
// (`"arrowclosed"`) with the shared `--text-secondary` stroke — hardcoded so
// this file never imports `@xyflow/react` (a client rendering dep).
const DEFAULT_MARKER_END = { type: "arrowclosed", color: "var(--text-secondary)" };

const MODEL = "qwen/qwen3.6-27b";
const GROQ_MAX_ATTEMPTS = 3;
// Groq enforces output-tokens-per-minute (OTPM) per org tier. The call
// leaves `max_tokens` unset by default, so Groq estimates the model's full
// output window (1529 tokens for this model) — over a 1000-OTPM tier limit,
// which rejects the request pre-flight with 429 `rate_limit_exceeded`.
// Capping at the tier limit keeps the request admissible. Output must fit
// the cap with margin: the system prompt bounds the design (≤10 nodes +
// 12 edges) AND demands compact single-line JSON, landing around ~650
// tokens. Pretty-printed output and larger designs get truncated
// (finish_reason=length) before the closing brace.
const GROQ_MAX_TOKENS = 1000;
const MAX_OPS = 50;
const MAX_NEW_NODES = 30;
const MAX_NEW_EDGES = 40;
const POSITION_BOUND = 4000;
const SNAPSHOT_NODE_LIMIT = 40;

// ---------------------------------------------------------------------------
// Op types (the model's JSON contract — one variant per spec action).
// ---------------------------------------------------------------------------

type AgentOp =
  | {
      op: "addNode";
      key: string;
      label?: string;
      shape?: string;
      color?: string;
      x?: number;
      y?: number;
    }
  | { op: "moveNode"; key: string; x?: number; y?: number }
  | { op: "resizeNode"; key: string; width?: number; height?: number }
  | { op: "updateNode"; key: string; label?: string; shape?: string; color?: string }
  | { op: "deleteNode"; key: string }
  | { op: "addEdge"; source: string; target: string; label?: string }
  | { op: "deleteEdge"; source: string; target: string };

type Stage = "start" | "processing" | "complete" | "error";

type AiStatusEvent = {
  type: "AI_STATUS";
  runId: string;
  stage: Stage;
  message: string;
};

// Server-side view of the `flow` LiveObject owned by `useLiveblocksFlow`
// (`storageKey: "flow"` default). Same LSON-cast-at-the-boundary spirit as
// the client hooks (`use-canvas-drop.ts`), but against the node SDK's
// server-side live structures.
type LsonRecord = Record<string, Lson | undefined>;

type SnapshotNode = { id: string; label: string; shape: string; x: number; y: number };

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Ghost, an AI system-design architect. Respond with ONLY a JSON object shaped { "ops": [...] } — no markdown fences, no explanation, no other text. Emit COMPACT JSON: one line, no indentation, no line breaks, no spaces except inside string values.

Node shapes (exact strings only): rectangle (default service/component), diamond (decision/gateway), circle (event/endpoint), pill (service/process), cylinder (database/storage), hexagon (external system/boundary).
Node colors (exact strings only): neutral (default), blue, purple, orange, red, pink, green, teal. Match color to component character: databases teal or green, events blue, gateways orange, external systems purple, errors/failing parts red.

Op variants (the "op" field selects one):
- { "op": "addNode", "key": "unique-key", "label": "Display Label", "shape": "rectangle", "color": "neutral", "x": 0, "y": 0 }
- { "op": "moveNode", "key": "existing label or key", "x": 100, "y": 200 }
- { "op": "resizeNode", "key": "existing label or key", "width": 200, "height": 100 }
- { "op": "updateNode", "key": "existing label or key", "label": "New Label", "shape": "pill", "color": "blue" }
- { "op": "deleteNode", "key": "existing label or key" }
- { "op": "addEdge", "source": "label or key", "target": "label or key", "label": "optional flow label" }
- { "op": "deleteEdge", "source": "label or key", "target": "label or key" }

Rules:
- Refer to existing canvas nodes by their EXACT label. Refer to nodes you create in this same response by their "key".
- Every addEdge source/target must be an existing label or a key defined by an addNode earlier in the same ops list.
- Layout: data flows left to right. New components go right of related ones. Keep at least 200px horizontal and 140px vertical spacing between node centers. Keep coordinates within -2000..2000.
- Prefer addNode/addEdge for new systems. Only move/resize/update/delete when the user explicitly asks to change the existing design.
- Keep designs focused: at most 10 new nodes and 12 new edges per response.
- Labels are short component names (2-4 words). Edge labels are short verbs or protocols (e.g. "HTTPS", "publishes", "reads").`;

function buildUserPrompt(prompt: string, existing: SnapshotNode[]): string {
  if (existing.length === 0) {
    return `The canvas is empty. Design the requested system from scratch.\n\nUser request: ${prompt}`;
  }
  const lines = existing.map(
    (n) => `- "${n.label}" (${n.shape}) at x=${Math.round(n.x)}, y=${Math.round(n.y)}`,
  );
  return `Current canvas nodes (extend this design, do not duplicate what exists):\n${lines.join("\n")}\n\nUser request: ${prompt}`;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function isAgentOp(value: unknown): value is AgentOp {
  const r = asRecord(value);
  if (!r || typeof r["op"] !== "string") return false;
  return [
    "addNode",
    "moveNode",
    "resizeNode",
    "updateNode",
    "deleteNode",
    "addEdge",
    "deleteEdge",
  ].includes(r["op"] as string);
}

function validShape(shape: unknown): string {
  return typeof shape === "string" && (NODE_SHAPES as readonly string[]).includes(shape)
    ? shape
    : DEFAULT_SHAPE;
}

function validColor(color: unknown): string {
  return typeof color === "string" && (NODE_COLORS as readonly string[]).includes(color)
    ? color
    : DEFAULT_COLOR;
}

function dimensionsFor(shape: string): { width: number; height: number } {
  return SHAPE_DIMENSIONS[shape] ?? SHAPE_DIMENSIONS[DEFAULT_SHAPE]!;
}

/**
 * Pull the first JSON object out of raw model text. Handles markdown fences,
 * preamble/postamble chatter, and reasoning-trace leakage — anything where
 * the payload is embedded in a larger string. Qwen thinking traces
 * (`<think>…</think>`) are stripped first: they can contain braces that
 * defeat the brace-scan below, and a response cut off mid-thought has no
 * JSON at all. Throws when nothing parseable is found.
 */
function extractOpsJson(content: string): unknown {
  const stripped = content.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "");
  const direct = tryParse(stripped);
  if (direct !== undefined) return direct;
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    const parsed = tryParse(fenced);
    if (parsed !== undefined) return parsed;
  }
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const parsed = tryParse(stripped.slice(start, end + 1));
    if (parsed !== undefined) return parsed;
  }
  throw new Error("model returned no parseable JSON object");
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text.trim()) as unknown;
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * True for Groq quota errors (HTTP 429 / `rate_limit_exceeded`). These ride
 * a per-minute output-token window, so the fast 750ms retry backoff can
 * never clear them — the attempt loop must fail fast instead of burning all
 * three attempts in ~2s.
 */
function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b429\b/.test(message)) return true;
  return message.toLowerCase().includes("rate_limit_exceeded");
}

/** User-facing terminal message: raw provider JSON never reaches the chat. */
function friendlyGroqError(message: string): string {
  if (/rate_limit_exceeded/i.test(message) || /\b429\b/.test(message)) {
    return "Ghost hit the AI rate limit — wait a minute and try again.";
  }
  if (/finish_reason=length/i.test(message)) {
    return "Ghost's draft was too large to finish — try a smaller request.";
  }
  if (/no parseable JSON|no valid ops|no ops array/i.test(message)) {
    return "Ghost's draft came back unreadable — try again.";
  }
  return message;
}

/**
 * Wrap a plain node/edge object the same way the client hooks do
 * (`LiveObject.from(node)` in `use-canvas-drop.ts`) so the
 * `useLiveblocksFlow` reader sees an identical shape.
 */
function asLiveNode(obj: unknown): LiveObject<LsonRecord> {
  return LiveObject.from(obj as JsonObject) as unknown as LiveObject<LsonRecord>;
}

/** Read a server-side live node back as a plain record for merging. */
function liveToRecord(live: LiveObject<LsonRecord>): Record<string, unknown> {
  return asRecord(live.toJSON()) ?? {};
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function keyOf(key: unknown): string {
  return typeof key === "string" ? key.trim().toLowerCase() : "";
}

// ---------------------------------------------------------------------------
// Liveblocks helpers (server-side, via @liveblocks/node)
// ---------------------------------------------------------------------------

function requireClients(): { liveblocks: Liveblocks; groq: Groq } {
  const liveblocksSecret = process.env["LIVEBLOCKS_SECRET_KEY"];
  if (!liveblocksSecret) throw new Error("LIVEBLOCKS_SECRET_KEY is not set");
  const groqKey = process.env["GROQ_API_KEY"];
  if (!groqKey) throw new Error("GROQ_API_KEY is not set");
  return {
    liveblocks: new Liveblocks({ secret: liveblocksSecret }),
    groq: new Groq({ apiKey: groqKey }),
  };
}

async function broadcast(
  liveblocks: Liveblocks,
  roomId: string,
  runId: string,
  stage: Stage,
  message: string,
): Promise<void> {
  const event: AiStatusEvent = { type: "AI_STATUS", runId, stage, message };
  // Persist the same payload to Storage so collaborators who join mid-run
  // replay the latest status on mount (spec 25 fix: RoomEvents are ephemeral
  // and never reach late joiners). Best-effort like the broadcast itself —
  // a Storage failure must never fail the design run.
  try {
    await liveblocks.mutateStorage(roomId, ({ root }) => {
      const store = root as unknown as {
        get: (key: string) => LiveObject<LsonRecord> | undefined;
        set: (key: string, value: LiveObject<LsonRecord>) => void;
      };
      const status = new LiveObject({
        runId,
        stage,
        message,
        updatedAt: Date.now(),
      });
      store.set("aiStatus", status);
    });
  } catch (error) {
    logger.warn("design-agent status persist failed", { stage, error: String(error) });
  }
  try {
    await liveblocks.broadcastEvent(roomId, event);
  } catch (error) {
    // The status feed is best-effort: a broadcast failure must never fail
    // the design run itself.
    logger.warn("design-agent broadcast failed", { stage, error: String(error) });
  }
}

/** Read the live canvas as plain JSON. Missing/empty storage → empty list. */
async function readSnapshot(liveblocks: Liveblocks, roomId: string): Promise<SnapshotNode[]> {
  let doc: unknown;
  try {
    doc = await liveblocks.getStorageDocument(roomId, "json");
  } catch (error) {
    logger.warn("design-agent snapshot read failed, treating canvas as empty", {
      error: String(error),
    });
    return [];
  }
  const root = asRecord(doc);
  const flow = root ? asRecord(root["flow"]) : null;
  const nodes = flow ? asRecord(flow["nodes"]) : null;
  if (!nodes) return [];
  const out: SnapshotNode[] = [];
  for (const [id, raw] of Object.entries(nodes)) {
    if (out.length >= SNAPSHOT_NODE_LIMIT) break;
    const node = asRecord(raw);
    const data = node ? asRecord(node["data"]) : null;
    const position = node ? asRecord(node["position"]) : null;
    out.push({
      id,
      label: typeof data?.["label"] === "string" ? (data["label"] as string) : "",
      shape: typeof data?.["shape"] === "string" ? (data["shape"] as string) : DEFAULT_SHAPE,
      x: typeof position?.["x"] === "number" ? (position["x"] as number) : 0,
      y: typeof position?.["y"] === "number" ? (position["y"] as number) : 0,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export const designAgent = task({
  id: "design-agent",
  run: async (payload: DesignAgentPayload, { ctx }): Promise<DesignAgentResult> => {
    const runId: string = ctx.run.id;

    // Defensive payload validation (the route validates too, but direct
    // triggers bypass it).
    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
    const roomId = typeof payload.roomId === "string" ? payload.roomId.trim() : "";
    if (!prompt || !roomId) {
      logger.error("design-agent rejected: empty prompt or roomId");
      return { ok: false, error: "Prompt and roomId are required" };
    }

    let clients: { liveblocks: Liveblocks; groq: Groq };
    try {
      clients = requireClients();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("design-agent missing credentials", { error: message });
      return { ok: false, error: message };
    }
    const { liveblocks, groq } = clients;

    await broadcast(liveblocks, roomId, runId, "start", "Ghost is reading your canvas…");
    logger.info("design-agent run", { roomId, projectId: payload.projectId });

    // 1. Snapshot so the model extends the design instead of duplicating it.
    const existing = await readSnapshot(liveblocks, roomId);
    const resolve = new Map<string, string>();
    for (const n of existing) {
      if (n.label.trim()) resolve.set(n.label.trim().toLowerCase(), n.id);
      resolve.set(n.id, n.id);
    }

    // 2. Ask Groq for the op list.
    //
    // No `response_format: json_object` — Qwen on Groq rejects JSON mode
    // (`json_validate_failed` on empty generations). The system prompt
    // demands JSON-only output and `extractOpsJson` recovers the payload
    // from fences/chatter. Up to 3 attempts: empty generations and
    // transient 4xx/5xx are retried with backoff before giving up.
    // `max_tokens` is capped at the org's OTPM tier limit (see
    // GROQ_MAX_TOKENS) — without it Groq estimates the full output window
    // and 429s the request pre-flight. Rate-limit errors fail fast with a
    // friendly message instead of pointlessly retrying into a per-minute
    // quota window.
    let ops: AgentOp[];
    try {
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(prompt, existing) },
      ] as { role: "system" | "user"; content: string }[];
      let lastError = "unknown error";
      let lastFinishReason = "unknown";
      ops = [];
      for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS; attempt += 1) {
        // Captured for the warn log below: without the raw preview +
        // finish_reason, a "no parseable JSON" failure is undiagnosable
        // (empty generation? truncated mid-thought? refusal?).
        let finishReason = "unknown";
        let contentPreview = "";
        try {
          const completion = await groq.chat.completions.create({
            model: MODEL,
            temperature: 0.3,
            max_tokens: GROQ_MAX_TOKENS,
            // Qwen is a hybrid thinking model: left alone it spends the
            // whole 1000-token budget on a <think> trace and gets cut off
            // (finish_reason=length) before emitting any JSON. This task is
            // pure JSON emission, so reasoning is disabled entirely and the
            // full budget goes to the ops list.
            reasoning_effort: "none",
            messages,
          });
          const choice = completion.choices[0];
          finishReason = choice?.finish_reason ?? "unknown";
          const content = choice?.message?.content ?? "";
          contentPreview = content.length > 500 ? `${content.slice(0, 500)}…` : content;
          const list: unknown = asRecord(extractOpsJson(content))?.["ops"];
          if (!Array.isArray(list)) throw new Error("model response has no ops array");
          const valid = list.filter(isAgentOp);
          if (valid.length === 0) throw new Error("model returned no valid ops");
          ops = valid.slice(0, MAX_OPS);
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          lastFinishReason = finishReason;
          logger.warn("design-agent Groq attempt failed", {
            attempt,
            error: lastError,
            finishReason,
            contentPreview,
          });
          if (isRateLimitError(error)) break;
          if (attempt < GROQ_MAX_ATTEMPTS) await sleep(750 * attempt);
        }
      }
      if (ops.length === 0)
        throw new Error(friendlyGroqError(`${lastError} (finish_reason=${lastFinishReason})`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("design-agent Groq call failed", { error: message });
      await broadcast(
        liveblocks,
        roomId,
        runId,
        "error",
        `Ghost couldn't interpret that prompt (${message})`,
      );
      return { ok: false, error: message };
    }

    await broadcast(
      liveblocks,
      roomId,
      runId,
      "processing",
      `Ghost planned ${ops.length} change${ops.length === 1 ? "" : "s"} — applying to the canvas…`,
    );

    // 3. Apply ops inside one storage mutation (atomic: peers see pre- or
    //    post-state, never a half-written canvas).
    const warnings: string[] = [];
    const stamp = Date.now();
    let counter = 0;
    const nextId = (prefix: string): string => `${prefix}-${stamp}-${(counter += 1)}`;
    // Fallback layout cursor for addNode ops without coordinates: right of
    // the existing content, stepping down per node.
    let cursorX = existing.reduce((max, n) => Math.max(max, n.x), 0) + 240;
    let cursorY = 0;
    let addedNodes = 0;
    let addedEdges = 0;
    // Every successful canvas mutation (add/move/resize/update/delete),
    // not just additions — drives the terminal summary below.
    let appliedOps = 0;

    try {
      await liveblocks.mutateStorage(roomId, ({ root }) => {
        type FlowObject = LiveObject<{
          nodes: LiveMap<string, LiveObject<LsonRecord>>;
          edges: LiveMap<string, LiveObject<LsonRecord>>;
        }>;
        const store = root as unknown as {
          get: (key: string) => FlowObject | undefined;
          set: (key: string, value: FlowObject) => void;
        };
        // Same init the client performs in `setInitialStorage`
        // (`node_modules/@liveblocks/react-flow/dist/lib/flow.js`): create
        // the `flow` object with empty maps when the canvas was never
        // opened. The client's init no-ops when `flow` exists, so this can
        // never fight it — whichever side runs first wins, same end state.
        let flow = store.get("flow");
        if (!flow) {
          flow = new LiveObject({
            nodes: new LiveMap<string, LiveObject<LsonRecord>>([]),
            edges: new LiveMap<string, LiveObject<LsonRecord>>([]),
          });
          store.set("flow", flow);
        }
        const liveNodes = flow.get("nodes");
        const liveEdges = flow.get("edges");
        if (!liveNodes || !liveEdges) {
          throw new Error("canvas storage is corrupt — re-open the canvas and retry");
        }

        const resolveKey = (key: string): string | null => resolve.get(key) ?? null;

        for (const op of ops) {
          switch (op.op) {
            case "addNode": {
              if (addedNodes >= MAX_NEW_NODES) {
                warnings.push(`node limit reached, skipped "${op.key}"`);
                break;
              }
              const key = keyOf(op.key);
              if (!key) {
                warnings.push("addNode with empty key skipped");
                break;
              }
              const shape = validShape(op.shape);
              const { width, height } = dimensionsFor(shape);
              const x =
                typeof op.x === "number" ? clamp(op.x, -POSITION_BOUND, POSITION_BOUND) : cursorX;
              const y =
                typeof op.y === "number" ? clamp(op.y, -POSITION_BOUND, POSITION_BOUND) : cursorY;
              if (typeof op.x !== "number" || typeof op.y !== "number") cursorY += 140;
              const id = nextId("ai-node");
              const node = {
                id,
                type: "canvasNode",
                position: { x, y },
                data: {
                  label: typeof op.label === "string" && op.label.trim() ? op.label.trim() : op.key,
                  color: validColor(op.color),
                  shape,
                },
                width,
                height,
                measured: { width, height },
                origin: [0.5, 0.5],
              };
              liveNodes.set(id, asLiveNode(node));
              resolve.set(key, id);
              if (typeof node.data.label === "string")
                resolve.set(node.data.label.trim().toLowerCase(), id);
              addedNodes += 1;
              appliedOps += 1;
              break;
            }
            case "moveNode": {
              const id = resolveKey(keyOf(op.key));
              const live = id ? liveNodes.get(id) : undefined;
              if (!id || !live) {
                warnings.push(`moveNode: unknown node "${op.key}"`);
                break;
              }
              if (typeof op.x !== "number" && typeof op.y !== "number") {
                warnings.push(`moveNode "${op.key}": no coordinates, skipped`);
                break;
              }
              const current = liveToRecord(live);
              const pos = asRecord(current["position"]) ?? {};
              liveNodes.set(
                id,
                asLiveNode({
                  ...current,
                  position: {
                    x:
                      typeof op.x === "number"
                        ? clamp(op.x, -POSITION_BOUND, POSITION_BOUND)
                        : num(pos["x"], 0),
                    y:
                      typeof op.y === "number"
                        ? clamp(op.y, -POSITION_BOUND, POSITION_BOUND)
                        : num(pos["y"], 0),
                  },
                }),
              );
              appliedOps += 1;
              break;
            }
            case "resizeNode": {
              const id = resolveKey(keyOf(op.key));
              const live = id ? liveNodes.get(id) : undefined;
              if (!id || !live) {
                warnings.push(`resizeNode: unknown node "${op.key}"`);
                break;
              }
              const w = typeof op.width === "number" ? clamp(Math.round(op.width), 40, 800) : null;
              const h =
                typeof op.height === "number" ? clamp(Math.round(op.height), 40, 800) : null;
              if (w === null && h === null) {
                warnings.push(`resizeNode "${op.key}": no dimensions, skipped`);
                break;
              }
              const current = liveToRecord(live);
              const measured = asRecord(current["measured"]) ?? {};
              const width = w ?? num(measured["width"], 160);
              const height = h ?? num(measured["height"], 80);
              liveNodes.set(
                id,
                asLiveNode({ ...current, width, height, measured: { width, height } }),
              );
              appliedOps += 1;
              break;
            }
            case "updateNode": {
              const id = resolveKey(keyOf(op.key));
              const live = id ? liveNodes.get(id) : undefined;
              if (!id || !live) {
                warnings.push(`updateNode: unknown node "${op.key}"`);
                break;
              }
              const current = liveToRecord(live);
              const data: Record<string, unknown> = { ...asRecord(current["data"]) };
              if (typeof op.label === "string" && op.label.trim()) data["label"] = op.label.trim();
              if (typeof op.shape === "string") data["shape"] = validShape(op.shape);
              if (typeof op.color === "string") data["color"] = validColor(op.color);
              liveNodes.set(id, asLiveNode({ ...current, data }));
              if (typeof data["label"] === "string") {
                resolve.set((data["label"] as string).trim().toLowerCase(), id);
              }
              appliedOps += 1;
              break;
            }
            case "deleteNode": {
              const id = resolveKey(keyOf(op.key));
              if (!id || !liveNodes.get(id)) {
                warnings.push(`deleteNode: unknown node "${op.key}"`);
                break;
              }
              liveNodes.delete(id);
              // Drop connected edges so no dangling references remain (same
              // contract as the client `useCanvasDelete` flow).
              for (const edgeId of Array.from(liveEdges.keys())) {
                const edge = liveEdges.get(edgeId);
                if (edge?.get("source") === id || edge?.get("target") === id) {
                  liveEdges.delete(edgeId);
                }
              }
              appliedOps += 1;
              break;
            }
            case "addEdge": {
              if (addedEdges >= MAX_NEW_EDGES) {
                warnings.push(`edge limit reached, skipped edge ${op.source} → ${op.target}`);
                break;
              }
              const source = resolveKey(keyOf(op.source));
              const target = resolveKey(keyOf(op.target));
              if (!source || !target) {
                warnings.push(`addEdge: unknown endpoint "${op.source}" → "${op.target}"`);
                break;
              }
              let duplicate = false;
              for (const edgeId of Array.from(liveEdges.keys())) {
                const edge = liveEdges.get(edgeId);
                if (edge?.get("source") === source && edge?.get("target") === target) {
                  duplicate = true;
                  break;
                }
              }
              if (duplicate) {
                warnings.push(`addEdge: edge ${op.source} → ${op.target} already exists`);
                break;
              }
              const id = nextId("ai-edge");
              liveEdges.set(
                id,
                asLiveNode({
                  id,
                  source,
                  target,
                  type: "canvasEdge",
                  data: {
                    label: typeof op.label === "string" ? op.label.trim() : "",
                  },
                  markerEnd: { ...DEFAULT_MARKER_END },
                }),
              );
              addedEdges += 1;
              appliedOps += 1;
              break;
            }
            case "deleteEdge": {
              const source = resolveKey(keyOf(op.source));
              const target = resolveKey(keyOf(op.target));
              if (!source || !target) {
                warnings.push(`deleteEdge: unknown endpoint "${op.source}" → "${op.target}"`);
                break;
              }
              let removed: string | null = null;
              for (const edgeId of Array.from(liveEdges.keys())) {
                const edge = liveEdges.get(edgeId);
                if (edge?.get("source") === source && edge?.get("target") === target) {
                  removed = edgeId;
                  break;
                }
              }
              if (!removed) {
                warnings.push(`deleteEdge: no edge ${op.source} → ${op.target}`);
                break;
              }
              liveEdges.delete(removed);
              appliedOps += 1;
              break;
            }
          }
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("design-agent storage mutation failed", { error: message });
      await broadcast(liveblocks, roomId, runId, "error", `Ghost hit a canvas error (${message})`);
      return { ok: false, error: message };
    }

    const summary =
      appliedOps === 0
        ? "Ghost finished with no canvas changes."
        : addedNodes + addedEdges > 0
          ? `Ghost added ${addedNodes} node${addedNodes === 1 ? "" : "s"} and ${addedEdges} edge${addedEdges === 1 ? "" : "s"}.`
          : `Ghost applied ${appliedOps} canvas change${appliedOps === 1 ? "" : "s"}.`;
    const fullMessage = warnings.length > 0 ? `${summary} (${warnings.length} skipped)` : summary;
    logger.info("design-agent complete", { addedNodes, addedEdges, appliedOps, warnings });
    await broadcast(liveblocks, roomId, runId, "complete", fullMessage);
    return { ok: true, addedNodes, addedEdges, appliedOps, warnings };
  },
});
