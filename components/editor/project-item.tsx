"use client";

import { MoreHorizontalIcon, PencilIcon, TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@/lib/projects";

// ---------------------------------------------------------------------------
// Single project row in the sidebar. The trailing `...` menu — and therefore
// the rename/delete actions — only appears for projects the current user
// owns. Shared/collaborator projects render the name only.
// ---------------------------------------------------------------------------

type ProjectItemProps = {
  project: Project;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
};

function ProjectItem({ project, onRename, onDelete }: ProjectItemProps) {
  return (
    <div className="group flex items-center justify-between gap-1 rounded-xl px-2 py-1.5 hover:bg-subtle/50">
      <span className="truncate text-sm text-copy-primary">{project.name}</span>
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
