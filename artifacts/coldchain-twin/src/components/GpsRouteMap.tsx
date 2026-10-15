import { useMemo } from 'react';
import { Navigation, MapPin, Compass, ShieldAlert, Activity } from 'lucide-react';
import type { TelemetryPoint } from '../types/simulation';

interface GpsRouteMapProps {
  activePoint: TelemetryPoint | null;
  routeCoordinates: [number, number][];
}

export function GpsRouteMap({ activePoint, routeCoordinates }: GpsRouteMapProps) {
  const currentLat = activePoint?.latitude ?? 19.076;
  const currentLng = activePoint?.longitude ?? 72.8807;
  const speed = activePoint?.speed_kmh ?? 0;
  const shock = activePoint?.shock_g ?? activePoint?.vibration ?? 0.15;

  // Compute SVG projection bounds for polyline
  const { pathD, pointsWithSvgCoords, currentSvgPos } = useMemo(() => {
    const defaultCoords: [number, number][] =
      routeCoordinates.length > 0 ? routeCoordinates : [[currentLat, currentLng]];

    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;

    for (const [lat, lng] of defaultCoords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    // Add padding if points are identical or range is tiny
    const latSpan = Math.max(0.005, maxLat - minLat);
    const lngSpan = Math.max(0.005, maxLng - minLng);

    const width = 460;
    const height = 180;
    const padding = 24;

    const toSvgX = (lng: number) =>
      padding + ((lng - (minLng - lngSpan * 0.1)) / (lngSpan * 1.2)) * (width - 2 * padding);

    const toSvgY = (lat: number) =>
      height - padding - ((lat - (minLat - latSpan * 0.1)) / (latSpan * 1.2)) * (height - 2 * padding);

    const projected = defaultCoords.map(([lat, lng]) => ({
      x: toSvgX(lng),
      y: toSvgY(lat),
      lat,
      lng,
    }));

    const pathString = projected.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }, '');

    const currentPos = {
      x: toSvgX(currentLng),
      y: toSvgY(currentLat),
    };

    return { pathD: pathString, pointsWithSvgCoords: projected, currentSvgPos: currentPos };
  }, [routeCoordinates, currentLat, currentLng]);

  return (
    <div
      className="panel gps-card"
      data-testid="panel-gps-route"
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Navigation size={15} color="#38bdf8" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
            Live Telematics &amp; Transit Polyline
          </span>
          <span
            className="live-dot"
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }}
          />
        </div>
        <div className="mono" style={{ fontSize: 11, color: '#7dd3fc' }}>
          {currentLat.toFixed(5)}°N, {currentLng.toFixed(5)}°E
        </div>
      </div>

      <div style={{ position: 'relative', height: 180, background: '#08111b' }}>
        {/* SVG Polyline Route */}
        <svg
          viewBox="0 0 460 180"
          style={{ width: '100%', height: '100%', display: 'block' }}
          role="img"
          aria-label="GPS Route Polyline"
        >
          <defs>
            <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
            </linearGradient>
            <filter id="glow-route" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1="45" x2="460" y2="45" stroke="#122334" strokeDasharray="3 4" />
          <line x1="0" y1="90" x2="460" y2="90" stroke="#122334" strokeDasharray="3 4" />
          <line x1="0" y1="135" x2="460" y2="135" stroke="#122334" strokeDasharray="3 4" />
          <line x1="115" y1="0" x2="115" y2="180" stroke="#122334" strokeDasharray="3 4" />
          <line x1="230" y1="0" x2="230" y2="180" stroke="#122334" strokeDasharray="3 4" />
          <line x1="345" y1="0" x2="345" y2="180" stroke="#122334" strokeDasharray="3 4" />

          {/* Polyline Route Path */}
          {pathD && (
            <>
              <path
                d={pathD}
                fill="none"
                stroke="#0284c7"
                strokeWidth="4"
                strokeOpacity="0.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pathD}
                fill="none"
                stroke="url(#routeGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glow-route)"
              />
            </>
          )}

          {/* Waypoint dots */}
          {pointsWithSvgCoords.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={i === 0 ? 3.5 : 1.5}
              fill={i === 0 ? '#34d399' : '#0284c7'}
              opacity={0.8}
            />
          ))}

          {/* Current Vehicle Position Marker */}
          <g transform={`translate(${currentSvgPos.x}, ${currentSvgPos.y})`}>
            <circle r="9" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6" className="alarm-pulse" />
            <circle r="5" fill="#38bdf8" />
            <circle r="2" fill="#ffffff" />
          </g>
        </svg>

        {/* HUD Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 12,
            right: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(9, 19, 29, 0.85)',
            border: '1px solid #1c354c',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ color: '#94a3b8' }}>
              Speed: <b className="mono" style={{ color: '#f1f5f9' }}>{speed.toFixed(0)} km/h</b>
            </span>
            <span style={{ color: '#94a3b8' }}>
              Impact Shock:{' '}
              <b className="mono" style={{ color: shock > 1.2 ? '#ef4444' : '#34d399' }}>
                {shock.toFixed(2)} g
              </b>
            </span>
          </div>
          <div className="mono" style={{ color: '#38bdf8' }}>
            {routeCoordinates.length} waypoints recorded
          </div>
        </div>
      </div>
    </div>
  );
}
