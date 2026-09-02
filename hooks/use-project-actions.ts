"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { slugify, type Project } from "@/lib/projects";

// ---------------------------------------------------------------------------
// Single source of truth for the editor's project dialog state and the
// Create / Rename / Delete project actions.
//
// The project list is owned by the server component (`app/editor/page.tsx`)
// and passed in via `initialProjects` so the list survives `router.refresh()`
// without a client-side cache. The hook derives `ownedProjects` /
// `sharedProjects` from that input; the three submit handlers call
// `fetch` against `/api/projects` and then `router.refresh()` to re-fetch
// the server data.
//
// Room ID generation is a stub for the upcoming real-time canvas spec:
// `slugify(name) + "-" + shortSuffix()`. The room ID is not yet sent to
// the API (the spec's POST handler derives the cuid PK server-side); it
// exists here so the create path produces a stable, human-readable key
// for the future Liveblocks room.
// ---------------------------------------------------------------------------

type DialogState =
  | { type: "create" }
  | { type: "rename"; project: Project }
  | { type: "delete"; project: Project }
  | { type: null };

export type UseProjectActionsResult = {
  ownedProjects: Project[];
  sharedProjects: Project[];
  isCreateOpen: boolean;
  isRenameOpen: boolean;
  isDeleteOpen: boolean;
  renameTarget: Project | null;
  deleteTarget: Project | null;
  formName: string;
  isSubmitting: boolean;
  openCreate: () => void;
  openRename: (project: Project) => void;
  openDelete: (project: Project) => void;
  closeDialog: () => void;
  setFormName: (name: string) => void;
  submitCreate: () => Promise<void>;
  submitRename: () => Promise<void>;
  submitConfirmDelete: () => Promise<void>;
};

function shortSuffix(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  }
  return Math.random().toString(36).slice(2, 8);
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export function useProjectActions(initialProjects: Project[]): UseProjectActionsResult {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ type: null });
  const [formName, setFormName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const takenSuffixes = useRef<Set<string>>(new Set());

  const ownedProjects = initialProjects.filter((p) => p.isOwner);
  const sharedProjects = initialProjects.filter((p) => !p.isOwner);

  const reserveRoomSuffix = useCallback((slug: string): string => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = shortSuffix();
      const key = `${slug}-${suffix}`;
      if (!takenSuffixes.current.has(key)) {
        takenSuffixes.current.add(key);
        return key;
      }
    }
    const fallback = `${slug}-${shortSuffix()}${shortSuffix()}`;
    takenSuffixes.current.add(fallback);
    return fallback;
  }, []);

  const openCreate = useCallback(() => {
    setFormName("");
    setDialog({ type: "create" });
  }, []);

  const openRename = useCallback((project: Project) => {
    setFormName(project.name);
    setDialog({ type: "rename", project });
  }, []);

  const openDelete = useCallback((project: Project) => {
    setDialog({ type: "delete", project });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog({ type: null });
    setFormName("");
    setIsSubmitting(false);
  }, []);

  const submitCreate = useCallback(async () => {
    if (dialog.type !== "create") return;
    const name = formName.trim();
    if (!name) return;
    setIsSubmitting(true);

    // Reserve the room ID locally so the future Liveblocks spec has a
    // stable key. Not yet persisted — the API derives the cuid PK.
    reserveRoomSuffix(slugify(name));

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const message = await readError(response);
        console.error("Failed to create project:", message);
        return;
      }

      setDialog({ type: null });
      setFormName("");
      router.refresh();
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [dialog, formName, reserveRoomSuffix, router]);

  const submitRename = useCallback(async () => {
    if (dialog.type !== "rename") return;
    const name = formName.trim();
    if (!name) return;
    const target = dialog.project;
    if (name === target.name) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const message = await readError(response);
        console.error("Failed to rename project:", message);
        return;
      }

      setDialog({ type: null });
      setFormName("");
      router.refresh();
    } catch (error) {
      console.error("Failed to rename project:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [dialog, formName, router]);

  const submitConfirmDelete = useCallback(async () => {
    if (dialog.type !== "delete") return;
    const target = dialog.project;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${target.id}`, { method: "DELETE" });

      if (!response.ok) {
        const message = await readError(response);
        console.error("Failed to delete project:", message);
        return;
      }

      setDialog({ type: null });
      router.push("/editor");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete project:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [dialog, router]);

  return {
    ownedProjects,
    sharedProjects,
    isCreateOpen: dialog.type === "create",
    isRenameOpen: dialog.type === "rename",
    isDeleteOpen: dialog.type === "delete",
    renameTarget: dialog.type === "rename" ? dialog.project : null,
    deleteTarget: dialog.type === "delete" ? dialog.project : null,
    formName,
    isSubmitting,
    openCreate,
    openRename,
    openDelete,
    closeDialog,
    setFormName,
    submitCreate,
    submitRename,
    submitConfirmDelete,
  };
}
