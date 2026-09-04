"use client";

import type { ReactNode } from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { authAppearance } from "@/lib/auth-appearance";

// ---------------------------------------------------------------------------
// Top navbar for every editor screen. The home page mounts it with no
// `center` or `rightActions`; the workspace page passes the project name
// (center) plus share and AI-sidebar toggles (right of the user button's
// flex group). The far-right `UserButton` stays put in both contexts.
// ---------------------------------------------------------------------------

type EditorNavbarProps = {
  isOpen: boolean;
  onToggle: () => void;
  center?: ReactNode;
  rightActions?: ReactNode;
};

function EditorNavbar({ isOpen, onToggle, center, rightActions }: EditorNavbarProps) {
  return (
    <header className="relative z-50 flex h-14 w-full items-center justify-between border-b border-surface-border bg-base px-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={isOpen}
        >
          {isOpen ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
        </Button>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center px-4">
        {center ? (
          <div className="truncate text-sm font-medium text-copy-primary">{center}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {rightActions}
        <UserButton appearance={authAppearance} userProfileProps={{ appearance: authAppearance }} />
      </div>
    </header>
  );
}

export { EditorNavbar };
export type { EditorNavbarProps };
