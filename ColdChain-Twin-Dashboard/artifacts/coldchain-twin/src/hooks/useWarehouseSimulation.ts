import { useEffect, useState } from 'react';

export type Zone = { id: string; name: string; temp: number; target: number; compressor: string; risk: number };

export function useWarehouseSimulation() {
  const [load, setLoad] = useState(248);
  const [zones, setZones] = useState<Zone[]>([
    { id: 'A', name: 'Ice Cream Vault', temp: -18, target: -18, compressor: 'COMP-01', risk: 18 },
    { id: 'B', name: 'Frozen Meat & Seafood', temp: -20, target: -20, compressor: 'COMP-02', risk: 64 },
    { id: 'C', name: 'Deep-Freeze Pharmaceuticals', temp: -22, target: -22, compressor: 'COMP-03', risk: 9 },
  ]);
  const [breach, setBreach] = useState(false);
  const [optimized, setOptimized] = useState(false);
  useEffect(() => { if (breach) setLoad(290); }, [breach]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLoad(breach ? 290 : Math.round(245 + Math.random() * 10));
      setZones((previous) => previous.map((zone) => {
        if (breach && zone.id === 'A') return { ...zone, temp: Math.min(-14, Number((zone.temp + 0.2).toFixed(1))), risk: 94 };
        const target = optimized && zone.id !== 'C' ? zone.target - 0.4 : zone.target;
        const jitter = (Math.random() - 0.5) * 0.4;
        return { ...zone, temp: Number((target + jitter).toFixed(1)) };
      }));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [breach, optimized]);
  return { load, zones, breach, setBreach, optimized, setOptimized, setZones };
}
