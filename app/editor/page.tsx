"use client";

import { useState } from "react";

import { EditorNavbar, ProjectSidebar } from "@/components/editor";

function EditorPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-dvh flex-col bg-base">
      <EditorNavbar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen((open) => !open)} />
      <ProjectSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="flex flex-1 items-center justify-center">
        <span className="text-sm text-copy-muted">Canvas</span>
      </main>
    </div>
  );
}

export default EditorPage;
