#!/usr/bin/env node
/**
 * ColdChain-Twin — Sequential Excel Telemetry Agent Runner (CLI)
 * ==============================================================
 * Consumes an external Excel (.xlsx / .xls) or .csv sheet and executes
 * the Telemetry Sentinel and Route & Quality Predictor agents sequentially,
 * segment-by-segment (1 row per segment).
 *
 * Usage:
 *   node agent_service/run_simulation_cli.js [path_to_excel_or_csv] [--interval 1000]
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Load SheetJS from api-server node_modules
let XLSX;
try {
  XLSX = require('../artifacts/api-server/node_modules/xlsx');
} catch (_) {
  try {
    XLSX = require('xlsx');
  } catch (e) {
    console.error('SheetJS (xlsx) is required. Please run: pnpm --filter @workspace/api-server add xlsx');
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let filePath = path.resolve(process.cwd(), 'data', 'simulation_dataset.xlsx');
let intervalMs = 1000;
let maxRows = 0;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--interval' && args[i + 1]) {
    intervalMs = parseInt(args[i + 1], 10) || 1000;
    i++;
  } else if (args[i] === '--max' && args[i + 1]) {
    maxRows = parseInt(args[i + 1], 10) || 0;
    i++;
  } else if (!args[i].startsWith('--')) {
    filePath = path.resolve(args[i]);
  }
}

if (!fs.existsSync(filePath)) {
  console.error(`\x1b[31m[ERROR] Dataset file not found at: ${filePath}\x1b[0m`);
  process.exit(1);
}

console.log(`\x1b[36m========================================================================\x1b[0m`);
console.log(`\x1b[36m❄️  ColdChain-Twin Multi-Agent Sequential Telemetry Processor\x1b[0m`);
console.log(`\x1b[36m========================================================================\x1b[0m`);
console.log(`📂 Ingesting External Dataset: \x1b[33m${filePath}\x1b[0m`);
console.log(`⏱️  Playback Interval: \x1b[33m${intervalMs} ms\x1b[0m per excel row segment`);

// Read workbook
const workbook = XLSX.readFile(filePath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rawRows = XLSX.utils.sheet_to_json(sheet);

if (!rawRows || rawRows.length === 0) {
  console.error(`\x1b[31m[ERROR] Sheet "${sheetName}" contains 0 rows.\x1b[0m`);
  process.exit(1);
}

const totalToProcess = maxRows > 0 ? Math.min(rawRows.length, maxRows) : rawRows.length;
console.log(`📊 Successfully parsed \x1b[32m${rawRows.length}\x1b[0m total rows from sheet \x1b[35m"${sheetName}"\x1b[0m.`);
console.log(`🤖 Initializing Telemetry Sentinel Agent & Route & Quality Predictor Agent...`);
console.log(`\x1b[36m------------------------------------------------------------------------\x1b[0m\n`);

function cleanKey(k) {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeRow(row, idx) {
  const lookup = {};
  for (const [k, v] of Object.entries(row)) {
    lookup[cleanKey(k)] = v;
  }

  const rawTemp = lookup['temperature'] ?? lookup['temp'] ?? lookup['tempc'] ?? -18.5;
  const temp = parseFloat(rawTemp);

  const rawHum = lookup['humidity'] ?? lookup['hum'] ?? 72;
  const hum = parseFloat(rawHum);

  const rawVib = lookup['vibration'] ?? lookup['vib'] ?? 0.15;
  const vib = parseFloat(rawVib);

  const rawLat = lookup['latitude'] ?? lookup['lat'] ?? 18.5204;
  const lat = parseFloat(rawLat);

  const rawLng = lookup['longitude'] ?? lookup['lon'] ?? lookup['lng'] ?? 73.8567;
  const lng = parseFloat(rawLng);

  const rawBat = lookup['batterylevel'] ?? lookup['battery'] ?? 95;
  const bat = parseFloat(rawBat);

  let status = lookup['coolingunitstatus'] ?? lookup['status'] ?? lookup['cooling'] ?? 'OPTIMAL';
  status = String(status).toUpperCase();
  if (temp > -15) status = 'CRITICAL';
  else if (temp > -18) status = 'WARNING';

  return {
    stepIndex: idx + 1,
    timestamp: lookup['timestamp'] ?? new Date().toISOString(),
    temperature: isNaN(temp) ? -18.5 : temp,
    humidity: isNaN(hum) ? 72 : hum,
    vibration: isNaN(vib) ? 0.15 : vib,
    latitude: isNaN(lat) ? 18.5204 : lat,
    longitude: isNaN(lng) ? 73.8567 : lng,
    batteryLevel: isNaN(bat) ? 95 : bat,
    coolingUnitStatus: status
  };
}

// Call Python Agent bridge via subprocess
function runAgentAudit(step, history) {
  return new Promise((resolve) => {
    const bridgePath = path.resolve(__dirname, 'bridge.py');
    const py = spawn('python', [bridgePath], { windowsHide: true });

    let stdout = '';
    py.stdout.on('data', (d) => { stdout += d.toString(); });
    py.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          return resolve(JSON.parse(stdout.trim()));
        } catch (_) {}
      }
      // Fallback audit
      resolve(null);
    });
    py.on('error', () => resolve(null));

    py.stdin.write(JSON.stringify({ step, history }));
    py.stdin.end();
  });
}

const history = [];

async function run() {
  for (let i = 0; i < totalToProcess; i++) {
    const row = normalizeRow(rawRows[i], i);
    history.push(row);

    console.log(`\x1b[1m\x1b[35m>>> Running segment ${i + 1} comprising of 1 excel row (Row ${i + 1} of ${totalToProcess})...\x1b[0m`);
    console.log(`    \x1b[90mTimestamp: ${row.timestamp} | GPS: [${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}]\x1b[0m`);
    
    const tempColor = row.temperature > -15 ? '\x1b[31m' : row.temperature > -18 ? '\x1b[33m' : '\x1b[32m';
    console.log(`    📊 Telemetry: Temp: ${tempColor}${row.temperature.toFixed(1)}°C\x1b[0m | Hum: ${row.humidity}% | Vib: ${row.vibration.toFixed(2)}g | Battery: ${row.batteryLevel}% | Unit: ${row.coolingUnitStatus}`);

    // Run agents
    const verdict = await runAgentAudit(row, history.slice(-5));
    if (verdict) {
      if (verdict.sentinel.status === 'VIOLATION') {
        console.log(`    \x1b[31m├── 🛡️  [Sentinel Agent]: VIOLATION (${verdict.sentinel.severity} SEVERITY)\x1b[0m`);
        verdict.sentinel.violations.forEach((v) => {
          console.log(`    \x1b[31m│   • ${v}\x1b[0m`);
        });
        console.log(`    \x1b[33m└── 📈 [Quality Predictor]: Risk ${verdict.predictor.qualityRiskScore}/100 (${verdict.predictor.shelfLifeImpact})\x1b[0m`);
        console.log(`        \x1b[36mDirective: ${verdict.predictor.recommendation}\x1b[0m`);
      } else {
        console.log(`    \x1b[32m├── 🛡️  [Sentinel Agent]: CLEAR - All parameters within HACCP bounds (Temp <= -18°C)\x1b[0m`);
        console.log(`    \x1b[32m└── 📈 [Quality Predictor]: Nominal cargo integrity (Risk: ${verdict.predictor.qualityRiskScore}/100)\x1b[0m`);
      }
    }

    console.log('');

    if (i < totalToProcess - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  console.log(`\x1b[32m========================================================================\x1b[0m`);
  console.log(`\x1b[32m✅ Completed sequential processing of ${totalToProcess} segments (${totalToProcess} excel rows).\x1b[0m`);
  console.log(`\x1b[32m========================================================================\x1b[0m`);
}

run().catch(console.error);
