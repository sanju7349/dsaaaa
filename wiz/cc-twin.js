/**
 * ColdChain-Twin — Shared Runtime & Inter-Page State Controller
 * Exposes window.CC
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

  // Aliases for resilience
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

  // Default initial shared state
  const DEFAULT_STATE = {
    meta: {
      sidebarCollapsed: false,
      footerCollapsed: false,
      updatedAt: Date.now()
    },
    alert: {
      active: true,
      title: 'BAY 3 LEAK',
      zone: 'C',
      ageSec: 42
    },
    sim: {
      applied: false,
      openings: 60,
      duration: 42,
      ambient: 32,
      deltaT: 22,
      seal: 'Good',
      strategy: 'Off-Peak Night Shift',
      results: {
        currentDaily: 420,
        optimizedDaily: 360,
        reduction: 14.3,
        saved: 60,
        stress: 24,
        co2: 18.4
      }
    },
    config: {
      facilityId: 'ND-04',
      facilityName: 'North Dock Facility',
      region: 'Maharashtra, IN',
      timezone: 'Asia/Kolkata (IST)',
      ambient: 32.0,
      humidity: 78,
      alarmThermal: -15.0,
      alarmDoor: 30,
      zones: [
        { id: 'A', name: 'Zone A · Ice Cream Vault', target: -18.0, warn: -15.0, crit: -12.0, doorAlarm: 30, compressor: 'CMP-01', status: 'normal' },
        { id: 'B', name: 'Zone B · Frozen Meat & Seafood', target: -20.0, warn: -17.0, crit: -14.0, doorAlarm: 45, compressor: 'CMP-02', status: 'normal' },
        { id: 'C', name: 'Zone C · Deep-Freeze Pharma', target: -22.0, warn: -19.0, crit: -16.0, doorAlarm: 20, compressor: 'CMP-03', status: 'alert' },
        { id: 'D', name: 'Zone D · Chiller Dock', target: 2.0, warn: 4.0, crit: 6.0, doorAlarm: 60, compressor: 'CMP-04', status: 'watch' }
      ]
    },
    esg: {
      co2AvoidedTonnes: 12.4,
      energySavedKwh: 28600,
      billSavingsInr: 210000,
      billSavingsUsd: 2600,
      tier1Progress: 71,
      treesEquivalent: 560
    }
  };

  // Helper: Deep merge
  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    for (const key of Object.keys(source)) {
      if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  // Load state from localStorage with fallback
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
      }
    } catch (e) {
      console.warn('[CC] Failed to parse localStorage state:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  // Save state to localStorage
  function persistState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[CC] Failed to save to localStorage:', e);
    }
  }

  // Event bus
  const listeners = {};

  const CC = {
    PAGES,
    state: loadState(),

    // Dotted path getter: CC.get("sim.results.reduction")
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

    // Dotted path setter: CC.set("sim.applied", true)
    set(path, value) {
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
      curr[parts[parts.length - 1]] = value;
      this.state.meta.updatedAt = Date.now();

      persistState(this.state);
      this.emit('state:changed', { path, value, state: this.state });
      window.dispatchEvent(new CustomEvent('cc-twin-state', { detail: { path, value, state: this.state } }));
    },

    // Patch shallow or nested
    patch(obj) {
      if (!obj || typeof obj !== 'object') return;
      deepMerge(this.state, obj);
      this.state.meta.updatedAt = Date.now();
      persistState(this.state);
      this.emit('state:changed', { patch: obj, state: this.state });
      window.dispatchEvent(new CustomEvent('cc-twin-state', { detail: { patch: obj, state: this.state } }));
    },

    // Event subscription
    on(eventName, cb) {
      if (!listeners[eventName]) listeners[eventName] = [];
      listeners[eventName].push(cb);
      return () => {
        listeners[eventName] = listeners[eventName].filter((fn) => fn !== cb);
      };
    },

    // Emit event
    emit(eventName, data) {
      if (listeners[eventName]) {
        listeners[eventName].forEach((fn) => {
          try { fn(data); } catch (err) { console.error(`[CC] Error in ${eventName} listener:`, err); }
        });
      }
    },

    // Resolve target page URL
    resolveUrl(pageKey) {
      return PAGES[pageKey] || pageKey;
    },

    // Navigate to a registered page with optional hash
    go(pageKey, hash = '') {
      const targetFilename = this.resolveUrl(pageKey);
      if (!targetFilename) return;

      if (window.self !== window.top) {
        window.parent.postMessage({ type: 'cc-nav', page: pageKey, hash: hash, url: targetFilename }, '*');
        return;
      }

      const currentPath = window.location.pathname;
      const currentFilename = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';

      // Check if we are already on this page
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

      // Navigate to relative page
      const targetUrl = targetFilename + (hash ? (hash.startsWith('#') ? hash : '#' + hash) : '');
      window.location.href = targetUrl;
    },

    // Detect current page key
    getCurrentPageKey() {
      const bodyPage = document.body ? document.body.getAttribute('data-page') : null;
      if (bodyPage && PAGES[bodyPage]) return bodyPage;

      const currentPath = window.location.pathname;
      const currentFilename = currentPath.substring(currentPath.lastIndexOf('/') + 1);

      if (ALIASES[currentFilename]) return ALIASES[currentFilename];

      for (const [key, fname] of Object.entries(PAGES)) {
        if (currentFilename.toLowerCase() === fname.toLowerCase()) {
          return key;
        }
      }
      return bodyPage || 'twin';
    }
  };

  // Cross-tab synchronization
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        CC.state = deepMerge(CC.state, JSON.parse(e.newValue));
        CC.emit('state:sync', CC.state);
        syncDOM(CC.state);
      } catch (err) {
        console.warn('[CC] Error syncing cross-tab state:', err);
      }
    }
  });

  // DOM Synchronization Routine
  function syncDOM(state) {
    // 1. Total Load readout ([data-cc="total-load"] or #totalLoad)
    const loadEls = document.querySelectorAll('[data-cc="total-load"], #totalLoad');
    const baseDaily = state.sim.applied ? state.sim.results.optimizedDaily : state.sim.results.currentDaily;
    const calculatedKw = Math.round(baseDaily / 24 * 14.2); // realistic kW baseline ~ 248 - 253 kW
    const displayKw = Math.max(230, Math.min(275, calculatedKw || 250));

    loadEls.forEach((el) => {
      el.textContent = displayKw;
    });

    // 2. Alert pill ([data-cc="alert-pill"], #alertPill, #topAlert)
    const alertEls = document.querySelectorAll('[data-cc="alert-pill"], #alertPill, #topAlert');
    alertEls.forEach((el) => {
      if (!state.alert.active) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
        const titleSpan = el.querySelector('span:last-child') || el;
        if (titleSpan) {
          titleSpan.textContent = `WARNING: ${state.alert.title}`;
        }
      }
    });

    // 3. Sidebar collapsed sync
    const sidebar = document.querySelector('.sidebar, #sidebar');
    if (sidebar) {
      sidebar.classList.toggle('collapsed', !!state.meta.sidebarCollapsed);
    }

    // 4. Footer collapsed sync
    const footer = document.querySelector('.footer-bar, #footerBar');
    if (footer) {
      footer.classList.toggle('collapsed', !!state.meta.footerCollapsed);
    }
  }

  // Wire navigation, listeners, and bridges on DOM ready
  function init() {
    // If embedded inside dashboard iframe, seamlessly hide duplicate topbar and sidebar
    if (window.self !== window.top) {
      document.body.classList.add('in-frame');
      if (!document.getElementById('cc-frame-style')) {
        const frameStyle = document.createElement('style');
        frameStyle.id = 'cc-frame-style';
        frameStyle.textContent = `
          body.in-frame .sidebar,
          body.in-frame #sidebar,
          body.in-frame .topbar,
          body.in-frame header.topbar,
          body.in-frame .footer-bar,
          body.in-frame #footerBar {
            display: none !important;
          }
          body.in-frame .app-layout {
            min-height: 100vh !important;
          }
          body.in-frame .main-content {
            padding: 20px 24px 60px !important;
            width: 100% !important;
          }
          body.in-frame {
            background: #0B1120 !important;
            overflow-x: hidden !important;
          }
        `;
        document.head.appendChild(frameStyle);
      }
    }

    const pageKey = CC.getCurrentPageKey();
    if (document.body && !document.body.getAttribute('data-page')) {
      document.body.setAttribute('data-page', pageKey);
    }

    // A. Wire Sidebar items with [data-nav]
    const navItems = document.querySelectorAll('[data-nav], .sidebar-nav .nav-item');
    navItems.forEach((item) => {
      let navKey = item.getAttribute('data-nav');
      if (!navKey) {
        // Infer from text content or data-page attribute
        const text = item.textContent.toLowerCase();
        if (item.dataset.page) {
          navKey = item.dataset.page;
        } else if (text.includes('overview')) navKey = 'overview';
        else if (text.includes('camera')) navKey = 'cameras';
        else if (text.includes('twin')) navKey = 'twin';
        else if (text.includes('energy') || text.includes('simulation')) navKey = 'energy';
        else if (text.includes('copilot') || text.includes('co-pilot')) navKey = 'copilot';
        else if (text.includes('audit') || text.includes('esg')) navKey = 'audit';
        else if (text.includes('config') || text.includes('facility')) navKey = 'config';

        if (navKey) item.setAttribute('data-nav', navKey);
      }

      if (navKey) {
        item.classList.toggle('active', navKey === pageKey);

        item.addEventListener('click', (e) => {
          e.preventDefault();
          CC.go(navKey);
        });
      }
    });

    // B. Wire Sidebar Collapse Button
    const collapseBtns = document.querySelectorAll('#collapseBtn, [data-action="collapse-sidebar"]');
    collapseBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const sidebar = document.querySelector('.sidebar, #sidebar');
        if (sidebar) {
          const next = !sidebar.classList.contains('collapsed');
          sidebar.classList.toggle('collapsed', next);
          CC.set('meta.sidebarCollapsed', next);
        }
      });
    });

    // C. Wire Footer Chevron Collapse
    const footerChevrons = document.querySelectorAll('#footerChevron, .footer-chevron');
    footerChevrons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const footer = document.querySelector('.footer-bar, #footerBar');
        if (footer) {
          const next = !footer.classList.contains('collapsed');
          footer.classList.toggle('collapsed', next);
          CC.set('meta.footerCollapsed', next);
        }
      });
    });

    // D. Wire Alert Pills to cross-page navigate to twin #bay3
    const alertPills = document.querySelectorAll('[data-cc="alert-pill"], #alertPill, #topAlert');
    alertPills.forEach((pill) => {
      pill.setAttribute('data-cc', 'alert-pill');
      pill.style.cursor = 'pointer';
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        pill.classList.add('flash');
        setTimeout(() => pill.classList.remove('flash'), 1200);
        CC.emit('alert:clicked', CC.state.alert);
        CC.go('twin', '#bay3');
      });
    });

    // E. Total Load Jitter (Visual only — keeps dashboard alive without polluting state)
    setInterval(() => {
      const loadEls = document.querySelectorAll('[data-cc="total-load"], #totalLoad');
      const baseDaily = CC.state.sim.applied ? CC.state.sim.results.optimizedDaily : CC.state.sim.results.currentDaily;
      const calculatedKw = Math.round(baseDaily / 24 * 14.2) || 250;
      const jitter = Math.round((Math.random() - 0.5) * 5);
      const val = Math.max(228, Math.min(270, calculatedKw + jitter));
      loadEls.forEach((el) => {
        el.textContent = val;
      });
    }, 2500);

    // F. "Updated Xs ago" ticker
    let tickerSeconds = 0;
    CC.on('state:changed', () => { tickerSeconds = 0; });
    setInterval(() => {
      tickerSeconds++;
      const tickers = document.querySelectorAll('[data-cc="updated-ticker"], #lastUpdated, #lastSync');
      tickers.forEach((t) => {
        if (t.id === 'lastSync') {
          t.textContent = (tickerSeconds * 0.1).toFixed(1);
        } else {
          t.textContent = tickerSeconds < 5 ? 'updated just now' : `updated ${tickerSeconds}s ago`;
        }
      });
    }, 1000);

    // G. Hash scroll handling on initial page load (e.g. #bay3, #anomalyDoor)
    if (window.location.hash) {
      const hash = window.location.hash;
      setTimeout(() => {
        let el = document.querySelector(hash);
        if (!el && hash === '#bay3') {
          el = document.querySelector('.zone-c, [data-zone="C"], #anomalyDoor');
        }
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('flash');
          setTimeout(() => el.classList.remove('flash'), 1800);
        }
      }, 350);
    }

    // Initial DOM sync
    syncDOM(CC.state);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CC = CC;
})(typeof window !== 'undefined' ? window : this);
