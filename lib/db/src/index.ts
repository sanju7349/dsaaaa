import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 })
  : null;
export const db = pool ? drizzle(pool, { schema }) : null;

pool?.on("error", (err) => {
  console.error("PostgreSQL pool error:", err.message);
});

export * from "./schema";
