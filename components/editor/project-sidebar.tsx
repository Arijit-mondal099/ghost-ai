"use client";

import { PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ProjectSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  return (
    <aside
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

      <Tabs defaultValue="mine" className="flex flex-1 flex-col px-4 pt-3">
        <TabsList className="w-full">
          <TabsTrigger value="mine" className="flex-1">
            My Projects
          </TabsTrigger>
          <TabsTrigger value="shared" className="flex-1">
            Shared
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mine" className="mt-4 text-sm text-copy-muted">
          No projects yet.
        </TabsContent>
        <TabsContent value="shared" className="mt-4 text-sm text-copy-muted">
          No shared projects yet.
        </TabsContent>
      </Tabs>

      <div className="border-t border-surface-border p-4">
        <Button variant="default" className="w-full">
          <PlusIcon />
          New Project
        </Button>
      </div>
    </aside>
  );
}

export { ProjectSidebar };
export type { ProjectSidebarProps };
