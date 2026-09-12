"use client";

import { PlusIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "./reveal";

const FAQS = [
  {
    q: "Do I need to know system design to use Ghost AI?",
    a: "No. Describe what you want in plain English and Ghost drafts the first graph. You refine it visually.",
  },
  {
    q: "How does realtime collaboration work?",
    a: "Invite a collaborator by email. You share one canvas with live cursors, selections, and synced edits.",
  },
  {
    q: "What does the AI generate?",
    a: "Nodes and edges on your canvas — services, stores, queues, and how they connect. You keep full edit control.",
  },
  {
    q: "Where are specs stored?",
    a: "Generate a Markdown spec from the current graph. View it in the app or download the file.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Free covers up to 3 owned projects with basic AI and collaboration. Upgrade when you need more.",
  },
  {
    q: "Can I invite people outside my team?",
    a: "Yes. Any collaborator with an account can join your project by email invite.",
  },
];

export function Faqs() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="border-b border-surface-border">
      <div className="scroll-mt-20 px-6 py-20 md:py-28">
        <Reveal>
          <h2
            id="faq-heading"
            className="text-3xl font-medium tracking-tight text-copy-primary md:text-4xl"
          >
            Frequently asked questions
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <Accordion type="single" collapsible className="mt-10">
            {FAQS.map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`}>
                <AccordionTrigger className="py-6 text-left text-lg text-copy-primary hover:no-underline group-aria-expanded/accordion-trigger:text-brand md:text-xl [&_[data-slot=accordion-trigger-icon]]:hidden">
                  {item.q}
                  <PlusIcon
                    className="ml-auto h-5 w-5 shrink-0 text-copy-muted transition-transform group-aria-expanded/accordion-trigger:rotate-45 group-aria-expanded/accordion-trigger:text-brand"
                    aria-hidden="true"
                  />
                </AccordionTrigger>
                <AccordionContent className="pb-6 text-base text-copy-secondary">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
