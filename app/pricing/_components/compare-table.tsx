import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PLAN_LABELS } from "@/lib/billing";

// ---------------------------------------------------------------------------
// Side-by-side comparison. Rows mirror the spec-36 plan table exactly; the
// column order (Free → Pro → Pro Max) follows the capacity ladder, so the
// left-to-right order carries information.
// ---------------------------------------------------------------------------

const ROWS: Array<{ label: string; values: [string, string, string]; mono?: boolean }> = [
  { label: "Owned projects", values: ["3", "100", "1,000"], mono: true },
  { label: "AI architect generation", values: ["Basic", "Higher limits", "Highest limits"] },
  { label: "Markdown spec generation", values: ["Basic", "Higher limits", "Highest limits"] },
  { label: "Collaboration capacity", values: ["Basic", "More capacity", "Highest"] },
  { label: "Analytics", values: ["Basic", "Advanced", "All advanced"] },
  { label: "Shared projects you join", values: ["Unlimited", "Unlimited", "Unlimited"] },
  { label: "Manage subscription", values: ["In checkout", "In checkout", "In checkout"] },
];

function CompareTable() {
  return (
    <section aria-labelledby="compare-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs text-copy-muted">compare / side by side</p>
        <h2 id="compare-heading" className="text-xl font-medium text-copy-primary">
          Compare plans
        </h2>
      </div>
      <Card className="border-surface-border bg-surface">
        <CardHeader className="grid grid-cols-[1fr_repeat(3,minmax(0,4.5rem))] items-center gap-2 sm:grid-cols-[1fr_repeat(3,minmax(0,7rem))]">
          <CardTitle className="text-sm font-medium text-copy-muted">Capability</CardTitle>
          {(["free", "pro", "pro_max"] as const).map((slug) => (
            <span
              key={slug}
              className="text-right font-mono text-xs text-copy-secondary sm:text-sm"
            >
              {PLAN_LABELS[slug]}
            </span>
          ))}
        </CardHeader>
        <CardContent className="flex flex-col">
          {ROWS.map((row, index) => (
            <div key={row.label}>
              {index > 0 ? <Separator className="opacity-60" /> : null}
              <div className="grid grid-cols-[1fr_repeat(3,minmax(0,4.5rem))] items-center gap-2 py-2.5 sm:grid-cols-[1fr_repeat(3,minmax(0,7rem))]">
                <span className="text-sm text-copy-secondary">{row.label}</span>
                {row.values.map((value, valueIndex) => (
                  <span
                    key={`${row.label}-${valueIndex}`}
                    className={
                      row.mono
                        ? "text-right font-mono text-sm text-copy-primary"
                        : "text-right text-sm text-copy-primary"
                    }
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

export { CompareTable };
