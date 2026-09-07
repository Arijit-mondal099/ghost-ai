"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useOthers } from "@liveblocks/react";

import { authAppearance } from "@/lib/auth-appearance";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Top-right participant group inside the editor canvas view (only).
//
// Two visual halves separated by a 1px divider that only appears when at
// least one other participant is present:
//   1. Up to 5 overlapping collaborator avatars (filtered to exclude the
//      current Clerk user — their representation is the Clerk UserButton on
//      the right). The spec is explicit: do not render a second avatar for
//      the current user from the Liveblocks presence list.
//   2. The Clerk UserButton, sized to match the avatars via a per-element
//      `userButtonBox` override (the same shadcn `authAppearance` theme
//      used in the navbar, with a 32px box on top).
//
// Display-only — the avatar row is `aria-hidden` and the avatars are
// non-interactive. The current user opens their account / sign-out menu via
// the UserButton (navbar or canvas); the canvas one is a duplicate of the
// navbar one (the spec confirmed the navbar should keep its UserButton).
//
// No shadcn `Avatar` primitive — rolled a 15-line `CollaboratorAvatar` with
// initials + optional `<img>` so we don't add a new dep or modify the
// protected `components/ui/*` foundation. Same rationale as
// `share-project-dialog.tsx:24-26`.
//
// Subtle ring: each avatar (and the UserButton) gets a 2px halo in the
// brand-dim token so it stays readable on the dark `bg-base` canvas. Same
// ring precedent as `canvas-color-toolbar.tsx:151` and `canvas-node.tsx:75`.
// ---------------------------------------------------------------------------

const AVATAR_SIZE = 32;
const AVATAR_RING = "0 0 0 2px var(--accent-primary-dim)";
const MAX_AVATARS = 5;

// Canvas-mounted UserButton. Sized to match the avatar diameter (32px) via
// the `userButtonBox` element override; the shadcn `authAppearance` theme
// is reused so the trigger's color/font stay consistent with the navbar.
const canvasUserButtonAppearance = {
  ...authAppearance,
  elements: {
    ...authAppearance.elements,
    userButtonBox: "h-8 w-8",
  },
} as const;

function initialsFor(name: string | null): string {
  const source = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (source.length === 0) return "?";
  if (source.length === 1) return source[0]!.slice(0, 2).toUpperCase();
  return `${source[0]![0]}${source[source.length - 1]![0]}`.toUpperCase();
}

function CollaboratorAvatar({
  name,
  imageUrl,
  size = AVATAR_SIZE,
}: {
  name: string;
  imageUrl: string;
  size?: number;
}) {
  const initials = initialsFor(name);
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-[10px] font-medium text-copy-secondary ring-1 ring-surface-border"
      style={{ width: size, height: size, boxShadow: AVATAR_RING }}
      aria-hidden
    >
      {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}

function PresenceAvatars() {
  const { user } = useUser();
  const others = useOthers();

  // Liveblocks `Other.id` is the Clerk user id, set via `identifyUser` in
  // `/api/liveblocks-auth`. Bail until Clerk resolves to avoid a flicker
  // where the current user briefly appears as a collaborator.
  if (!user) return null;

  const currentUserId = user.id;
  const filtered = others.filter((other) => other.id !== currentUserId);

  const visible = filtered.slice(0, MAX_AVATARS);
  const overflow = filtered.length - visible.length;
  const showDivider = filtered.length > 0;

  return (
    <div className="nodrag nopan absolute top-4 right-4 z-40 flex items-center">
      <div aria-hidden className="flex items-center">
        {visible.map((other, index) => (
          <div key={other.connectionId} className={cn(index === 0 ? "" : "-ml-2")}>
            <CollaboratorAvatar name={other.info?.name ?? ""} imageUrl={other.info?.avatar ?? ""} />
          </div>
        ))}
        {overflow > 0 ? (
          <div
            className="-ml-2 flex shrink-0 items-center justify-center rounded-full bg-elevated text-[10px] font-medium text-copy-secondary ring-1 ring-surface-border"
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, boxShadow: AVATAR_RING }}
            aria-hidden
          >
            +{overflow}
          </div>
        ) : null}
      </div>
      {showDivider ? <div className="mx-1 h-4 w-px bg-surface-border" aria-hidden /> : null}
      <UserButton
        appearance={canvasUserButtonAppearance}
        userProfileProps={{ appearance: authAppearance }}
      />
    </div>
  );
}

export { PresenceAvatars };
