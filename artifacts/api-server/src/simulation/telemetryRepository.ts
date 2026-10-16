import { and, asc, desc, eq, max } from "drizzle-orm";
import { alertIncidents, db, telemetryRecords } from "@workspace/db";
import { isDatabaseAvailable, markDatabaseUnavailable } from "../lib/database";
import type { TelemetryPoint } from "./types";

export const DEFAULT_SHIPMENT_ID = "coldchain-active";

function numericValue(value: string | null, fallback = 0): number {
  return value === null ? fallback : Number(value);
}

function toTelemetryPoint(row: typeof telemetryRecords.$inferSelect): TelemetryPoint {
  const cargoTemperature = numericValue(row.cargoTemperature);
  const humidity = numericValue(row.humidityRh, 65);
  const shock = numericValue(row.shockG);
  const coolingStatus = (row.coolingStatus ?? "OPTIMAL") as TelemetryPoint["cooling_status"];
  return {
    timestamp: row.timestamp.toISOString(),
    cargo_temperature: cargoTemperature,
    ambient_temperature: numericValue(row.ambientTemperature, 32),
    setpoint_temperature: numericValue(row.setpointTemperature, -20),
    humidity_rh: humidity,
    cooling_status: coolingStatus,
    battery_level: row.batteryLevel ?? 100,
    door_open: row.doorOpen ?? false,
    latitude: numericValue(row.latitude),
    longitude: numericValue(row.longitude),
    speed_kmh: numericValue(row.speedKmh),
    shock_g: shock,
    stepIndex: row.stepSequence,
    temperature: cargoTemperature,
    humidity,
    vibration: shock,
    batteryLevel: row.batteryLevel ?? 100,
    coolingUnitStatus: coolingStatus === "COOLING" || coolingStatus === "DEFROST" ? "OPTIMAL" : coolingStatus,
  };
}

export async function persistTelemetryDataset(
  shipmentId: string,
  points: TelemetryPoint[],
): Promise<boolean> {
  if (!db || !isDatabaseAvailable()) return false;

  try {
    await db.transaction(async (transaction) => {
      await transaction.delete(telemetryRecords).where(eq(telemetryRecords.shipmentId, shipmentId));
      for (let offset = 0; offset < points.length; offset += 500) {
        const batch = points.slice(offset, offset + 500);
        await transaction.insert(telemetryRecords).values(batch.map((point, index) => ({
          shipmentId,
          stepSequence: offset + index + 1,
          timestamp: new Date(point.timestamp),
          cargoTemperature: point.cargo_temperature.toFixed(2),
          ambientTemperature: point.ambient_temperature.toFixed(2),
          setpointTemperature: point.setpoint_temperature.toFixed(2),
          humidityRh: point.humidity_rh.toFixed(2),
          coolingStatus: point.cooling_status,
          batteryLevel: point.battery_level,
          doorOpen: point.door_open,
          latitude: point.latitude.toFixed(6),
          longitude: point.longitude.toFixed(6),
          speedKmh: point.speed_kmh.toFixed(1),
          shockG: point.shock_g.toFixed(2),
        })));
      }
    });
    return true;
  } catch (err) {
    markDatabaseUnavailable(err, "telemetry upload");
    return false;
  }
}

export async function loadTelemetryDataset(shipmentId: string): Promise<TelemetryPoint[] | null> {
  if (!db || !isDatabaseAvailable()) return null;

  try {
    const rows = await db
      .select()
      .from(telemetryRecords)
      .where(eq(telemetryRecords.shipmentId, shipmentId))
      .orderBy(asc(telemetryRecords.stepSequence));
    return rows.map(toTelemetryPoint);
  } catch (err) {
    markDatabaseUnavailable(err, "telemetry load");
    return null;
  }
}

export async function loadLatestTelemetryDataset(): Promise<{ shipmentId: string; points: TelemetryPoint[] } | null> {
  if (!db || !isDatabaseAvailable()) return null;
  try {
    const [latest] = await db
      .select({ shipmentId: telemetryRecords.shipmentId, latestId: max(telemetryRecords.id) })
      .from(telemetryRecords)
      .groupBy(telemetryRecords.shipmentId)
      .orderBy(desc(max(telemetryRecords.id)))
      .limit(1);
    if (!latest) return null;
    const points = await loadTelemetryDataset(latest.shipmentId);
    return points && points.length > 0 ? { shipmentId: latest.shipmentId, points } : null;
  } catch (err) {
    markDatabaseUnavailable(err, "latest telemetry dataset load");
    return null;
  }
}

export interface StoredAlertIncident {
  shipmentId: string | null;
  stepSequence: number | null;
  alertType: "EXCURSION" | "DOOR_BREACH" | "SHOCK_IMPACT" | null;
  severity: "WARNING" | "CRITICAL" | null;
  message: string | null;
  createdAt: Date | null;
}

export async function persistAlertIncident(incident: StoredAlertIncident): Promise<void> {
  if (!db || !isDatabaseAvailable()) return;
  try {
    await db.insert(alertIncidents).values(incident);
  } catch (err) {
    markDatabaseUnavailable(err, "alert incident insert");
  }
}

export async function loadUnacknowledgedAlerts(
  shipmentId?: string,
): Promise<StoredAlertIncident[] | null> {
  if (!db || !isDatabaseAvailable()) return null;
  try {
    const conditions = shipmentId
      ? and(
        eq(alertIncidents.acknowledged, false),
        eq(alertIncidents.alertType, "EXCURSION"),
        eq(alertIncidents.shipmentId, shipmentId),
      )
      : and(eq(alertIncidents.acknowledged, false), eq(alertIncidents.alertType, "EXCURSION"));
    const rows = await db
      .select({
        shipmentId: alertIncidents.shipmentId,
        stepSequence: alertIncidents.stepSequence,
        alertType: alertIncidents.alertType,
        severity: alertIncidents.severity,
        message: alertIncidents.message,
        createdAt: alertIncidents.createdAt,
      })
      .from(alertIncidents)
      .where(conditions)
      .orderBy(desc(alertIncidents.createdAt))
      .limit(20);
    return rows;
  } catch (err) {
    markDatabaseUnavailable(err, "unacknowledged alert query");
    return null;
  }
}
