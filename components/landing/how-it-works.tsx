"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

const STEPS = [
  {
    n: "01",
    title: "Prompt",
    body: "Describe the system in plain English. Ghost drafts nodes and edges onto the canvas.",
    hint: "/prompt",
  },
  {
    n: "02",
    title: "Refine together",
    body: "Move, connect, and rename with live cursors. Everyone sees the same graph.",
    hint: "/invite",
  },
  {
    n: "03",
    title: "Export spec",
    body: "Generate a Markdown technical spec from the graph. Review it or download it.",
    hint: "/spec.md",
  },
];

const ROTATE_MS = 3000;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % STEPS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <section id="how" aria-labelledby="how-heading" className="border-b border-surface-border">
      <div className="scroll-mt-20 px-6 py-20 md:py-28">
        <Reveal>
          <p className="inline-flex items-center rounded-xl border border-surface-border bg-surface px-3 py-1 font-mono text-xs tracking-widest text-copy-secondary uppercase">
            How it works
          </p>
          <h2
            id="how-heading"
            className="mt-5 max-w-2xl text-3xl font-medium tracking-tight text-copy-primary md:text-5xl"
          >
            From sentence to spec in three moves.
          </h2>
          <p className="mt-4 max-w-xl text-base text-copy-secondary">
            Prompt the canvas, refine it live with your team, then export a spec your team can build
            from.
          </p>
        </Reveal>
        <div
          className="mt-10 grid gap-4 md:grid-cols-3"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {STEPS.map((step, i) => {
            const isActive = i === active;
            return (
              <motion.button
                key={step.n}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={isActive}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-6 text-left outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-brand",
                  isActive
                    ? "border-subtle-border bg-elevated"
                    : "border-surface-border bg-surface hover:bg-elevated",
                )}
              >
                <span
                  className={cn(
                    "text-5xl font-bold tracking-tight",
                    isActive ? "text-copy-muted" : "text-copy-faint",
                  )}
                  aria-hidden="true"
                >
                  {step.n}
                </span>
                <span
                  className={cn(
                    "mt-6 block text-lg font-medium",
                    isActive ? "text-copy-primary" : "text-copy-secondary",
                  )}
                >
                  {step.title}
                </span>
                <span
                  className={cn(
                    "mt-2 block text-sm leading-relaxed",
                    isActive ? "text-copy-secondary" : "text-copy-muted",
                  )}
                >
                  {step.body}
                </span>
                <span className="mt-4 block font-mono text-xs text-copy-muted">{step.hint}</span>
                {isActive ? (
                  <span
                    key={active}
                    className="ghost-step-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand"
                    aria-hidden="true"
                  />
                ) : null}
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
