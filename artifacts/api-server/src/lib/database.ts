import { db, pool } from "@workspace/db";
import { logger } from "./logger";

let databaseAvailable = false;
let databaseFailureLogged = false;

export async function initializeDatabase(): Promise<boolean> {
  if (!db || !pool) {
    logger.warn("DATABASE_URL is unset; using in-memory backend storage");
    return false;
  }

  try {
    await pool.query("SELECT 1");
    databaseAvailable = true;
    logger.info("PostgreSQL connection is active");
    return true;
  } catch (err) {
    markDatabaseUnavailable(err, "PostgreSQL startup check");
    logger.warn("PostgreSQL unavailable; using in-memory backend storage");
    return false;
  }
}

export function isDatabaseAvailable(): boolean {
  return databaseAvailable;
}

export function markDatabaseUnavailable(err: unknown, operation: string): void {
  databaseAvailable = false;
  if (!databaseFailureLogged) {
    logger.warn({ err, operation }, "Database operation failed; switching to in-memory fallback");
    databaseFailureLogged = true;
  }
}
