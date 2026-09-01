"use client";

import type { ReactNode } from "react";

import { SparklesIcon } from "lucide-react";

const FEATURES = [
  "Real-time AI canvas",
  "Project workspaces",
  "Multiplayer collaboration",
] as const;

type AuthShellProps = {
  children: ReactNode;
};

function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="grid min-h-dvh w-full grid-cols-1 bg-base text-copy-primary lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-surface-border p-10 lg:flex">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-5 text-brand" />
          <span className="text-sm font-medium tracking-tight">Ghost AI</span>
        </div>

        <div className="max-w-sm space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight text-copy-primary">
            Think out loud, ship out loud.
          </h1>
          <p className="text-sm text-copy-secondary">
            A workspace where AI agents and humans build together.
          </p>
          <ul className="space-y-2 text-sm text-copy-muted">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-brand" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-copy-faint">By continuing you agree to our terms.</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

export { AuthShell };
export type { AuthShellProps };
