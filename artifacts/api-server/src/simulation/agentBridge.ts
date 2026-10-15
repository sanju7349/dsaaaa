import { spawn } from "node:child_process";
import path from "node:path";
import { type TelemetryPoint, type AgentVerdict } from "./types";

/**
 * Built-in Node.js Sentinel & Quality Predictor (Zero-latency fallback)
 */
function localNodeAudit(step: TelemetryPoint, _history: TelemetryPoint[]): AgentVerdict {
  const violations: string[] = [];
  let severity: "LOW" | "MEDIUM" | "HIGH" = "LOW";

  // 1. Temperature Excursion Check (-18.0°C threshold for frozen cold chain)
  if (step.temperature > -15.0) {
    violations.push(
      `CRITICAL TEMPERATURE EXCURSION: ${step.temperature.toFixed(1)}°C breaches -18.0°C threshold by +${(step.temperature - -18.0).toFixed(1)}°C`
    );
    severity = "HIGH";
  } else if (step.temperature > -18.0) {
    violations.push(`Thermal breach warning: ${step.temperature.toFixed(1)}°C is above target setpoint (-18.0°C)`);
    severity = "MEDIUM";
  }

  // 2. Vibration Shocks
  if (step.vibration > 2.0) {
    violations.push(`Severe road vibration shock: ${step.vibration.toFixed(2)}g exceeds safety limit (1.5g)`);
    severity = "HIGH";
  } else if (step.vibration > 1.5) {
    violations.push(`Elevated road shock: ${step.vibration.toFixed(2)}g detected`);
    if (severity === "LOW") severity = "MEDIUM";
  }

  // 3. Cooling Unit Status
  if (step.coolingUnitStatus === "CRITICAL" || step.coolingUnitStatus === "OFF") {
    violations.push(`Refrigeration unit failure: status is ${step.coolingUnitStatus}`);
    severity = "HIGH";
  } else if (step.coolingUnitStatus === "WARNING") {
    violations.push("Cooling unit in WARNING status - compressor strain detected");
    if (severity === "LOW") severity = "MEDIUM";
  }

  // 4. Battery drain
  if (step.batteryLevel < 20.0) {
    violations.push(`Low telematics battery: ${step.batteryLevel.toFixed(1)}% remaining`);
    if (severity === "LOW") severity = "MEDIUM";
  }

  // Predictor Risk Score
  let riskScore = 12;
  if (step.temperature > -18.0) {
    riskScore += Math.min(65, Math.round((step.temperature - -18.0) * 16));
  }
  if (step.vibration > 1.5) {
    riskScore += Math.min(20, Math.round((step.vibration - 1.5) * 15));
  }
  if (step.coolingUnitStatus === "CRITICAL") riskScore += 25;
  else if (step.coolingUnitStatus === "WARNING") riskScore += 10;
  riskScore = Math.min(98, Math.max(5, riskScore));

  let shelfLife = "Nominal (100% shelf-life preserved)";
  let recommendation = "Cargo conditions optimal. Maintain current velocity and refrigeration setpoint.";

  if (riskScore >= 70) {
    shelfLife = "-25% to -40% (Urgent action needed)";
    recommendation = `IMMEDIATE INTERVENTION REQUIRED: Temperature at ${step.temperature.toFixed(1)}°C. Engage secondary diesel cooling unit. Alert destination cold-store dock at Lat ${step.latitude.toFixed(4)}, Lng ${step.longitude.toFixed(4)} to prepare rapid blast freezer triage.`;
  } else if (riskScore >= 40) {
    shelfLife = "-8% to -15% accelerated degradation";
    recommendation = `THERMAL WARNING: Product integrity at moderate risk (${step.temperature.toFixed(1)}°C). Tighten trailer perimeter seals and increase cooling setpoint to -24°C.`;
  }

  return {
    timestamp: step.timestamp,
    stepIndex: step.stepIndex,
    hasExcursion: violations.length > 0,
    sentinel: {
      status: violations.length > 0 ? "VIOLATION" : "CLEAR",
      violations,
      severity,
    },
    predictor: {
      qualityRiskScore: riskScore,
      shelfLifeImpact: shelfLife,
      recommendation,
    },
    source: "SENTINEL_NODE_BRIDGE",
  };
}

/**
 * Execute Python bridge in ./agent_service/bridge.py asynchronously.
 */
function callPythonAgentBridge(step: TelemetryPoint, history: TelemetryPoint[]): Promise<AgentVerdict | null> {
  return new Promise((resolve) => {
    try {
      const pythonScript = path.resolve(process.cwd(), "agent_service", "bridge.py");
      const pyProcess = spawn("python", [pythonScript], {
        windowsHide: true,
      });

      let stdout = "";
      let isDone = false;

      const timeout = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          try {
            pyProcess.kill();
          } catch (_) {}
          resolve(null);
        }
      }, 1500);

      pyProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pyProcess.on("close", (code) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeout);
          if (code === 0 && stdout.trim()) {
            try {
              const parsed = JSON.parse(stdout.trim()) as AgentVerdict;
              resolve(parsed);
              return;
            } catch (_) {}
          }
          resolve(null);
        }
      });

      pyProcess.on("error", () => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeout);
          resolve(null);
        }
      });

      // Send payload via stdin
      const payload = JSON.stringify({ step, history: history.slice(-5) });
      pyProcess.stdin.write(payload);
      pyProcess.stdin.end();
    } catch (_) {
      resolve(null);
    }
  });
}

export async function auditTelemetryStep(step: TelemetryPoint, history: TelemetryPoint[]): Promise<AgentVerdict> {
  // Try Python CrewAI bridge first
  const pythonResult = await callPythonAgentBridge(step, history);
  if (pythonResult && pythonResult.sentinel) {
    return pythonResult;
  }

  // Fallback to high-performance local audit
  return localNodeAudit(step, history);
}
