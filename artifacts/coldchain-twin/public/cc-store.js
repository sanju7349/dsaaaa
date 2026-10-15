/**
 * ColdChain-Twin — Shared State Store (cc-store.js)
 * Exposes window.CC with reactive store, dotted-path get/set,
 * persistence, cross-tab synchronization, and auto-wired DOM slots.
 */
(function (global) {
  'use strict';

  // 1. Page Registry — maps logical page keys to physical filenames
  const PAGES = {
    overview: 'overview.html',
    cameras:  'live_camera_feeds.html',
    twin:     '3dwarehouse.html',
    energy:   'energy_simulation.html',
    copilot:  'copilot_ai.html',
    audit:    'audit_and_esg_report.html',
    config:   'facility_config.html'
  };

  const ALIASES = {
    'warehouse_twin.html': 'twin',
    '3dwarehouse.html': 'twin',
    'energy_simulations.html': 'energy',
    'energy_simulation.html': 'energy',
    'audit_esg.html': 'audit',
    'audit_and_esg_report.html': 'audit',
    'facility_config.html': 'config',
    'overview.html': 'overview',
    'live_camera_feeds.html': 'cameras',
    'copilot_ai.html': 'copilot'
  };

  const STORAGE_KEY = 'cc-twin-state-v1';

  // 2. Default Initial State
  const DEFAULTS = {
    meta: {
      sidebarCollapsed: false,
      footerCollapsed: false,
      activePage: 'overview',
      updatedAt: Date.now()
    },
    facility: {
      id: 'ND-04',
      name: 'North Dock Facility',
      region: 'Maharashtra, IN',
      timezone: 'Asia/Kolkata (IST)',
      ambient: 32.0,
      humidity: 78,
      totalLoad: 251,
      co2Intensity: 4.8,
      alarmThermal: -15.0,
      alarmDoor: 20,
      zones: [
        { id: 'A', name: 'Zone A · Ice Cream Vault', temp: -18.2, target: -18.0, warn: -15.0, crit: -12.0, doorAlarm: 30, compressor: 'CMP-01', status: 'normal', doorOpen: false },
        { id: 'B', name: 'Zone B · Frozen Meat & Seafood', temp: -20.0, target: -20.0, warn: -17.0, crit: -14.0, doorAlarm: 45, compressor: 'CMP-02', status: 'normal', doorOpen: false },
        { id: 'C', name: 'Zone C · Deep-Freeze Pharma', temp: -22.0, target: -22.0, warn: -19.0, crit: -16.0, doorAlarm: 20, compressor: 'CMP-03', status: 'warning', doorOpen: true },
        { id: 'D', name: 'Zone D · Chiller Dock', temp: 2.1, target: 2.0, warn: 4.0, crit: 6.0, doorAlarm: 60, compressor: 'CMP-04', status: 'watch', doorOpen: false }
      ],
      compressors: [
        { id: 'CMP-01', name: 'Compressor 1', zone: 'A', status: 'normal', dutyCycle: 68, powerKw: 62 },
        { id: 'CMP-02', name: 'Compressor 2', zone: 'B', status: 'overdrive', dutyCycle: 82, powerKw: 94, overdrivePct: 18 },
        { id: 'CMP-03', name: 'Compressor 3', zone: 'C', status: 'normal', dutyCycle: 74, powerKw: 75 },
        { id: 'CMP-04', name: 'Compressor 4', zone: 'D', status: 'normal', dutyCycle: 32, powerKw: 20 }
      ],
      sensors: [
        { id: 'S-101', name: 'Zone A Core Probe', zone: 'A', type: 'RTD Pt100', status: 'normal', calibratedAt: Date.now() - 3600000 },
        { id: 'S-102', name: 'Zone B Core Probe', zone: 'B', type: 'RTD Pt100', status: 'normal', calibratedAt: Date.now() - 7200000 },
        { id: 'S-103', name: 'Zone C Core Probe', zone: 'C', type: 'RTD Pt100', status: 'warning', calibratedAt: Date.now() - 86400000 },
        { id: 'S-104', name: 'Bay 3 Thermal IR Seal', zone: 'C', type: 'Thermal FLIR', status: 'alert', calibratedAt: Date.now() - 172800000 }
      ]
    },
    alerts: [
      { id: 'COMP-02', severity: 'critical', title: 'Compressor 2 running 18% over thermal baseline', zone: 'B', ageSec: 350, dismissed: false },
      { id: 'BAY-03', severity: 'warning', title: 'Bay 3 loading door open 42s during peak ambient heat (+32°C outside)', zone: 'C', ageSec: 42, dismissed: false },
      { id: 'EVAP-01', severity: 'advisory', title: 'Evaporator 1 icing detected on coil matrix', zone: 'A', ageSec: 1200, dismissed: false }
    ],
    simulation: {
      openings: 60,
      duration: 42,
      ambient: 32,
      deltaT: 22,
      seal: 'Good',
      strategy: 'Off-Peak Night Shift',
      applied: false,
      lastAppliedScenario: 'Off-Peak Night Shift',
      bay3DoorOpen: true,
      doorOpenSeconds: 42,
      results: {
        currentDaily: 420,
        optimizedDaily: 360,
        reduction: 14.3,
        saved: 60,
        stress: 24,
        co2: 18.4,
        energySplit: { compressor: 62, evaporator: 23, lighting: 10, dock: 5 }
      }
    },
    esg: {
      co2AvoidedTonnes: 12.4,
      energySavedKwh: 28600,
      billSavingsInr: 210000,
      billSavingsUsd: 2600,
      treesEquivalent: 560,
      tier1Progress: 71,
      lastReportGenerated: null
    },
    copilot: {
      pendingPrompt: '',
      conversationHistory: [
        { role: 'ai', text: 'Hello Operator. I am continuously monitoring Facility ND-04 telemetry. Currently detecting: Bay 3 Seal Ajar (42s duration) and Compressor 2 running 18% over baseline. How can I assist you?', timestamp: Date.now() - 60000 }
      ]
    },
    cameraFeeds: {
      'CAM-01': { name: 'Vault Aisle 2', zone: 'A', status: 'LIVE', fps: 30, airflowCfm: 350, temp: -18.2 },
      'CAM-02': { name: 'Compressor Room', zone: 'B', status: 'ADVISORY', fps: 30, compressorOverdrive: 18, dutyCycle: 82 },
      'CAM-03': { name: 'Bay 3 Loading Dock', zone: 'C', status: 'ALERT', fps: 30, doorOpen: true, doorSeconds: 42, occupancy: '1 Operator, 1 Forklift' },
      'CAM-04': { name: 'Staging Dock', zone: 'D', status: 'LIVE', fps: 30, trucks: 0, temp: 2.1 }
    }
  };

  // Helper: Deep merge
  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    for (const key of Object.keys(source)) {
      if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target && typeof target[key] === 'object') {
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  // Load from localStorage or seed from DEFAULTS
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), parsed);
      }
    } catch (e) {
      console.warn('[CC-Store] Failed to parse localStorage state:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  // Persist state
  function persistState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[CC-Store] Failed to save to localStorage:', e);
    }
  }

  // Event & Subscription registries
  const eventListeners = {};
  const pathSubscribers = [];

  const CC = {
    PAGES,
    DEFAULTS,
    state: loadState(),

    // Dotted-path getter: CC.get("simulation.openings")
    get(path) {
      if (!path) return this.state;
      const parts = path.split('.');
      let curr = this.state;
      for (const p of parts) {
        if (curr == null) return undefined;
        curr = curr[p];
      }
      return curr;
    },

    // Dotted-path setter: CC.set("simulation.openings", 75)
    set(path, value, options = {}) {
      if (!path) return;
      const parts = path.split('.');
      let curr = this.state;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!(p in curr) || typeof curr[p] !== 'object' || curr[p] === null) {
          curr[p] = {};
        }
        curr = curr[p];
      }
      const lastKey = parts[parts.length - 1];
      curr[lastKey] = value;
      this.state.meta.updatedAt = Date.now();

      if (!options.silent) {
        persistState(this.state);
        this._notifySubscribers(path, value);
        this.emit('state:changed', { path, value, state: this.state });
        window.dispatchEvent(new CustomEvent('cc-twin-state', { detail: { path, value, state: this.state } }));
        this.updateSharedSlots();
      }
    },

    // Shallow merge helper
    patch(partial, options = {}) {
      if (!partial || typeof partial !== 'object') return;
      deepMerge(this.state, partial);
      this.state.meta.updatedAt = Date.now();

      if (!options.silent) {
        persistState(this.state);
        for (const key of Object.keys(partial)) {
          this._notifySubscribers(key, partial[key]);
        }
        this.emit('state:changed', { patch: partial, state: this.state });
        window.dispatchEvent(new CustomEvent('cc-twin-state', { detail: { patch: partial, state: this.state } }));
        this.updateSharedSlots();
      }
    },

    // Subscribe to a dotted path or prefix
    subscribe(path, callback) {
      const entry = { path, callback };
      pathSubscribers.push(entry);
      return () => {
        const idx = pathSubscribers.indexOf(entry);
        if (idx !== -1) pathSubscribers.splice(idx, 1);
      };
    },

    _notifySubscribers(changedPath, value) {
      pathSubscribers.forEach(({ path, callback }) => {
        // Match if subscriber path is prefix or ancestor or exact
        if (
          path === '*' ||
          changedPath === path ||
          changedPath.startsWith(path + '.') ||
          path.startsWith(changedPath + '.')
        ) {
          try {
            callback(this.get(path), changedPath, value);
          } catch (err) {
            console.error(`[CC-Store] Error in subscriber for ${path}:`, err);
          }
        }
      });
    },

    // Named event emitter: CC.emit(name, payload)
    emit(eventName, payload) {
      if (eventListeners[eventName]) {
        eventListeners[eventName].forEach((cb) => {
          try { cb(payload); } catch (e) { console.error(`[CC-Store] Error in event listener ${eventName}:`, e); }
        });
      }
    },

    // Named event listener: CC.on(name, cb)
    on(eventName, cb) {
      if (!eventListeners[eventName]) eventListeners[eventName] = [];
      eventListeners[eventName].push(cb);
      return () => {
        eventListeners[eventName] = eventListeners[eventName].filter((fn) => fn !== cb);
      };
    },

    // Resolve target page URL handling relative directory (root vs subfolder)
    resolveUrl(pageKey) {
      const filename = PAGES[pageKey] || pageKey;
      return filename;
    },

    // Navigate using the page registry
    go(pageKey, hash = '') {
      const targetFilename = this.resolveUrl(pageKey);
      if (!targetFilename) return;

      // If embedded inside parent iframe
      if (window.self !== window.top) {
        try {
          window.parent.postMessage({ type: 'cc-nav', page: pageKey, hash: hash, url: targetFilename }, '*');
        } catch (_) {}
      }

      const currentPath = window.location.pathname;
      const currentFilename = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';

      const isSamePage = currentFilename.toLowerCase() === targetFilename.toLowerCase() ||
        ALIASES[currentFilename] === pageKey;

      if (isSamePage) {
        if (hash) {
          const targetEl = document.querySelector(hash);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.classList.add('flash');
            setTimeout(() => targetEl.classList.remove('flash'), 1500);
          } else {
            window.location.hash = hash;
          }
        }
        return;
      }

      const cleanHash = hash ? (hash.startsWith('#') ? hash : '#' + hash) : '';
      window.location.href = targetFilename + cleanHash;
    },

    // Get current page key
    getCurrentPageKey() {
      const body = document.body;
      const bodyPage = body ? body.getAttribute('data-page') : null;
      if (bodyPage && PAGES[bodyPage]) return bodyPage;

      const currentPath = window.location.pathname;
      const currentFilename = currentPath.substring(currentPath.lastIndexOf('/') + 1);
      if (ALIASES[currentFilename]) return ALIASES[currentFilename];

      for (const [key, fname] of Object.entries(PAGES)) {
        if (currentFilename.toLowerCase() === fname.toLowerCase()) return key;
      }
      return bodyPage || 'overview';
    },

    // Update shared data slots in DOM
    updateSharedSlots() {
      if (!document.body) return;

      // 1. Total Load slots (data-cc="total-load")
      const totalLoad = Math.round(this.get('facility.totalLoad') || 251);
      document.querySelectorAll('[data-cc="total-load"]').forEach((el) => {
        el.textContent = totalLoad;
      });

      // 2. Alert Pill (data-cc="alert-pill")
      const alerts = this.get('alerts') || [];
      const bay3DoorOpen = this.get('simulation.bay3DoorOpen');
      const activeAlerts = alerts.filter((a) => !a.dismissed);
      const hasDoorLeak = bay3DoorOpen || activeAlerts.some((a) => a.id === 'BAY-03');

      document.querySelectorAll('[data-cc="alert-pill"]').forEach((pill) => {
        if (hasDoorLeak) {
          pill.style.display = 'flex';
          const doorSec = this.get('simulation.doorOpenSeconds') || 42;
          pill.innerHTML = `<span>⚠</span><span>WARNING: BAY 3 LEAK (${doorSec}s)</span>`;
          pill.title = 'Click to inspect in 3D Warehouse Twin';
        } else if (activeAlerts.length > 0) {
          pill.style.display = 'flex';
          pill.innerHTML = `<span>⚠</span><span>${activeAlerts[0].title.slice(0, 24)}…</span>`;
        } else {
          pill.style.display = 'none';
        }
      });

      // 3. Updated ticker
      const secAgo = Math.max(0, Math.floor((Date.now() - (this.get('meta.updatedAt') || Date.now())) / 1000));
      document.querySelectorAll('[data-cc="updated-ticker"]').forEach((el) => {
        el.textContent = `last sync ${secAgo < 2 ? '0.4' : secAgo}s ago`;
      });

      // 4. Sidebar collapsed state
      const sidebarCollapsed = Boolean(this.get('meta.sidebarCollapsed'));
      document.querySelectorAll('[data-cc="sidebar"], aside.sidebar').forEach((sb) => {
        sb.classList.toggle('collapsed', sidebarCollapsed);
      });

      // 5. Footer collapsed state
      const footerCollapsed = Boolean(this.get('meta.footerCollapsed'));
      document.querySelectorAll('[data-cc="footer"], .footer-bar, #footerBar').forEach((fb) => {
        fb.classList.toggle('collapsed', footerCollapsed);
      });
    },

    // Auto-wire navigation anchors, sidebar collapse, alert pill clicks, and hash anchors
    initDom() {
      const pageKey = this.getCurrentPageKey();
      if (document.body && !document.body.getAttribute('data-page')) {
        document.body.setAttribute('data-page', pageKey);
      }

      // Tag sidebar links and set active
      document.querySelectorAll('[data-nav]').forEach((link) => {
        const navKey = link.getAttribute('data-nav');
        if (PAGES[navKey]) {
          link.href = PAGES[navKey];
          link.classList.toggle('active', navKey === pageKey);
        }
        link.addEventListener('click', (e) => {
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            e.preventDefault();
            this.go(navKey);
          }
        });
      });

      // Alert pill click navigates to 3D Twin Bay 3
      document.querySelectorAll('[data-cc="alert-pill"], .alert-pill, #alertPill').forEach((pill) => {
        if (!pill.dataset.ccBound) {
          pill.dataset.ccBound = 'true';
          pill.addEventListener('click', () => {
            this.go('twin', '#bay3');
          });
        }
      });

      // Sidebar collapse toggle
      document.querySelectorAll('[data-nav-action="collapse-sidebar"], #collapseBtn').forEach((btn) => {
        if (!btn.dataset.ccBound) {
          btn.dataset.ccBound = 'true';
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const current = Boolean(this.get('meta.sidebarCollapsed'));
            this.set('meta.sidebarCollapsed', !current);
          });
        }
      });

      // Footer collapse toggle
      document.querySelectorAll('[data-nav-action="toggle-footer"], #footerChevron').forEach((btn) => {
        if (!btn.dataset.ccBound) {
          btn.dataset.ccBound = 'true';
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const current = Boolean(this.get('meta.footerCollapsed'));
            this.set('meta.footerCollapsed', !current);
          });
        }
      });

      // Handle URL hash on load (e.g. #bay3, #zoneA)
      const initialHash = window.location.hash;
      if (initialHash) {
        setTimeout(() => {
          const targetEl = document.querySelector(initialHash) ||
            (initialHash === '#bay3' ? document.getElementById('bay3') : null);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.classList.add('flash');
            setTimeout(() => targetEl.classList.remove('flash'), 1800);
          }
        }, 250);
      }

      this.updateSharedSlots();
    }
  };

  // Cross-tab storage event handler
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      try {
        const fresh = JSON.parse(e.newValue);
        if (fresh) {
          CC.state = deepMerge(CC.state, fresh);
          CC._notifySubscribers('*', CC.state);
          CC.emit('state:changed', { state: CC.state, source: 'storage' });
          CC.updateSharedSlots();
        }
      } catch (err) {
        console.warn('[CC-Store] Error handling cross-tab storage sync:', err);
      }
    }
  });

  // DOMContentLoaded initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      CC.initDom();
      CC.emit('state:ready', CC.state);
    });
  } else {
    setTimeout(() => {
      CC.initDom();
      CC.emit('state:ready', CC.state);
    }, 0);
  }

  global.CC = CC;
})(typeof window !== 'undefined' ? window : this);
