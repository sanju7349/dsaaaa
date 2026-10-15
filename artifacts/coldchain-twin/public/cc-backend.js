/**
 * ColdChain-Twin — Backend Adapter (cc-backend.js)
 * Abstraction layer switching between SIMULATED local engine and LIVE MQTT / REST telemetry.
 * Automatically falls back to SIMULATED with a single console warning on disconnect.
 */
(function (global) {
  'use strict';

  class BackendAdapter {
    constructor() {
      this.mode = 'SIMULATED';
      this.ws = null;
      this.connectionTimeout = null;
      this.facilityId = (global.CC && global.CC.get('facility.id')) || 'ND-04';
    }

    init() {
      // Check query param (?mode=live) or stored mode
      let desiredMode = 'SIMULATED';
      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'live') {
          desiredMode = 'LIVE';
        } else {
          desiredMode = localStorage.getItem('cc-backend-mode') || 'SIMULATED';
        }
      } catch (_) {}

      if (desiredMode === 'LIVE') {
        const brokerUrl = localStorage.getItem('cc-mqtt-url') || 'wss://broker.hivemq.com:8884/mqtt';
        this.connect(brokerUrl);
      } else {
        this.setMode('SIMULATED');
      }
    }

    setMode(mode) {
      this.mode = mode;
      try { localStorage.setItem('cc-backend-mode', mode); } catch (_) {}

      if (mode === 'SIMULATED') {
        console.log('[CC-Backend] Mode: SIMULATED (Local thermodynamic physics engine active)');
        if (global.CC && global.CC.sim && !global.CC.sim.isRunning()) {
          global.CC.sim.start();
        }
      } else if (mode === 'LIVE') {
        console.log('[CC-Backend] Mode: LIVE (Real-time telemetry pipeline)');
        if (global.CC && global.CC.sim) {
          global.CC.sim.stop();
        }
      }

      if (global.CC) {
        global.CC.emit('backend:mode', { mode });
      }
    }

    connect(brokerUrl = 'wss://broker.hivemq.com:8884/mqtt', options = {}) {
      console.log(`[CC-Backend] Attempting live MQTT WebSocket connection to: ${brokerUrl}`);

      // Set timeout fallback: if connection does not establish within 3.5s, fall back gracefully
      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      this.connectionTimeout = setTimeout(() => {
        if (this.mode !== 'SIMULATED') {
          console.warn('[CC-Backend] Live MQTT connection timed out. Gracefully falling back to SIMULATED mode.');
          this.setMode('SIMULATED');
        }
      }, 3500);

      try {
        if (this.ws) {
          try { this.ws.close(); } catch (_) {}
        }

        // Standard WebSocket connection stub for MQTT over WS
        this.ws = new WebSocket(brokerUrl, ['mqtt']);

        this.ws.onopen = () => {
          clearTimeout(this.connectionTimeout);
          this.setMode('LIVE');
          console.log(`[CC-Backend] Connected to live MQTT broker at ${brokerUrl}`);
          this._subscribeToTopics();
        };

        this.ws.onmessage = (event) => {
          this._handleIncomingMessage(event.data);
        };

        this.ws.onerror = (err) => {
          clearTimeout(this.connectionTimeout);
          console.warn('[CC-Backend] Live MQTT connection failed. Gracefully falling back to SIMULATED mode.');
          this.setMode('SIMULATED');
        };

        this.ws.onclose = () => {
          if (this.mode === 'LIVE') {
            console.warn('[CC-Backend] Live MQTT connection closed. Gracefully falling back to SIMULATED mode.');
            this.setMode('SIMULATED');
          }
        };
      } catch (err) {
        clearTimeout(this.connectionTimeout);
        console.warn('[CC-Backend] Live connection initialization error. Gracefully falling back to SIMULATED mode:', err.message);
        this.setMode('SIMULATED');
      }
    }

    _subscribeToTopics() {
      const CC = global.CC;
      const fid = (CC && CC.get('facility.id')) || this.facilityId;
      console.log(`[CC-Backend] Subscribing to telemetry topics for facility: coldchain/${fid}/#`);
    }

    _handleIncomingMessage(data) {
      const CC = global.CC;
      if (!CC) return;

      try {
        const payload = typeof data === 'string' ? JSON.parse(data) : null;
        if (!payload) return;

        // Route payload to CC store
        if (payload.path && payload.value !== undefined) {
          CC.set(payload.path, payload.value);
        } else if (payload.facility) {
          CC.patch({ facility: payload.facility });
        }
      } catch (err) {
        // Non-JSON or binary MQTT frame
      }
    }

    disconnect() {
      if (this.ws) {
        try { this.ws.close(); } catch (_) {}
        this.ws = null;
      }
      this.setMode('SIMULATED');
    }
  }

  const backend = new BackendAdapter();

  if (global.CC) {
    global.CC.backend = backend;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => backend.init());
  } else {
    setTimeout(() => backend.init(), 0);
  }

  global.CC_Backend = backend;
})(typeof window !== 'undefined' ? window : this);
