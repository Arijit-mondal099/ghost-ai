import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PricingTable } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { authAppearance } from "@/lib/auth-appearance";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { CompareTable } from "./_components/compare-table";
import { CountingSection } from "./_components/counting-section";
import { FaqSection } from "./_components/faq-section";
import { PricingHero } from "./_components/pricing-hero";

// ---------------------------------------------------------------------------
// Pricing page (spec 36). Protected: `proxy.ts` already gates every route,
// and the `auth()` check below redirects signed-out visitors to `/sign-in`
// as defense in depth (mirrors `app/editor/[roomId]/page.tsx`).
//
// Plans (`free` / `pro` / `pro_max`) render through Clerk's `<PricingTable />`
// — checkout, upgrade/downgrade, and subscription management all happen in
// Clerk's in-app drawer. No custom billing portal. Everything around the
// table (hero, plan details, counting explainer, comparison, FAQ) is present
// to help the reader choose before they pay.
// ---------------------------------------------------------------------------

function PricingTableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading plans" className="grid w-full gap-4 md:grid-cols-3">
      {[0, 1, 2].map((slot) => (
        <div
          key={slot}
          className="h-64 animate-pulse rounded-2xl border border-surface-border bg-surface"
        />
      ))}
    </div>
  );
}

const SECTION_LINKS = [
  { href: "#checkout", label: "Checkout" },
  { href: "#compare", label: "Compare" },
  { href: "#faq", label: "FAQ" },
] as const;

async function PricingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex min-h-dvh flex-col bg-base text-copy-primary">
      <header className="border-b border-surface-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/editor" aria-label="Back to editor">
              <ArrowLeftIcon />
              Editor
            </Link>
          </Button>
          <nav aria-label="On this page" className="hidden items-center gap-1 sm:flex">
            {SECTION_LINKS.map((link) => (
              <Button key={link.href} variant="ghost" size="sm" asChild>
                <Link href={link.href} className="font-mono">
                  {link.label}
                </Link>
              </Button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-10 sm:py-12">
        <PricingHero />

        <Separator />

        <section
          aria-labelledby="checkout-heading"
          id="checkout"
          className="flex flex-col gap-4 scroll-mt-6"
        >
          <div className="flex flex-col gap-1 text-center">
            <p className="font-mono text-xs text-copy-muted">checkout / choose a plan</p>
            <h2 id="checkout-heading" className="text-xl font-medium text-copy-primary">
              Plans and usage
            </h2>
            <p className="text-sm text-copy-muted">
              Free includes up to 3 owned projects. Upgrade for more capacity — checkout opens right
              here, managed by Clerk.
            </p>
          </div>
          <Suspense fallback={<PricingTableSkeleton />}>
            <PricingTable appearance={authAppearance} />
          </Suspense>
          <p className="text-center text-xs text-copy-muted">
            By subscribing you agree to our{" "}
            <Link
              href="/terms"
              className="rounded text-ai-text outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="rounded text-ai-text outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <Separator />

        <CountingSection />

        <div id="compare" className="scroll-mt-6">
          <CompareTable />
        </div>

        <div id="faq" className="scroll-mt-6">
          <FaqSection />
        </div>

        <Separator />

        <section
          aria-labelledby="pricing-cta-heading"
          className="flex flex-col items-center gap-3 rounded-2xl border border-surface-border bg-surface px-6 py-8 text-center"
        >
          <h2 id="pricing-cta-heading" className="text-lg font-medium text-copy-primary">
            Still deciding? Your canvases are waiting.
          </h2>
          <p className="max-w-md text-sm text-copy-muted">
            Start on Free, invite collaborators, and upgrade the moment the fourth project calls.
            Nothing you draw is ever lost to billing.
          </p>
          <Button asChild>
            <Link href="/editor">
              Back to the editor
              <ArrowRightIcon />
            </Link>
          </Button>
        </section>
      </main>
    </div>
  );
}

export default PricingPage;
