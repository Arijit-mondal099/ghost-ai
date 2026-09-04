"use client";

import Link from "next/link";
import { MoreHorizontalIcon, PencilIcon, TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/projects";

// ---------------------------------------------------------------------------
// Single project row in the sidebar. The whole row is a link to the
// project's workspace so the sidebar is the universal navigation surface
// (home and workspace both). The trailing `...` menu — and therefore the
// rename/delete actions — only appears for projects the current user owns;
// shared/collaborator projects render the name only. The dropdown trigger
// is a sibling button, not nested inside the link, so clicking it opens
// the menu instead of following the link. `DropdownMenuItem.onSelect` stops
// the default so Rename / Delete never navigate either. When `isActive`
// is set (the workspace page sets it for the project whose room is open),
// the row gets a persistent `bg-subtle` highlight.
// ---------------------------------------------------------------------------

type ProjectItemProps = {
  project: Project;
  isActive?: boolean;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
};

function ProjectItem({ project, isActive, onRename, onDelete }: ProjectItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-1 rounded-xl px-2 py-1.5 hover:bg-subtle/50",
        isActive && "bg-subtle",
      )}
    >
      <Link
        href={`/editor/${project.id}`}
        aria-current={isActive ? "page" : undefined}
        className="flex min-w-0 flex-1 cursor-pointer items-center"
      >
        <span className="truncate text-sm text-copy-primary">{project.name}</span>
      </Link>
      {project.isOwner ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${project.name}`}
              className="opacity-60 hover:opacity-100"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={2}>
            <DropdownMenuItem onSelect={() => onRename(project)}>
              <PencilIcon />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(project)}>
              <TrashIcon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export { ProjectItem };
export type { ProjectItemProps };
