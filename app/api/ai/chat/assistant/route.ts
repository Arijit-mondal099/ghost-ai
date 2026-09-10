// ---------------------------------------------------------------------------
// POST /api/ai/chat/assistant — server-broadcast a Ghost chat message
//
// Body: `{ runId, message }`. `AI_CHAT` RoomEvents carry client-provided
// sender/role, so listeners only render `role: "assistant"` from server
// origin (spec 28). This route is that origin: it verifies the requester
// owns the TaskRun (same gates as the token route) and broadcasts the Ghost
// message via the server SDK. Room id is derived from the TaskRun row, never
// from the caller.
//
// Returns `201 { id }` (server-generated message id) so the initiator can
// append with the same id and dedupe the broadcast echo.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api/auth";
import { liveblocks } from "@/lib/liveblocks";
import {
  badRequest,
  forbidden,
  HttpError,
  json,
  notFound,
  rateLimited,
  unauthorized,
} from "@/lib/api/responses";
import { checkRateLimit, resolveRateLimitIdentifier } from "@/lib/ratelimit";
import { parseAssistantMessageBody } from "@/lib/api/validation";
import { AI_CHAT_GHOST_SENDER_ID } from "@/types/tasks";

export async function POST(request: Request): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof HttpError) return unauthorized();
    throw error;
  }

  // Rate-limit before any validation or billable work: 401s never consume
  // quota, and abuse never reaches Prisma/Liveblocks. Fail-open — Redis-down
  // allows the request.
  const assistantLimit = await checkRateLimit("ai", resolveRateLimitIdentifier(userId, request));
  if (!assistantLimit.ok) {
    return rateLimited(assistantLimit.limit, assistantLimit.remaining, assistantLimit.reset);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = parseAssistantMessageBody(body);
  if (!parsed.ok) {
    return badRequest(parsed.code, parsed.message);
  }
  const { runId, message } = parsed.value;

  const taskRun = await prisma.taskRun.findUnique({
    where: { runId },
    select: { projectId: true, userId: true },
  });
  if (!taskRun) return notFound("Run not found");
  if (taskRun.userId !== userId) {
    return forbidden("You do not own this run");
  }

  const project = await prisma.project.findUnique({
    where: { id: taskRun.projectId },
    select: { id: true },
  });
  if (!project) return notFound("Project not found");

  const id = crypto.randomUUID();
  try {
    await liveblocks.broadcastEvent(taskRun.projectId, {
      type: "AI_CHAT",
      id,
      sender: { id: AI_CHAT_GHOST_SENDER_ID, name: "Ghost" },
      role: "assistant",
      content: message,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Assistant broadcast failed", error);
    return json(
      { error: { code: "BROADCAST_UNAVAILABLE", message: "Ghost message could not be sent" } },
      { status: 502 },
    );
  }

  return json({ id }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
