"use client";

import Link from "next/link";
import { CrownIcon, PlusIcon, XIcon } from "lucide-react";

import { ProjectItem } from "@/components/editor/project-item";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLAN_LABELS, type BillingSummary } from "@/lib/billing";
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
  currentRoomId?: string;
  inline?: boolean;
  /** Plan badge + usage. Presentational — resolved server-side in the layout. */
  billing?: BillingSummary;
  onClose: () => void;
  onCreate: () => void;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
};

// ---------------------------------------------------------------------------
// Plan badge + usage footer (spec 36). Purely presentational: counts and the
// plan arrive as props from the server layout. A missing `billing` prop
// (loading or error upstream) renders a muted fallback that links to
// `/pricing` — the project list above never breaks.
// ---------------------------------------------------------------------------

function SidebarBillingFooter({ billing }: { billing?: BillingSummary }) {
  if (!billing) {
    return (
      <div className="border-t border-surface-border p-4">
        <div aria-hidden="true" className="mb-2 h-2 animate-pulse rounded-xl bg-subtle" />
        <Button variant="ghost" size="sm" className="w-full" asChild>
          <Link href="/pricing">
            <CrownIcon />
            Upgrade
          </Link>
        </Button>
      </div>
    );
  }

  const planLabel = PLAN_LABELS[billing.plan] ?? billing.plan;
  const used = Math.min(billing.ownedCount, billing.limit);
  const percent = billing.limit > 0 ? Math.min(100, Math.round((used / billing.limit) * 100)) : 0;

  return (
    <div className="border-t border-surface-border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-copy-secondary">
          {planLabel} &bull; {billing.ownedCount}/{billing.limit} projects
        </span>
        <Button variant="ghost" size="sm" asChild aria-label="Upgrade plan">
          <Link href="/pricing">
            <CrownIcon />
            Upgrade
          </Link>
        </Button>
      </div>
      <div
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={billing.limit}
        aria-label={`${billing.ownedCount} of ${billing.limit} projects used`}
        className="h-1.5 overflow-hidden rounded-xl bg-subtle"
      >
        <div className="h-full rounded-xl bg-brand" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ProjectSidebar({
  isOpen,
  ownedProjects,
  sharedProjects,
  currentRoomId,
  inline = false,
  billing,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: ProjectSidebarProps) {
  if (inline) {
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
          className={cn("h-full w-72 flex-col border-r-0 bg-base", isOpen ? "flex" : "hidden")}
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
                        isActive={project.id === currentRoomId}
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
                        isActive={project.id === currentRoomId}
                        onRename={onRename}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>

          <SidebarBillingFooter billing={billing} />
          <div className="p-4">
            <Button variant="default" className="w-full" onClick={onCreate}>
              <PlusIcon />
              New Project
            </Button>
          </div>
        </aside>
      </>
    );
  }

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
                      isActive={project.id === currentRoomId}
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
                      isActive={project.id === currentRoomId}
                      onRename={onRename}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <SidebarBillingFooter billing={billing} />
        <div className="p-4">
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
