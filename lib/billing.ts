// ---------------------------------------------------------------------------
// Billing entitlements (spec 36). Single config module for all plan/limit
// decisions — no hardcoded plan numbers at call sites.
//
// Clerk is the source of truth for the active plan (slugs configured in the
// Clerk Dashboard: `free` / `pro` / `pro_max`). There is no local user table
// and no billing DB migration. Unknown/missing plans default to `free`.
//
// Project caps count OWNED projects only (`ownerId = userId`); shared /
// collaborator projects never count toward the cap.
//
// This module is client+server safe: pure functions only, no `server-only`,
// no Prisma, no Clerk imports. Server code resolves the plan via `auth()` and
// passes the structural `has` checker in (wrapped as `(o) => has(o)`).
// ---------------------------------------------------------------------------

export const PLAN_PROJECT_LIMITS = {
  free: 3,
  pro: 100,
  pro_max: 1000,
} as const;

export type PlanSlug = keyof typeof PLAN_PROJECT_LIMITS;

export const DEFAULT_PLAN: PlanSlug = "free";

export const PLAN_LABELS: Record<PlanSlug, string> = {
  free: "Free",
  pro: "Pro",
  pro_max: "Pro Max",
};

/** Structural shape of Clerk's `has({ plan })` checker. */
export type HasPlanCheck = (options: { plan: string }) => boolean;

function isKnownPlan(plan: string): plan is PlanSlug {
  return plan === "free" || plan === "pro" || plan === "pro_max";
}

/** Type guard for plan slugs arriving over the wire (API error payloads). */
export function isPlanSlug(value: unknown): value is PlanSlug {
  return typeof value === "string" && isKnownPlan(value);
}

/**
 * Resolve the active plan from Clerk's `has` checker. Checks highest tier
 * first so a `pro_max` subscriber never resolves as `pro`. Defaults to
 * `free` when nothing matches (or the checker throws).
 */
export function getPlan(has: HasPlanCheck): PlanSlug {
  try {
    if (has({ plan: "pro_max" })) return "pro_max";
    if (has({ plan: "pro" })) return "pro";
    if (has({ plan: "free" })) return "free";
  } catch {
    return DEFAULT_PLAN;
  }
  return DEFAULT_PLAN;
}

export function getProjectLimit(plan: PlanSlug): number {
  return PLAN_PROJECT_LIMITS[plan] ?? PLAN_PROJECT_LIMITS[DEFAULT_PLAN];
}

/** True while the owner may still create another owned project. */
export function canCreateProject(ownedCount: number, plan: PlanSlug): boolean {
  return ownedCount < getProjectLimit(plan);
}

/** Next tier to suggest on an over-limit rejection. */
export function getUpgradeTo(plan: PlanSlug): PlanSlug {
  if (plan === "free") return "pro";
  if (plan === "pro") return "pro_max";
  return "pro_max";
}

export type PlanLimitExceededDetails = {
  code: "PLAN_LIMIT_EXCEEDED";
  message: string;
  currentPlan: PlanSlug;
  limit: number;
  upgradeTo: PlanSlug;
};

/** Plan badge + usage payload, resolved server-side for the sidebar. */
export type BillingSummary = {
  plan: PlanSlug;
  ownedCount: number;
  limit: number;
};

/** Flat 403 `error` payload (see `forbidden()` in lib/api/responses.ts). */
export function planLimitExceededBody(plan: PlanSlug): PlanLimitExceededDetails {
  const limit = getProjectLimit(plan);
  const upgradeTo = getUpgradeTo(plan);
  const planLabel = PLAN_LABELS[plan] ?? PLAN_LABELS[DEFAULT_PLAN];
  const upgradeLabel = PLAN_LABELS[upgradeTo] ?? PLAN_LABELS[DEFAULT_PLAN];
  return {
    code: "PLAN_LIMIT_EXCEEDED",
    message: `The ${planLabel} plan allows up to ${limit} projects. Upgrade to ${upgradeLabel} to create more.`,
    currentPlan: plan,
    limit,
    upgradeTo,
  };
}

// ---------------------------------------------------------------------------
// Future capabilities (AI/spec generation, collaboration, analytics tiers).
// Values are NOT finalized — these return allow/deny + tier placeholders so
// call sites never hardcode numbers. Configure real limits here later.
// ---------------------------------------------------------------------------

export type CapabilityDecision = {
  allowed: boolean;
  /** Placeholder for a future numeric/configured limit. */
  limit: null;
};

export function canUseAiGeneration(_plan: PlanSlug): CapabilityDecision {
  return { allowed: true, limit: null };
}

export function canUseAdvancedSpecs(_plan: PlanSlug): CapabilityDecision {
  return { allowed: true, limit: null };
}

export function canInviteCollaborator(_plan: PlanSlug): CapabilityDecision {
  return { allowed: true, limit: null };
}

export type AnalyticsTier = "basic" | "advanced" | "all";

export function getAnalyticsTier(plan: PlanSlug): AnalyticsTier {
  if (plan === "pro_max") return "all";
  if (plan === "pro") return "advanced";
  return "basic";
}
