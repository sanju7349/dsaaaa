# ColdChain-Twin — Integration Guide & Architecture Specification

ColdChain-Twin is an industrial Refrigerated Warehouse & Cold-Storage Digital Twin Suite. It connects 7 specialized operational interfaces into a single live, reactive system driven by a shared state store, a swappable thermodynamic simulation engine, and an abstraction layer for live MQTT / REST telemetry.

---

## 1. Architectural Overview: The Three Shared Layers

The twin architecture decouples presentation from telemetry via three lightweight, standalone scripts loaded on every page with standard `<script>` tags:

### 1.1 The State Store (`cc-store.js`)
* **Role**: Single source of truth across all 7 pages.
* **Exposes**: `window.CC`
* **Core API**:
  - `CC.get(path)`: Dotted-path getter (e.g., `CC.get("simulation.openings")`, `CC.get("facility.ambient")`).
  - `CC.set(path, value, options)`: Dotted-path setter, persists to `localStorage` under `cc-twin-state-v1`, publishes reactivity events.
  - `CC.patch(partial)`: Shallow/deep state merge helper.
  - `CC.subscribe(path, callback)`: Triggers whenever the path, an ancestor, or a descendant changes.
  - `CC.emit(eventName, payload)` / `CC.on(eventName, cb)`: Named lifecycle and domain events (`sim:applied`, `config:saved`, `alert:created`, `alert:dismissed`, `camera:event`, `copilot:message`, `state:ready`).
  - `CC.go(pageKey, hash)`: Inter-page navigation via the centralized `CC.PAGES` registry.
  - `CC.PAGES`: Logical page mapping dictionary.
* **Cross-Tab Synchronization**: Any state mutation automatically emits custom events locally and broadcasts across browser tabs via the `window.addEventListener("storage")` API.
* **Auto-Wiring**: Binds sidebar navigation active states (`data-nav`), alert pill clicks, and data slots (`data-cc="total-load"`, `data-cc="alert-pill"`, `data-cc="updated-ticker"`, `data-cc="sidebar"`, `data-cc="footer"`).

### 1.2 The Simulation Engine (`cc-sim.js`)
* **Role**: Centralized thermodynamic "backend" when real hardware is offline.
* **Master Tick Loop (1 Hz)**:
  - Models heat ingress across Cold Zones (A, B, C, D) based on exterior ambient temperature, door status, and cooling targets.
  - Ticks door open duration for Bay 3 and issues automated threshold alerts (`BAY-03`) when duration exceeds 20 seconds.
  - Recalculates total facility electrical load (kW), compressor duty cycles (CMP-01 to CMP-04), and daily carbon footprint ($CO_2$ intensity).
  - Emits `camera:event` detection packets and advances sensor calibration timestamps.
* **Swappability**: Adheres to the standard telemetry event interface. Can be swapped for real MQTT broker streams without altering UI code.

### 1.3 The Backend Adapter (`cc-backend.js`)
* **Role**: Data origin abstraction layer.
* **Modes**:
  - `SIMULATED` (default): Delegates physics generation directly to `cc-sim.js`.
  - `LIVE`: Connects over WebSockets (`wss://`) to MQTT topics such as `coldchain/{facilityId}/#`.
  - **Graceful Degradation**: If an MQTT broker connection fails or times out, it automatically falls back to `SIMULATED` mode with a single console warning.

---

## 2. Audit Table (§2)

| Page | Data Displayed | Data Written | Expected Backend Source | Non-working / Missing Links Fixed | Siloed Loops Centralized |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`overview.html`**<br>`data-page="overview"` | • Total Load (kW)<br>• Alert Pill (`BAY 3 LEAK`)<br>• Avg Zone Temp & $\Delta$<br>• Humidity & $CO_2$ avoided<br>• CAM-03 YOLOv8 feed | • "Dispatch Tech" (dismisses alert)<br>• "Simulate Bay 3 Breach" (toggles door open/close)<br>• Anomaly "Mitigate" button | • Smart power meters (kW)<br>• RTD Pt100 temp probes<br>• YOLOv8 edge inference stream<br>• Central alert registry | • Sidebar active nav link highlight<br>• Alert pill deep link to `3dwarehouse.html#bay3` | • Local load & temperature intervals unified into `cc-sim.js` |
| **`live_camera_feeds.html`**<br>`data-page="cameras"` | • CAM-03 dock camera with YOLO bboxes & door timer<br>• Sub-feeds: CAM-01, CAM-02, CAM-04<br>• Topbar load & alert pill | • Toggle Visible/Thermal IR<br>• "Emergency Close Door"<br>• "Capture Snapshot"<br>• Sub-cam thumbnail clicks | • RTSP / WebRTC camera feeds<br>• YOLOv8 detection metadata<br>• FLIR thermal matrix | • Added **"Send to Co-Pilot"** action on Bay 3 detection event<br>• Sub-cam thumbnails link to 3D Twin zone anchors | • Local door timer & compressor duty counters synced to store |
| **`3dwarehouse.html`**<br>`data-page="twin"` | • Isometric 3D SVG model<br>• Zone A, B, C live temps & alert state<br>• Zone C Target setpoint<br>• Layer overlays (Doors, Sensors, Airflow)<br>• Anomaly Detection panel | • Layer toggles<br>• View angle selector<br>• Co-Pilot prompt modal<br>• "Close Door" anomaly resolution | • IoT temperature stream<br>• Door magnetic reed switches<br>• Compressor telemetry | • Hash targeting (`#bay3`) with smooth scroll and pulse highlight<br>• Added "Close Door" button to anomaly item | • Local clock preserved; twin state rendering driven by `CC.state` |
| **`energy_simulation.html`**<br>`data-page="energy"` | • Sliders: Openings, Duration, Ambient, $\Delta T$, Seal, Strategy<br>• Baseline vs Optimized kWh & % reduction<br>• Hourly load curves & AI recommendations | • Slider inputs<br>• Seal condition selector<br>• Strategy dropdown<br>• Scenario presets<br>• "Apply Optimized Schedule" | • SimPy thermodynamic engine<br>• Historical AMI smart meter load profile<br>• Weather forecast ambient service | • Scripts relocated before inline script to eliminate undefined reference on parse<br>• Ambient slider seeds from `facility.ambient` on load | • Calculation logic dispatches to `CC.state` for cross-page sync |
| **`copilot_ai.html`**<br>`data-page="copilot"` | • Chat conversation history<br>• Suggestion chips<br>• Llama 3 local engine status | • Query prompt input<br>• Suggestion chip clicks<br>• Pre-fill / submit from other pages<br>• "Clear History" | • Local fine-tuned LLM / LangChain RAG pipeline | • Pre-fills user prompt from `copilot.pendingPrompt`<br>• Cross-link to `audit_and_esg_report.html` | • AI streaming simulation centralized |
| **`audit_and_esg_report.html`**<br>`data-page="audit"` | • $CO_2$ avoided (12.4 t)<br>• Energy saved (28,600 kWh)<br>• Direct bill savings (₹2.1L)<br>• Rolling 30-day savings chart<br>• Net-zero progress donut (71%) | • "Generate ESG Audit Report"<br>• "Download Report" (.txt blob) | • Utility billing API & carbon accounting ledger<br>• Bureau Veritas emission factor registry | • Scripts relocated before inline script<br>• Reflects applied schedule reduction (`simulation.results.reduction`) in metric badge and report | • Metric counters and charts animate on state synchronization |
| **`facility_config.html`**<br>`data-page="config"` | • Site parameters (ID, Name, Region, Ambient, Humidity)<br>• Zone Table (Targets, Warn, Crit, Door Alarm)<br>• Compressor rack switches<br>• Sensor probe network & calibration LEDs | • Site parameter inputs<br>• Zone target inputs (specifically Zone C)<br>• Equipment toggle switches<br>• Sensor probe "Calibrate" buttons<br>• "Save configuration" | • BMS / SCADA central configuration<br>• Modbus/BACnet device controller<br>• Calibration log database | • Embedded missing `cc-store.js`, `cc-sim.js`, `cc-backend.js`<br>• Connected `saveConfig` to `facility.ambient` and `facility.zones[2].target` | • Siloed 2.5s load jitter replaced with `CC.state` telemetry |

---

## 3. The Four Additive Edits Per Page (§4.1–§4.4)

Every page in the ColdChain-Twin suite follows these exact 4 additive steps:

1. **Add Three Script Tags**:
   Before the page's inline `<script>`, insert:
   ```html
   <script src="cc-store.js"></script>
   <script src="cc-sim.js"></script>
   <script src="cc-backend.js"></script>
   ```

2. **Add `data-page` to `<body>`**:
   ```html
   <body data-page="energy">
   ```
   Allowed values: `overview`, `cameras`, `twin`, `energy`, `copilot`, `audit`, `config`.

3. **Tag Sidebar Links**:
   ```html
   <a href="3dwarehouse.html" class="nav-item" data-nav="twin">...</a>
   ```
   `cc-store.js` automatically manages URL routing and highlights the active item.

4. **Tag Shared Data Slots**:
   - `data-cc="total-load"`: Real-time total power readout in kW.
   - `data-cc="alert-pill"`: Topbar active alert banner.
   - `data-cc="updated-ticker"`: "last sync Xs ago" indicator.
   - `data-cc="sidebar"`: Primary navigation rail (handles collapsed state).
   - `data-cc="footer"`: Architecture drawer root.
   - `data-nav-action="collapse-sidebar"`: Sidebar collapse toggle anchor.
   - `data-nav-action="toggle-footer"`: Footer drawer chevron button.

---

## 4. Per-Page Patch List

* **`overview.html`**:
  - `data-page`: `"overview"`
  - `data-nav`: Tagged on all 7 sidebar navigation items.
  - `data-cc`: Added to `#totalLoad`, `#alertPill`, `#sidebar`, `#collapseBtn`, `updated-ticker`.
  - `CC.get`: Reads `facility.zones`, `facility.humidity`, `esg.co2AvoidedTonnes`, `simulation.bay3DoorOpen`, `alerts`.
  - `CC.set`: Toggle breach updates `simulation.bay3DoorOpen` and `simulation.doorOpenSeconds`.

* **`live_camera_feeds.html`**:
  - `data-page`: `"cameras"`
  - `data-nav`: Tagged on all 7 sidebar items.
  - `data-cc`: Added to `#totalLoad`, `#alertPill`, `#sidebar`, `#collapseBtn`, `updated-ticker`.
  - Added button: `"Send to Co-Pilot"` in Bay 3 detection HUD and bottombar.
  - `CC.set`: `sendBay3ToCopilot()` writes `copilot.pendingPrompt` and routes via `CC.go('copilot')`. "Emergency Close Door" writes `simulation.bay3DoorOpen: false` and clears `BAY-03` alert.

* **`3dwarehouse.html`**:
  - `data-page`: `"twin"`
  - `data-nav`: Tagged on all 7 sidebar items.
  - `data-cc`: Added to `#totalLoad`, `#topAlert`, `#sidebar`, `#collapseBtn`, `#lastSync`.
  - Zone C target: Added `#targetC` element displaying dynamic target from `CC.get('facility.zones')`.
  - Added button: `"Close Door"` inside `#anomalyDoor` item.
  - `CC.set`: `closeBay3Door()` sets `simulation.bay3DoorOpen: false`, resets door timer, and purges `BAY-03` from `alerts`.

* **`energy_simulation.html`**:
  - `data-page`: `"energy"`
  - `data-nav`: Tagged on all 7 sidebar items.
  - `data-cc`: Added to `#totalLoad`, `#alertPill`, `#sidebar`, `#collapseBtn`, `updated-ticker`.
  - Reordered scripts: Placed `cc-store.js`, `cc-sim.js`, `cc-backend.js` before inline logic.
  - `CC.get`: Seeds `state.ambient` from `facility.ambient`, openings, duration, deltaT, seal, and strategy.
  - `CC.set`: "Apply Optimized Schedule" sets `simulation.applied`, `simulation.results`, `simulation.lastAppliedScenario`, and emits `sim:applied`.

* **`copilot_ai.html`**:
  - `data-page`: `"copilot"`
  - `data-nav`: Tagged on all 7 sidebar items.
  - `data-cc`: Added to `#totalLoad`, `#alertPill`, `#sidebar`, `#collapseBtn`, `updated-ticker`.
  - `CC.get`: On boot, reads `copilot.pendingPrompt`. Pre-fills `inputEl.value` and invokes `sendQuery()`.
  - `CC.set`: Saves chat interactions to `copilot.conversationHistory`.

* **`audit_and_esg_report.html`**:
  - `data-page`: `"audit"`
  - `data-nav`: Tagged on all 7 sidebar items.
  - `data-cc`: Added to `#totalLoad`, `#alertPill`, `#sidebar`, `#collapseBtn`, `#lastUpdated`, `#footerBar`, `#footerChevron`.
  - Added badge: `#badgeReduction` displaying applied reduction percentage.
  - `CC.get`: Reads `simulation.applied` and `simulation.results.reduction` on load to dynamically reflect savings.

* **`facility_config.html`**:
  - `data-page`: `"config"`
  - `data-nav`: Tagged on all 7 sidebar items.
  - `data-cc`: Added to `#totalLoad`, `#alertPill`, `#sidebar`, `#collapseBtn`, `#lastUpdated`, `#footerBar`, `#footerChevron`.
  - Replaced load jitter: Connected to `facility.totalLoad` from store.
  - `CC.get`: `loadFromCC()` initializes all site inputs and zone table rows on load.
  - `CC.set`: `saveConfig()` persists `facility.ambient`, `facility.humidity`, `facility.zones`, and specifically Zone C target `facility.zones[2].target`.

---

## 5. Acceptance Tests & Verification (§5)

Each cross-page acceptance test was verified against the live implementation:

1. **Sidebar Navigation**:
   - *Test*: Click each nav link across all 7 pages.
   - *Result*: **PASS**. `CC.go` routes to physical filenames from `CC.PAGES`; arriving page tags active sidebar state.

2. **Alert Routing**:
   - *Test*: Click `WARNING: BAY 3 LEAK` pill from any page.
   - *Result*: **PASS**. Navigates to `3dwarehouse.html#bay3`, scrolls to Zone C, and executes the 3-pulse `.flash` outline. Clicking "Close Door" sets `bay3DoorOpen: false`, resets door timer, and permanently hides the alert pill across all pages.

3. **Simulation $\to$ ESG**:
   - *Test*: Apply the Optimized Schedule in `energy_simulation.html`. Navigate to `audit_and_esg_report.html`.
   - *Result*: **PASS**. Metric tiles display the reduction badge (`14.3% REDUCTION APPLIED`) derived directly from `simulation.results.reduction`.

4. **Config $\to$ Twin**:
   - *Test*: Edit Zone C Target to `-23.5°C` in `facility_config.html` and click Save. Navigate to `3dwarehouse.html`.
   - *Result*: **PASS**. Zone C tile immediately displays `Target: -23.5°C`.

5. **Config $\to$ Simulator**:
   - *Test*: Set Site Ambient to `35.0°C` in `facility_config.html` and click Save. Navigate to `energy_simulation.html`.
   - *Result*: **PASS**. Ambient slider seeds with `35.0°C` on first load.

6. **Camera $\to$ Co-Pilot**:
   - *Test*: Click "Send to Co-Pilot" on Bay 3 detection event in `live_camera_feeds.html`.
   - *Result*: **PASS**. Routes to `copilot_ai.html`, pre-fills input with Bay 3 door open telemetry, and submits recommendation query.

7. **Live Simulation Continuity**:
   - *Test*: Leave a page and return after several seconds.
   - *Result*: **PASS**. Master 1 Hz physics loop in `cc-sim.js` maintains continuous state across tab transitions.

8. **Cross-Tab Synchronization**:
   - *Test*: Open `energy_simulation.html` and `audit_and_esg_report.html` in adjacent browser tabs. Apply schedule in tab 1.
   - *Result*: **PASS**. Storage event listener broadcasts mutation, updating metrics in tab 2 in real time.

9. **Graceful Degradation**:
   - *Test*: Verify page execution if `cc-store.js` or backend is unreachable.
   - *Result*: **PASS**. All store calls are guarded by `window.CC` existence checks, falling back seamlessly to local mock displays without console errors.

---

## 6. How to Add a New Page in the Future

To add an eighth page (e.g. `maintenance_planner.html`):

1. **Register in `cc-store.js`**:
   Add to `PAGES` registry:
   ```javascript
   const PAGES = {
     ...
     maintenance: 'maintenance_planner.html'
   };
   ```
2. **Add `data-page` to your new page**:
   ```html
   <body data-page="maintenance">
   ```
3. **Include the Three Scripts**:
   ```html
   <script src="cc-store.js"></script>
   <script src="cc-sim.js"></script>
   <script src="cc-backend.js"></script>
   ```
4. **Tag Nav Anchors**:
   ```html
   <a href="maintenance_planner.html" class="nav-item" data-nav="maintenance">...</a>
   ```
   The shared store will automatically wire active states, sidebar collapse, topbar telemetry, and cross-tab broadcasts.
