"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, FileTextIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { EditorDialog } from "@/components/editor/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// ---------------------------------------------------------------------------
// Spec preview dialog (spec 31). Opens when a spec row is selected in the
// Specs tab. Fetches the Markdown through the existing gated download
// endpoint (`fetch(url).text()` — the Blob store is private, so the client
// never touches Blob URLs) and renders it with react-markdown.
//
// Fetched content is cleared on close — spec Markdown is never kept in
// frontend state long-term (spec scope limit). Escape + focus trap come
// from the Radix Dialog; the download anchor lets the browser handle the
// file like the list-row action does.
// ---------------------------------------------------------------------------

type SpecPreviewDialogProps = {
  projectId: string;
  specId: string | null;
  onClose: () => void;
};

export function SpecPreviewDialog({ projectId, specId, onClose }: SpecPreviewDialogProps) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const open = specId !== null;
  const downloadUrl =
    specId !== null ? `/api/projects/${projectId}/specs/${specId}/download` : null;

  useEffect(() => {
    if (specId === null) return;
    let cancelled = false;
    setMarkdown(null);
    setErrorMessage(null);
    setIsLoading(true);
    fetch(`/api/projects/${projectId}/specs/${specId}/download`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setMarkdown(text);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Failed to load spec preview", error);
        setErrorMessage("Failed to load spec preview");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, specId]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // Drop fetched content immediately — no long-term storage.
      setMarkdown(null);
      setErrorMessage(null);
      onClose();
    }
  }

  return (
    <EditorDialog.Root open={open} onOpenChange={handleOpenChange}>
      <EditorDialog.Content className="max-h-[80dvh] sm:max-w-2xl">
        <EditorDialog.Description className="sr-only">
          Rendered Markdown preview of the selected spec.
        </EditorDialog.Description>
        <EditorDialog.Header>
          <div className="flex items-center gap-3 pr-8">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-border bg-elevated"
            >
              <FileTextIcon className="h-4 w-4 text-brand" />
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <EditorDialog.Title className="truncate text-sm font-medium">
                {specId !== null ? `spec-${specId}.md` : "Spec preview"}
              </EditorDialog.Title>
              <p className="mt-0.5 font-mono text-[11px] tracking-wide text-copy-faint uppercase">
                Markdown · Preview
              </p>
            </div>
            {downloadUrl !== null ? (
              <Button variant="ghost" size="icon-sm" asChild aria-label="Download spec">
                <a href={downloadUrl} download>
                  <DownloadIcon />
                </a>
              </Button>
            ) : null}
          </div>
        </EditorDialog.Header>
        <ScrollArea className="max-h-[60dvh] pr-4">
          {isLoading ? (
            <p className="text-sm text-copy-muted">Loading spec…</p>
          ) : errorMessage !== null ? (
            <p role="alert" className="text-sm text-copy-muted">
              {errorMessage}
            </p>
          ) : markdown !== null ? (
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-copy-primary [&_h1]:text-lg [&_h1]:font-medium [&_h2]:text-base [&_h2]:font-medium [&_h3]:text-sm [&_h3]:font-medium [&_a]:text-brand [&_a]:underline [&_code]:rounded [&_code]:bg-elevated [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-surface-border [&_pre]:bg-elevated [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:text-xs [&_td]:border [&_td]:border-surface-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-surface-border [&_th]:bg-elevated [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Spec Markdown is saver-controlled but rendered in every
                  // viewer's browser — a remote `![alt](https://...)` would
                  // fire an external request on each preview open (tracking
                  // pixel). Never load images; show the alt text instead.
                  img: ({ alt }) => (
                    <span className="text-copy-muted">
                      {typeof alt === "string" && alt.length > 0
                        ? `[image: ${alt}]`
                        : "[image omitted]"}
                    </span>
                  ),
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          ) : null}
        </ScrollArea>
      </EditorDialog.Content>
    </EditorDialog.Root>
  );
}
