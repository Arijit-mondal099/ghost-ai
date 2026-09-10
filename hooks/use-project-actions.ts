"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { slugify, type Project } from "@/lib/projects";
import { getProjectLimit, isPlanSlug, type PlanSlug } from "@/lib/billing";

// ---------------------------------------------------------------------------
// Single source of truth for the editor's project dialog state and the
// Create / Rename / Delete project actions.
//
// The project list is owned by the editor layout (`app/editor/layout.tsx`)
// and passed in via `initialProjects` so the list survives `router.refresh()`
// without a client-side cache. The hook derives `ownedProjects` /
// `sharedProjects` from that input. Rename calls `fetch` + `router.refresh()`;
// Create navigates straight into the new workspace (`/editor/{id}`) and then
// refreshes so the persistent shell list picks up the new project (the
// layout payload is otherwise reused verbatim on navigation); Delete
// navigates home and refreshes.
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

export type UpgradePrompt = {
  currentPlan: PlanSlug;
  limit: number;
  upgradeTo: PlanSlug;
};

export type UseProjectActionsResult = {
  ownedProjects: Project[];
  sharedProjects: Project[];
  isCreateOpen: boolean;
  isRenameOpen: boolean;
  isDeleteOpen: boolean;
  isUpgradeOpen: boolean;
  renameTarget: Project | null;
  deleteTarget: Project | null;
  upgrade: UpgradePrompt | null;
  formName: string;
  isSubmitting: boolean;
  openCreate: () => void;
  openRename: (project: Project) => void;
  openDelete: (project: Project) => void;
  closeDialog: () => void;
  closeUpgrade: () => void;
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
  const details = await readErrorDetails(response);
  return details.message;
}

type ErrorDetails = {
  message: string;
  code?: string;
  currentPlan?: unknown;
  limit?: unknown;
  upgradeTo?: unknown;
};

async function readErrorDetails(response: Response): Promise<ErrorDetails> {
  try {
    const body = (await response.json()) as { error?: Record<string, unknown> };
    const error = body.error ?? {};
    const message =
      typeof error.message === "string" ? error.message : `Request failed (${response.status})`;
    return {
      message,
      code: typeof error.code === "string" ? error.code : undefined,
      currentPlan: error.currentPlan,
      limit: error.limit,
      upgradeTo: error.upgradeTo,
    };
  } catch {
    return { message: `Request failed (${response.status})` };
  }
}

/** Build an upgrade prompt from a `PLAN_LIMIT_EXCEEDED` payload, or null. */
function toUpgradePrompt(details: ErrorDetails): UpgradePrompt | null {
  if (details.code !== "PLAN_LIMIT_EXCEEDED") return null;
  if (!isPlanSlug(details.currentPlan) || !isPlanSlug(details.upgradeTo)) return null;
  const limit =
    typeof details.limit === "number" && Number.isFinite(details.limit)
      ? details.limit
      : getProjectLimit(details.currentPlan);
  return { currentPlan: details.currentPlan, limit, upgradeTo: details.upgradeTo };
}

export function useProjectActions(initialProjects: Project[]): UseProjectActionsResult {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ type: null });
  const [formName, setFormName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [upgrade, setUpgrade] = useState<UpgradePrompt | null>(null);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
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

  const closeUpgrade = useCallback(() => {
    setIsUpgradeOpen(false);
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
        const details = await readErrorDetails(response);
        const prompt = toUpgradePrompt(details);
        if (prompt) {
          // Over-limit (spec 36): stay on the page, keep the create dialog
          // state, and open the upgrade dialog. Nothing is created.
          setUpgrade(prompt);
          setIsUpgradeOpen(true);
          return;
        }
        console.error("Failed to create project:", details.message);
        return;
      }

      // The 201 body is the full project record (see PROJECT_SELECT in
      // app/api/projects/route.ts). The new project's `id` is also the
      // workspace URL slug for now (treated as Project.id per spec 08).
      const created = (await response.json()) as { id: string };

      setDialog({ type: null });
      setFormName("");
      router.push(`/editor/${created.id}`);
      // The editor layout payload is reused on navigation — without this
      // the sidebar list (and the shell's room lookup) never learns about
      // the new project.
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
    isUpgradeOpen,
    renameTarget: dialog.type === "rename" ? dialog.project : null,
    deleteTarget: dialog.type === "delete" ? dialog.project : null,
    upgrade,
    formName,
    isSubmitting,
    openCreate,
    openRename,
    openDelete,
    closeDialog,
    closeUpgrade,
    setFormName,
    submitCreate,
    submitRename,
    submitConfirmDelete,
  };
}
