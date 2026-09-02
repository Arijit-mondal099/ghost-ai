"use client";

import { PlusIcon, XIcon } from "lucide-react";

import { ProjectItem } from "@/components/editor/project-item";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/projects";

// ---------------------------------------------------------------------------
// Floating left sidebar listing the user's owned projects and the projects
// shared with them. The mobile backdrop is a sibling `<button>` (not a
// `<div>`) so keyboard focus and screen readers get the close action
// for free; it's hidden at the `md` breakpoint to match the sidebar's
// desktop-open behavior.
// ---------------------------------------------------------------------------

type ProjectSidebarProps = {
  isOpen: boolean;
  ownedProjects: Project[];
  sharedProjects: Project[];
  onClose: () => void;
  onCreate: () => void;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
};

function ProjectSidebar({
  isOpen,
  ownedProjects,
  sharedProjects,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: ProjectSidebarProps) {
  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs md:hidden"
        />
      ) : null}
      <aside
        inert={!isOpen}
        aria-hidden={!isOpen}
        className={cn(
          "fixed left-0 top-14 bottom-0 z-40 flex w-72 flex-col border-r border-surface-border bg-base/95 backdrop-blur-md transition-transform duration-200",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <span className="text-sm font-medium text-copy-primary">Projects</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close sidebar">
            <XIcon />
          </Button>
        </div>

        <Tabs defaultValue="mine" className="flex flex-1 flex-col overflow-hidden px-4 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="mine" className="flex-1">
              My Projects
            </TabsTrigger>
            <TabsTrigger value="shared" className="flex-1">
              Shared
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="mt-3 flex-1 overflow-hidden">
            {ownedProjects.length === 0 ? (
              <p className="text-sm text-copy-muted">No projects yet.</p>
            ) : (
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-0.5 pb-2">
                  {ownedProjects.map((project) => (
                    <ProjectItem
                      key={project.id}
                      project={project}
                      onRename={onRename}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
          <TabsContent value="shared" className="mt-3 flex-1 overflow-hidden">
            {sharedProjects.length === 0 ? (
              <p className="text-sm text-copy-muted">No shared projects yet.</p>
            ) : (
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-0.5 pb-2">
                  {sharedProjects.map((project) => (
                    <ProjectItem
                      key={project.id}
                      project={project}
                      onRename={onRename}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <div className="border-t border-surface-border p-4">
          <Button variant="default" className="w-full" onClick={onCreate}>
            <PlusIcon />
            New Project
          </Button>
        </div>
      </aside>
    </>
  );
}

export { ProjectSidebar };
export type { ProjectSidebarProps };
