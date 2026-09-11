import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/accordion";

// ---------------------------------------------------------------------------
// FAQ. Answers restate the enforced rules (owned-only caps, read-only
// grandfathering, Clerk-managed checkout) so the page never promises what
// the API does not do. Single-open accordion keeps the page scannable.
// ---------------------------------------------------------------------------

const FAQS = [
  {
    question: "What counts toward my project limit?",
    answer:
      "Only projects you own. Every project has one owner; when you create a project, you own it and it counts. Projects shared with you live under Shared and never count, on any plan.",
  },
  {
    question: "What happens when I reach the limit?",
    answer:
      "Creating another project is blocked and an upgrade dialog opens instead — the extra project is never created. Upgrade to the next tier in the plan table to keep going; everything you already own stays untouched.",
  },
  {
    question: "What happens to my projects if I downgrade?",
    answer:
      "Nothing is deleted. If the lower tier allows fewer projects than you own, your existing projects become read-only: you can still open and view all of them. Delete projects until you are back under the limit and write access returns.",
  },
  {
    question: "Do collaborators need a paid plan?",
    answer:
      "No. Anyone you invite works inside your canvas on your plan's capacity. They only need their own plan for projects they own themselves.",
  },
  {
    question: "How do I pay, upgrade, or cancel?",
    answer:
      "Directly in the plan table on this page. Checkout, plan changes, and cancellation all run through Clerk's billing surface — there is no separate billing portal to learn. Cancel anytime; your projects stay, and nothing is deleted. If you sit over the Free limit after cancelling, existing projects become read-only — creating and editing stay blocked — until you delete projects back under the limit and write access returns.",
  },
  {
    question: "Are AI generation and specs limited?",
    answer:
      "Both are included on every plan with no per-plan difference today. If tiered generation limits arrive later, they will be enforced in the product and stated here.",
  },
  {
    question: "Can I switch plans later?",
    answer:
      "Yes, in either direction, from the same plan table. Upgrades apply immediately so you can create again; downgrades take effect per Clerk's billing terms and grandfather your existing projects as read-only until you fit the new limit.",
  },
] as const;

function FaqSection() {
  return (
    <section aria-labelledby="faq-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs text-copy-muted">faq / before you choose</p>
        <h2 id="faq-heading" className="text-xl font-medium text-copy-primary">
          Questions, answered plainly
        </h2>
      </div>
      <Accordion
        type="single"
        collapsible
        className="rounded-2xl border border-surface-border bg-surface px-4"
      >
        {FAQS.map((faq) => (
          <AccordionItem key={faq.question} value={faq.question}>
            <AccordionTrigger className="text-copy-primary">{faq.question}</AccordionTrigger>
            <AccordionContent className="text-copy-muted">{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export { FaqSection };
