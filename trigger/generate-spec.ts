// ---------------------------------------------------------------------------
// Spec generation task (spec 29 — backend flow).
//
// The current canvas graph + chat history become a Markdown technical spec:
//
//   1. Validate the payload defensively (direct triggers bypass the route).
//   2. Set `metadata.status = "generating"` so realtime subscribers
//      (`useRealtimeRun`) track progress without any Liveblocks dependency.
//   3. Ask Groq (`qwen/qwen3.6-27b`, `reasoning_effort: "none"`) for Markdown.
//      Output is prose, not ops — no JSON extraction needed.
//   4. Set `metadata.status = "complete"` (or `"error"`) and return
//      `{ ok: true, markdown }`. The Markdown rides the task output; nothing
//      is persisted here (spec storage is a later unit).
//
// Self-contained by design: the shape/color vocabulary is duplicated from
// `types/canvas.ts` (cited below) because the Trigger.dev bundle cannot rely
// on the app's `@/` path alias. Registered via `trigger.config.ts`
// (`dirs: ["./trigger"]`).
// ---------------------------------------------------------------------------

import { logger, metadata, task } from "@trigger.dev/sdk";
import Groq from "groq-sdk";

export type GenerateSpecPayload = {
  projectId: string;
  roomId: string;
  chatHistory: { role: "user" | "assistant"; content: string }[];
  nodes: unknown[];
  edges: unknown[];
};

type GenerateSpecResult = { ok: true; markdown: string } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Vocabulary (mirrors `types/canvas.ts` NODE_SHAPES + NODE_COLORS — duplicated
// so this file has no `@/` imports; see header note). Used to give the model
// the semantic meaning behind each node's shape/color.
// ---------------------------------------------------------------------------

const SHAPE_MEANINGS: Record<string, string> = {
  rectangle: "general component/service",
  diamond: "decision/gateway",
  circle: "event/endpoint",
  pill: "service/process",
  cylinder: "database/storage",
  hexagon: "external system/boundary",
};

const MODEL = "qwen/qwen3.6-27b";
const GROQ_MAX_ATTEMPTS = 3;
// Output token ceiling, resolved per run (see `resolveMaxTokens`).
// Live-test finding (2026-09-10): the org's `on_demand` tier enforces
// 1000 output tokens/min, so the original hardcoded 4000 was rejected
// pre-flight with 429 `rate_limit_exceeded` ("Requested 4000") — no amount
// of retrying or waiting clears that, the request itself is over limit.
// Default 1000 matches the enforced ceiling (same as design-agent's op
// JSON); raise via `GROQ_SPEC_MAX_TOKENS` after a tier bump instead of
// editing code. The attempt loop still fails fast on 429s (see
// `isRateLimitError`) with a friendly message instead of burning attempts.
const GRAPH_NODE_LIMIT = 200;
const GRAPH_EDGE_LIMIT = 400;
const CHAT_MESSAGE_LIMIT = 50;

/**
 * Max output tokens for the spec completion. Env-overridable so a Groq
 * tier upgrade (console.groq.com/settings/billing) takes effect without a
 * code change. Floored at 256 (below that even a short spec truncates to
 * uselessness) and capped at 32000 (sanity bound on runaway config).
 */
function resolveMaxTokens(): number {
  const raw = process.env["GROQ_SPEC_MAX_TOKENS"];
  const parsed = raw === undefined ? NaN : Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 256) return Math.min(Math.floor(parsed), 32000);
  return 1000;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Ghost, an AI system-design architect writing a technical specification. Respond with ONLY the Markdown spec — no fences, no preamble, no explanation outside the document.

Structure the spec as:

# <System name inferred from the design>

## Overview
A short paragraph: what the system does and its primary purpose.

## Components
One subsection per canvas node (### <Label>). Describe each component's role, inferring character from its shape and color hints: rectangle = general component/service, diamond = decision/gateway, circle = event/endpoint, pill = service/process, cylinder = database/storage, hexagon = external system/boundary.

## Connections & Data Flow
Describe how components interact, following the directed edges in order. Name the source, the protocol or verb on each edge label if present, and the target. Call out request paths, event flows, and storage reads/writes.

## Design Rationale & Open Questions
Ground this in the conversation history: decisions the user made, tradeoffs discussed, and anything unresolved or worth confirming before implementation.

Rules:
- Every node and edge in the graph must be covered; never invent components or connections that are not in the graph.
- Keep labels exact as given. If an edge has no label, describe the relationship generically.
- If the graph is empty, write the Overview from the conversation and note that no canvas components exist yet.
- Keep the spec focused and implementation-ready; avoid marketing language.`;

// Appended to the user prompt when the full draft overflows the output token
// budget: same structure and coverage requirements, constrained hard enough
// to fit ~1000 output tokens.
const COMPACT_SUFFIX = `

The previous draft exceeded the output length budget and was cut off. Rewrite the COMPLETE spec compactly so it fits: one tight paragraph per component, brief bullets for data flow, short rationale. Total under 700 words. Every node and edge must still be covered.`;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function serializeGraph(
  nodes: unknown[],
  edges: unknown[],
): { nodeLines: string[]; edgeLines: string[] } {
  const seen = new Map<string, string>();
  const nodeLines: string[] = [];
  for (const raw of nodes.slice(0, GRAPH_NODE_LIMIT)) {
    const node = asRecord(raw);
    if (!node || typeof node["id"] !== "string") continue;
    const id = node["id"] as string;
    const data = asRecord(node["data"]) ?? {};
    const label =
      typeof data["label"] === "string" && data["label"].trim()
        ? (data["label"] as string).trim()
        : id;
    const shape = typeof data["shape"] === "string" ? (data["shape"] as string) : "rectangle";
    const color = typeof data["color"] === "string" ? (data["color"] as string) : "neutral";
    const meaning = SHAPE_MEANINGS[shape] ?? SHAPE_MEANINGS["rectangle"]!;
    seen.set(id, label);
    nodeLines.push(`- "${label}" [${shape}: ${meaning}, color ${color}]`);
  }
  const edgeLines: string[] = [];
  for (const raw of edges.slice(0, GRAPH_EDGE_LIMIT)) {
    const edge = asRecord(raw);
    if (!edge || typeof edge["source"] !== "string" || typeof edge["target"] !== "string") continue;
    const source = seen.get(edge["source"] as string) ?? (edge["source"] as string);
    const target = seen.get(edge["target"] as string) ?? (edge["target"] as string);
    const data = asRecord(edge["data"]) ?? {};
    const label = typeof data["label"] === "string" ? (data["label"] as string).trim() : "";
    edgeLines.push(
      label ? `- "${source}" --[${label}]--> "${target}"` : `- "${source}" --> "${target}"`,
    );
  }
  return { nodeLines, edgeLines };
}

function buildUserPrompt(
  chatHistory: GenerateSpecPayload["chatHistory"],
  nodes: unknown[],
  edges: unknown[],
): string {
  const { nodeLines, edgeLines } = serializeGraph(nodes, edges);
  const graphSection =
    nodeLines.length === 0 && edgeLines.length === 0
      ? "The canvas is empty — no nodes or edges."
      : `Canvas nodes:\n${nodeLines.join("\n")}\n\nCanvas edges:\n${edgeLines.join("\n")}`;
  const chatSection =
    chatHistory.length === 0
      ? "No conversation history."
      : chatHistory
          .slice(-CHAT_MESSAGE_LIMIT)
          .map((m) => `${m.role === "user" ? "User" : "Ghost"}: ${m.content}`)
          .join("\n");
  return `${graphSection}\n\nConversation history:\n${chatSection}\n\nWrite the technical specification for this system.`;
}

// ---------------------------------------------------------------------------
// Small helpers (same shapes as `trigger/design-agent.ts`)
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * True for Groq quota errors (HTTP 429 / `rate_limit_exceeded`). These ride
 * a per-minute output-token window, so the retry backoff can never clear
 * them — the attempt loop must fail fast instead of burning all three
 * attempts in ~2s.
 */
function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b429\b/.test(message)) return true;
  return message.toLowerCase().includes("rate_limit_exceeded");
}

/** User-facing terminal message: raw provider JSON never reaches the chat. */
function friendlyGroqError(message: string): string {
  // Pre-flight tier-cap rejection ("Request too large ... OTPM: Limit
  // 1000, Requested 4000 ... reduce max_tokens"): waiting can never clear
  // it — the request itself is over the tier limit — so say so instead of
  // the generic rate-limit advice below.
  if (/output tokens|OTPM|reduce max_tokens/i.test(message)) {
    return "Ghost's spec draft exceeds this Groq plan's output-token limit — upgrade the Groq tier or lower GROQ_SPEC_MAX_TOKENS.";
  }
  if (/rate_limit_exceeded/i.test(message) || /\b429\b/.test(message)) {
    return "Ghost hit the AI rate limit — wait a minute and try again.";
  }
  if (/finish_reason=length/i.test(message)) {
    return "Ghost's draft was cut off — the canvas may be too large for one spec, try a smaller scope.";
  }
  return message;
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export const generateSpec = task({
  id: "generate-spec",
  run: async (payload: GenerateSpecPayload): Promise<GenerateSpecResult> => {
    // Defensive payload validation (the route validates too, but direct
    // triggers bypass it).
    const roomId = typeof payload.roomId === "string" ? payload.roomId.trim() : "";
    const projectId = typeof payload.projectId === "string" ? payload.projectId.trim() : "";
    const chatHistory = Array.isArray(payload.chatHistory) ? payload.chatHistory : null;
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : null;
    const edges = Array.isArray(payload.edges) ? payload.edges : null;
    if (!roomId || !projectId || !chatHistory || !nodes || !edges) {
      logger.error("generate-spec rejected: malformed payload");
      return { ok: false, error: "roomId, projectId, chatHistory, nodes, and edges are required" };
    }
    // Same bounds as SPEC_GRAPH_MAX_NODES / SPEC_GRAPH_MAX_EDGES enforced by
    // the route validator (duplicated — this bundle has no `@/` alias).
    // Reject instead of truncating: the prompt contract covers every node
    // and edge, so silently dropping accepted elements is a correctness bug.
    if (nodes.length > GRAPH_NODE_LIMIT || edges.length > GRAPH_EDGE_LIMIT) {
      logger.error("generate-spec rejected: graph exceeds limits", {
        nodes: nodes.length,
        edges: edges.length,
      });
      return {
        ok: false,
        error: `nodes must have at most ${GRAPH_NODE_LIMIT} entries and edges at most ${GRAPH_EDGE_LIMIT}`,
      };
    }

    let groq: Groq;
    try {
      const groqKey = process.env["GROQ_API_KEY"];
      if (!groqKey) throw new Error("GROQ_API_KEY is not set");
      // Bound each attempt: the SDK default is 10 minutes, so a stalled
      // provider call would pin the client's run on EXECUTING past any
      // reasonable wait (3 attempts ≈ 30 min). 90s × 3 + backoff ≈ 4.6 min
      // worst case, inside the client's 6-minute absolute timeout.
      groq = new Groq({ apiKey: groqKey, timeout: 90_000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("generate-spec missing credentials", { error: message });
      return { ok: false, error: message };
    }

    metadata.set("status", "generating");
    metadata.set("progress", 0.1);
    logger.info("generate-spec run", {
      roomId,
      projectId,
      nodes: nodes.length,
      edges: edges.length,
      messages: chatHistory.length,
    });

    // Ask Groq for the Markdown spec. No `response_format: json_object` —
    // the output is prose, not JSON (and Qwen on Groq rejects JSON mode
    // anyway — see `trigger/design-agent.ts`). Up to 3 attempts: empty
    // generations and transient 4xx/5xx are retried with backoff; rate-limit
    // errors fail fast with a friendly message. A `length` truncation is
    // retried once in compact mode (below) before giving up.
    let markdown = "";
    try {
      const baseUserPrompt = buildUserPrompt(chatHistory, nodes, edges);
      let lastError = "unknown error";
      let compactMode = false;
      for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS; attempt += 1) {
        let finishReason = "unknown";
        let contentPreview = "";
        try {
          const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: compactMode ? baseUserPrompt + COMPACT_SUFFIX : baseUserPrompt,
            },
          ] as { role: "system" | "user"; content: string }[];
          const completion = await groq.chat.completions.create({
            model: MODEL,
            temperature: 0.4,
            max_tokens: resolveMaxTokens(),
            // Qwen is a hybrid thinking model: left alone it can spend the
            // token budget on a <think> trace instead of the spec. This task
            // is pure Markdown emission, so reasoning is disabled entirely.
            reasoning_effort: "none",
            messages,
          });
          const choice = completion.choices[0];
          finishReason = choice?.finish_reason ?? "unknown";
          const content = (choice?.message?.content ?? "").trim();
          contentPreview = content.length > 200 ? `${content.slice(0, 200)}…` : content;
          if (!content) throw new Error("model returned empty content");
          if (finishReason === "length") {
            if (!compactMode) {
              // Full draft overflowed the output budget — retry once with a
              // brevity-constrained prompt instead of failing outright. Sleep
              // out Groq's per-minute output-token window first so the retry
              // itself isn't rate-limited, heartbeating metadata on the way
              // so the realtime stream carries traffic (long-quiet SSE
              // connections get killed) and the run stays visibly alive.
              compactMode = true;
              logger.info("generate-spec retrying in compact mode", {
                attempt,
                finishReason,
              });
              for (let waited = 0; waited < 60_000; waited += 15_000) {
                await sleep(15_000);
                metadata.set("progress", 0.2 + (0.3 * (waited + 15_000)) / 60_000);
              }
              continue;
            }
            // Compact draft still cut off: the canvas genuinely exceeds what
            // one run can emit — `friendlyGroqError` reports this distinctly.
            lastError = "finish_reason=length";
            break;
          }
          markdown = content;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          logger.warn("generate-spec Groq attempt failed", {
            attempt,
            error: lastError,
            finishReason,
            contentPreview,
          });
          if (isRateLimitError(error)) break;
          if (attempt < GROQ_MAX_ATTEMPTS) await sleep(750 * attempt);
        }
      }
      if (!markdown) throw new Error(friendlyGroqError(lastError));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("generate-spec Groq call failed", { error: message });
      metadata.set("status", "error");
      return { ok: false, error: message };
    }

    metadata.set("progress", 1.0);
    metadata.set("status", "complete");
    logger.info("generate-spec complete", { chars: markdown.length });
    return { ok: true, markdown };
  },
});
