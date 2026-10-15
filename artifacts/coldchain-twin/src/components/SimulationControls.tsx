import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Upload,
  FileSpreadsheet,
  Zap,
  Activity,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Gauge,
  Navigation,
  BatteryCharging,
  Sparkles,
  RefreshCw,
  Terminal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { TelemetryPoint, SimulationStatus, AgentVerdict } from '../types/simulation';

interface SimulationControlsProps {
  status: SimulationStatus;
  isConnected: boolean;
  isUploading: boolean;
  errorMessage: string | null;
  onStart: (speed?: number) => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSetSpeed: (speed: number) => void;
  onUploadFile: (file: File) => Promise<any>;
  onLoadLocal: (path?: string) => Promise<any>;
}

interface SegmentLog {
  stepIndex: number;
  totalSteps: number;
  timestamp: string;
  temperature: number;
  humidity: number;
  vibration: number;
  batteryLevel: number;
  coolingUnitStatus: string;
  verdict: AgentVerdict | null;
}

export function SimulationControls({
  status,
  isConnected,
  isUploading,
  errorMessage,
  onStart,
  onPause,
  onStep,
  onReset,
  onSetSpeed,
  onUploadFile,
  onLoadLocal,
}: SimulationControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [segmentLogs, setSegmentLogs] = useState<SegmentLog[]>([]);
  const [showConsole, setShowConsole] = useState(true);
  const lastStepLogged = useRef<number>(-1);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  const { state, currentStep, totalSteps, speed, activePayload, lastAgentVerdict } = status;
  const isPlaying = state === 'PLAYING';
  const progressPercent = totalSteps > 0 ? Math.min(100, Math.round((currentStep / totalSteps) * 100)) : 0;

  useEffect(() => {
    if (activePayload && activePayload.stepIndex !== lastStepLogged.current) {
      lastStepLogged.current = activePayload.stepIndex;
      setSegmentLogs((prev) => [
        ...prev.slice(-39),
        {
          stepIndex: activePayload.stepIndex,
          totalSteps,
          timestamp: activePayload.timestamp,
          temperature: activePayload.temperature,
          humidity: activePayload.humidity,
          vibration: activePayload.vibration,
          batteryLevel: activePayload.batteryLevel,
          coolingUnitStatus: activePayload.coolingUnitStatus,
          verdict: lastAgentVerdict || null,
        },
      ]);
    }
  }, [activePayload, totalSteps, lastAgentVerdict]);

  useEffect(() => {
    if (showConsole && consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [segmentLogs, showConsole]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUploadFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await onUploadFile(file);
    }
  };

  const handleLoadSample = async () => {
    try {
      setLocalLoading(true);
      await onLoadLocal();
    } finally {
      setLocalLoading(false);
    }
  };

  const speeds = [0.5, 1.0, 2.0, 5.0];

  return (
    <section className="panel simulation-panel nav-target" id="simulation-engine" data-testid="module-simulation-controls">
      {/* Panel Header */}
      <div className="panel-head">
        <div>
          <div className="panel-title">
            <Radio size={16} color="#36c8dd" className={isPlaying ? 'animate-pulse' : ''} />
            <span>Sequential Telemetry Playback Engine</span>
            <span
              className="live-dot"
              style={{
                background: isConnected ? '#42d4b2' : '#f59e0b',
                boxShadow: isConnected ? '0 0 8px #42d4b2' : 'none',
              }}
              title={isConnected ? 'Real-time SSE Stream Connected' : 'Connecting to Stream...'}
            />
          </div>
          <div className="panel-sub">
            Continuous Excel/CSV playback streamer · Multi-agent CrewAI Sentinel &amp; Quality Predictor
          </div>
        </div>

        {/* State Badge & Stream Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            className={`severity ${
              state === 'PLAYING'
                ? 'normal'
                : state === 'PAUSED'
                ? 'warning'
                : state === 'COMPLETED'
                ? 'good'
                : 'advisory'
            }`}
            style={{ fontSize: 10, padding: '4px 9px', letterSpacing: '0.06em' }}
            data-testid="status-simulation-state"
          >
            {state === 'PLAYING' && '▶ '}
            {state === 'PAUSED' && '⏸ '}
            {state === 'COMPLETED' && '✓ '}
            {state}
          </div>
          <span className="mono" style={{ fontSize: 11, color: isConnected ? '#42d4b2' : '#94a3b8' }}>
            {isConnected ? 'LIVE SSE' : 'CONNECTING'}
          </span>
        </div>
      </div>

      <div style={{ padding: '14px 18px' }}>
        {/* Error banner */}
        {errorMessage && (
          <div className="alarm-banner show" style={{ marginBottom: 14, background: '#2d1519', borderColor: '#f87171' }}>
            <span>
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: '#f87171' }} />
              {errorMessage}
            </span>
          </div>
        )}

        {/* Top Control Bar: Upload & Actions */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
            paddingBottom: 14,
            borderBottom: '1px solid #1a2736',
          }}
        >
          {/* File Upload & Sample Loader */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              id="telemetry-file-upload"
              data-testid="input-simulation-file"
            />
            <button
              className="btn ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              data-testid="button-upload-dataset"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Upload size={14} color="#36c8dd" />
              <span>{isUploading ? 'Ingesting…' : 'Upload .xlsx / .csv'}</span>
            </button>

            <button
              className="btn"
              onClick={handleLoadSample}
              disabled={localLoading}
              data-testid="button-load-sample"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FileSpreadsheet size={14} color="#68d7a0" />
              <span>{localLoading ? 'Loading…' : 'Load Default Dataset (80 Steps)'}</span>
            </button>

            <span className="mono" style={{ fontSize: 11, color: '#7a8f9f', marginLeft: 4 }}>
              {totalSteps > 0 ? `${totalSteps} total records loaded` : 'No dataset loaded'}
            </span>
          </div>

          {/* Playback Controls & Speed Multipliers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Speed Pills */}
            <div
              style={{
                display: 'inline-flex',
                background: '#0d1927',
                borderRadius: 6,
                padding: '2px 4px',
                border: '1px solid #1e3347',
              }}
            >
              {speeds.map((s) => (
                <button
                  key={s}
                  onClick={() => onSetSpeed(s)}
                  data-testid={`speed-${s}x`}
                  style={{
                    background: speed === s ? '#18435d' : 'transparent',
                    color: speed === s ? '#4be3f2' : '#738b9c',
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Play/Pause */}
            {isPlaying ? (
              <button
                className="btn warning"
                onClick={onPause}
                data-testid="button-pause-simulation"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Pause size={14} />
                <span>Pause</span>
              </button>
            ) : (
              <button
                className="btn primary"
                onClick={() => onStart()}
                disabled={totalSteps === 0}
                data-testid="button-play-simulation"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Play size={14} />
                <span>Play</span>
              </button>
            )}

            {/* Step Forward */}
            <button
              className="btn"
              onClick={onStep}
              disabled={totalSteps === 0 || isPlaying}
              data-testid="button-step-simulation"
              title="Advance exactly 1 step forward"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <SkipForward size={14} />
              <span>Next Step</span>
            </button>

            {/* Reset */}
            <button
              className="btn ghost"
              onClick={onReset}
              disabled={totalSteps === 0}
              data-testid="button-reset-simulation"
              title="Reset to step 1"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Progress Bar & Scrubber */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 12, color: '#97abc0', fontWeight: 600 }}>
              Playback Progress: <span style={{ color: '#38d3e9' }}>Step {currentStep}</span> of {totalSteps}
            </span>
            <span className="mono" style={{ fontSize: 11, color: '#7a8e9e' }}>
              {progressPercent}% Complete · Rate: {speed}x ({Math.round(1000 / speed)}ms/step)
            </span>
          </div>

          <div
            style={{
              width: '100%',
              height: 8,
              background: '#132130',
              borderRadius: 4,
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid #1b2f42',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background:
                  activePayload && activePayload.temperature > -15
                    ? 'linear-gradient(90deg, #36c8dd, #f59e0b, #ef4444)'
                    : 'linear-gradient(90deg, #186b84, #36c8dd)',
                transition: 'width 0.25s ease-out',
                boxShadow: '0 0 8px rgba(54, 200, 221, 0.4)',
              }}
            />
          </div>
        </div>

        {/* Live Telemetry Sensor Readouts */}
        {activePayload && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
              marginBottom: 16,
            }}
          >
            {/* Temperature */}
            <div className="panel metric-card" style={{ padding: '10px 12px' }}>
              <div className="metric-top" style={{ fontSize: 11 }}>
                Temp Probe <Gauge size={13} color="#36c8dd" />
              </div>
              <div
                className="metric-value"
                data-testid="metric-stream-temp"
                style={{
                  fontSize: 20,
                  color:
                    activePayload.temperature > -15
                      ? '#ef4444'
                      : activePayload.temperature > -18
                      ? '#f59e0b'
                      : '#36c8dd',
                }}
              >
                {activePayload.temperature.toFixed(1)}
                <small>°C</small>
              </div>
              <div className="metric-foot">
                {activePayload.temperature > -18 ? (
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>EXCURSION BREACH</span>
                ) : (
                  <span style={{ color: '#68d7a0' }}>NORMAL SETPOINT</span>
                )}
              </div>
            </div>

            {/* Humidity */}
            <div className="panel metric-card" style={{ padding: '10px 12px' }}>
              <div className="metric-top" style={{ fontSize: 11 }}>
                Humidity <Activity size={13} color="#e3a34c" />
              </div>
              <div className="metric-value" data-testid="metric-stream-humidity" style={{ fontSize: 20 }}>
                {activePayload.humidity.toFixed(1)}
                <small>%</small>
              </div>
              <div className="metric-foot">Target: 60–75% RH</div>
            </div>

            {/* Vibration Shock */}
            <div className="panel metric-card" style={{ padding: '10px 12px' }}>
              <div className="metric-top" style={{ fontSize: 11 }}>
                Vibration <Activity size={13} color={activePayload.vibration > 1.5 ? '#ef4444' : '#57d6e4'} />
              </div>
              <div
                className="metric-value"
                data-testid="metric-stream-vibration"
                style={{
                  fontSize: 20,
                  color: activePayload.vibration > 1.5 ? '#f87171' : '#d8e6ef',
                }}
              >
                {activePayload.vibration.toFixed(2)}
                <small>g</small>
              </div>
              <div className="metric-foot">
                {activePayload.vibration > 1.5 ? (
                  <span style={{ color: '#f87171', fontWeight: 600 }}>ROAD SHOCK BUMP</span>
                ) : (
                  <span>Smooth transit</span>
                )}
              </div>
            </div>

            {/* Cooling Unit Status */}
            <div className="panel metric-card" style={{ padding: '10px 12px' }}>
              <div className="metric-top" style={{ fontSize: 11 }}>
                Cooling Unit <Zap size={13} color="#38d4e9" />
              </div>
              <div
                className="metric-value"
                data-testid="metric-stream-cooling"
                style={{
                  fontSize: 16,
                  color:
                    activePayload.coolingUnitStatus === 'CRITICAL'
                      ? '#ef4444'
                      : activePayload.coolingUnitStatus === 'WARNING'
                      ? '#f59e0b'
                      : '#42d4b2',
                  marginTop: 3,
                }}
              >
                {activePayload.coolingUnitStatus}
              </div>
              <div className="metric-foot">Compressor rack telemetry</div>
            </div>

            {/* Battery Level */}
            <div className="panel metric-card" style={{ padding: '10px 12px' }}>
              <div className="metric-top" style={{ fontSize: 11 }}>
                Telematics Battery <BatteryCharging size={13} color="#45c58e" />
              </div>
              <div className="metric-value" data-testid="metric-stream-battery" style={{ fontSize: 20 }}>
                {activePayload.batteryLevel.toFixed(1)}
                <small>%</small>
              </div>
              <div className="metric-foot">IoT Sensor telemetry</div>
            </div>

            {/* Transit GPS Track */}
            <div className="panel metric-card" style={{ padding: '10px 12px' }}>
              <div className="metric-top" style={{ fontSize: 11 }}>
                Transit GPS <Navigation size={13} color="#4bbce3" />
              </div>
              <div className="mono" data-testid="metric-stream-coords" style={{ fontSize: 12, color: '#35cce0', marginTop: 4 }}>
                {activePayload.latitude.toFixed(4)}°N
                <br />
                {activePayload.longitude.toFixed(4)}°E
              </div>
              <div className="metric-foot">Transit Corridor Pune–Mumbai</div>
            </div>
          </div>
        )}

        {/* AI Sentinel & Quality Predictor Audit Card */}
        {lastAgentVerdict && (
          <div
            style={{
              background: lastAgentVerdict.hasExcursion ? '#22151b' : '#0e1b24',
              border: `1px solid ${lastAgentVerdict.hasExcursion ? '#8f333a' : '#1e384b'}`,
              borderRadius: 8,
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
            data-testid="card-agent-verdict"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={15} color={lastAgentVerdict.hasExcursion ? '#ff6b6b' : '#3ae3cf'} />
                <strong style={{ fontSize: 12, color: '#f1f5f9', letterSpacing: '0.04em' }}>
                  CREWAI SENTINEL &amp; PREDICTOR VERDICT
                </strong>
                <span
                  className={`severity ${
                    lastAgentVerdict.sentinel.status === 'VIOLATION'
                      ? 'critical'
                      : lastAgentVerdict.sentinel.status === 'WARNING'
                      ? 'warning'
                      : 'normal'
                  }`}
                  style={{ fontSize: 9, padding: '2px 7px' }}
                >
                  SENTINEL: {lastAgentVerdict.sentinel.status}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#889eb0' }}>
                <span className="mono">Audit Source: {lastAgentVerdict.source}</span>
                <span className="mono">Risk Score: <b style={{ color: lastAgentVerdict.predictor.qualityRiskScore > 50 ? '#ff8686' : '#68d7a0' }}>{lastAgentVerdict.predictor.qualityRiskScore}/100</b></span>
                <span className="mono">Shelf Life: {lastAgentVerdict.predictor.shelfLifeImpact}</span>
              </div>
            </div>

            {/* Violations List */}
            {lastAgentVerdict.sentinel.violations.length > 0 && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', borderRadius: 4, borderLeft: '3px solid #ef4444' }}>
                {lastAgentVerdict.sentinel.violations.map((v, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.4 }}>
                    • {v}
                  </div>
                ))}
              </div>
            )}

            {/* Predictive Recommendation */}
            <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5, background: 'rgba(15, 23, 42, 0.4)', padding: '6px 10px', borderRadius: 4 }}>
              <b style={{ color: '#38d3e9' }}>Predictor Directive: </b>
              {lastAgentVerdict.predictor.recommendation}
            </div>
          </div>
        )}

        {/* Live Segment-by-Segment Processing Feed */}
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setShowConsole(!showConsole)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Terminal size={14} color="#38d3e9" />
              <strong style={{ fontSize: 11, color: '#e2e8f0', letterSpacing: '0.04em' }}>
                LIVE AGENT EXECUTION FEED (1 EXCEL ROW PER SEGMENT)
              </strong>
              {segmentLogs.length > 0 && (
                <span className="mono" style={{ fontSize: 10, color: '#38d3e9', background: '#0e2438', padding: '1px 7px', borderRadius: 4 }}>
                  Segment {currentStep} of {totalSteps}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {segmentLogs.length > 0 && (
                <button
                  className="btn ghost"
                  style={{ fontSize: 9, padding: '2px 7px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSegmentLogs([]);
                  }}
                >
                  Clear Feed
                </button>
              )}
              <span style={{ color: '#7b8f9e', display: 'flex', alignItems: 'center' }}>
                {showConsole ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </div>
          </div>

          {showConsole && (
            <div
              style={{
                background: '#070d16',
                border: '1px solid #1a2f45',
                borderRadius: 6,
                padding: '12px 14px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 11,
                maxHeight: 220,
                overflowY: 'auto',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
              }}
              data-testid="console-segment-feed"
            >
              {segmentLogs.length === 0 ? (
                <div style={{ color: '#64748b', fontStyle: 'italic', padding: '6px 0' }}>
                  Awaiting playback… Click "Play" or "Next Step", or upload any external Excel (.xlsx/.csv) dataset to stream row-by-row agent execution.
                </div>
              ) : (
                segmentLogs.map((log) => {
                  const hasViolation = log.verdict?.sentinel.status === 'VIOLATION';
                  const tempColor = log.temperature > -15 ? '#ef4444' : log.temperature > -18 ? '#f59e0b' : '#38bdf8';
                  return (
                    <div
                      key={log.stepIndex}
                      style={{
                        marginBottom: 10,
                        paddingBottom: 8,
                        borderBottom: '1px dashed #142333',
                        background: hasViolation ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                        padding: hasViolation ? '6px 8px' : '2px 0',
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ color: '#c084fc', fontWeight: 'bold' }}>
                        &gt;&gt;&gt; Running segment {log.stepIndex} comprising of 1 excel row (Row {log.stepIndex} of {log.totalSteps})...
                      </div>
                      <div style={{ color: '#94a3b8', paddingLeft: 14 }}>
                        ├── 📊 Telemetry: Temp: <span style={{ color: tempColor, fontWeight: 'bold' }}>{log.temperature.toFixed(1)}°C</span> | Hum: {log.humidity}% | Vib: {log.vibration.toFixed(2)}g | Bat: {log.batteryLevel}% | Unit: {log.coolingUnitStatus}
                      </div>
                      {log.verdict && (
                        <>
                          <div
                            style={{
                              color: hasViolation ? '#f87171' : '#4ade80',
                              paddingLeft: 14,
                              fontWeight: hasViolation ? 'bold' : 'normal',
                            }}
                          >
                            ├── 🛡️ [Sentinel Agent]: {log.verdict.sentinel.status}
                            {log.verdict.sentinel.violations[0] ? ` — ${log.verdict.sentinel.violations[0]}` : ' — All parameters within HACCP bounds (Temp <= -18°C)'}
                          </div>
                          <div style={{ color: '#38d3e9', paddingLeft: 14 }}>
                            └── 📈 [Quality Predictor]: Risk {log.verdict.predictor.qualityRiskScore}/100 ({log.verdict.predictor.shelfLifeImpact}) • Directive: {log.verdict.predictor.recommendation.slice(0, 115)}...
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={consoleBottomRef} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
