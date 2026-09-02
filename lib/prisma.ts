// ---------------------------------------------------------------------------
// Cached Prisma client singleton.
//
// Two adapter paths, branched by DATABASE_URL:
//   - `prisma+postgres://` -> Accelerate  (local `prisma dev` and remote)
//   - everything else      -> @prisma/adapter-pg  (plain postgres://)
//
// The globalThis cache survives Next.js dev hot reloads so we don't open a
// new pool per save. In production, the module is evaluated once and the
// cache is bypassed.
// ---------------------------------------------------------------------------

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withAccelerate } from "@prisma/extension-accelerate";

interface GlobalForPrisma {
  prismaGlobal?: ReturnType<typeof createPrismaClient>;
}

const globalRef = globalThis as typeof globalThis & GlobalForPrisma;

function createPrismaClient() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  if (url.startsWith("prisma+postgres://")) {
    // Accelerate path: local `prisma dev` and remote Prisma Postgres.
    return new PrismaClient({ accelerateUrl: url }).$extends(withAccelerate());
  }

  // Direct driver-adapter path: plain postgres:// connection strings.
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

export const prisma = globalRef.prismaGlobal ?? createPrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalRef.prismaGlobal = prisma;
}
