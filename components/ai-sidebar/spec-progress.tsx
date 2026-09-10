"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";

import { DraftingDots } from "@/components/loading";
import { useRunClock } from "@/hooks/use-run-clock";
import type { SpecGenPhase } from "@/hooks/use-spec-generation";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Spec run progress rail. The three steps are the run's true sequence —
// snapshot the canvas graph, draft the Markdown, save the draft — so step
// markers encode real information here, not decoration. Done steps get a
// success check, the live step gets a cream spinner, upcoming steps stay a
// hollow faint dot. A mono elapsed clock keeps long runs honest (the
// absolute timeout is 6 minutes); it is `aria-hidden` so the ticking never
// spams screen readers, while `role="status"` announces phase changes.
// ---------------------------------------------------------------------------

const SPEC_STEPS = [
  { key: "snapshot", label: "Snapshot canvas" },
  { key: "draft", label: "Draft spec" },
  { key: "save", label: "Save draft" },
] as const;

type ActiveSpecPhase = Exclude<SpecGenPhase, null>;

function SpecProgress({ phase }: { phase: ActiveSpecPhase }) {
  const elapsed = useRunClock();
  const activeIndex = SPEC_STEPS.findIndex((step) => step.key === phase);

  return (
    <div
      role="status"
      aria-label={`Generating spec: ${SPEC_STEPS[activeIndex]?.label ?? "working"}`}
      className="rounded-2xl border border-surface-border bg-surface p-3"
    >
      <div className="flex items-center gap-2">
        <DraftingDots className="text-brand" />
        <p className="min-w-0 flex-1 font-mono text-[10px] tracking-widest text-brand uppercase">
          Writing drawing set
        </p>
        <span aria-hidden="true" className="shrink-0 font-mono text-[11px] text-copy-faint">
          {elapsed}
        </span>
      </div>
      <ol aria-hidden="true" className="mt-2.5 flex flex-col gap-1.5">
        {SPEC_STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li key={step.key} className="flex items-center gap-2">
              {done ? (
                <CheckIcon className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : active ? (
                <LoaderCircleIcon className="h-3.5 w-3.5 shrink-0 animate-spin text-brand motion-reduce:animate-none" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-subtle-border" />
              )}
              <span
                className={cn(
                  "text-xs",
                  active ? "text-copy-primary" : done ? "text-copy-secondary" : "text-copy-faint",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export { SpecProgress };
