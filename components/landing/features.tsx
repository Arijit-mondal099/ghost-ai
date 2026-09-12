"use client";

import { BotIcon, MousePointer2Icon } from "lucide-react";
import { motion } from "motion/react";

import { NODE_COLORS } from "@/types/canvas";
import { Reveal } from "./reveal";

const blue = NODE_COLORS[1];
const purple = NODE_COLORS[2];
const orange = NODE_COLORS[3];
const green = NODE_COLORS[6];

function CanvasVisual() {
  return (
    <div className="relative flex h-full items-center justify-center gap-3 p-6">
      {[
        { label: "API", c: blue },
        { label: "DB", c: purple },
        { label: "Worker", c: orange },
        { label: "Cache", c: green },
      ].map((n, i) => (
        <div key={n.label} className="relative">
          <div
            className="rounded-xl border px-4 py-2.5 text-xs font-medium"
            style={{
              backgroundColor: n.c.fill,
              borderColor: n.c.text,
              color: n.c.text,
            }}
          >
            {n.label}
          </div>
          {i < 2 ? (
            <span className="absolute -top-1 -right-1 flex items-center gap-0.5 rounded-full bg-base px-1.5 py-0.5 font-mono text-[9px] text-copy-primary">
              <MousePointer2Icon className="h-3 w-3 text-ai-text" />
              {i === 0 ? "you" : "sam"}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PromptVisual() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
      <div className="w-full max-w-[220px] rounded-xl border border-surface-border bg-base px-3 py-2 font-mono text-[11px] text-copy-muted">
        Design a checkout pipeline…
      </div>
      <div className="flex items-center gap-1.5 rounded-xl bg-ai px-3 py-1.5 text-copy-primary">
        <BotIcon className="h-4 w-4" />
        <span className="flex gap-1">
          <span className="ghost-node-dot size-1.5 rounded-full bg-ai-text" />
          <span className="ghost-node-dot size-1.5 rounded-full bg-ai-text" />
          <span className="ghost-node-dot size-1.5 rounded-full bg-ai-text" />
        </span>
      </div>
      <div className="w-full max-w-[220px] space-y-1.5">
        <div className="h-1.5 w-full rounded-full bg-subtle" />
        <div className="h-1.5 w-4/5 rounded-full bg-subtle" />
      </div>
    </div>
  );
}

function TemplatesVisual() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6">
      {["Monolith", "Microservices", "Event-driven"].map((t, i) => (
        <div
          key={t}
          className="w-full max-w-[220px] rounded-xl border border-surface-border bg-base px-3 py-2 text-xs text-copy-secondary"
          style={{ opacity: 1 - i * 0.25 }}
        >
          {t}
        </div>
      ))}
    </div>
  );
}

function PresenceVisual() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
      <div className="flex -space-x-2">
        {["MR", "DK", "PS"].map((p) => (
          <span
            key={p}
            className="flex size-9 items-center justify-center rounded-full border border-surface-border bg-base font-mono text-[10px] text-copy-primary"
          >
            {p}
          </span>
        ))}
      </div>
      <p className="rounded-xl bg-ai px-3 py-1.5 font-mono text-[10px] text-copy-primary">
        Maya is editing Worker
      </p>
    </div>
  );
}

function SpecVisual() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-[220px] rounded-xl border border-surface-border bg-base p-4">
        <p className="font-mono text-[10px] tracking-widest text-copy-faint uppercase">spec.md</p>
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-subtle" />
          <div className="h-1.5 w-5/6 rounded-full bg-subtle" />
          <div className="h-1.5 w-4/6 rounded-full bg-subtle" />
        </div>
        <p className="mt-3 inline-block rounded-lg bg-accent-dim px-2.5 py-1 font-mono text-[10px] text-brand">
          Download
        </p>
      </div>
    </div>
  );
}

const CARDS = [
  {
    title: "Everyone on the same graph",
    body: "Drag a node on one screen, watch it move on theirs — cursors, selections, and edits sync live.",
    visual: <CanvasVisual />,
    bg: "/features/one.jpg",
    wide: true,
  },
  {
    title: "Prompt it into existence",
    body: "Describe the system in plain English. Ghost drafts the nodes and edges.",
    visual: <PromptVisual />,
    bg: "/features/two.jpg",
    wide: false,
  },
  {
    title: "Start from proven shapes",
    body: "Monolith, microservices, event-driven, serverless — import a starter and refine it.",
    visual: <TemplatesVisual />,
    bg: "/features/three.jpg",
    wide: false,
  },
  {
    title: "See who is doing what",
    body: "Cursors, selections, and thinking states show the whole room at work.",
    visual: <PresenceVisual />,
    bg: "/features/foure.jpg",
    wide: false,
  },
  {
    title: "Leave with a spec",
    body: "One click turns the graph into Markdown. View it in-app or download it.",
    visual: <SpecVisual />,
    bg: "/features/five.jpg",
    wide: false,
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="border-b border-surface-border"
    >
      <div className="scroll-mt-20 px-6 py-20 md:py-28">
        <Reveal>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
            <h2
              id="features-heading"
              className="text-3xl font-medium tracking-tight text-copy-primary md:text-5xl"
            >
              Agree on the architecture without the busywork.
            </h2>
            <p className="text-base leading-relaxed text-copy-secondary lg:justify-self-end">
              Realtime canvas, AI drafts, and one-click specs — every decision lands on a shared
              graph your team can build from.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {CARDS.map((card, i) => (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: (i % 3) * 0.08 }}
              whileHover={{ y: -4 }}
              className={
                card.wide
                  ? "overflow-hidden rounded-2xl border border-surface-border bg-surface lg:col-span-2"
                  : "overflow-hidden rounded-2xl border border-surface-border bg-surface"
              }
            >
              <div
                className="h-60 bg-cover bg-center bg-no-repeat md:h-72"
                style={{ backgroundImage: `url(${card.bg})` }}
                aria-hidden="true"
              >
                {card.visual}
              </div>
              <div className="border-t border-surface-border p-6">
                <h3 className="text-lg font-medium text-copy-primary">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-copy-secondary">{card.body}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
