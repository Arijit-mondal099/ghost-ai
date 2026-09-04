"use client";

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Client hook for the share dialog. Mirrors the controlled-dialog pattern
// from `useProjectActions` (parent owns open/close + form + submitting)
// but lives in its own file because the share dialog's state shape is
// independent of the create/rename/delete union and would only clutter that
// hook with fields the project dialogs don't use.
//
// The hook fetches collaborators on open (matching the fetch-on-action
// pattern from spec 07's project dialogs) and refreshes after each
// successful invite/remove. Server-side ownership is the source of truth
// for invite/remove authorization — `isOwner` is computed in the workspace
// page and passed in as a prop. The client cannot escalate it.
// ---------------------------------------------------------------------------

export type Collaborator = {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
};

export type ShareOwner = {
  userId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
};

type UseShareDialogArgs = {
  projectId: string;
};

export type UseShareDialogResult = {
  isOpen: boolean;
  isLoading: boolean;
  isInviting: boolean;
  isRemovingId: string | null;
  isCopied: boolean;
  formEmail: string;
  errorMessage: string | null;
  owner: ShareOwner | null;
  collaborators: Collaborator[];
  open: () => void;
  close: () => void;
  setFormEmail: (email: string) => void;
  submitInvite: () => Promise<void>;
  submitRemove: (collaboratorId: string) => Promise<void>;
  copyLink: () => Promise<void>;
};

type ApiError = { code: string; message: string };

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    return {
      code: body.error?.code ?? "UNKNOWN",
      message: body.error?.message ?? `Request failed (${response.status})`,
    };
  } catch {
    return { code: "UNKNOWN", message: `Request failed (${response.status})` };
  }
}

export function useShareDialog({ projectId }: UseShareDialogArgs): UseShareDialogResult {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isRemovingId, setIsRemovingId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [owner, setOwner] = useState<ShareOwner | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const { message } = await readError(response);
        setErrorMessage(message);
        return;
      }
      const body = (await response.json()) as {
        owner: ShareOwner;
        collaborators: Collaborator[];
      };
      setOwner(body.owner);
      setCollaborators(body.collaborators);
    } catch (error) {
      console.error("Failed to load collaborators", error);
      setErrorMessage("Failed to load collaborators");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const open = useCallback(() => {
    setIsOpen(true);
    setErrorMessage(null);
    setFormEmail("");
    setIsCopied(false);
    void refresh();
  }, [refresh]);

  const close = useCallback(() => {
    setIsOpen(false);
    setErrorMessage(null);
    setFormEmail("");
    setIsCopied(false);
    setIsInviting(false);
    setIsRemovingId(null);
  }, []);

  // Auto-clear the "Copied!" feedback after ~1.5s so the button reverts.
  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [isCopied]);

  const submitInvite = useCallback(async () => {
    const trimmed = formEmail.trim();
    if (!trimmed || isInviting) return;
    setIsInviting(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!response.ok) {
        const { code, message } = await readError(response);
        if (code === "USER_NOT_FOUND") {
          setErrorMessage("No account exists for that email. They need to sign up first.");
        } else if (code === "ALREADY_COLLABORATOR") {
          setErrorMessage("That email is already invited to this project.");
        } else if (code === "FORBIDDEN") {
          setErrorMessage("Only the project owner can invite collaborators.");
        } else {
          setErrorMessage(message);
        }
        return;
      }
      setFormEmail("");
      await refresh();
    } catch (error) {
      console.error("Failed to invite collaborator", error);
      setErrorMessage("Failed to invite collaborator");
    } finally {
      setIsInviting(false);
    }
  }, [formEmail, isInviting, projectId, refresh]);

  const submitRemove = useCallback(
    async (collaboratorId: string) => {
      if (isRemovingId) return;
      setIsRemovingId(collaboratorId);
      setErrorMessage(null);
      try {
        const response = await fetch(`/api/projects/${projectId}/collaborators/${collaboratorId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const { message } = await readError(response);
          setErrorMessage(message);
          return;
        }
        await refresh();
      } catch (error) {
        console.error("Failed to remove collaborator", error);
        setErrorMessage("Failed to remove collaborator");
      } finally {
        setIsRemovingId(null);
      }
    },
    [isRemovingId, projectId, refresh],
  );

  const copyLink = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
    } catch (error) {
      console.error("Failed to copy link", error);
      setErrorMessage("Could not copy link to clipboard");
    }
  }, []);

  return {
    isOpen,
    isLoading,
    isInviting,
    isRemovingId,
    isCopied,
    formEmail,
    errorMessage,
    owner,
    collaborators,
    open,
    close,
    setFormEmail,
    submitInvite,
    submitRemove,
    copyLink,
  };
}
