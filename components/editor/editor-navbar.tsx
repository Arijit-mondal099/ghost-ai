"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CrownIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { authAppearance } from "@/lib/auth-appearance";
import { PLAN_LABELS, type BillingSummary } from "@/lib/billing";

// ---------------------------------------------------------------------------
// Top navbar for every editor screen. The home page mounts it with no
// `center` or `rightActions`; the workspace page passes the project name
// (center) plus share and AI-sidebar toggles (right of the user button's
// flex group). The far-right `UserButton` renders unless `showUserButton`
// is false (the room navbar hides it).
//
// The plan slot next to `UserButton` is upsell-aware: free (or unknown)
// viewers get the Pricing link, while pro/pro_max subscribers see their
// plan name instead — no upgrade button for paying users.
// ---------------------------------------------------------------------------

type EditorNavbarProps = {
  isOpen: boolean;
  onToggle: () => void;
  center?: ReactNode;
  rightActions?: ReactNode;
  showUserButton?: boolean;
  /** Plan for the upsell-aware slot (server-resolved, optional). */
  billing?: BillingSummary;
};

function EditorNavbar({
  isOpen,
  onToggle,
  center,
  rightActions,
  showUserButton = true,
  billing,
}: EditorNavbarProps) {
  const planLabel = billing ? (PLAN_LABELS[billing.plan] ?? billing.plan) : null;
  const isPaid = billing?.plan === "pro" || billing?.plan === "pro_max";
  return (
    <header className="relative z-50 flex h-14 w-full items-center justify-between border-b border-surface-border bg-base px-4">
      <div className="flex flex-1 items-center gap-2">
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
      <div className="flex flex-1 items-center justify-end gap-2">
        {rightActions}
        {isPaid ? (
          <span
            aria-label={`Current plan: ${planLabel}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-2.5 py-1.5 text-xs font-medium text-copy-primary"
          >
            <CrownIcon className="h-4 w-4 text-brand" />
            <span className="hidden sm:inline">{planLabel}</span>
          </span>
        ) : (
          <Button variant="ghost" size="sm" asChild aria-label="View plans and upgrade">
            <Link href="/pricing">
              <CrownIcon />
              <span className="hidden sm:inline">Pricing</span>
            </Link>
          </Button>
        )}
        {showUserButton ? (
          <UserButton
            appearance={authAppearance}
            userProfileProps={{ appearance: authAppearance }}
          />
        ) : null}
      </div>
    </header>
  );
}

export { EditorNavbar };
export type { EditorNavbarProps };
