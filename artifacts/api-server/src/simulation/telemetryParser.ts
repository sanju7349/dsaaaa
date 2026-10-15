import * as XLSX from "xlsx";
import fs from "node:fs";
import { type TelemetryPoint, type CoolingStatus } from "./types";

function cleanKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCoolingStatus(val: any, cargoTemp: number, setpointTemp: number): CoolingStatus {
  if (typeof val === "string") {
    const s = val.trim().toUpperCase();
    if (s.includes("DEFROST")) return "DEFROST";
    if (s.includes("CRIT") || s.includes("ALARM") || s.includes("WARN") || s.includes("ALERT")) return "WARNING";
    if (s.includes("OFF") || s.includes("STOP")) return "OFF";
    if (s.includes("COOL")) return "COOLING";
    if (s.includes("OPT") || s.includes("NORM") || s.includes("OK") || s.includes("GOOD")) return "OPTIMAL";
  }

  // Fallback heuristics based on delta over setpoint
  if (cargoTemp > setpointTemp + 4.0) return "WARNING";
  if (cargoTemp > setpointTemp + 1.5) return "COOLING";
  return "OPTIMAL";
}

function parseDoorOpen(val: any): boolean {
  if (val === true || val === 1 || val === "1") return true;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "open" || s === "yes" || s === "opened";
  }
  return false;
}

function parseTimestamp(rawTs: any, fallbackDate: Date): string {
  if (rawTs === undefined || rawTs === null) {
    return fallbackDate.toISOString();
  }

  if (typeof rawTs === "string") {
    const parsed = new Date(rawTs);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return rawTs;
  }

  if (rawTs instanceof Date) {
    return rawTs.toISOString();
  }

  if (typeof rawTs === "number") {
    if (rawTs > 1000000000000) {
      return new Date(rawTs).toISOString();
    }
    if (rawTs > 1000000000) {
      return new Date(rawTs * 1000).toISOString();
    }
    // Excel serial date code
    const dateObj = new Date((rawTs - 25569) * 86400 * 1000);
    return dateObj.toISOString();
  }

  return fallbackDate.toISOString();
}

export function parseRawRows(rawRows: Record<string, any>[]): TelemetryPoint[] {
  if (!rawRows || rawRows.length === 0) {
    throw new Error("Dataset is empty. No telemetry rows found.");
  }

  const baseTime = Date.now();

  const points: TelemetryPoint[] = rawRows.map((row, index) => {
    const lookup: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      lookup[cleanKey(key)] = value;
    }

    // 1. Timestamp
    const rawTs =
      lookup["timestamp"] ??
      lookup["time"] ??
      lookup["date"] ??
      lookup["datetime"] ??
      lookup["ts"];
    const timestamp = parseTimestamp(rawTs, new Date(baseTime + index * 60000));

    // 2. Setpoint Temperature (default: -20.0)
    const rawSetpoint =
      lookup["setpointtemperature"] ??
      lookup["setpoint"] ??
      lookup["setpointtemp"] ??
      lookup["targettemp"] ??
      lookup["targettemperature"] ??
      lookup["setpointc"];
    const setpoint_temperature =
      rawSetpoint !== undefined && !Number.isNaN(Number(rawSetpoint))
        ? Number(Number(rawSetpoint).toFixed(1))
        : -20.0;

    // 3. Cargo Temperature (Payload Core)
    const rawCargoTemp =
      lookup["cargotemperature"] ??
      lookup["cargotemp"] ??
      lookup["temperature"] ??
      lookup["temp"] ??
      lookup["tempc"] ??
      lookup["temperaturec"] ??
      lookup["t"];
    const cargo_temperature =
      rawCargoTemp !== undefined && !Number.isNaN(Number(rawCargoTemp))
        ? Number(Number(rawCargoTemp).toFixed(1))
        : setpoint_temperature;

    // 4. Ambient Temperature (Outside Environmental)
    const rawAmbient =
      lookup["ambienttemperature"] ??
      lookup["ambienttemp"] ??
      lookup["outsidetemp"] ??
      lookup["outsidetemperature"] ??
      lookup["ambient"];
    const ambient_temperature =
      rawAmbient !== undefined && !Number.isNaN(Number(rawAmbient))
        ? Number(Number(rawAmbient).toFixed(1))
        : 30.0;

    // 5. Humidity RH
    const rawHum =
      lookup["humidityrh"] ??
      lookup["rh"] ??
      lookup["humidity"] ??
      lookup["hum"] ??
      lookup["humiditypct"];
    const humidity_rh =
      rawHum !== undefined && !Number.isNaN(Number(rawHum))
        ? Number(Number(rawHum).toFixed(1))
        : 65.0;

    // 6. Cooling Status
    const rawStatus =
      lookup["coolingstatus"] ??
      lookup["status"] ??
      lookup["mode"] ??
      lookup["coolingunitstatus"] ??
      lookup["cooling"];
    const cooling_status = normalizeCoolingStatus(
      rawStatus,
      cargo_temperature,
      setpoint_temperature
    );

    // 7. Battery Level (0-100 integer)
    const rawBat =
      lookup["batterylevel"] ??
      lookup["battery"] ??
      lookup["batterypct"] ??
      lookup["bat"];
    const battery_level =
      rawBat !== undefined && !Number.isNaN(Number(rawBat))
        ? Math.max(0, Math.min(100, Math.round(Number(rawBat))))
        : 95;

    // 8. Door Open (boolean)
    const rawDoor =
      lookup["dooropen"] ??
      lookup["door"] ??
      lookup["doorstatus"] ??
      lookup["baydoor"];
    const door_open = parseDoorOpen(rawDoor);

    // 9. GPS Coordinates
    const rawLat = lookup["latitude"] ?? lookup["lat"] ?? lookup["y"];
    const latitude =
      rawLat !== undefined && !Number.isNaN(Number(rawLat))
        ? Number(Number(rawLat).toFixed(6))
        : 18.5204;

    const rawLng =
      lookup["longitude"] ??
      lookup["lon"] ??
      lookup["lng"] ??
      lookup["long"] ??
      lookup["x"];
    const longitude =
      rawLng !== undefined && !Number.isNaN(Number(rawLng))
        ? Number(Number(rawLng).toFixed(6))
        : 73.8567;

    // 10. Speed (km/h)
    const rawSpeed =
      lookup["speedkmh"] ??
      lookup["speed"] ??
      lookup["speedkm"] ??
      lookup["velocity"];
    const speed_kmh =
      rawSpeed !== undefined && !Number.isNaN(Number(rawSpeed))
        ? Number(Number(rawSpeed).toFixed(1))
        : 0.0;

    // 11. Shock (G-force vibration)
    const rawShock =
      lookup["shockg"] ??
      lookup["shock"] ??
      lookup["vibration"] ??
      lookup["vib"] ??
      lookup["vibrationg"] ??
      lookup["accel"];
    const shock_g =
      rawShock !== undefined && !Number.isNaN(Number(rawShock))
        ? Number(Number(rawShock).toFixed(2))
        : 0.15;

    return {
      timestamp,
      cargo_temperature,
      ambient_temperature,
      setpoint_temperature,
      humidity_rh,
      cooling_status,
      battery_level,
      door_open,
      latitude,
      longitude,
      speed_kmh,
      shock_g,

      // Compatibility properties
      stepIndex: index + 1,
      temperature: cargo_temperature,
      humidity: humidity_rh,
      vibration: shock_g,
      batteryLevel: battery_level,
      coolingUnitStatus:
        cooling_status === "COOLING" || cooling_status === "DEFROST"
          ? "OPTIMAL"
          : cooling_status,
    };
  });

  // Step 2 Requirement: Sort dataset in strictly ascending chronological order based on timestamp
  points.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (Number.isNaN(timeA) || Number.isNaN(timeB)) return 0;
    return timeA - timeB;
  });

  // Re-index stepIndex sequentially after sorting
  points.forEach((p, idx) => {
    p.stepIndex = idx + 1;
  });

  return points;
}

function extractTargetSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Invalid workbook: No sheets found.");
  }

  // Look for a sheet named 'Telemetry' (case-insensitive) or default to the first sheet
  const telemetryName = workbook.SheetNames.find(
    (name) => name.trim().toLowerCase() === "telemetry"
  );

  const targetSheetName = telemetryName || workbook.SheetNames[0]!;
  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error(`Sheet "${targetSheetName}" could not be loaded.`);
  }

  return sheet;
}

export function parseTelemetryBuffer(buffer: Buffer): TelemetryPoint[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = extractTargetSheet(workbook);
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
  return parseRawRows(rawRows);
}

export function parseTelemetryFile(filePath: string): TelemetryPoint[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dataset file not found at: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = extractTargetSheet(workbook);
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
  return parseRawRows(rawRows);
}
