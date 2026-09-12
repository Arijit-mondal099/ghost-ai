// COPY-DRAFT — replace with real users before launch.

"use client";

import { QuoteIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

const ROW_ONE = [
  {
    quote:
      "We pasted our checkout RFC into Ghost and had a graph the whole team could argue with by standup.",
    name: "Maya R.",
  },
  {
    quote:
      "Its simplicity — one prompt and the architecture is on the canvas, ready to refactor together.",
    name: "Lake T.",
  },
  {
    quote: "Looks super helpful for both my platform reviews and my weekend side projects.",
    name: "Alex C.",
  },
  {
    quote: "A middle ground between a whiteboard and a wiki that nobody updates.",
    name: "Nicolas Q.",
  },
];

const ROW_TWO = [
  {
    quote:
      "The live canvas ended the screenshot ping-pong. Two of us refactor while the third writes the spec.",
    name: "Daniel K.",
  },
  {
    quote:
      "That perfect balance of clean minimalism and real functionality I have been looking for.",
    name: "Amrit S.",
  },
  {
    quote: "I was missing a visual layer for system thinking. This is it.",
    name: "Aman G.",
  },
  {
    quote:
      "Fed up with diagram tools nobody opens — this one generates the spec, so we actually use it.",
    name: "Aayush A.",
  },
];

function QuoteCard({ quote, name }: { quote: string; name: string }) {
  return (
    <figure className="w-[300px] shrink-0 rounded-2xl border border-surface-border bg-surface p-6 transition-colors duration-200 hover:border-subtle-border hover:bg-elevated md:w-[340px]">
      <QuoteIcon className="h-8 w-8 text-copy-faint" aria-hidden="true" fill="currentColor" />
      <blockquote className="mt-4 min-h-24 text-[15px] leading-relaxed text-copy-primary">
        {quote}
      </blockquote>
      <figcaption className="mt-6 text-sm text-copy-muted">{name}</figcaption>
    </figure>
  );
}

function MarqueeRow({
  quotes,
  reverse,
  label,
}: {
  quotes: typeof ROW_ONE;
  reverse?: boolean;
  label: string;
}) {
  return (
    <div
      role="marquee"
      aria-label={label}
      className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
    >
      <div
        className={cn("ghost-marquee flex w-max gap-4 pr-4", reverse && "ghost-marquee-reverse")}
      >
        {quotes.map((t) => (
          <QuoteCard key={t.name} quote={t.quote} name={t.name} />
        ))}
        {quotes.map((t) => (
          <span key={`dup-${t.name}`} aria-hidden="true" className="contents">
            <QuoteCard quote={t.quote} name={t.name} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function Testimonials() {
  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="border-b border-surface-border"
    >
      <div className="scroll-mt-20 py-20 md:py-28">
        <Reveal className="px-6">
          <h2
            id="testimonials-heading"
            className="text-3xl font-medium tracking-tight text-copy-primary md:text-4xl"
          >
            What users are saying.
          </h2>
        </Reveal>
        <div className="mt-10 space-y-4">
          <MarqueeRow quotes={ROW_ONE} label="User testimonials, row one" />
          <MarqueeRow quotes={ROW_TWO} reverse label="User testimonials, row two" />
        </div>
      </div>
    </section>
  );
}
