import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export interface FacilityZoneConfigs {
  zones?: Array<Record<string, unknown>>;
  compressors?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export const telemetryRecords = pgTable(
  "telemetry_records",
  {
    id: serial("id").primaryKey(),
    shipmentId: varchar("shipment_id", { length: 64 }).notNull(),
    stepSequence: integer("step_sequence").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" }).notNull(),
    cargoTemperature: numeric("cargo_temperature", { precision: 5, scale: 2 }).notNull(),
    ambientTemperature: numeric("ambient_temperature", { precision: 5, scale: 2 }),
    setpointTemperature: numeric("setpoint_temperature", { precision: 5, scale: 2 }).default("-20.00"),
    humidityRh: numeric("humidity_rh", { precision: 5, scale: 2 }),
    coolingStatus: varchar("cooling_status", { length: 24 }).default("OPTIMAL"),
    batteryLevel: integer("battery_level").default(100),
    doorOpen: boolean("door_open").default(false),
    latitude: numeric("latitude", { precision: 9, scale: 6 }).notNull(),
    longitude: numeric("longitude", { precision: 9, scale: 6 }).notNull(),
    speedKmh: numeric("speed_kmh", { precision: 5, scale: 1 }).default("0.0"),
    shockG: numeric("shock_g", { precision: 5, scale: 2 }).default("0.0"),
  },
  (table) => [
    index("telemetry_records_shipment_id_idx").on(table.shipmentId),
    index("telemetry_records_shipment_step_idx").on(table.shipmentId, table.stepSequence.asc()),
  ],
);

export const facilityConfigs = pgTable("facility_configs", {
  facilityId: varchar("facility_id", { length: 64 }).primaryKey(),
  facilityName: varchar("facility_name", { length: 128 }),
  zoneConfigs: jsonb("zone_configs").$type<FacilityZoneConfigs>(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export const alertIncidents = pgTable("alert_incidents", {
  id: serial("id").primaryKey(),
  shipmentId: varchar("shipment_id", { length: 64 }),
  stepSequence: integer("step_sequence"),
  alertType: varchar("alert_type", { length: 32 }).$type<"EXCURSION" | "DOOR_BREACH" | "SHOCK_IMPACT">(),
  severity: varchar("severity", { length: 16 }).$type<"WARNING" | "CRITICAL">(),
  message: text("message"),
  acknowledged: boolean("acknowledged").default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});
