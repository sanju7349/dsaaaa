export type CoolingStatus = 'OPTIMAL' | 'COOLING' | 'WARNING' | 'DEFROST' | 'OFF';
export type CoolingUnitStatus = 'OPTIMAL' | 'WARNING' | 'CRITICAL' | 'OFF' | 'COOLING' | 'DEFROST';
export type SimulationState = 'IDLE' | 'PLAYING' | 'PAUSED' | 'COMPLETED';

export interface AlertPayload {
  type: 'WARNING' | 'CRITICAL' | 'INFO';
  message: string;
}

export interface TelemetryPoint {
  // Customer Excel Telemetry schema
  timestamp: string;
  cargo_temperature: number;
  ambient_temperature: number;
  setpoint_temperature: number;
  humidity_rh: number;
  cooling_status: CoolingStatus;
  battery_level: number;
  door_open: boolean;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  shock_g: number;

  // Compatibility helpers
  stepIndex: number;
  temperature: number;
  humidity: number;
  vibration: number;
  batteryLevel: number;
  coolingUnitStatus: CoolingUnitStatus;
}

export interface SentinelFinding {
  status: 'CLEAR' | 'WARNING' | 'VIOLATION';
  violations: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface QualityPrediction {
  qualityRiskScore: number;
  shelfLifeImpact: string;
  recommendation: string;
}

export interface AgentVerdict {
  timestamp: string;
  stepIndex: number;
  hasExcursion: boolean;
  sentinel: SentinelFinding;
  predictor: QualityPrediction;
  source: 'CREW_AI_PYTHON' | 'SENTINEL_NODE_BRIDGE';
}

export interface SimulationStatus {
  state: SimulationState;
  isPlaying: boolean;
  currentIndex: number;
  currentStep: number;
  totalRecords: number;
  totalSteps: number;
  intervalMs: number;
  speed: number;
  progressPercent: number;
  activeRecord: TelemetryPoint | null;
  activePayload: TelemetryPoint | null;
  lastAgentVerdict?: AgentVerdict | null;
  alert?: AlertPayload | null;
  recentHistory?: TelemetryPoint[];
}
