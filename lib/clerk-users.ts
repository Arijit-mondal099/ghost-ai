// ---------------------------------------------------------------------------
// Thin Clerk Backend wrapper for the share dialog.
//
// `clerkClient.users.getUserList({ emailAddress: [...] })` is documented as a
// case-insensitive partial-match filter, so it can return users whose
// address merely contains the query. We re-filter the response to an exact
// case-insensitive match ourselves, so callers never see a stale match.
//
// Two return shapes are used intentionally:
//   - `findUserByEmail` returns `null` (not a stub) on miss. The invite
//     route relies on `null` to reject unknown emails; a stub would silently
//     create rows for non-existent accounts.
//   - `enrichCollaborators` returns a stub (`name: null, imageUrl: null`)
//     on miss so the list endpoint can still render an email-only row — the
//     spec says "If a Clerk user is not found for an email, fall back to
//     showing the email only."
//
// All helpers never re-throw: a Clerk failure logs and returns the same
// shape as a successful "no match" so the dialog can render uniformly.
// ---------------------------------------------------------------------------

import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

export type EnrichedUser = {
  email: string;
  name: string | null;
  imageUrl: string | null;
};

type ClerkUser = {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string;
  emailAddresses: { emailAddress: string }[] | undefined;
};

export function displayNameFromClerk(user: ClerkUser): string | null {
  const first = user.firstName?.trim() ?? "";
  const last = user.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full.length > 0) return full;
  if (user.username) return user.username;
  return null;
}

function userToEnriched(user: ClerkUser): EnrichedUser {
  const primary = user.emailAddresses?.[0]?.emailAddress.toLowerCase() ?? "";
  return {
    email: primary,
    name: displayNameFromClerk(user),
    imageUrl: user.imageUrl ? user.imageUrl : null,
  };
}

export async function findUserByEmail(email: string): Promise<EnrichedUser | null> {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) return null;

  try {
    const client = await clerkClient();
    const list = await client.users.getUserList({ emailAddress: [normalized] });
    const match = list.data.find((u) =>
      (u.emailAddresses ?? []).some((ea) => ea.emailAddress.toLowerCase() === normalized),
    );
    if (!match) return null;
    return userToEnriched(match);
  } catch (error) {
    console.error("Clerk lookup failed for", normalized, error);
    return null;
  }
}

export async function enrichCollaborators(emails: readonly string[]): Promise<EnrichedUser[]> {
  // De-dupe so we don't issue redundant Clerk calls. Map preserves input order.
  // `null` from findUserByEmail becomes a stub here so the list endpoint can
  // still render the email-only fallback row.
  const unique = Array.from(new Set(emails.map((e) => e.toLowerCase())));
  const settled = await Promise.all(unique.map((email) => findUserByEmail(email)));
  return unique.map((email, index) => {
    const hit = settled[index];
    return hit ?? { email, name: null, imageUrl: null };
  });
}

export async function findUserById(userId: string): Promise<EnrichedUser | null> {
  if (userId.trim().length === 0) return null;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return userToEnriched(user);
  } catch (error) {
    console.error("Clerk lookup failed for userId", userId, error);
    return null;
  }
}
