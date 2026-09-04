// ---------------------------------------------------------------------------
// Centered "no access" panel for the editor workspace. Renders for both
// missing projects and unauthorized access — the spec routes both to the
// same surface, so the page passes the same component for each. Server
// component (no interactivity; the link is a plain `<a>` for now and the
// `Button asChild` slot from shadcn would be over-engineered for a single
// use site).
// ---------------------------------------------------------------------------

import { LockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

function AccessDenied() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-base px-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <LockIcon className="h-8 w-8 text-copy-muted" aria-hidden />
        <h1 className="text-xl font-medium text-copy-primary">
          You don&apos;t have access to this project
        </h1>
        <p className="text-sm text-copy-muted">
          Ask the project owner to invite you, or pick another from your projects.
        </p>
        <Button asChild variant="outline" className="mt-1">
          <a href="/editor">Back to projects</a>
        </Button>
      </div>
    </div>
  );
}

export { AccessDenied };
