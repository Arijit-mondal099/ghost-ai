"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Pricing error boundary. A Clerk billing outage must never strand the user —
// offer a retry and a way back to the editor.
// ---------------------------------------------------------------------------

function PricingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-base px-4 text-center">
      <h1 className="text-xl font-medium text-copy-primary">Plans are unavailable</h1>
      <p className="max-w-sm text-sm text-copy-muted">
        We couldn&apos;t load the plan table. Your projects are unaffected.
      </p>
      <div className="flex items-center gap-2">
        <Button variant="default" size="sm" onClick={reset}>
          Try again
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/editor">Back to editor</Link>
        </Button>
      </div>
    </div>
  );
}

export default PricingError;
