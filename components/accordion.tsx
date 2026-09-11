"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";

import {
  Accordion as ShadcnAccordion,
  AccordionItem as ShadcnAccordionItem,
  AccordionTrigger as ShadcnAccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Project accordion. Re-exports the shadcn primitive except `Content`, which
// is re-implemented here with working state variants.
//
// Why: the generated `components/ui/accordion.tsx` targets
// `data-open:`/`data-closed:` variants, but the Radix Collapsible primitive
// backing `Content` only ever emits `data-state="open|closed"`
// (verified in `@radix-ui/react-collapsible`), so the expand/collapse
// animation never runs. The `components/ui/*` files are protected foundation
// (never modified), so the fix lives here — same pattern as
// `EditorDialog.Content`. Animation names are unchanged (`tw-animate-css`
// provides the keyframes).
// ---------------------------------------------------------------------------

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up"
      {...props}
    >
      <div
        className={cn(
          "h-(--radix-accordion-content-height) pt-0 pb-2.5 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
}

export {
  ShadcnAccordion as Accordion,
  ShadcnAccordionItem as AccordionItem,
  ShadcnAccordionTrigger as AccordionTrigger,
  AccordionContent,
};
