// ---------------------------------------------------------------------------
// Hand-rolled request body parsers for the project API. Avoids pulling in
// a schema library for two small bodies. Each parser returns a discriminated
// union so the handler does a single if (!parsed.ok) return ... check.
// ---------------------------------------------------------------------------

import { AI_CHAT_CONTENT_MAX_LENGTH } from "@/types/tasks";

const DEFAULT_PROJECT_NAME = "Untitled Project";
const NAME_MAX_LENGTH = 120;

export type CreateProjectBody = { name: string };
export type RenameProjectBody = { name: string };

export type ParseResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

type NameRead =
  | { kind: "absent" }
  | { kind: "ok"; value: string }
  | { kind: "err"; message: string };

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return (
    typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) === Object.prototype
  );
}

function invalidBody(code: string, message: string) {
  return { ok: false as const, code, message };
}

function readName(input: Record<string, unknown>): NameRead {
  if (!("name" in input)) {
    return { kind: "absent" };
  }
  const raw = input["name"];
  if (raw === undefined || raw === null) {
    return { kind: "absent" };
  }
  if (typeof raw !== "string") {
    return { kind: "err", message: "name must be a string" };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { kind: "err", message: "name must not be empty" };
  }
  if (trimmed.length > NAME_MAX_LENGTH) {
    return { kind: "err", message: `name must be at most ${NAME_MAX_LENGTH} characters` };
  }
  return { kind: "ok", value: trimmed };
}

function rejectUnknownFields(
  input: Record<string, unknown>,
  allowed: readonly string[],
): { code: string; message: string } | null {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) {
      return { code: "INVALID_BODY", message: `Unknown field: ${key}` };
    }
  }
  return null;
}

export function parseCreateProjectBody(input: unknown): ParseResult<CreateProjectBody> {
  if (input === undefined || input === null) {
    return { ok: true, value: { name: DEFAULT_PROJECT_NAME } };
  }
  if (!isPlainObject(input)) {
    return invalidBody("INVALID_BODY", "Body must be a JSON object");
  }
  const unknown = rejectUnknownFields(input, ["name"]);
  if (unknown) return invalidBody(unknown.code, unknown.message);

  const name = readName(input);
  if (name.kind === "err") return invalidBody("INVALID_BODY", name.message);
  if (name.kind === "absent") {
    return { ok: true, value: { name: DEFAULT_PROJECT_NAME } };
  }
  return { ok: true, value: { name: name.value } };
}

export function parseRenameProjectBody(input: unknown): ParseResult<RenameProjectBody> {
  if (!isPlainObject(input)) {
    return invalidBody("INVALID_BODY", "Body must be a JSON object");
  }
  const unknown = rejectUnknownFields(input, ["name"]);
  if (unknown) return invalidBody(unknown.code, unknown.message);

  const name = readName(input);
  if (name.kind === "err") return invalidBody("INVALID_BODY", name.message);
  if (name.kind === "absent") {
    return invalidBody("INVALID_BODY", "name is required");
  }
  return { ok: true, value: { name: name.value } };
}

// ---------------------------------------------------------------------------
// Collaborator invite body. The email is lowercased + trimmed so the
// `@@unique([projectId, email])` constraint catches duplicates regardless
// of input casing, and the Clerk enrichment lookup uses the same canonical
// form. Clerk is the source of truth for "does this account exist" — the
// route handler does a separate pre-check via findUserByEmail and returns
// 400 USER_NOT_FOUND on miss.
// ---------------------------------------------------------------------------

export type InviteCollaboratorBody = { email: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseInviteCollaboratorBody(input: unknown): ParseResult<InviteCollaboratorBody> {
  if (!isPlainObject(input)) {
    return invalidBody("INVALID_BODY", "Body must be a JSON object");
  }
  const unknown = rejectUnknownFields(input, ["email"]);
  if (unknown) return invalidBody(unknown.code, unknown.message);

  if (!("email" in input) || input["email"] === undefined || input["email"] === null) {
    return invalidBody("INVALID_BODY", "email is required");
  }
  const raw = input["email"];
  if (typeof raw !== "string") {
    return invalidBody("INVALID_BODY", "email must be a string");
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) {
    return invalidBody("INVALID_BODY", "email is required");
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return invalidBody("INVALID_EMAIL", "email is not a valid address");
  }
  return { ok: true, value: { email: trimmed } };
}

// ---------------------------------------------------------------------------
// Liveblocks auth body. The Liveblocks JS client posts `{ room: "<id>" }` to
// the auth endpoint (the wire field name is fixed by the SDK), so the parser
// reads `room` and surfaces it as `roomId` to the route — the route does not
// need to know about the wire name. No format validation: a CUID-shaped
// string is required, but the id is opaque to the client and the Prisma
// lookup will return null for a bad id, which the route surfaces as 403.
// Trimming + non-emptiness is enough here.
// ---------------------------------------------------------------------------

export type LiveblocksAuthBody = { roomId: string };

export function parseLiveblocksAuthBody(input: unknown): ParseResult<LiveblocksAuthBody> {
  if (!isPlainObject(input)) {
    return invalidBody("INVALID_BODY", "Body must be a JSON object");
  }
  const unknown = rejectUnknownFields(input, ["room"]);
  if (unknown) return invalidBody(unknown.code, unknown.message);

  if (!("room" in input) || input["room"] === undefined || input["room"] === null) {
    return invalidBody("INVALID_BODY", "room is required");
  }
  const raw = input["room"];
  if (typeof raw !== "string") {
    return invalidBody("INVALID_BODY", "room must be a string");
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return invalidBody("INVALID_BODY", "room is required");
  }
  return { ok: true, value: { roomId: trimmed } };
}

// ---------------------------------------------------------------------------
// Canvas save body (spec 21). The graph schema stays owned by
// `types/canvas.ts` — the API only checks the envelope: two arrays of plain
// objects with string ids, plus a total size guard. Node/edge internals are
// opaque here so canvas-side schema evolution does not require API changes.
// ---------------------------------------------------------------------------

export type CanvasSaveBody = { nodes: unknown[]; edges: unknown[] };

const CANVAS_MAX_BYTES = 5 * 1024 * 1024;

function isIdRecord(value: unknown): boolean {
  return isPlainObject(value) && typeof value["id"] === "string";
}

// ---------------------------------------------------------------------------
// Design agent trigger + token bodies (spec 23). `roomId` is the project id
// (spec 08) — accepted as an optional override, defaulting to `projectId` so
// callers that only know the project still work. The route verifies project
// access after parsing; the token route verifies TaskRun ownership.
// ---------------------------------------------------------------------------

export type DesignTriggerBody = { prompt: string; projectId: string; roomId: string };
export type DesignTokenBody = { runId: string };

const DESIGN_PROMPT_MAX_LENGTH = 4000;

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseDesignTriggerBody(input: unknown): ParseResult<DesignTriggerBody> {
  if (!isPlainObject(input)) {
    return invalidBody("INVALID_BODY", "Body must be a JSON object");
  }
  const unknown = rejectUnknownFields(input, ["prompt", "projectId", "roomId"]);
  if (unknown) return invalidBody(unknown.code, unknown.message);

  const prompt = readNonEmptyString(input["prompt"]);
  if (!prompt) {
    return invalidBody("INVALID_BODY", "prompt is required");
  }
  if (prompt.length > DESIGN_PROMPT_MAX_LENGTH) {
    return invalidBody(
      "INVALID_BODY",
      `prompt must be at most ${DESIGN_PROMPT_MAX_LENGTH} characters`,
    );
  }
  const projectId = readNonEmptyString(input["projectId"]);
  if (!projectId) {
    return invalidBody("INVALID_BODY", "projectId is required");
  }
  const roomRaw = input["roomId"];
  const roomId =
    roomRaw === undefined || roomRaw === null ? projectId : readNonEmptyString(roomRaw);
  if (!roomId) {
    return invalidBody("INVALID_BODY", "roomId must be a non-empty string");
  }
  return { ok: true, value: { prompt, projectId, roomId } };
}

export function parseDesignTokenBody(input: unknown): ParseResult<DesignTokenBody> {
  if (!isPlainObject(input)) {
    return invalidBody("INVALID_BODY", "Body must be a JSON object");
  }
  const unknown = rejectUnknownFields(input, ["runId"]);
  if (unknown) return invalidBody(unknown.code, unknown.message);

  const runId = readNonEmptyString(input["runId"]);
  if (!runId) {
    return invalidBody("INVALID_BODY", "runId is required");
  }
  return { ok: true, value: { runId } };
}

// ---------------------------------------------------------------------------
// Assistant chat broadcast body (spec 28). `{ runId, message }` — the route
// verifies the requester owns the TaskRun before the server broadcasts the
// Ghost message, so only the initiating run's owner can post as Ghost.
// ---------------------------------------------------------------------------

export type AssistantMessageBody = { runId: string; message: string };

export function parseAssistantMessageBody(input: unknown): ParseResult<AssistantMessageBody> {
  if (!isPlainObject(input)) {
    return invalidBody("INVALID_BODY", "Body must be a JSON object");
  }
  const unknown = rejectUnknownFields(input, ["runId", "message"]);
  if (unknown) return invalidBody(unknown.code, unknown.message);

  const runId = readNonEmptyString(input["runId"]);
  if (!runId) {
    return invalidBody("INVALID_BODY", "runId is required");
  }
  const message = readNonEmptyString(input["message"]);
  if (!message) {
    return invalidBody("INVALID_BODY", "message is required");
  }
  if (message.length > AI_CHAT_CONTENT_MAX_LENGTH) {
    return invalidBody(
      "INVALID_BODY",
      `message must be at most ${AI_CHAT_CONTENT_MAX_LENGTH} characters`,
    );
  }
  return { ok: true, value: { runId, message } };
}

export function parseCanvasSaveBody(input: unknown): ParseResult<CanvasSaveBody> {
  if (!isPlainObject(input)) {
    return invalidBody("INVALID_BODY", "Body must be a JSON object");
  }
  const unknown = rejectUnknownFields(input, ["nodes", "edges"]);
  if (unknown) return invalidBody(unknown.code, unknown.message);

  const { nodes, edges } = input;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return invalidBody("INVALID_BODY", "nodes and edges must be arrays");
  }
  if (!nodes.every(isIdRecord) || !edges.every(isIdRecord)) {
    return invalidBody("INVALID_BODY", "every node and edge must be an object with a string id");
  }
  // Measure UTF-8 bytes, not UTF-16 code units: multibyte label text would
  // otherwise pass the check while exceeding the limit on the wire.
  const byteLength = new TextEncoder().encode(JSON.stringify(input)).byteLength;
  if (byteLength > CANVAS_MAX_BYTES) {
    return invalidBody("CANVAS_TOO_LARGE", "Canvas payload exceeds the 5 MB limit");
  }
  return { ok: true, value: { nodes, edges } };
}

// ---------------------------------------------------------------------------
// Spec generation trigger + token bodies (spec 29). No `projectId` is accepted
// anywhere here: project access is derived from `roomId` (`roomId ===
// Project.id` per spec 08), so a client-supplied project id would only be an
// IDOR vector. `rejectUnknownFields` turns one into INVALID_BODY.
// `chatHistory` entries mirror the AI_CHAT feed contract (specs 26/28):
// user/assistant roles with content capped at AI_CHAT_CONTENT_MAX_LENGTH.
// `nodes`/`edges` reuse the canvas-save envelope (id records + byte guard) so
// canvas schema evolution never touches this parser.
// ---------------------------------------------------------------------------

export type SpecChatMessage = { role: "user" | "assistant"; content: string };
export type SpecTriggerBody = {
  roomId: string;
  chatHistory: SpecChatMessage[];
  nodes: unknown[];
  edges: unknown[];
};
export type SpecTokenBody = { runId: string };

const SPEC_CHAT_HISTORY_MAX_MESSAGES = 50;

// Mirror of GRAPH_NODE_LIMIT / GRAPH_EDGE_LIMIT in
// `trigger/generate-spec.ts` (duplicated — the Trigger.dev bundle cannot use
// the `@/` alias). Graphs beyond these bounds are rejected below so the task
// never silently truncates accepted elements out of the prompt (its "cover
// every node and edge" contract).
export const SPEC_GRAPH_MAX_NODES = 200;
export const SPEC_GRAPH_MAX_EDGES = 400;

function isSpecChatMessage(value: unknown): value is SpecChatMessage {
  if (!isPlainObject(value)) return false;
  const { role, content } = value;
  if (role !== "user" && role !== "assistant") return false;
  if (typeof content !== "string") return false;
  const trimmed = content.trim();
  if (trimmed.length === 0 || content.length > AI_CHAT_CONTENT_MAX_LENGTH) return false;
  return true;
}

export function parseSpecTriggerBody(input: unknown): ParseResult<SpecTriggerBody> {
  if (!isPlainObject(input)) {
    return invalidBody("INVALID_BODY", "Body must be a JSON object");
  }
  const unknown = rejectUnknownFields(input, ["roomId", "chatHistory", "nodes", "edges"]);
  if (unknown) return invalidBody(unknown.code, unknown.message);

  const roomId = readNonEmptyString(input["roomId"]);
  if (!roomId) {
    return invalidBody("INVALID_BODY", "roomId is required");
  }
  const { chatHistory, nodes, edges } = input;
  if (!Array.isArray(chatHistory)) {
    return invalidBody("INVALID_BODY", "chatHistory must be an array");
  }
  if (chatHistory.length > SPEC_CHAT_HISTORY_MAX_MESSAGES) {
    return invalidBody(
      "INVALID_BODY",
      `chatHistory must have at most ${SPEC_CHAT_HISTORY_MAX_MESSAGES} messages`,
    );
  }
  if (!chatHistory.every(isSpecChatMessage)) {
    return invalidBody(
      "INVALID_BODY",
      "every chatHistory entry must be { role: user|assistant, content }",
    );
  }
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return invalidBody("INVALID_BODY", "nodes and edges must be arrays");
  }
  if (!nodes.every(isIdRecord) || !edges.every(isIdRecord)) {
    return invalidBody("INVALID_BODY", "every node and edge must be an object with a string id");
  }
  if (nodes.length > SPEC_GRAPH_MAX_NODES || edges.length > SPEC_GRAPH_MAX_EDGES) {
    return invalidBody(
      "SPEC_TOO_LARGE",
      `nodes must have at most ${SPEC_GRAPH_MAX_NODES} entries and edges at most ${SPEC_GRAPH_MAX_EDGES}`,
    );
  }
  // Same wire-size reasoning as the canvas-save guard above: the graph +
  // history ride the Trigger.dev trigger payload, so bound it here.
  const byteLength = new TextEncoder().encode(JSON.stringify(input)).byteLength;
  if (byteLength > CANVAS_MAX_BYTES) {
    return invalidBody("SPEC_TOO_LARGE", "Spec payload exceeds the 5 MB limit");
  }
  return {
    ok: true,
    value: { roomId, chatHistory: chatHistory as SpecChatMessage[], nodes, edges },
  };
}

export function parseSpecTokenBody(input: unknown): ParseResult<SpecTokenBody> {
  if (!isPlainObject(input)) {
    return invalidBody("INVALID_BODY", "Body must be a JSON object");
  }
  const unknown = rejectUnknownFields(input, ["runId"]);
  if (unknown) return invalidBody(unknown.code, unknown.message);

  const runId = readNonEmptyString(input["runId"]);
  if (!runId) {
    return invalidBody("INVALID_BODY", "runId is required");
  }
  return { ok: true, value: { runId } };
}

// ---------------------------------------------------------------------------
// Spec save body (spec 30). The client POSTs the finished Markdown (fetched
// from the completed generate-spec run output) so the API can persist it to
// Vercel Blob + a ProjectSpec row. Single allow-listed field; the membership
// gate lives in the route. Size guard is generous headroom over Groq's
// 4000-token output cap (~16 KB) without inviting abuse.
// ---------------------------------------------------------------------------

export type SpecSaveBody = { markdown: string };

const SPEC_SAVE_MAX_BYTES = 500 * 1024;

export function parseSpecSaveBody(input: unknown): ParseResult<SpecSaveBody> {
  if (!isPlainObject(input)) {
    return invalidBody("INVALID_BODY", "Body must be a JSON object");
  }
  const unknown = rejectUnknownFields(input, ["markdown"]);
  if (unknown) return invalidBody(unknown.code, unknown.message);

  const markdown = readNonEmptyString(input["markdown"]);
  if (!markdown) {
    return invalidBody("INVALID_BODY", "markdown is required");
  }
  // UTF-8 bytes, not UTF-16 code units (same reasoning as the canvas guard).
  const byteLength = new TextEncoder().encode(markdown).byteLength;
  if (byteLength > SPEC_SAVE_MAX_BYTES) {
    return invalidBody("SPEC_TOO_LARGE", "Spec exceeds the 500 KB limit");
  }
  return { ok: true, value: { markdown } };
}
