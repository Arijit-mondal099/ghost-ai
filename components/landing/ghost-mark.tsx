import Link from "next/link";
import { GhostIcon } from "lucide-react";

export function LandingGhostMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand"
      aria-label="Ghost AI home"
    >
      <span className="flex size-8 items-center justify-center rounded-xl bg-accent-dim text-brand">
        <GhostIcon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-base font-semibold tracking-tight text-copy-primary">Ghost AI</span>
    </Link>
  );
}
