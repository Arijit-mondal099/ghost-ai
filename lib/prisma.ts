// ---------------------------------------------------------------------------
// Cached Prisma client singleton.
//
// The local `prisma dev` proxy on port 51213 only supports Prisma Client up
// to 7.2.0 on the HTTP/Accelerate path. With Client 7.8.0 the proxy rejects
// the connection with `P6000`. We bypass the proxy entirely and talk to the
// embedded Postgres on its direct TCP port (51214) via `@prisma/adapter-pg`.
//
// The globalThis cache survives Next.js dev hot reloads so we don't open a
// new pool per save. In production, the module is evaluated once and the
// cache is bypassed.
// ---------------------------------------------------------------------------

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

function createPrismaClient(): PrismaClient {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

interface GlobalForPrisma {
  prismaGlobal?: ReturnType<typeof createPrismaClient>;
}

const globalRef = globalThis as typeof globalThis & GlobalForPrisma;

export const prisma: PrismaClient = globalRef.prismaGlobal ?? createPrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalRef.prismaGlobal = prisma;
}
