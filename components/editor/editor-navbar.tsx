"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type EditorNavbarProps = {
  isOpen: boolean;
  onToggle: () => void;
};

function EditorNavbar({ isOpen, onToggle }: EditorNavbarProps) {
  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-surface-border bg-base px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={isOpen}
        >
          {isOpen ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
        </Button>
      </div>
      <div className="flex items-center" />
      <div className="flex items-center" />
    </header>
  );
}

export { EditorNavbar };
export type { EditorNavbarProps };
