import path from "node:path";
import fs from "node:fs";
import { type Response } from "express";
import {
  type TelemetryPoint,
  type SimulationState,
  type SimulationStatus,
  type AlertPayload,
  type AgentVerdict,
} from "./types";
import { parseTelemetryFile } from "./telemetryParser";
import { auditTelemetryStep } from "./agentBridge";
import { logger } from "../lib/logger";

export class SimulationEngine {
  public records: TelemetryPoint[] = [];
  public currentIndex: number = 0;
  public isPlaying: boolean = false;
  public intervalMs: number = 1000;
  private timer: NodeJS.Timeout | null = null;
  private sseClients: Set<Response> = new Set();
  private lastAgentVerdict: AgentVerdict | null = null;
  private isProcessingStep: boolean = false;

  constructor() {
    this.autoLoadDefault();
  }

  private autoLoadDefault() {
    try {
      const candidates = [
        path.resolve(process.cwd(), "data", "sample_coldchain.xlsx"),
        path.resolve(process.cwd(), "..", "..", "data", "sample_coldchain.xlsx"),
        path.resolve(process.cwd(), "data", "simulation_dataset.xlsx"),
        path.resolve(process.cwd(), "data", "simulation_dataset.csv"),
        path.resolve(process.cwd(), "..", "..", "data", "simulation_dataset.xlsx"),
      ];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          this.loadLocalDataset(p);
          logger.info({ path: p, count: this.records.length }, "Auto-loaded default simulation dataset");
          break;
        }
      }
    } catch (err) {
      logger.warn({ err }, "Could not auto-load default simulation dataset");
    }
  }

  public loadDataset(points: TelemetryPoint[]) {
    if (!points || points.length === 0) {
      throw new Error("Cannot load empty dataset.");
    }

    this.pause();
    this.records = points;
    this.currentIndex = 0;
    this.isPlaying = false;
    this.lastAgentVerdict = null;

    logger.info({ totalRecords: this.records.length }, "Simulation dataset loaded");

    // Perform audit on first point if available
    if (this.records.length > 0) {
      const first = this.records[0]!;
      auditTelemetryStep(first, []).then((verdict) => {
        this.lastAgentVerdict = verdict;
        this.broadcastStatus();
      });
    }

    this.broadcastStatus();
  }

  public loadLocalDataset(customPath?: string): number {
    const defaultCandidates = [
      path.resolve(process.cwd(), "data", "sample_coldchain.xlsx"),
      path.resolve(process.cwd(), "..", "..", "data", "sample_coldchain.xlsx"),
      path.resolve(process.cwd(), "data", "simulation_dataset.xlsx"),
      path.resolve(process.cwd(), "..", "..", "data", "simulation_dataset.xlsx"),
    ];

    let filePath = customPath ? path.resolve(customPath) : null;
    if (!filePath) {
      for (const p of defaultCandidates) {
        if (fs.existsSync(p)) {
          filePath = p;
          break;
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Dataset file not found at: ${filePath || 'default paths'}`);
    }

    const points = parseTelemetryFile(filePath);
    this.loadDataset(points);
    return points.length;
  }

  public play(options?: { intervalMs?: number; speed?: number }): SimulationStatus {
    if (this.records.length === 0) {
      throw new Error("No dataset loaded. Upload a dataset or load local dataset first.");
    }

    if (options?.intervalMs && options.intervalMs > 0) {
      this.intervalMs = options.intervalMs;
    } else if (options?.speed && options.speed > 0) {
      this.intervalMs = Math.round(1000 / options.speed);
    }

    // Loop back if at the end
    if (this.currentIndex >= this.records.length - 1) {
      this.currentIndex = 0;
    }

    this.isPlaying = true;
    this.startTimer();
    this.broadcastStatus();

    // Trigger current row immediately
    this.triggerStep();

    return this.getStatus();
  }

  // Compatibility alias for start()
  public start(options?: { intervalMs?: number; speed?: number }): SimulationStatus {
    return this.play(options);
  }

  public pause(): SimulationStatus {
    this.clearTimer();
    this.isPlaying = false;
    this.broadcastStatus();
    return this.getStatus();
  }

  public async step(): Promise<{ status: SimulationStatus; record: TelemetryPoint | null }> {
    if (this.records.length === 0) {
      throw new Error("No dataset loaded.");
    }

    // Stop continuous timer on manual step
    this.clearTimer();
    this.isPlaying = false;

    const currentRecord = this.records[this.currentIndex] ?? null;

    if (currentRecord) {
      await this.triggerStep();
    }

    // Advance to next index for the next call
    if (this.currentIndex < this.records.length - 1) {
      this.currentIndex++;
    }

    this.broadcastStatus();
    return { status: this.getStatus(), record: currentRecord };
  }

  public reset(): SimulationStatus {
    this.clearTimer();
    this.currentIndex = 0;
    this.isPlaying = false;
    this.lastAgentVerdict = null;

    if (this.records.length > 0) {
      const first = this.records[0]!;
      auditTelemetryStep(first, []).then((verdict) => {
        this.lastAgentVerdict = verdict;
        this.emitRow(first);
      });
    }

    this.broadcastStatus();
    return this.getStatus();
  }

  public setSpeed(speedOrInterval: { intervalMs?: number; speed?: number }): SimulationStatus {
    if (speedOrInterval.intervalMs && speedOrInterval.intervalMs > 0) {
      this.intervalMs = speedOrInterval.intervalMs;
    } else if (speedOrInterval.speed && speedOrInterval.speed > 0) {
      this.intervalMs = Math.max(100, Math.round(1000 / speedOrInterval.speed));
    }

    if (this.isPlaying) {
      this.startTimer();
    }

    this.broadcastStatus();
    return this.getStatus();
  }

  public getAlert(record: TelemetryPoint | null): AlertPayload | null {
    if (!record) return null;
    if (record.cargo_temperature > record.setpoint_temperature + 2.0) {
      return {
        type: "WARNING",
        message: `Temperature threshold breached: ${record.cargo_temperature}°C`,
      };
    }
    return null;
  }

  public getStatus(): SimulationStatus {
    const activePayload = this.records[this.currentIndex] ?? null;
    const alert = this.getAlert(activePayload);
    const speed = Number((1000 / this.intervalMs).toFixed(2));
    const totalRecords = this.records.length;
    const progressPercent = totalRecords > 0
      ? Math.min(100, Math.round(((this.currentIndex + 1) / totalRecords) * 100))
      : 0;

    let state: SimulationState = "IDLE";
    if (this.isPlaying) {
      state = "PLAYING";
    } else if (this.currentIndex > 0 && this.currentIndex < totalRecords - 1) {
      state = "PAUSED";
    } else if (totalRecords > 0 && this.currentIndex >= totalRecords - 1) {
      state = "COMPLETED";
    }

    const startIdx = Math.max(0, this.currentIndex - 29);
    const recentHistory = this.records.slice(startIdx, this.currentIndex + 1);

    return {
      state,
      isPlaying: this.isPlaying,
      currentIndex: this.currentIndex,
      currentStep: totalRecords > 0 ? this.currentIndex + 1 : 0,
      totalRecords,
      totalSteps: totalRecords,
      intervalMs: this.intervalMs,
      speed,
      progressPercent,
      activeRecord: activePayload,
      activePayload,
      lastAgentVerdict: this.lastAgentVerdict,
      alert,
      recentHistory,
    };
  }

  private startTimer() {
    this.clearTimer();
    const effectiveInterval = Math.max(100, this.intervalMs);

    this.timer = setInterval(() => {
      this.tick();
    }, effectiveInterval);
  }

  private clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (!this.isPlaying || this.isProcessingStep) return;

    if (this.currentIndex >= this.records.length - 1) {
      this.isPlaying = false;
      this.clearTimer();
      this.broadcastStatus();
      return;
    }

    this.currentIndex++;
    await this.triggerStep();
  }

  private async triggerStep() {
    const currentRecord = this.records[this.currentIndex];
    if (!currentRecord) return;

    this.isProcessingStep = true;
    try {
      const history = this.records.slice(Math.max(0, this.currentIndex - 5), this.currentIndex);
      const verdict = await auditTelemetryStep(currentRecord, history);
      this.lastAgentVerdict = verdict;

      this.emitRow(currentRecord);

      if (verdict.hasExcursion) {
        this.broadcast("agent", verdict);
      }
    } catch (err) {
      logger.error({ err }, "Error auditing telemetry step");
      this.emitRow(currentRecord);
    } finally {
      this.isProcessingStep = false;
    }
  }

  private emitRow(record: TelemetryPoint) {
    const alert = this.getAlert(record);
    const status = this.getStatus();

    const payload = {
      row: record,
      data: record,
      step: record,
      currentIndex: this.currentIndex,
      totalRecords: this.records.length,
      progressPercent: status.progressPercent,
      isPlaying: this.isPlaying,
      intervalMs: this.intervalMs,
      alert,
      verdict: this.lastAgentVerdict,
      status,
    };

    // Broadcast standard telemetry event
    this.broadcast("telemetry", payload);

    // Also broadcast message event so default onmessage handles it
    this.broadcast("message", payload);

    if (alert) {
      this.broadcast("alert", alert);
    }
  }

  private broadcastStatus() {
    this.broadcast("status", this.getStatus());
  }

  // --- SSE Broadcasting ---

  public addClient(res: Response) {
    this.sseClients.add(res);
    logger.info({ totalClients: this.sseClients.size }, "SSE client connected to simulation stream");

    // Immediately push initial status
    const currentStatus = this.getStatus();
    res.write(`event: status\ndata: ${JSON.stringify(currentStatus)}\n\n`);

    // Send recent history buffer (up to 30 points) so charts render full curve immediately
    const startIdx = Math.max(0, this.currentIndex - 29);
    const recentHistory = this.records.slice(startIdx, this.currentIndex + 1);
    if (recentHistory.length > 0) {
      res.write(`event: history\ndata: ${JSON.stringify(recentHistory)}\n\n`);
    }

    if (currentStatus.activePayload) {
      const initialPayload = {
        row: currentStatus.activePayload,
        data: currentStatus.activePayload,
        step: currentStatus.activePayload,
        currentIndex: this.currentIndex,
        totalRecords: this.records.length,
        progressPercent: currentStatus.progressPercent,
        isPlaying: this.isPlaying,
        intervalMs: this.intervalMs,
        alert: currentStatus.alert,
        verdict: this.lastAgentVerdict,
        status: currentStatus,
      };
      res.write(`event: telemetry\ndata: ${JSON.stringify(initialPayload)}\n\n`);
      res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);
    }
  }

  public removeClient(res: Response) {
    this.sseClients.delete(res);
    logger.info({ totalClients: this.sseClients.size }, "SSE client disconnected");
  }

  public broadcast(event: string, data: any) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(message);
      } catch (_) {
        this.sseClients.delete(client);
      }
    }
  }
}

export const simulationController = new SimulationEngine();
