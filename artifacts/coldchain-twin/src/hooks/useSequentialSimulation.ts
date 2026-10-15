import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  TelemetryPoint,
  SimulationStatus,
  AgentVerdict,
  AlertPayload,
} from '../types/simulation';

interface UseSequentialSimulationOptions {
  onAlert?: (alert: AlertPayload, point: TelemetryPoint) => void;
}

export function useSequentialSimulation(options?: UseSequentialSimulationOptions) {
  const [status, setStatus] = useState<SimulationStatus>({
    state: 'IDLE',
    isPlaying: false,
    currentIndex: 0,
    currentStep: 0,
    totalRecords: 0,
    totalSteps: 0,
    intervalMs: 1000,
    speed: 1.0,
    progressPercent: 0,
    activeRecord: null,
    activePayload: null,
    lastAgentVerdict: null,
    alert: null,
  });

  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [currentAlert, setCurrentAlert] = useState<AlertPayload | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const lastAlertTimestampRef = useRef<string>('');
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Sync routeCoordinates and history with a new telemetry point
  const handleIncomingPoint = useCallback((point: TelemetryPoint, alert?: AlertPayload | null) => {
    setHistory((prev) => {
      const exists = prev.some((p) => p.stepIndex === point.stepIndex);
      if (exists) return prev;
      return [...prev.slice(-29), point];
    });

    if (point.latitude && point.longitude) {
      setRouteCoordinates((prev) => {
        const last = prev[prev.length - 1];
        if (last && last[0] === point.latitude && last[1] === point.longitude) {
          return prev;
        }
        return [...prev, [point.latitude, point.longitude]];
      });
    }

    if (alert && alert.message !== lastAlertTimestampRef.current) {
      lastAlertTimestampRef.current = alert.message;
      setCurrentAlert(alert);
      optionsRef.current?.onAlert?.(alert, point);
    }
  }, []);

  // Poll status on initial mount
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/simulation/status');
      if (res.ok) {
        const data: SimulationStatus = await res.json();
        setStatus(data);
        if (data.recentHistory && Array.isArray(data.recentHistory) && data.recentHistory.length > 0) {
          setHistory(data.recentHistory.slice(-30));
          const coords: [number, number][] = data.recentHistory
            .filter((p) => p.latitude && p.longitude)
            .map((p) => [p.latitude, p.longitude]);
          if (coords.length > 0) {
            setRouteCoordinates(coords);
          }
        } else {
          const record = data.activeRecord || data.activePayload;
          if (record) {
            handleIncomingPoint(record, data.alert);
          }
        }
      }
    } catch (_) {
      // Backend may be starting
    }
  }, [handleIncomingPoint]);

  // Establish SSE connection
  useEffect(() => {
    fetchStatus();

    const connectSSE = () => {
      try {
        const sse = new EventSource('/api/simulation/stream');
        eventSourceRef.current = sse;

        sse.onopen = () => {
          setIsConnected(true);
          setErrorMessage(null);
        };

        const handleTelemetryEvent = (raw: string) => {
          try {
            const payload = JSON.parse(raw);
            const point: TelemetryPoint = payload.row || payload.data || payload.step;
            const newStatus: SimulationStatus | undefined = payload.status;
            const alert: AlertPayload | null = payload.alert || null;
            const verdict: AgentVerdict | null = payload.verdict || null;

            if (newStatus) {
              setStatus((prev) => ({
                ...prev,
                ...newStatus,
                activeRecord: point || newStatus.activeRecord,
                activePayload: point || newStatus.activePayload,
                lastAgentVerdict: verdict || newStatus.lastAgentVerdict || prev.lastAgentVerdict,
                alert: alert || newStatus.alert,
              }));
            } else if (point) {
              setStatus((prev) => ({
                ...prev,
                activeRecord: point,
                activePayload: point,
                lastAgentVerdict: verdict || prev.lastAgentVerdict,
                alert,
              }));
            }

            if (point) {
              handleIncomingPoint(point, alert);
            }
          } catch (_) {}
        };

        sse.addEventListener('status', (e: MessageEvent) => {
          try {
            const newStatus: SimulationStatus = JSON.parse(e.data);
            setStatus(newStatus);
            if (newStatus.recentHistory && Array.isArray(newStatus.recentHistory) && newStatus.recentHistory.length > 0) {
              setHistory(newStatus.recentHistory.slice(-30));
              const coords: [number, number][] = newStatus.recentHistory
                .filter((p) => p.latitude && p.longitude)
                .map((p) => [p.latitude, p.longitude]);
              if (coords.length > 0) {
                setRouteCoordinates(coords);
              }
            } else {
              const record = newStatus.activeRecord || newStatus.activePayload;
              if (record) {
                handleIncomingPoint(record, newStatus.alert);
              }
            }
          } catch (_) {}
        });

        sse.addEventListener('history', (e: MessageEvent) => {
          try {
            const list: TelemetryPoint[] = JSON.parse(e.data);
            if (Array.isArray(list) && list.length > 0) {
              setHistory(list.slice(-30));
              const coords: [number, number][] = list
                .filter((p) => p.latitude && p.longitude)
                .map((p) => [p.latitude, p.longitude]);
              if (coords.length > 0) {
                setRouteCoordinates(coords);
              }
            }
          } catch (_) {}
        });

        sse.addEventListener('telemetry', (e: MessageEvent) => {
          handleTelemetryEvent(e.data);
        });

        sse.onmessage = (e: MessageEvent) => {
          handleTelemetryEvent(e.data);
        };

        sse.addEventListener('alert', (e: MessageEvent) => {
          try {
            const alert: AlertPayload = JSON.parse(e.data);
            setCurrentAlert(alert);
          } catch (_) {}
        });

        sse.addEventListener('agent', (e: MessageEvent) => {
          try {
            const verdict: AgentVerdict = JSON.parse(e.data);
            setStatus((prev) => ({
              ...prev,
              lastAgentVerdict: verdict,
            }));
          } catch (_) {}
        });

        sse.onerror = () => {
          setIsConnected(false);
        };
      } catch (err: any) {
        setIsConnected(false);
        setErrorMessage(err?.message || 'Failed to connect to simulation stream');
      }
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [fetchStatus, handleIncomingPoint]);

  // Simulation controls
  const play = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await fetch('/api/simulation/play', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to play simulation');
      if (data.status) setStatus(data.status);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Play failed');
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await fetch('/api/simulation/pause', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to pause simulation');
      if (data.status) setStatus(data.status);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Pause failed');
    }
  }, []);

  const step = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await fetch('/api/simulation/step', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to advance step');
      if (data.status) setStatus(data.status);
      if (data.record) {
        handleIncomingPoint(data.record, data.status?.alert);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Step failed');
    }
  }, [handleIncomingPoint]);

  const reset = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await fetch('/api/simulation/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset simulation');
      if (data.status) setStatus(data.status);
      setHistory([]);
      setRouteCoordinates([]);
      setCurrentAlert(null);
      lastAlertTimestampRef.current = '';
    } catch (err: any) {
      setErrorMessage(err?.message || 'Reset failed');
    }
  }, []);

  const setSpeedPreset = useCallback(async (preset: '0.5x' | '1x' | '2x' | '4x') => {
    const map = {
      '0.5x': 2000,
      '1x': 1000,
      '2x': 500,
      '4x': 250,
    };
    const intervalMs = map[preset] || 1000;
    try {
      setErrorMessage(null);
      const res = await fetch('/api/simulation/speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMs }),
      });
      const data = await res.json();
      if (data.status) setStatus(data.status);
    } catch (_) {}
  }, []);

  const setSpeed = useCallback(async (speedValue: number) => {
    try {
      setErrorMessage(null);
      const res = await fetch('/api/simulation/speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed: speedValue }),
      });
      const data = await res.json();
      if (data.status) setStatus(data.status);
    } catch (_) {}
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    try {
      setIsUploading(true);
      setErrorMessage(null);
      const formData = new FormData();
      formData.append('dataset', file);

      const res = await fetch('/api/dataset/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Upload failed');
      }

      if (data.status) {
        setStatus(data.status);
      }
      setHistory(data.preview ? [data.preview] : []);
      if (data.preview?.latitude && data.preview?.longitude) {
        setRouteCoordinates([[data.preview.latitude, data.preview.longitude]]);
      } else {
        setRouteCoordinates([]);
      }
      return data;
    } catch (err: any) {
      setErrorMessage(err?.message || 'Upload error');
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const loadLocal = useCallback(async (filePath?: string) => {
    try {
      setErrorMessage(null);
      const res = await fetch('/api/simulation/load-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load local dataset');
      if (data.status) setStatus(data.status);
      if (data.preview) {
        setHistory([data.preview]);
        if (data.preview.latitude && data.preview.longitude) {
          setRouteCoordinates([[data.preview.latitude, data.preview.longitude]]);
        }
      }
      return data;
    } catch (err: any) {
      setErrorMessage(err?.message || 'Load local failed');
      throw err;
    }
  }, []);

  const dismissAlert = useCallback(() => {
    setCurrentAlert(null);
  }, []);

  return {
    status,
    history,
    routeCoordinates,
    currentAlert,
    dismissAlert,
    isConnected,
    isUploading,
    errorMessage,
    play,
    start: play, // backward compatibility
    pause,
    step,
    reset,
    setSpeedPreset,
    setSpeed,
    uploadFile,
    loadLocal,
    refreshStatus: fetchStatus,
  };
}
