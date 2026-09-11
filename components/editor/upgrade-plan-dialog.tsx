"use client";

import Link from "next/link";
import { CrownIcon } from "lucide-react";

import { EditorDialog } from "@/components/editor/dialog";
import { Button } from "@/components/ui/button";
import { PLAN_LABELS, type PlanSlug } from "@/lib/billing";

// ---------------------------------------------------------------------------
// Upgrade dialog (spec 36). Opens when project creation is rejected with
// `PLAN_LIMIT_EXCEEDED`: the user stays on the current page, the create
// dialog keeps its state underneath, and nothing is created. Upgrade routes
// to `/pricing` (Clerk checkout); Cancel dismisses.
// ---------------------------------------------------------------------------

export type UpgradeInfo = {
  currentPlan: PlanSlug;
  limit: number;
  upgradeTo: PlanSlug;
};

type UpgradePlanDialogProps = {
  open: boolean;
  upgrade: UpgradeInfo | null;
  onOpenChange: (open: boolean) => void;
};

function UpgradePlanDialog({ open, upgrade, onOpenChange }: UpgradePlanDialogProps) {
  const currentLabel = upgrade ? (PLAN_LABELS[upgrade.currentPlan] ?? upgrade.currentPlan) : "Free";
  const upgradeLabel = upgrade ? (PLAN_LABELS[upgrade.upgradeTo] ?? upgrade.upgradeTo) : "Pro";
  const limit = upgrade?.limit ?? 3;

  return (
    <EditorDialog.Root open={open} onOpenChange={onOpenChange}>
      <EditorDialog.Content>
        <EditorDialog.Header>
          <h3 className="text-lg font-medium">Project limit reached</h3>
          <EditorDialog.Description>
            The {currentLabel} plan includes up to {limit} projects. Upgrade to {upgradeLabel} to
            create more — your existing projects stay untouched.
          </EditorDialog.Description>
        </EditorDialog.Header>
        <div className="flex items-center gap-2 rounded-2xl border border-surface-border bg-surface px-3 py-2 text-sm text-copy-secondary">
          <CrownIcon className="h-4 w-4 shrink-0 text-brand" />
          <span>
            Current plan: <span className="font-medium text-copy-primary">{currentLabel}</span>
          </span>
        </div>
        <EditorDialog.Footer>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" asChild>
            <Link href="/pricing">
              <CrownIcon />
              Upgrade to {upgradeLabel}
            </Link>
          </Button>
        </EditorDialog.Footer>
      </EditorDialog.Content>
    </EditorDialog.Root>
  );
}

export { UpgradePlanDialog };
export type { UpgradePlanDialogProps };
