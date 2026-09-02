"use client";

import { useCallback, useState } from "react";

import { mockProjects, slugify, type Project } from "@/lib/projects";

// ---------------------------------------------------------------------------
// Single source of truth for the editor's project list and the Create /
// Rename / Delete project dialogs.
//
// The hook is editor-scoped today, so it lives in `hooks/` (the alias
// declared in `components.json`). When the project model graduates to a real
// store, this hook is the seam — callers don't change.
//
// `isSubmitting` is wired through the API even though spec 04 has no
// backend, so the eventual swap to Prisma mutations only changes the bodies
// of submitCreate / submitRename / submitConfirmDelete.
// ---------------------------------------------------------------------------

type DialogState =
  | { type: "create" }
  | { type: "rename"; project: Project }
  | { type: "delete"; project: Project }
  | { type: null };

export type UseProjectDialogsResult = {
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

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useProjectDialogs(): UseProjectDialogsResult {
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [dialog, setDialog] = useState<DialogState>({ type: null });
  const [formName, setFormName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ownedProjects = projects.filter((p) => p.isOwner);
  const sharedProjects = projects.filter((p) => !p.isOwner);

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
    const newProject: Project = {
      id: generateId(),
      name,
      slug: slugify(name),
      ownerId: "user_1",
      isOwner: true,
    };
    setProjects((prev) => [newProject, ...prev]);
    setDialog({ type: null });
    setFormName("");
    setIsSubmitting(false);
  }, [dialog, formName]);

  const submitRename = useCallback(async () => {
    if (dialog.type !== "rename") return;
    const name = formName.trim();
    if (!name) return;
    const target = dialog.project;
    setIsSubmitting(true);
    setProjects((prev) =>
      prev.map((p) => (p.id === target.id ? { ...p, name, slug: slugify(name) } : p)),
    );
    setDialog({ type: null });
    setFormName("");
    setIsSubmitting(false);
  }, [dialog, formName]);

  const submitConfirmDelete = useCallback(async () => {
    if (dialog.type !== "delete") return;
    const target = dialog.project;
    setIsSubmitting(true);
    setProjects((prev) => prev.filter((p) => p.id !== target.id));
    setDialog({ type: null });
    setIsSubmitting(false);
  }, [dialog]);

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
