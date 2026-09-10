"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Client hook for the AI sidebar Specs tab (spec 31). Fetches spec metadata
// rows (`{ id, createdAt }`) from the read-only GET list route — content is
// never listed, only fetched per-spec through the gated download route for
// preview text.
//
// Mirrors the fetch-on-action pattern from `useShareDialog`: `no-store`
// fetch, `{ error: { code, message } }` body parsing, and a monotonic
// refresh generation so a stale GET can't overwrite a newer list. Hook-local
// state only — no global store (spec scope limit).
// ---------------------------------------------------------------------------

export type ProjectSpecMeta = {
  id: string;
  createdAt: string;
};

type UseProjectSpecsArgs = {
  projectId: string;
};

export type UseProjectSpecsResult = {
  specs: ProjectSpecMeta[];
  isLoading: boolean;
  errorMessage: string | null;
  refresh: () => Promise<void>;
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export function useProjectSpecs({ projectId }: UseProjectSpecsArgs): UseProjectSpecsResult {
  const [specs, setSpecs] = useState<ProjectSpecMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Monotonic refresh generation — only the latest request may apply state.
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async () => {
    refreshGeneration.current += 1;
    const generation = refreshGeneration.current;
    const isLatest = () => generation === refreshGeneration.current;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/specs`, {
        cache: "no-store",
      });
      if (!response.ok) {
        if (!isLatest()) return;
        setErrorMessage(await readErrorMessage(response));
        return;
      }
      const body = (await response.json()) as { specs: ProjectSpecMeta[] };
      if (!isLatest()) return;
      setSpecs(body.specs);
    } catch (error) {
      if (!isLatest()) return;
      console.error("Failed to load specs", error);
      setErrorMessage("Failed to load specs");
    } finally {
      if (isLatest()) setIsLoading(false);
    }
  }, [projectId]);

  // `refresh` is memoized on `projectId`, so this only re-runs when the
  // project changes (manual `refresh()` calls bypass it — no flicker on
  // retry). Drop the previous project's rows first: otherwise the tab
  // renders stale rows for the new project, and a failed request would
  // leave them in place.
  useEffect(() => {
    setSpecs([]);
    void refresh();
  }, [refresh]);

  return { specs, isLoading, errorMessage, refresh };
}
