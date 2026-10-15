import { useRef, type ChangeEvent } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Upload,
  Radio,
  Gauge,
  Thermometer,
  Activity,
  Battery,
  BatteryCharging,
  DoorOpen,
  DoorClosed,
  Navigation,
  Wind,
  AlertTriangle,
  X,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import type { TelemetryPoint, SimulationStatus, AlertPayload } from '../types/simulation';

export interface SimulationToolbarProps {
  status: SimulationStatus;
  activeTelemetry: TelemetryPoint | null;
  currentAlert: AlertPayload | null;
  isConnected: boolean;
  isUploading: boolean;
  errorMessage: string | null;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSetSpeedPreset: (preset: '0.5x' | '1x' | '2x' | '4x') => void;
  onUploadFile: (file: File) => Promise<any>;
  onLoadLocal?: () => Promise<any>;
  onDismissAlert?: () => void;
}

export function SimulationToolbar({
  status,
  activeTelemetry,
  currentAlert,
  isConnected,
  isUploading,
  errorMessage,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSetSpeedPreset,
  onUploadFile,
  onLoadLocal,
  onDismissAlert,
}: SimulationToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isPlaying, currentIndex, totalRecords, intervalMs, progressPercent } = status;
  const currentStep = totalRecords > 0 ? currentIndex + 1 : 0;

  // Determine active speed preset based on intervalMs
  const activeSpeedPreset: '0.5x' | '1x' | '2x' | '4x' =
    intervalMs >= 1800
      ? '0.5x'
      : intervalMs >= 800
      ? '1x'
      : intervalMs >= 400
      ? '2x'
      : '4x';

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUploadFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Color logic for cargo temperature
  const cargoTemp = activeTelemetry?.cargo_temperature ?? activeTelemetry?.temperature ?? -20.0;
  const setpointTemp = activeTelemetry?.setpoint_temperature ?? -20.0;
  const ambientTemp = activeTelemetry?.ambient_temperature ?? 30.0;
  const humidityRh = activeTelemetry?.humidity_rh ?? activeTelemetry?.humidity ?? 65.0;
  const coolingStatus = activeTelemetry?.cooling_status ?? activeTelemetry?.coolingUnitStatus ?? 'OPTIMAL';
  const batteryLevel = activeTelemetry?.battery_level ?? activeTelemetry?.batteryLevel ?? 95;
  const doorOpen = activeTelemetry?.door_open ?? false;
  const speedKmh = activeTelemetry?.speed_kmh ?? 0;
  const shockG = activeTelemetry?.shock_g ?? activeTelemetry?.vibration ?? 0.15;
  const lat = activeTelemetry?.latitude ?? 19.076;
  const lng = activeTelemetry?.longitude ?? 72.8807;

  const isTempCritical = cargoTemp > setpointTemp + 2.0;

  return (
    <section
      className="panel simulation-toolbar-card"
      data-testid="simulation-toolbar"
      style={{
        background: 'linear-gradient(180deg, #101c2b 0%, #0a131e 100%)',
        border: '1px solid #1e354a',
        borderRadius: 10,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45), 0 0 1px #38bdf8',
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      {/* Excursion Warning Banner */}
      {currentAlert && (
        <div
          data-testid="simulation-alert-banner"
          style={{
            background: 'linear-gradient(90deg, #7f1d1d 0%, #991b1b 100%)',
            color: '#fef2f2',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #ef4444',
            animation: 'pulse 2s infinite',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} color="#fca5a5" />
            <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '0.02em' }}>
              EXCURSION WARNING: {currentAlert.message} (Setpoint: {setpointTemp.toFixed(1)}°C)
            </span>
          </div>
          {onDismissAlert && (
            <button
              onClick={onDismissAlert}
              data-testid="button-dismiss-alert"
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                borderRadius: 4,
                padding: '3px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
              }}
            >
              <X size={13} /> Dismiss
            </button>
          )}
        </div>
      )}

      {/* Top Controls Row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 18px',
          borderBottom: '1px solid #162637',
        }}
      >
        {/* Title & Live SSE Stream Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0e7490 0%, #0369a1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(14, 116, 144, 0.4)',
            }}
          >
            <Radio size={18} color="#38bdf8" className={isPlaying ? 'animate-pulse' : ''} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', letterSpacing: '0.02em' }}>
                Customer Telemetry Playback Engine
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 600,
                  color: isConnected ? '#34d399' : '#fbbf24',
                  background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  padding: '2px 8px',
                  borderRadius: 12,
                  border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: isConnected ? '#34d399' : '#fbbf24',
                    boxShadow: isConnected ? '0 0 6px #34d399' : 'none',
                  }}
                />
                {isConnected ? 'LIVE SSE' : 'CONNECTING'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Sequential Excel/CSV Row-by-Row Player · Real-Time Twin Sync
            </div>
          </div>
        </div>

        {/* Step Indicator & Playback Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Step Counter Badge */}
          <div
            data-testid="badge-step-indicator"
            style={{
              background: '#0d1825',
              border: '1px solid #1e3a53',
              borderRadius: 6,
              padding: '5px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Step</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>
              {currentStep} / {totalRecords}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: '#64748b',
                background: '#132232',
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              {progressPercent}%
            </span>
          </div>

          {/* Speed Selector Preset Pills */}
          <div
            style={{
              display: 'inline-flex',
              background: '#0a1420',
              borderRadius: 6,
              padding: '3px',
              border: '1px solid #1c3246',
            }}
            data-testid="group-speed-pills"
          >
            {(['0.5x', '1x', '2x', '4x'] as const).map((preset) => {
              const isActive = activeSpeedPreset === preset;
              return (
                <button
                  key={preset}
                  onClick={() => onSetSpeedPreset(preset)}
                  data-testid={`speed-preset-${preset}`}
                  style={{
                    background: isActive ? '#0284c7' : 'transparent',
                    color: isActive ? '#ffffff' : '#7dd3fc',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 9px',
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {preset}
                </button>
              );
            })}
          </div>

          {/* Play/Pause Toggle */}
          {isPlaying ? (
            <button
              className="btn warning"
              onClick={onPause}
              data-testid="button-play-pause-toggle"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              <Pause size={14} />
              <span>Pause</span>
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={onPlay}
              disabled={totalRecords === 0}
              data-testid="button-play-pause-toggle"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              <Play size={14} />
              <span>Play</span>
            </button>
          )}

          {/* Step Forward Button */}
          <button
            className="btn"
            onClick={onStep}
            disabled={totalRecords === 0 || isPlaying}
            data-testid="button-step-forward"
            title="Step forward by exactly 1 row"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 12,
            }}
          >
            <SkipForward size={14} />
            <span>Step</span>
          </button>

          {/* Reset Button */}
          <button
            className="btn ghost"
            onClick={onReset}
            disabled={totalRecords === 0}
            data-testid="button-reset-playback"
            title="Reset cursor to index 0"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              fontSize: 12,
            }}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>

          {/* File Upload Input & Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.csv"
            style={{ display: 'none' }}
            id="simulation-excel-upload"
            data-testid="input-excel-file"
          />
          <button
            className="btn ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            data-testid="button-upload-excel"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderColor: '#0284c7',
              color: '#38bdf8',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Upload size={14} color="#38bdf8" />
            <span>{isUploading ? 'Ingesting…' : 'Upload Dataset'}</span>
          </button>

          {onLoadLocal && (
            <button
              className="btn ghost"
              onClick={onLoadLocal}
              data-testid="button-reload-sample"
              title="Reload default sample dataset"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 10px',
                fontSize: 11,
                color: '#94a3b8',
              }}
            >
              <FileSpreadsheet size={13} color="#34d399" />
              <span>Sample</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Ribbon */}
      <div
        style={{
          width: '100%',
          height: 4,
          background: '#0d1825',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: isTempCritical
              ? 'linear-gradient(90deg, #38bdf8, #f59e0b, #ef4444)'
              : 'linear-gradient(90deg, #0284c7, #38bdf8)',
            transition: 'width 0.2s linear',
            boxShadow: '0 0 8px rgba(56, 189, 248, 0.5)',
          }}
        />
      </div>

      {/* Sensor Gauges & Quick Telemetry Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 8,
          padding: '10px 18px',
          background: 'rgba(10, 20, 31, 0.6)',
        }}
      >
        {/* Cargo Temperature */}
        <div
          data-testid="gauge-cargo-temp"
          style={{
            background: 'rgba(15, 28, 43, 0.7)',
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${isTempCritical ? '#ef4444' : '#1e384e'}`,
          }}
        >
          <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Payload Temp</span>
            <Thermometer size={12} color={isTempCritical ? '#ef4444' : '#38bdf8'} />
          </div>
          <div
            className="mono"
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: isTempCritical ? '#ef4444' : '#38bdf8',
              marginTop: 2,
            }}
          >
            {cargoTemp.toFixed(1)}°C
          </div>
          <div style={{ fontSize: 9, color: isTempCritical ? '#fca5a5' : '#64748b' }}>
            Target: {setpointTemp.toFixed(1)}°C
          </div>
        </div>

        {/* Ambient Temperature */}
        <div
          data-testid="gauge-ambient-temp"
          style={{
            background: 'rgba(15, 28, 43, 0.7)',
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #1e384e',
          }}
        >
          <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ambient Temp</span>
            <Activity size={12} color="#fbbf24" />
          </div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#fcd34d', marginTop: 2 }}>
            {ambientTemp.toFixed(1)}°C
          </div>
          <div style={{ fontSize: 9, color: '#64748b' }}>Outside Environment</div>
        </div>

        {/* Humidity RH */}
        <div
          data-testid="gauge-humidity-rh"
          style={{
            background: 'rgba(15, 28, 43, 0.7)',
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #1e384e',
          }}
        >
          <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Relative Humidity</span>
            <Wind size={12} color="#34d399" />
          </div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#6ee7b7', marginTop: 2 }}>
            {humidityRh.toFixed(1)}%
          </div>
          <div style={{ fontSize: 9, color: '#64748b' }}>Target: 55–65% RH</div>
        </div>

        {/* Cooling Status */}
        <div
          data-testid="gauge-cooling-status"
          style={{
            background: 'rgba(15, 28, 43, 0.7)',
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #1e384e',
          }}
        >
          <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Cooling Unit</span>
            <Gauge size={12} color="#38bdf8" />
          </div>
          <div
            className="mono"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color:
                coolingStatus === 'WARNING'
                  ? '#f87171'
                  : coolingStatus === 'DEFROST'
                  ? '#fbbf24'
                  : '#34d399',
              marginTop: 4,
            }}
          >
            {coolingStatus}
          </div>
          <div style={{ fontSize: 9, color: '#64748b' }}>Refrigeration Rack</div>
        </div>

        {/* Battery & Door Status */}
        <div
          data-testid="gauge-battery-door"
          style={{
            background: 'rgba(15, 28, 43, 0.7)',
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #1e384e',
          }}
        >
          <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Battery / Door</span>
            {batteryLevel > 20 ? <Battery size={12} color="#34d399" /> : <BatteryCharging size={12} color="#ef4444" />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
              {batteryLevel}%
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: doorOpen ? '#ef4444' : '#34d399',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              {doorOpen ? <DoorOpen size={11} /> : <DoorClosed size={11} />}
              {doorOpen ? 'DOOR OPEN' : 'CLOSED'}
            </span>
          </div>
          <div style={{ fontSize: 9, color: '#64748b' }}>IoT Telematics</div>
        </div>

        {/* GPS Coordinates & Speed */}
        <div
          data-testid="gauge-gps-speed"
          style={{
            background: 'rgba(15, 28, 43, 0.7)',
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #1e384e',
          }}
        >
          <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Transit GPS / Speed</span>
            <Navigation size={12} color="#38bdf8" />
          </div>
          <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: '#7dd3fc', marginTop: 2 }}>
            {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
          </div>
          <div style={{ fontSize: 9, color: '#64748b' }}>
            {speedKmh.toFixed(0)} km/h · {shockG.toFixed(2)}g shock
          </div>
        </div>
      </div>
    </section>
  );
}
