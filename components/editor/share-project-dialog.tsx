"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, UserPlusIcon, XIcon } from "lucide-react";

import { EditorDialog } from "@/components/editor/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Collaborator, ShareOwner } from "@/hooks/use-share-dialog";

// ---------------------------------------------------------------------------
// Share project dialog. Owners can invite/remove collaborators; collaborators
// see a read-only view with the owner badge. The hook (`useShareDialog`)
// owns all state + fetch + submit; this component is presentational and
// receives its props straight through from the workspace client.
//
// Collaborators see a muted "You" badge next to their own row in the
// collaborator list (matched by case-insensitive email against
// `currentUserEmail`). The owner row at the top keeps its primary "Owner"
// badge and is not additionally tagged with "You" — that would be
// redundant.
//
// No shadcn `Avatar` primitive — rolled a 15-line `CollaboratorAvatar` with
// initials + optional `<img>` so we don't add a new dep or modify the
// protected `components/ui/*` foundation.
//
// No `EditorDialog.Footer` — close is the top-right X, and the dialog has no
// destructive primary action that needs a confirm. Remove is per-row and
// trivially reversible (re-invite by email).
//
// `shareUrl` is hydrated from `window.location.href` in a `useEffect` to
// avoid touching `window` during the static analysis pass (Next 16 RSC
// evaluates the function body even for "use client" components).
// ---------------------------------------------------------------------------

type ShareProjectDialogProps = {
  isOpen: boolean;
  isOwner: boolean;
  isLoading: boolean;
  isInviting: boolean;
  isRemovingId: string | null;
  isCopied: boolean;
  formEmail: string;
  errorMessage: string | null;
  owner: ShareOwner | null;
  collaborators: Collaborator[];
  currentUserEmail: string | null;
  onOpenChange: (open: boolean) => void;
  onFormEmailChange: (email: string) => void;
  onSubmitInvite: () => void;
  onRemove: (collaboratorId: string) => void;
  onCopyLink: () => void;
};

function initialsFor(name: string | null, email: string): string {
  const source = (name?.trim() || email).split(/[\s@.]+/).filter(Boolean);
  if (source.length === 0) return "?";
  if (source.length === 1) return source[0]!.slice(0, 2).toUpperCase();
  return `${source[0]![0]}${source[source.length - 1]![0]}`.toUpperCase();
}

function CollaboratorAvatar({
  name,
  imageUrl,
  email,
  size = 32,
}: {
  name: string | null;
  imageUrl: string | null;
  email: string;
  size?: number;
}) {
  const initials = initialsFor(name, email);
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-[10px] font-medium text-copy-secondary ring-1 ring-surface-border"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}

function ShareProjectDialog({
  isOpen,
  isOwner,
  isLoading,
  isInviting,
  isRemovingId,
  isCopied,
  formEmail,
  errorMessage,
  owner,
  collaborators,
  currentUserEmail,
  onOpenChange,
  onFormEmailChange,
  onSubmitInvite,
  onRemove,
  onCopyLink,
}: ShareProjectDialogProps) {
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShareUrl(window.location.href);
  }, [isOpen]);

  return (
    <EditorDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <EditorDialog.Content>
        <EditorDialog.Header>
          <h3 className="text-lg font-medium">Share project</h3>
          <EditorDialog.Description>
            {isOwner
              ? "Manage who can view and edit this project."
              : "View the people with access to this project."}
          </EditorDialog.Description>
        </EditorDialog.Header>

        {/* Copy-link row */}
        <div className="flex w-full min-w-0 items-center gap-2">
          <code className="min-w-0 flex-1 truncate overflow-hidden rounded-md bg-surface px-2 py-1 text-xs text-copy-secondary">
            {shareUrl}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopyLink}
            disabled={isCopied}
            className="shrink-0"
          >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
            {isCopied ? "Copied!" : "Copy link"}
          </Button>
        </div>

        {/* Read-only banner for non-owners */}
        {!isOwner ? (
          <p className="text-xs text-copy-muted">
            Only the project owner can invite or remove collaborators.
          </p>
        ) : null}

        {/* Inline error block */}
        {errorMessage ? (
          <p
            role="alert"
            aria-live="polite"
            className="rounded-md border border-surface-border bg-surface px-2 py-1.5 text-xs text-error"
          >
            {errorMessage}
          </p>
        ) : null}

        {/* Owner row */}
        {owner ? (
          <div className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl bg-surface px-2 py-1.5">
            <CollaboratorAvatar name={owner.name} imageUrl={owner.imageUrl} email={owner.email} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-copy-primary">
                {owner.name ?? owner.email ?? "Project owner"}
              </p>
              {owner.name && owner.email ? (
                <p className="truncate text-xs text-copy-muted">{owner.email}</p>
              ) : null}
            </div>
            <span className="shrink-0 rounded-md bg-accent-dim px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
              Owner
            </span>
          </div>
        ) : null}

        {/* Collaborator list */}
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium text-copy-muted">
            Collaborators ({collaborators.length})
          </p>
          <ScrollArea className="max-h-60 w-full overflow-hidden rounded-xl border border-surface-border">
            {isLoading && collaborators.length === 0 ? (
              <p className="px-2 py-3 text-xs text-copy-muted">Loading collaborators…</p>
            ) : collaborators.length === 0 ? (
              <p className="px-2 py-3 text-xs text-copy-muted">No collaborators yet.</p>
            ) : (
              <ul className="flex flex-col">
                {collaborators.map((row) => {
                  const isCurrentUser =
                    currentUserEmail !== null &&
                    row.email.toLowerCase() === currentUserEmail.toLowerCase();
                  return (
                    <li
                      key={row.id}
                      className="flex min-w-0 items-center gap-3 overflow-hidden border-b border-surface-border px-2 py-1.5 last:border-b-0"
                    >
                      <CollaboratorAvatar
                        name={row.name}
                        imageUrl={row.imageUrl}
                        email={row.email}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-copy-primary">
                          {row.name ?? row.email}
                        </p>
                        {row.name ? (
                          <p className="truncate text-xs text-copy-muted">{row.email}</p>
                        ) : null}
                      </div>
                      {isCurrentUser ? (
                        <span className="shrink-0 rounded-md bg-subtle px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-copy-secondary">
                          You
                        </span>
                      ) : null}
                      {isOwner ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onRemove(row.id)}
                          disabled={isRemovingId === row.id}
                          aria-label={`Remove ${row.name ?? row.email}`}
                        >
                          <XIcon />
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Invite form (owner only) */}
        {isOwner ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitInvite();
            }}
            className="flex min-w-0 flex-col gap-2"
          >
            <p className="text-xs font-medium text-copy-muted">Invite by email</p>
            <div className="flex w-full min-w-0 gap-2">
              <Input
                type="email"
                autoFocus
                placeholder="someone@example.com"
                value={formEmail}
                onChange={(event) => onFormEmailChange(event.target.value)}
                className="bg-surface text-copy-primary placeholder:text-copy-muted"
                disabled={isInviting}
              />
              <Button type="submit" disabled={!formEmail.trim() || isInviting}>
                <UserPlusIcon />
                Invite
              </Button>
            </div>
          </form>
        ) : null}
      </EditorDialog.Content>
    </EditorDialog.Root>
  );
}

export { ShareProjectDialog };
export type { ShareProjectDialogProps };
