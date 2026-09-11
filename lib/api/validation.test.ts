import { describe, expect, test } from "bun:test";

import {
  parseAssistantMessageBody,
  parseCanvasSaveBody,
  parseCreateProjectBody,
  parseDesignTokenBody,
  parseDesignTriggerBody,
  parseInviteCollaboratorBody,
  parseLiveblocksAuthBody,
  parseRenameProjectBody,
  parseSpecSaveBody,
  parseSpecTokenBody,
  parseSpecTriggerBody,
} from "@/lib/api/validation";

describe("parseCreateProjectBody", () => {
  test("defaults when body is missing", () => {
    expect(parseCreateProjectBody(undefined)).toEqual({
      ok: true,
      value: { name: "Untitled Project" },
    });
    expect(parseCreateProjectBody(null)).toEqual({
      ok: true,
      value: { name: "Untitled Project" },
    });
    expect(parseCreateProjectBody({})).toEqual({
      ok: true,
      value: { name: "Untitled Project" },
    });
  });

  test("trims names", () => {
    expect(parseCreateProjectBody({ name: "  Hello  " })).toEqual({
      ok: true,
      value: { name: "Hello" },
    });
  });

  test("rejects unknown fields, empty, non-string, over-length", () => {
    expect(parseCreateProjectBody({ name: "a", extra: 1 }).ok).toBe(false);
    expect(parseCreateProjectBody({ name: "   " }).ok).toBe(false);
    expect(parseCreateProjectBody({ name: 42 }).ok).toBe(false);
    expect(parseCreateProjectBody({ name: "x".repeat(121) }).ok).toBe(false);
    expect(parseCreateProjectBody("nope").ok).toBe(false);
    expect(parseCreateProjectBody([]).ok).toBe(false);
  });

  test("accepts 120 chars", () => {
    const parsed = parseCreateProjectBody({ name: "x".repeat(120) });
    expect(parsed.ok).toBe(true);
  });
});

describe("parseRenameProjectBody", () => {
  test("requires a non-empty name", () => {
    expect(parseRenameProjectBody({ name: "New" })).toEqual({
      ok: true,
      value: { name: "New" },
    });
    expect(parseRenameProjectBody({}).ok).toBe(false);
    expect(parseRenameProjectBody({ name: "  " }).ok).toBe(false);
    expect(parseRenameProjectBody({ name: "a", bogus: true }).ok).toBe(false);
    expect(parseRenameProjectBody(null).ok).toBe(false);
  });
});

describe("parseInviteCollaboratorBody", () => {
  test("lowercases and trims", () => {
    expect(parseInviteCollaboratorBody({ email: "  A@Example.COM " })).toEqual({
      ok: true,
      value: { email: "a@example.com" },
    });
  });

  test("rejects bad emails and bad shapes", () => {
    expect(parseInviteCollaboratorBody({ email: "not-an-email" }).ok).toBe(false);
    expect(parseInviteCollaboratorBody({ email: "" }).ok).toBe(false);
    expect(parseInviteCollaboratorBody({}).ok).toBe(false);
    expect(parseInviteCollaboratorBody({ email: 42 }).ok).toBe(false);
    expect(parseInviteCollaboratorBody({ email: "a@b.com", extra: 1 }).ok).toBe(false);
    const bad = parseInviteCollaboratorBody({ email: "nope" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe("INVALID_EMAIL");
  });
});

describe("parseLiveblocksAuthBody", () => {
  test("maps room to roomId and trims", () => {
    expect(parseLiveblocksAuthBody({ room: "  abc  " })).toEqual({
      ok: true,
      value: { roomId: "abc" },
    });
  });

  test("rejects missing/empty/unknown", () => {
    expect(parseLiveblocksAuthBody({}).ok).toBe(false);
    expect(parseLiveblocksAuthBody({ room: "  " }).ok).toBe(false);
    expect(parseLiveblocksAuthBody({ room: 42 }).ok).toBe(false);
    expect(parseLiveblocksAuthBody({ room: "a", roomId: "b" }).ok).toBe(false);
  });
});

describe("parseDesignTriggerBody", () => {
  test("defaults roomId to projectId", () => {
    expect(parseDesignTriggerBody({ prompt: "hi", projectId: "p1" })).toEqual({
      ok: true,
      value: { prompt: "hi", projectId: "p1", roomId: "p1" },
    });
  });

  test("rejects missing prompt/projectId and over-length prompt", () => {
    expect(parseDesignTriggerBody({ projectId: "p1" }).ok).toBe(false);
    expect(parseDesignTriggerBody({ prompt: "hi" }).ok).toBe(false);
    expect(parseDesignTriggerBody({ prompt: "  ", projectId: "p1" }).ok).toBe(false);
    expect(parseDesignTriggerBody({ prompt: "x".repeat(4001), projectId: "p1" }).ok).toBe(false);
    expect(parseDesignTriggerBody({ prompt: "hi", projectId: "p1", extra: 1 }).ok).toBe(false);
  });
});

describe("parseDesignTokenBody", () => {
  test("requires runId", () => {
    expect(parseDesignTokenBody({ runId: "r1" })).toEqual({
      ok: true,
      value: { runId: "r1" },
    });
    expect(parseDesignTokenBody({}).ok).toBe(false);
    expect(parseDesignTokenBody({ runId: "  " }).ok).toBe(false);
  });
});

describe("parseAssistantMessageBody", () => {
  test("accepts runId + message, enforces 2000 cap", () => {
    expect(parseAssistantMessageBody({ runId: "r", message: "hello" })).toEqual({
      ok: true,
      value: { runId: "r", message: "hello" },
    });
    expect(parseAssistantMessageBody({ runId: "r", message: "x".repeat(2001) }).ok).toBe(false);
    expect(parseAssistantMessageBody({ runId: "r" }).ok).toBe(false);
  });
});

describe("parseCanvasSaveBody", () => {
  test("accepts node/edge id records", () => {
    expect(parseCanvasSaveBody({ nodes: [{ id: "n1" }], edges: [{ id: "e1" }] })).toEqual({
      ok: true,
      value: { nodes: [{ id: "n1" }], edges: [{ id: "e1" }] },
    });
  });

  test("rejects non-arrays and missing ids", () => {
    expect(parseCanvasSaveBody({ nodes: [], edges: [] }).ok).toBe(true);
    expect(parseCanvasSaveBody({ nodes: {}, edges: [] }).ok).toBe(false);
    expect(parseCanvasSaveBody({ nodes: [{ no: 1 }], edges: [] }).ok).toBe(false);
    expect(parseCanvasSaveBody({ nodes: [], edges: [{ id: 42 }] }).ok).toBe(false);
  });
});

describe("parseSpecTriggerBody", () => {
  const base = { roomId: "r1", chatHistory: [], nodes: [], edges: [] };

  test("accepts minimal graph", () => {
    expect(parseSpecTriggerBody(base).ok).toBe(true);
  });

  test("rejects bad chatHistory and oversized graphs", () => {
    expect(parseSpecTriggerBody({ ...base, chatHistory: "nope" }).ok).toBe(false);
    expect(
      parseSpecTriggerBody({
        ...base,
        chatHistory: [{ role: "user", content: "" }],
      }).ok,
    ).toBe(false);
    expect(
      parseSpecTriggerBody({
        ...base,
        chatHistory: [{ role: "weird", content: "hi" }],
      }).ok,
    ).toBe(false);
    const tooMany = Array.from({ length: 51 }, (_, i) => ({
      role: "user" as const,
      content: `m${i}`,
    }));
    expect(parseSpecTriggerBody({ ...base, chatHistory: tooMany }).ok).toBe(false);
    const tooManyNodes = Array.from({ length: 201 }, (_, i) => ({ id: `n${i}` }));
    expect(parseSpecTriggerBody({ ...base, nodes: tooManyNodes }).ok).toBe(false);
    const tooManyEdges = Array.from({ length: 401 }, (_, i) => ({ id: `e${i}` }));
    expect(parseSpecTriggerBody({ ...base, edges: tooManyEdges }).ok).toBe(false);
  });
});

describe("parseSpecTokenBody + parseSpecSaveBody", () => {
  test("token requires runId", () => {
    expect(parseSpecTokenBody({ runId: "r" }).ok).toBe(true);
    expect(parseSpecTokenBody({}).ok).toBe(false);
  });

  test("save requires markdown", () => {
    expect(parseSpecSaveBody({ markdown: "# hi" }).ok).toBe(true);
    expect(parseSpecSaveBody({}).ok).toBe(false);
    expect(parseSpecSaveBody({ markdown: "   " }).ok).toBe(false);
    expect(parseSpecSaveBody({ markdown: "# hi", extra: 1 }).ok).toBe(false);
  });
});
