// ---------------------------------------------------------------------------
// Concurrency test for atomic plan-limit allocation (spec 36 TOCTOU fix).
//
// Two simultaneous creates at the final free-plan slot must yield exactly
// one success and one `PLAN_LIMIT_EXCEEDED` — never two successes.
//
// Run: `bun test lib/projects-write.test.ts` (Bun auto-loads `.env` for
// `DATABASE_URL`). Skipped when `DATABASE_URL` is unset so `bun test` stays
// green on machines without DB access. Uses an isolated random `ownerId` and
// cleans up after itself.
// ---------------------------------------------------------------------------

import { describe, expect, test } from "bun:test";

import { prisma } from "@/lib/prisma";
import { tryCreateProject } from "@/lib/projects-write";

const ownerId = `toctou-probe-${crypto.randomUUID()}`;

async function cleanup(): Promise<void> {
  await prisma.project.deleteMany({ where: { ownerId } });
}

describe.skipIf(!process.env["DATABASE_URL"])("tryCreateProject concurrency", () => {
  test("two creates at the final free slot yield exactly one success", async () => {
    await cleanup();
    try {
      // Free plan allows 3 owned projects — fill to one remaining slot.
      for (let i = 0; i < 2; i += 1) {
        const seeded = await tryCreateProject({ ownerId, plan: "free", name: `seed ${i}` });
        expect(seeded.kind).toBe("created");
      }

      const [first, second] = await Promise.all([
        tryCreateProject({ ownerId, plan: "free", name: "race a" }),
        tryCreateProject({ ownerId, plan: "free", name: "race b" }),
      ]);

      const created = [first, second].filter((result) => result.kind === "created");
      const limited = [first, second].filter((result) => result.kind === "limited");
      expect(created).toHaveLength(1);
      expect(limited).toHaveLength(1);
      const loser = limited[0];
      expect(loser?.kind).toBe("limited");
      if (loser?.kind === "limited") {
        expect(loser.details.code).toBe("PLAN_LIMIT_EXCEEDED");
        expect(loser.details.currentPlan).toBe("free");
        expect(loser.details.limit).toBe(3);
      }

      expect(await prisma.project.count({ where: { ownerId } })).toBe(3);
    } finally {
      await cleanup();
    }
  }, 30000);
});
