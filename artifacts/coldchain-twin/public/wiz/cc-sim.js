/**
 * ColdChain-Twin — Thermodynamic Simulation Engine (cc-sim.js)
 * Master 1 Hz physics loop modeling heat ingress, door events,
 * compressor cycles, power draw, and carbon intensity.
 */
(function (global) {
  'use strict';

  let tickInterval = null;
  let tickCounter = 0;

  const SimEngine = {
    isRunning() {
      return tickInterval !== null;
    },

    start() {
      if (this.isRunning()) return;
      tickInterval = setInterval(() => this.tick(), 1000);
      console.log('[CC-Sim] Thermodynamic simulation engine started (1 Hz).');
      if (global.CC) global.CC.emit('sim:started');
    },

    stop() {
      if (!this.isRunning()) return;
      clearInterval(tickInterval);
      tickInterval = null;
      console.log('[CC-Sim] Thermodynamic simulation engine paused.');
      if (global.CC) global.CC.emit('sim:stopped');
    },

    tick() {
      const CC = global.CC;
      if (!CC) return;

      tickCounter++;

      const ambient = parseFloat(CC.get('facility.ambient') ?? CC.get('simulation.ambient') ?? 32);
      const humidity = parseFloat(CC.get('facility.humidity') ?? 78);
      const zones = CC.get('facility.zones') || [];
      const bay3DoorOpen = Boolean(CC.get('simulation.bay3DoorOpen'));
      const applied = Boolean(CC.get('simulation.applied'));
      const strategy = CC.get('simulation.strategy') || 'Off-Peak Night Shift';
      let doorSeconds = parseInt(CC.get('simulation.doorOpenSeconds') || 0, 10);

      // 1. Advance door open timer if Bay 3 is open
      if (bay3DoorOpen) {
        doorSeconds++;
        CC.set('simulation.doorOpenSeconds', doorSeconds, { silent: true });
        CC.set('cameraFeeds.CAM-03.doorSeconds', doorSeconds, { silent: true });

        // Check door open threshold for alerts
        const threshold = parseInt(CC.get('facility.alarmDoor') || 20, 10);
        if (doorSeconds >= threshold) {
          const alerts = CC.get('alerts') || [];
          const existing = alerts.find((a) => a.id === 'BAY-03');
          if (!existing) {
            const newAlert = {
              id: 'BAY-03',
              severity: 'warning',
              title: `Bay 3 loading door open ${doorSeconds}s during peak ambient heat (+${ambient}°C outside)`,
              zone: 'C',
              ageSec: doorSeconds,
              dismissed: false
            };
            alerts.unshift(newAlert);
            CC.set('alerts', alerts);
            CC.emit('alert:created', newAlert);
          } else {
            existing.ageSec = doorSeconds;
            existing.title = `Bay 3 loading door open ${doorSeconds}s during peak ambient heat (+${ambient}°C outside)`;
          }
        }
      }

      // 2. Realistic Zone Temperature Fluctuation
      const updatedZones = zones.map((z) => {
        const zone = { ...z };
        const target = parseFloat(zone.target ?? -18);

        // Natural micro-fluctuation
        const jitter = (Math.random() - 0.49) * 0.08;
        zone.temp = parseFloat((zone.temp + jitter).toFixed(2));

        // Heat ingress on Zone C if Bay 3 is open
        if (zone.id === 'C' && bay3DoorOpen) {
          const ingressDelta = Math.max(0.02, (ambient - zone.temp) * 0.0012);
          zone.temp = parseFloat((zone.temp + ingressDelta).toFixed(2));
          // If warming past warn threshold
          if (zone.temp > (zone.warn ?? -19.0)) {
            zone.status = 'alert';
          } else {
            zone.status = 'warning';
          }
        } else if (zone.id === 'C' && !bay3DoorOpen) {
          // Slowly cooling back down toward target
          if (zone.temp > target) {
            zone.temp = parseFloat((zone.temp - 0.04).toFixed(2));
          }
          if (zone.temp <= target + 0.5) {
            zone.status = 'normal';
          }
        } else if (zone.id === 'D') {
          if (zone.temp > target + 0.2) {
            zone.temp = parseFloat((zone.temp - 0.02).toFixed(2));
          }
        }

        // Apply optimization cooling setpoint reduction if applied
        if (applied && (zone.id === 'A' || zone.id === 'B')) {
          const optTarget = target - 0.4;
          if (zone.temp > optTarget) {
            zone.temp = parseFloat((zone.temp - 0.02).toFixed(2));
          }
        }

        return zone;
      });

      CC.set('facility.zones', updatedZones, { silent: true });

      // 3. Every 5 ticks: Recompute compressor duty, total kW power draw, CO2 intensity
      if (tickCounter % 5 === 0) {
        let basePower = 220;

        // Ambient load factor
        const ambientFactor = Math.max(0, (ambient - 20) * 1.3);
        basePower += ambientFactor;

        // Door ingress load penalty
        if (bay3DoorOpen) {
          basePower += 28.5 + Math.min(15, doorSeconds * 0.15);
        }

        // Strategy optimization discount
        if (applied) {
          const discountPct = strategy === 'Off-Peak Night Shift' ? 0.143 : 0.09;
          basePower = basePower * (1 - discountPct);
        }

        // Small noise
        basePower += (Math.random() - 0.5) * 2.2;
        const totalLoad = Math.round(Math.max(190, Math.min(310, basePower)));
        const co2Intensity = parseFloat((totalLoad * 0.0192).toFixed(1));

        CC.set('facility.totalLoad', totalLoad, { silent: true });
        CC.set('facility.co2Intensity', co2Intensity, { silent: true });

        // Update compressor telemetry
        const comps = CC.get('facility.compressors') || [];
        const updatedComps = comps.map((c) => {
          const comp = { ...c };
          if (comp.id === 'CMP-02') {
            comp.dutyCycle = bay3DoorOpen ? 82 : 72;
            comp.powerKw = Math.round(totalLoad * 0.38);
            comp.status = bay3DoorOpen ? 'overdrive' : 'normal';
          } else if (comp.id === 'CMP-01') {
            comp.dutyCycle = applied ? 62 : 68;
            comp.powerKw = Math.round(totalLoad * 0.31);
          } else {
            comp.dutyCycle = Math.round(65 + (Math.random() - 0.5) * 5);
            comp.powerKw = Math.round(totalLoad * 0.31);
          }
          return comp;
        });
        CC.set('facility.compressors', updatedComps, { silent: true });

        // Periodically emit camera detection events
        if (bay3DoorOpen && tickCounter % 15 === 0) {
          CC.emit('camera:event', {
            cameraId: 'CAM-03',
            type: 'THERMAL_INGRESS',
            details: `Airflow loss -15% detected at Aisle 2 return duct. Door open ${doorSeconds}s.`,
            timestamp: Date.now()
          });
        }
      }

      // 4. Update sensor calibration timestamps
      const sensors = CC.get('facility.sensors');
      if (Array.isArray(sensors)) {
        CC.set('facility.sensors', sensors, { silent: true });
      }

      // Notify subscribers and update shared DOM slots
      CC.updateSharedSlots();
      if (tickCounter % 5 === 1) {
        console.log(`[CC-Sim] Tick #${tickCounter} · Total Load: ${CC.get('facility.totalLoad')} kW · Bay 3: ${bay3DoorOpen ? 'OPEN (' + doorSeconds + 's)' : 'CLOSED'}`);
      }
      CC.emit('sim:tick', {
        tick: tickCounter,
        ambient,
        bay3DoorOpen,
        doorSeconds,
        totalLoad: CC.get('facility.totalLoad'),
        zones: updatedZones
      });
    }
  };

  if (global.CC) {
    global.CC.sim = SimEngine;
  }

  // Auto-start simulation engine when document is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      SimEngine.start();
    });
  } else {
    setTimeout(() => {
      SimEngine.start();
    }, 0);
  }

  global.CC_Sim = SimEngine;
})(typeof window !== 'undefined' ? window : this);
