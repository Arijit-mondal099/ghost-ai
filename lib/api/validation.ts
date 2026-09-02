// ---------------------------------------------------------------------------
// Hand-rolled request body parsers for the project API. Avoids pulling in
// a schema library for two small bodies. Each parser returns a discriminated
// union so the handler does a single if (!parsed.ok) return ... check.
// ---------------------------------------------------------------------------

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
