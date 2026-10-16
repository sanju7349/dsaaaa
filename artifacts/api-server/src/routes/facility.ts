import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, facilityConfigs, type FacilityZoneConfigs } from "@workspace/db";
import { isDatabaseAvailable, markDatabaseUnavailable } from "../lib/database";
import { logger } from "../lib/logger";

interface FacilityConfig {
  facilityId: string;
  facilityName: string | null;
  zoneConfigs: FacilityZoneConfigs;
  updatedAt: Date;
}

const memoryConfigs = new Map<string, FacilityConfig>();
const router: IRouter = Router();

function isZoneConfigs(value: unknown): value is FacilityZoneConfigs {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestedFacilityId(req: Request): string {
  const queryValue = req.query.facilityId;
  return typeof queryValue === "string" && queryValue.trim()
    ? queryValue.trim()
    : "ND-04";
}

router.get("/facility/config", async (req: Request, res: Response) => {
  const facilityId = requestedFacilityId(req);
  if (db && isDatabaseAvailable()) {
    try {
      const [config] = await db.select().from(facilityConfigs)
        .where(eq(facilityConfigs.facilityId, facilityId)).limit(1);
      if (config) {
        res.json({ config, source: "postgres" });
        return;
      }
    } catch (err) {
      markDatabaseUnavailable(err, "facility config read");
    }
  }

  res.json({
    config: memoryConfigs.get(facilityId) ?? null,
    source: "memory",
  });
});

router.post("/facility/config", async (req: Request, res: Response) => {
  const { facilityId, facilityName, zoneConfigs } = req.body ?? {};
  if (
    typeof facilityId !== "string"
    || !facilityId.trim()
    || facilityId.length > 64
    || (facilityName !== undefined && facilityName !== null
      && (typeof facilityName !== "string" || facilityName.length > 128))
    || !isZoneConfigs(zoneConfigs)
  ) {
    res.status(400).json({
      success: false,
      error: "facilityId, optional facilityName, and an object-valued zoneConfigs are required.",
    });
    return;
  }

  const id = facilityId.trim();
  const config: FacilityConfig = {
    facilityId: id,
    facilityName: typeof facilityName === "string" ? facilityName : null,
    zoneConfigs,
    updatedAt: new Date(),
  };
  memoryConfigs.set(id, config);

  let storage: "postgres" | "memory" = "memory";
  if (db && isDatabaseAvailable()) {
    try {
      await db.insert(facilityConfigs).values({
        facilityId: id,
        facilityName: config.facilityName,
        zoneConfigs,
        updatedAt: config.updatedAt,
      }).onConflictDoUpdate({
        target: facilityConfigs.facilityId,
        set: {
          facilityName: config.facilityName,
          zoneConfigs,
          updatedAt: config.updatedAt,
        },
      });
      storage = "postgres";
    } catch (err) {
      markDatabaseUnavailable(err, "facility config write");
      logger.warn({ facilityId: id }, "Facility config retained in memory after database write failure");
    }
  }

  res.json({ success: true, config, storage });
});

export default router;
