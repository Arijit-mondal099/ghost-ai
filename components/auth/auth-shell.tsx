import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

const PRAISE = [
  {
    name: "Maya R.",
    handle: "@maya_builds",
    quote: "Prompt to canvas to spec in one sitting. Standup approved.",
    initials: "MR",
  },
  {
    name: "Daniel K.",
    handle: "@danielk_dev",
    quote: "Finally a diagram tool my team actually opens.",
    initials: "DK",
  },
  {
    name: "Priya S.",
    handle: "@priya_ships",
    quote: "Live cursors ended our screenshot ping-pong.",
    initials: "PS",
  },
];

type AuthShellProps = {
  title: string;
  sub: string;
  footer: ReactNode;
  children: ReactNode;
};

function AuthShell({ title, sub, footer, children }: AuthShellProps) {
  return (
    <div
      className="min-h-dvh w-full bg-cover bg-center bg-no-repeat p-4 text-copy-primary md:p-8"
      style={{ backgroundImage: "url(/auth-out-bg.jpg)" }}
    >
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-surface-border bg-base md:min-h-[calc(100dvh-4rem)] lg:grid-cols-2">
        <main className="flex flex-col p-8 md:p-12">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1.5 rounded-xl text-sm text-copy-secondary outline-none transition-colors hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Home
          </Link>
          <div className="flex flex-1 items-center py-10">
            <div className="w-full max-w-sm">
              <h1 className="text-3xl font-medium tracking-tight text-copy-primary md:text-4xl">
                {title}
              </h1>
              <p className="mt-3 text-sm text-copy-secondary">{sub}</p>
              <div className="mt-8">{children}</div>
              <p className="mt-6 text-center text-sm text-copy-muted">{footer}</p>
            </div>
          </div>
        </main>
        <aside className="relative hidden overflow-hidden lg:block" aria-hidden="true">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url(/auth-in-bg.jpg)" }}
          />
          <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 gap-3 p-6">
            {PRAISE.map((p) => (
              <div
                key={p.handle}
                className="rounded-2xl border border-surface-border bg-base/70 p-4 backdrop-blur-md"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-subtle font-mono text-[10px] text-copy-primary">
                    {p.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-copy-primary">{p.name}</p>
                    <p className="truncate font-mono text-[10px] text-copy-muted">{p.handle}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-copy-secondary">{p.quote}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export { AuthShell };
export type { AuthShellProps };
