"use client";

import { useState } from "react";
import { DownloadIcon, FileTextIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SpecPreviewDialog } from "./spec-preview-dialog";
import { SpecProgress } from "./spec-progress";
import type { ChatMessage } from "./constants";
import { SpecListSkeleton } from "@/components/loading";
import { useProjectSpecs } from "@/hooks/use-project-specs";
import { useSpecGeneration } from "@/hooks/use-spec-generation";

// ---------------------------------------------------------------------------
// Specs tab: spec list for the current project under a Generate action.
//
// Generate (spec 32) snapshots the canvas graph + sidebar chat history,
// runs `generate-spec` via `/api/ai/spec`, and persists the Markdown
// through the save route — then refreshes the list. Progress is
// requester-local (the task broadcasts no room feed) and renders as a
// three-step phase rail (snapshot → draft → save) with an elapsed clock
// while the run is active; errors render inline. Rows show `spec-{id}.md` (ProjectSpec carries no title; the
// filename matches the download `Content-Disposition`) + a mono createdAt
// line, and are clickable to open the Markdown preview modal. Each row +
// the modal carries a download anchor so the browser handles the file.
// Rows are labeled like drawing numbers (`Draft {shortId}` — the tail of
// the cuid, which varies most; the full `spec-{id}.md` filename survives in
// the hover tooltip, aria labels, and the download itself) with a short
// mono timestamp line. The row is a single-level flex — one shrinkable
// item, everything else `shrink-0` — plus `overflow-hidden` on the card, so
// a long title can never push the download action off the card again.
// ---------------------------------------------------------------------------

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SpecsTab({
  projectId,
  roomId,
  messages,
}: {
  projectId: string;
  roomId: string;
  messages: ChatMessage[];
}) {
  const { specs, isLoading, errorMessage, refresh } = useProjectSpecs({ projectId });
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const generation = useSpecGeneration({
    projectId,
    roomId,
    messages,
    onSaved: () => refresh(),
  });

  const generateLabel = generation.isGenerating ? "Drafting…" : "Generate Spec";

  return (
    <div className="flex h-full flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <Button
          variant="default"
          disabled={generation.isGenerating}
          onClick={() => void generation.start()}
          aria-label="Generate spec"
          aria-busy={generation.isGenerating}
          className="w-full rounded-xl py-2.5 font-medium"
        >
          {generation.isGenerating ? (
            <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
          ) : null}
          {generateLabel}
        </Button>
        {generation.isGenerating && generation.phase !== null ? (
          <SpecProgress phase={generation.phase} />
        ) : generation.statusMessage !== null ? (
          <p
            role={generation.stage === "error" ? "alert" : "status"}
            className="text-xs text-copy-muted"
          >
            {generation.statusMessage}
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {errorMessage !== null && specs.length > 0 ? (
          <p role="alert" className="pb-2 text-xs text-copy-muted">
            {errorMessage}
          </p>
        ) : null}
        {isLoading && specs.length === 0 ? (
          <div role="status" aria-label="Loading specs">
            <p className="mb-3 font-mono text-[11px] tracking-wide text-copy-faint uppercase">
              Loading specs
            </p>
            <SpecListSkeleton />
          </div>
        ) : errorMessage !== null && specs.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p role="alert" className="text-sm text-copy-muted">
              {errorMessage}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Retry
            </Button>
          </div>
        ) : specs.length === 0 ? (
          <p className="text-sm text-copy-muted">No specs yet. Generate one from the canvas.</p>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            {isLoading ? (
              <p
                role="status"
                className="flex items-center gap-1.5 pb-2 font-mono text-[11px] tracking-wide text-copy-faint uppercase"
              >
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="h-3 w-3 animate-spin motion-reduce:animate-none"
                />
                Refreshing
              </p>
            ) : null}
            <div className="flex flex-col gap-3 pr-4">
              {specs.map((spec) => {
                const downloadUrl = `/api/projects/${projectId}/specs/${spec.id}/download`;
                const shortId = spec.id.slice(-6);
                return (
                  <div
                    key={spec.id}
                    className="flex items-start gap-3 overflow-hidden rounded-2xl border border-surface-border bg-surface p-4 transition-colors hover:border-subtle-border"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-border bg-elevated"
                    >
                      <FileTextIcon className="h-4 w-4 text-brand" />
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedSpecId(spec.id)}
                      aria-label={`Preview draft ${shortId}`}
                      title={`spec-${spec.id}.md`}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-copy-primary hover:underline">
                        Draft {shortId}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] tracking-wide text-copy-faint uppercase">
                        Markdown · {formatCreatedAt(spec.createdAt)}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      asChild
                      aria-label={`Download draft ${shortId}`}
                      className="shrink-0"
                    >
                      <a href={downloadUrl} download>
                        <DownloadIcon />
                      </a>
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      <SpecPreviewDialog
        projectId={projectId}
        specId={selectedSpecId}
        onClose={() => setSelectedSpecId(null)}
      />
    </div>
  );
}

export { SpecsTab };
