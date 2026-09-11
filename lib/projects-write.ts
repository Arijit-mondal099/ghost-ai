// ---------------------------------------------------------------------------
// Project writes with plan-limit enforcement (spec 36).
//
// `tryCreateProject` makes the count-then-create check atomic per owner: the
// whole critical section runs inside one transaction behind a
// transaction-scoped Postgres advisory lock keyed by `ownerId`. Without the
// lock, two concurrent POSTs could both pass `canCreateProject` and push the
// owner past their plan cap (TOCTOU). No migration needed — advisory locks
// are session/transaction primitives, not schema.
//
// The helper takes the resolved `plan` (never Clerk objects) so it stays
// auth-agnostic and directly testable.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import {
  canCreateProject,
  planLimitExceededBody,
  type PlanLimitExceededDetails,
  type PlanSlug,
} from "@/lib/billing";
import type { ProjectStatus } from "../app/generated/prisma/enums";

const PROJECT_SELECT = {
  id: true,
  name: true,
  description: true,
  status: true,
  canvasJsonPath: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type CreatedProject = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  canvasJsonPath: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProjectResult =
  | { kind: "created"; project: CreatedProject }
  | { kind: "limited"; details: PlanLimitExceededDetails };

export async function tryCreateProject(input: {
  ownerId: string;
  plan: PlanSlug;
  name: string;
}): Promise<CreateProjectResult> {
  return prisma.$transaction(async (tx) => {
    // Serialize concurrent creates for this owner. `pg_advisory_xact_lock`
    // is released automatically at commit/rollback, so a crashed request
    // can never wedge the owner.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.ownerId}))`;

    const ownedCount = await tx.project.count({ where: { ownerId: input.ownerId } });
    if (!canCreateProject(ownedCount, input.plan)) {
      return { kind: "limited", details: planLimitExceededBody(input.plan) };
    }

    const project = await tx.project.create({
      data: { ownerId: input.ownerId, name: input.name },
      select: PROJECT_SELECT,
    });
    return { kind: "created", project };
  });
}
