import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { TelemetryPoint } from '../types/simulation';

interface TelemetryTimelineChartProps {
  history: TelemetryPoint[];
}

export function TelemetryTimelineChart({ history }: TelemetryTimelineChartProps) {
  // Ensure we keep the most recent 25-30 data points for smooth line rendering
  const displayData = (history.length > 30 ? history.slice(-30) : history).map((pt, idx) => {
    const timeLabel = pt.timestamp
      ? pt.timestamp.length >= 19
        ? pt.timestamp.slice(11, 19)
        : pt.timestamp
      : `Step ${pt.stepIndex || idx + 1}`;

    const cargo = pt.cargo_temperature ?? pt.temperature ?? -20;
    const ambient = pt.ambient_temperature ?? 30;
    const humidity = pt.humidity_rh ?? pt.humidity ?? 65;
    const setpoint = pt.setpoint_temperature ?? -20;

    return {
      time: timeLabel,
      step: pt.stepIndex || idx + 1,
      cargo,
      ambient,
      humidity,
      setpoint,
      cooling: pt.cooling_status || pt.coolingUnitStatus || 'OPTIMAL',
      shock: pt.shock_g ?? pt.vibration ?? 0.15,
      battery: pt.battery_level ?? pt.batteryLevel ?? 95,
      door: pt.door_open ? 'OPEN' : 'CLOSED',
    };
  });

  return (
    <div
      className="panel"
      data-testid="panel-telemetry-timeline"
      style={{
        background: '#0d1825',
        border: '1px solid #1a2f44',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="panel-head"
        style={{
          borderBottom: '1px solid #192a3c',
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
              Temperature &amp; Humidity Telemetry Timeline
            </span>
            <span className="live-dot" style={{ background: '#38bdf8' }} />
          </div>
          <div className="panel-sub" style={{ fontSize: 11, color: '#64748b' }}>
            Real-time rolling window (Last {displayData.length} data points)
          </div>
        </div>

        <div className="chart-legend" style={{ fontSize: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 2, background: '#38bdf8' }} />
            Cargo Temp (°C)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 2, background: '#f59e0b' }} />
            Ambient Temp (°C)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 2, background: '#34d399' }} />
            Humidity (% RH)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 2, background: '#ef4444', borderBottom: '1px dashed #ef4444' }} />
            Setpoint (-20°C)
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 240, padding: '10px 10px 0 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="cargoAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="ambientAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#1e293b" strokeDasharray="3 4" vertical={false} />

            <XAxis
              dataKey="time"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#1e293b' }}
              interval="preserveStartEnd"
            />

            <YAxis
              yAxisId="temp"
              domain={[-26, 42]}
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}°C`}
            />

            <YAxis
              yAxisId="humidity"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: '#34d399', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0]?.payload;
                  return (
                    <div
                      style={{
                        background: '#0b1622',
                        border: '1px solid #1e3a53',
                        borderRadius: 6,
                        padding: '8px 12px',
                        color: '#f1f5f9',
                        fontSize: 11,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                      }}
                    >
                      <div className="mono" style={{ color: '#94a3b8', marginBottom: 4 }}>
                        Time: {label} (Step {data?.step})
                      </div>
                      <div style={{ color: '#38bdf8', fontWeight: 600 }}>
                        Payload Temp: {data?.cargo?.toFixed(1)}°C
                      </div>
                      <div style={{ color: '#f59e0b' }}>
                        Ambient Temp: {data?.ambient?.toFixed(1)}°C
                      </div>
                      <div style={{ color: '#34d399' }}>
                        Humidity RH: {data?.humidity?.toFixed(1)}%
                      </div>
                      <div style={{ color: '#94a3b8', marginTop: 4, fontSize: 10 }}>
                        Cooling: {data?.cooling} | Door: {data?.door} | Battery: {data?.battery}%
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Threshold line for target setpoint */}
            <ReferenceLine
              yAxisId="temp"
              y={-20}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: 'TARGET -20°C', fill: '#ef4444', fontSize: 9, position: 'insideBottomLeft' }}
            />

            {/* Warning line: Setpoint + 2.0 = -18°C */}
            <ReferenceLine
              yAxisId="temp"
              y={-18}
              stroke="#f59e0b"
              strokeDasharray="2 3"
              strokeWidth={1}
              label={{ value: 'BREACH > -18°C', fill: '#f59e0b', fontSize: 9, position: 'insideTopLeft' }}
            />

            {/* Ambient Area/Line */}
            <Area
              yAxisId="temp"
              type="monotone"
              dataKey="ambient"
              stroke="#f59e0b"
              strokeWidth={1.5}
              fill="url(#ambientAreaGrad)"
              isAnimationActive={false}
            />

            {/* Cargo Payload Temp Area/Line */}
            <Area
              yAxisId="temp"
              type="monotone"
              dataKey="cargo"
              stroke="#38bdf8"
              strokeWidth={2.5}
              fill="url(#cargoAreaGrad)"
              activeDot={{ r: 5, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 1.5 }}
              isAnimationActive={false}
            />

            {/* Humidity Line on Secondary Axis */}
            <Line
              yAxisId="humidity"
              type="monotone"
              dataKey="humidity"
              stroke="#34d399"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
