// ---------------------------------------------------------------------------
// Auth helpers for route handlers. The Clerk proxy already calls
// `auth.protect()` for every /api/* route, but the handler still needs the
// typed userId and an explicit 401 contract at the route layer.
// ---------------------------------------------------------------------------

import { auth } from "@clerk/nextjs/server";

import { HttpError } from "./responses";

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");
  }
  return userId;
}
