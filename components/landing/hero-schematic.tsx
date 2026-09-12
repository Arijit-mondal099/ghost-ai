import {
  ArrowUpIcon,
  ArrowUpRightIcon,
  BotIcon,
  CheckIcon,
  CircleIcon,
  CrownIcon,
  DatabaseIcon,
  DiamondIcon,
  GhostIcon,
  HexagonIcon,
  LayoutTemplateIcon,
  MaximizeIcon,
  PillIcon,
  Redo2Icon,
  SearchIcon,
  Share2Icon,
  SparklesIcon,
  SquareIcon,
  Undo2Icon,
  XIcon,
  ZoomInIcon,
} from "lucide-react";

import { NODE_COLORS } from "@/types/canvas";

const blue = NODE_COLORS[1];
const orangeText = NODE_COLORS[3].text;

const PROJECTS = ["Ecommerce App System Design", "chat application", "todo"];

const STARTERS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
];

export function HeroSchematic() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-t-2xl border border-b-0 border-surface-border bg-base shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-surface-border px-3 py-2">
        <span className="flex size-6 items-center justify-center rounded-lg bg-subtle">
          <GhostIcon className="h-4 w-4 text-brand" />
        </span>
        <p className="mx-auto font-mono text-[11px] text-copy-primary">todo</p>
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="flex items-center gap-1 rounded-lg bg-subtle px-2 py-1 font-mono text-[10px] text-copy-secondary">
            <CheckIcon className="h-3 w-3" />
            Saved
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-subtle px-2 py-1 font-mono text-[10px] text-copy-secondary">
            <Share2Icon className="h-3 w-3" />
            Share
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-subtle px-2 py-1 font-mono text-[10px] text-copy-secondary">
            <LayoutTemplateIcon className="h-3 w-3" />
            Templates
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-subtle px-2 py-1 font-mono text-[10px] text-copy-secondary">
            <SparklesIcon className="h-3 w-3" />
            AI
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-accent-dim px-2 py-1 font-mono text-[10px] text-brand">
            <CrownIcon className="h-3 w-3" />
            Pro
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-[190px_1fr_240px]">
        <div className="hidden flex-col border-r border-surface-border md:flex">
          <div className="flex items-center justify-between px-3 py-2.5">
            <p className="text-xs font-medium text-copy-primary">Projects</p>
            <XIcon className="h-4 w-4 text-copy-muted" />
          </div>
          <div className="mx-3 grid grid-cols-2 gap-1 rounded-xl bg-subtle p-1 font-mono text-[10px]">
            <span className="rounded-lg bg-elevated px-2 py-1.5 text-center text-copy-primary">
              My Projects
            </span>
            <span className="px-2 py-1.5 text-center text-copy-muted">Shared</span>
          </div>
          <ul className="mt-2 flex-1 space-y-1 px-3">
            {PROJECTS.map((p, i) => (
              <li
                key={p}
                className={
                  i === 2
                    ? "flex items-center justify-between rounded-xl bg-subtle px-2.5 py-2 text-xs text-copy-primary"
                    : "flex items-center justify-between rounded-xl px-2.5 py-2 text-xs text-copy-secondary"
                }
              >
                <span className="truncate">{p}</span>
                <span className="font-mono text-[10px] text-copy-faint">•••</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-surface-border p-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] text-copy-muted">Pro • 3/100 projects</p>
              <p className="flex items-center gap-1 font-mono text-[10px] text-copy-secondary">
                <CrownIcon className="h-3 w-3" />
                Pro
              </p>
            </div>
            <div className="mt-2 h-1 rounded-full bg-subtle">
              <div className="h-1 w-[4%] rounded-full bg-brand" />
            </div>
            <p className="mt-3 rounded-xl bg-brand px-3 py-2 text-center text-xs font-medium text-black">
              + New Project
            </p>
          </div>
        </div>

        <div
          className="relative min-h-[520px] overflow-hidden md:min-h-[620px]"
          style={{
            backgroundImage: "radial-gradient(circle, var(--text-faint) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        >
          <span
            className="absolute top-3 right-3 z-10 flex size-7 items-center justify-center rounded-full text-xs font-medium text-black"
            style={{ backgroundColor: orangeText }}
          >
            T
          </span>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-10 py-5 text-base font-medium md:px-14 md:py-6 md:text-lg"
            style={{
              backgroundColor: blue.fill,
              borderColor: blue.text,
              color: blue.text,
            }}
          >
            Ghost AI
          </div>

          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-surface-border bg-elevated px-3 py-1.5">
            <SearchIcon className="h-3.5 w-3.5 text-copy-muted" />
            <MaximizeIcon className="h-3.5 w-3.5 text-copy-muted" />
            <ZoomInIcon className="h-3.5 w-3.5 text-copy-muted" />
            <span className="h-3 w-px bg-subtle-border" />
            <Undo2Icon className="h-3.5 w-3.5 text-copy-muted" />
            <Redo2Icon className="h-3.5 w-3.5 text-copy-muted" />
          </div>
          <div className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-3 rounded-full border border-surface-border bg-elevated px-4 py-2 sm:flex">
            <SquareIcon className="h-3.5 w-3.5 text-copy-muted" />
            <DiamondIcon className="h-3.5 w-3.5 text-copy-muted" />
            <CircleIcon className="h-3.5 w-3.5 text-copy-muted" />
            <PillIcon className="h-3.5 w-3.5 text-copy-muted" />
            <DatabaseIcon className="h-3.5 w-3.5 text-copy-muted" />
            <HexagonIcon className="h-3.5 w-3.5 text-copy-muted" />
          </div>
        </div>

        <div className="hidden flex-col border-l border-surface-border md:flex">
          <div className="flex items-center gap-2 border-b border-surface-border px-3 py-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-subtle">
              <SparklesIcon className="h-4 w-4 text-brand" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-copy-primary">Ghost Architect</p>
              <p className="font-mono text-[10px] text-copy-muted">
                <span className="mr-1 inline-block size-1.5 rounded-full bg-success" />
                Drafting with you
              </p>
            </div>
            <XIcon className="h-4 w-4 text-copy-muted" />
          </div>
          <div className="mx-3 mt-2 grid grid-cols-2 gap-1 rounded-xl bg-subtle p-1 font-mono text-[10px]">
            <span className="rounded-lg bg-elevated px-2 py-1.5 text-center text-copy-primary">
              Architect
            </span>
            <span className="px-2 py-1.5 text-center text-copy-muted">Specs</span>
          </div>
          <div className="mx-3 mt-3 rounded-2xl border border-dashed border-subtle-border p-4 text-center">
            <p className="font-mono text-[10px] tracking-widest text-copy-faint uppercase">
              Blank blueprint
            </p>
            <span className="mx-auto mt-3 flex size-9 items-center justify-center rounded-full bg-subtle">
              <BotIcon className="h-4 w-4 text-copy-secondary" />
            </span>
            <p className="mt-3 text-xs font-medium text-copy-primary">
              Describe the system to start the draft
            </p>
            <p className="mt-1 text-[11px] text-copy-muted">
              Pick a starter draft or write your own to begin.
            </p>
          </div>
          <ul className="mt-3 space-y-1.5 px-3">
            {STARTERS.map((s) => (
              <li
                key={s}
                className="flex items-center justify-between gap-2 rounded-xl bg-subtle px-2.5 py-2 text-[11px] text-copy-secondary"
              >
                <span className="truncate">{s}</span>
                <ArrowUpRightIcon className="h-3.5 w-3.5 shrink-0 text-copy-faint" />
              </li>
            ))}
          </ul>
          <div className="mt-auto border-t border-surface-border p-3">
            <div className="rounded-2xl bg-subtle p-3">
              <p className="font-mono text-[10px] text-copy-faint">Describe the system to draft…</p>
              <div className="mt-6 flex items-center justify-between">
                <p className="font-mono text-[9px] text-copy-faint">
                  Enter to send • Shift + Enter for newline
                </p>
                <span className="flex size-6 items-center justify-center rounded-full bg-brand">
                  <ArrowUpIcon className="h-3.5 w-3.5 text-black" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
