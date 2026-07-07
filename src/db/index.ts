import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Prevent multiple instances of Pool in development during hot-reloading
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const isRemote = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost");

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/storybook",
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
export * as schema from "./schema";
