import { ReceiptIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Pricing hero. Thesis: "Pay for canvases, not seats." — the one thing that
// separates Ghost AI billing from generic SaaS pricing is owned-only project
// counting, so the hero states it outright and sketches it as canvas
// fragments (the capacity ledger) instead of a stat band.
// ---------------------------------------------------------------------------

const ASSURANCES = [
  {
    icon: UsersIcon,
    title: "Shared work stays free",
    body: "Projects shared with you never count toward your limit.",
  },
  {
    icon: ReceiptIcon,
    title: "Checkout lives here",
    body: "Pay in the plan table below. Clerk handles the receipt.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Nothing gets deleted",
    body: "Over the limit after a downgrade? Projects turn read-only.",
  },
] as const;

function PricingHero() {
  return (
    <section aria-labelledby="pricing-heading" className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-3">
        <Badge variant="secondary" className="font-mono">
          billing / plans &amp; usage
        </Badge>
        <h1
          id="pricing-heading"
          className="max-w-xl text-3xl font-semibold tracking-tight text-copy-primary sm:text-4xl"
        >
          Pay for canvases, not seats.
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-copy-secondary sm:text-base">
          Every plan includes the full workspace — realtime canvas, AI architect, and spec
          generation. The only thing that changes is how many projects you can own: 3, 100, or
          1,000. Collaborators join your canvases for free.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {ASSURANCES.map((item) => (
          <li
            key={item.title}
            className="flex flex-col gap-1.5 rounded-2xl border border-surface-border bg-surface px-4 py-3"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-copy-primary">
              <item.icon className="h-4 w-4 shrink-0 text-brand" />
              {item.title}
            </span>
            <span className="text-sm leading-relaxed text-copy-muted">{item.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { PricingHero };
