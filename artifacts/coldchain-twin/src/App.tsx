import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, AlertTriangle, ArrowDownRight, ArrowRight, AudioLines, Box, Camera, Check, ChevronDown, ChevronLeft, ChevronUp, CircleDot, ClipboardCheck, Cpu, DoorOpen, Gauge, Leaf, Menu, Send, Settings2, ShieldAlert, Snowflake, Sparkles, Thermometer, Wind, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWarehouseSimulation, type Zone } from '@/hooks/useWarehouseSimulation';

interface NavItem {
  label: string;
  icon: any;
  target: string;
  file?: string;
}

const navItems: NavItem[] = [
  { label: 'Overview', icon: Gauge, target: 'overview', file: '/wiz/overview.html' },
  { label: 'Live Camera Feeds', icon: Camera, target: 'camera', file: '/wiz/live_camera_feeds.html' },
  { label: '3D Warehouse Twin', icon: Box, target: 'twin', file: '/wiz/3dwarehouse.html' },
  { label: 'Energy Simulations', icon: Activity, target: 'simulator', file: '/wiz/energy_simulation.html' },
  { label: 'Co-Pilot AI', icon: Sparkles, target: 'copilot', file: '/wiz/copilot_ai.html' },
  { label: 'Audit & ESG Reports', icon: Leaf, target: 'esg', file: '/wiz/audit_and_esg_report.html' },
  { label: 'Facility Config', icon: Settings2, target: 'config', file: '/wiz/facility_config.html' },
];
const chartData = [
  ['00', 238, 224], ['01', 231, 220], ['02', 225, 218], ['03', 222, 216], ['04', 224, 216], ['05', 228, 218],
  ['06', 236, 221], ['07', 243, 224], ['08', 250, 228], ['09', 246, 229], ['10', 251, 231], ['11', 258, 233],
  ['12', 278, 235], ['13', 286, 236], ['14', 271, 234], ['15', 280, 232], ['16', 263, 231], ['17', 254, 230],
  ['18', 251, 229], ['19', 249, 228], ['20', 246, 226], ['21', 243, 225], ['22', 241, 224], ['23', 239, 222],
].map(([time, actual, baseline], i) => ({ time: `${String(time).padStart(2, '0')}:00`, actual: Number(actual), baseline: Number(baseline), doors: i >= 12 && i <= 16 ? (i === 13 ? 3 : 2) : i === 8 || i === 19 ? 1 : 0 }));

type Message = { from: 'user' | 'ai'; text: string };

function TwinMap({ zones, breach, doorOpen, onSelect }: { zones: Zone[]; breach: boolean; doorOpen: boolean; onSelect: (zone: Zone) => void }) {
  const [layers, setLayers] = useState({ Doors: true, 'IoT Sensors': true, Equipment: true, 'Airflow Pathways': true });
  const [preset, setPreset] = useState('Isometric View');
  const zoneCoords = [{ x: 88, y: 81 }, { x: 286, y: 81 }, { x: 484, y: 81 }];
  return <div className="panel twin-card nav-target" id="twin">
    <div className="panel-head"><div><div className="panel-title"><Box size={15} color="#36c8dd"/> 3D Warehouse Twin <span className="live-dot"/></div><div className="panel-sub">Interactive thermodynamic model · last sync 0.4s ago</div></div>
      <div className="twin-tools">{Object.entries(layers).map(([name, enabled]) => <label className={`toggle ${enabled ? 'on' : ''}`} key={name}><input type="checkbox" checked={enabled} onChange={() => setLayers((old) => ({ ...old, [name]: !old[name as keyof typeof old] }))} data-testid={`toggle-layer-${name.toLowerCase().replaceAll(' ', '-')}`}/>{name}</label>)}
      <select value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Twin view preset" className="toggle" data-testid="select-twin-preset"><option>Isometric View</option><option>Bay 3 Focus</option><option>Top-Down Thermal Map</option></select></div></div>
    <div className={`twin-stage ${preset === 'Bay 3 Focus' ? 'bay-focus' : preset === 'Top-Down Thermal Map' ? 'top-down' : ''}`}>
      <svg className="warehouse-svg" viewBox="0 0 720 300" role="img" aria-label="Interactive isometric cold-storage warehouse twin">
        <defs><linearGradient id="floorGrad" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#1e394a"/><stop offset="1" stopColor="#102130"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <polygon points="65,92 354,14 651,92 357,173" fill="url(#floorGrad)" stroke="#3a6477" strokeWidth="2"/>
        {zones.map((zone, index) => {
          const { x, y } = zoneCoords[index]; const isHot = (index === 0 && breach) || (index === 2 && doorOpen);
          const fill = index === 0 && breach ? '#9f362f' : index === 2 && doorOpen ? '#55402a' : index === 1 ? '#18566b' : '#174a4b';
          return <g key={zone.id} onClick={() => onSelect(zone)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(zone); } }} tabIndex={0} role="button" aria-label={`Open Zone ${zone.id} details`} data-testid={`zone-${zone.id.toLowerCase()}`} className="zone-shape">
            <polygon points={`${x},${y} ${x + 90},${y - 24} ${x + 178},${y} ${x + 88},${y + 25}`} fill={fill} fillOpacity=".9" stroke={isHot ? '#ff625e' : '#3aa4b4'} strokeWidth={isHot ? 2 : 1.5}/>
            <polygon points={`${x},${y} ${x + 88},${y + 25} ${x + 88},${y + 74} ${x},${y + 50}`} fill={index === 1 ? '#123448' : '#122e3b'} stroke="#2d687b"/>
            <polygon points={`${x + 88},${y + 25} ${x + 178},${y} ${x + 178},${y + 48} ${x + 88},${y + 74}`} fill="#132c3b" stroke="#2d687b"/>
            <text x={x + 88} y={y + 4} textAnchor="middle" className="zone-label">{`ZONE ${zone.id} · ${zone.name}`}</text><text x={x + 88} y={y + 22} textAnchor="middle" className="zone-temp">{zone.temp.toFixed(1)}°C</text>
            {layers.Equipment && <g><rect x={x + 18} y={y + 20} width="25" height="15" rx="2" fill="#183d52" stroke="#5ab8ce"/><circle cx={x + 24} cy={y + 39} r="3" fill="#46d7e7"/><circle cx={x + 39} cy={y + 39} r="3" fill="#46d7e7"/></g>}
            {layers['IoT Sensors'] && <g><circle cx={x + 152} cy={y + 17} r="5" fill={isHot ? '#ff514c' : '#28d5d4'} filter="url(#glow)"/><circle cx={x + 152} cy={y + 17} r="10" fill="none" stroke={isHot ? '#ff514c' : '#28d5d4'} opacity=".4"/></g>}
          </g>;
        })}
        {layers['Airflow Pathways'] && <g fill="none" stroke="#5ce5e9" strokeDasharray="5 6" strokeWidth="2" opacity=".7"><path d="M150 179 C205 202 230 210 292 220"/><path d="M360 184 C418 208 446 214 508 222"/></g>}
        {layers.Doors && <g><rect x="561" y="144" width="36" height="45" fill={breach ? '#9c3029' : doorOpen ? '#74512b' : '#1d5c49'} stroke={breach ? '#ff6056' : doorOpen ? '#e3a742' : '#48b885'}/><text x="579" y="203" textAnchor="middle" fill={doorOpen ? '#ffb06b' : '#8be3b3'} fontSize="8">{doorOpen ? 'BAY 3 · OPEN' : 'BAY 3 · CLOSED'}</text>{doorOpen && <path d="M578 151 L610 166 L610 204" fill="none" stroke={breach ? '#f35f56' : '#e3a742'} strokeWidth="2"/>}<circle cx="608" cy="163" r="6" fill={breach ? '#ef4444' : doorOpen ? '#f59e0b' : '#10b981'} className={breach ? 'alarm-pulse' : ''}/></g>}
      </svg>
      {preset === 'Bay 3 Focus' && <div className="twin-hud"><div className="hud-title">BAY 3 <span className="severity warning">DOOR AJAR</span></div><div className="hud-row"><span>Open duration</span><b>00:42</b></div><div className="hud-row"><span>Ambient ingress</span><b>+32°C</b></div><div className="hud-row"><span>Airflow loss</span><b>-15%</b></div></div>}
    </div>
    <div className="panel-head" style={{ borderTop: '1px solid #1b2939', borderBottom: 0, paddingTop: 9, paddingBottom: 9 }}><span className="eyebrow">Facility zones · select a zone for live telemetry</span><span className="mono" style={{ fontSize: 9, color: '#8296a9' }}>A ← —15°C TO —24°C— → C</span></div>
  </div>;
}

function App() {
  const { load, zones, breach, setBreach, optimized, setOptimized } = useWarehouseSimulation();
  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState('Overview');
  const [feed, setFeed] = useState<'visible' | 'thermal'>('visible');
  const [doorSeconds, setDoorSeconds] = useState(42);
  const [doorOpen, setDoorOpen] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [ticket, setTicket] = useState(false);
  const [openArch, setOpenArch] = useState(false);
  const [openDoorEvents, setOpenDoorEvents] = useState(2);
  const [openings, setOpenings] = useState(60);
  const [duration, setDuration] = useState(42);
  const [ambient, setAmbient] = useState(32);
  const [strategy, setStrategy] = useState('Off-Peak Night Shift');
  const [messages, setMessages] = useState<Message[]>([
    { from: 'user', text: 'Suggest ways to reduce energy waste in Bay 3 and provide a maintenance plan.' },
    { from: 'ai', text: 'For Bay 3, prioritize these high-impact actions:\n\n• Replace degraded silicone flap seal — estimated 8% total energy-loss reduction.\n• Shift blast precooling to 02:00–05:00 AM — saves ~12% on peak kW charges.\n• Clear Aisle 2 pallet obstruction to restore 350 CFM fan circulation.\n\nMaintenance plan: inspect the seal today, verify airflow after aisle clearance, then trend compressor duty cycle for 24 hours.' },
  ]);
  const [prompt, setPrompt] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [hour, setHour] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null;
  useEffect(() => { const timer = window.setInterval(() => setHour(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { const timer = window.setInterval(() => { if (doorOpen) setDoorSeconds((n) => n + 1); }, 1000); return () => clearInterval(timer); }, [doorOpen]);
  useEffect(() => { if (toast) { const t = window.setTimeout(() => setToast(''), 3600); return () => clearTimeout(t); } return undefined; }, [toast]);
  const simulation = useMemo(() => {
    if (openings === 60 && duration === 42 && ambient === 32 && strategy === 'Off-Peak Night Shift') return { current: 420, alternative: 360 };
    const current = Math.round(300 + openings * 1.02 + duration * 1.05 + Math.max(0, ambient) * 1.65);
    const factor = strategy === 'Off-Peak Night Shift' ? .857 : .91;
    return { current, alternative: Math.round(current * factor) };
  }, [openings, duration, ambient, strategy]);
  const saved = simulation.current - simulation.alternative;
  const reduction = (saved / simulation.current * 100).toFixed(1);
  const currentNav = navItems.find((n) => n.label === activeNav);

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'cc-nav') {
        const page = e.data.page;
        const nav = navItems.find((n) => n.target === page || n.label.toLowerCase().includes(String(page).toLowerCase()));
        if (nav) {
          setActiveNav(nav.label);
        }
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  const goTo = (target: string, label: string) => {
    setActiveNav(label);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const notify = (text: string) => setToast(text);
  const sendPrompt = (text = prompt) => {
    if (!text.trim() || streaming) return;
    const question = text.trim();
    setMessages((all) => [...all, { from: 'user', text: question }]); setPrompt(''); setStreaming(true);
    window.setTimeout(() => {
      const lower = question.toLowerCase();
      const reply = lower.includes('compressor') ? 'Compressor 2 is operating 18% above its thermal baseline. Check condenser airflow and suction pressure first; clear the Aisle 2 obstruction, inspect the evaporator coil for icing, then trend discharge temperature for 15 minutes. Dispatch a technician if the superheat remains outside its setpoint.' :
        lower.includes('esg') ? 'Audit snapshot: 12.4 tonnes CO2 avoided this month across 28,600 kWh saved. Export-ready measures include off-peak precooling, corrected door seals, and restored evaporator airflow. Record utility bills and maintenance evidence for the Tier 1 net-zero review.' :
        lower.includes('door') || lower.includes('seal') ? 'Failure simulation: a seal breach can add approximately 31 kW as warm, humid air enters the vault. Isolate Bay 3, fit a temporary strip curtain, keep the loading interval below 20 seconds, and replace the silicone flap seal before the next peak shift.' :
        'Recommended sequence: reduce door-open time below 20 seconds, clear Aisle 2 to restore 350 CFM, and move blast precooling to 02:00–05:00. Inspect the Bay 3 silicone seal and review Compressor 2 discharge temperature after the next cycle. Expected outcome: lower peak demand with no compromise to product temperature.';
      let index = 0;
      const timer = window.setInterval(() => {
        index = Math.min(reply.length, index + 5);
        setStreamingText(reply.slice(0, index));
        if (index >= reply.length) {
          window.clearInterval(timer);
          setMessages((all) => [...all, { from: 'ai', text: reply }]);
          setStreaming(false);
          setStreamingText('');
        }
      }, 18);
    }, 250);
  };
  const triggerBreach = () => {
    setBreach(true); setDoorOpen(true); setDoorSeconds(42); setTicket(true); setMessages((all) => [...all, { from: 'ai', text: 'URGENT MAINTENANCE TICKET · CC-2047 — Bay 3 seal breach: isolate the loading bay, install a temporary strip curtain, and replace the degraded silicone flap seal. Response window: 18 min.' }]); notify('Urgent maintenance ticket CC-2047 created · Bay 3 door seal breach'); goTo('twin', '3D Warehouse Twin');
  };
  const closeDoor = () => { setDoorOpen(false); setDoorSeconds(0); setOpenDoorEvents((n) => Math.max(0, n - 1)); notify('Bay 3 door closed · door timer reset'); };
  const applySchedule = () => { setOptimized(true); notify(`Optimized schedule applied · ${saved} kWh/day projected savings; Zones A & B cooling setpoints tightened`); };
  const acknowledge = (id: string) => { setAcknowledged((list) => [...list, id]); notify(`${id} acknowledged · logged to facility event history`); };
  const dispatch = (id: string) => { setTicket(true); notify(`Technician dispatched for ${id} · response window 18 min`); };
  const breachTimer = () => {
    if (breach) { setBreach(false); setTicket(false); notify('Breach simulation cleared · load returning to normal'); }
    else triggerBreach();
  };
  return <div className="app-shell">
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Primary navigation">
      <div className="brand"><div className="brand-mark"><Snowflake size={21}/></div><div className="brand-copy"><div className="brand-name">ColdChain<b>-Twin</b></div></div></div>
      <div className="side-caption">FACILITY CONTROL</div>
      <nav className="nav-list">{navItems.map(({ label, icon: Icon, target }) => <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => goTo(target, label)} data-testid={`nav-${target}`} aria-label={label} title={collapsed ? label : undefined}><Icon size={16}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-foot"><button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} data-testid="button-collapse-sidebar" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronLeft size={16}/> : <Menu size={16}/>}<span>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span></button></div>
    </aside>
    <div className={`main-area ${collapsed ? 'expanded' : ''}`}>
      <header className="topbar">
        <div className="headline"><div><div className="eyebrow">NORTH DOCK FACILITY <span style={{ color: '#456176' }}>·</span> CONTROL ROOM</div><div className="tagline">Less Energy Waste. Lower Emissions. Smarter Cold Chains.</div></div>
          <div className="header-right"><div className="load-readout" data-testid="metric-total-load"><small>TOTAL LOAD</small><strong>{load} <em>kW</em></strong></div><div className="status-warning" data-testid="status-bay3-warning"><AlertTriangle size={13}/> WARNING: BAY 3 LEAK</div></div></div>
        <div className="system-pills">
          <div className="system-pill"><b>CV Edge AI:</b> YOLOv8 - Active (30 FPS)</div><div className="system-pill"><b>IoT Telemetry:</b> MQTT Virtual Stream (60 Hz)</div><div className="system-pill"><b>Digital Twin:</b> SimPy Client Thermodynamic Model</div><div className="system-pill"><b>Generative AI:</b> Offline Energy Co-Pilot Engine</div>
        </div>
      </header>
      {activeNav === 'Overview' ? (
      <main className="content" id="overview">
        {breach && <div className="alarm-banner show" data-testid="status-breach-alarm"><span><ShieldAlert size={15} style={{ verticalAlign: 'middle', marginRight: 8 }}/>SIMULATED THERMAL BREACH ACTIVE · ZONE A WARMING · COMPRESSOR 2 OVERDRIVE</span><button className="btn danger" onClick={breachTimer}>Clear simulation</button></div>}
        <div className="section-head"><div><div className="section-title"><CircleDot size={14} color="#42d4b2"/> Live operations overview</div><div className="panel-sub">North Dock · Facility ND-04 · Local time {hour}</div></div><button className={`btn ${breach ? 'danger' : 'ghost'}`} onClick={breachTimer} data-testid="button-simulate-breach">{breach ? <Check size={13}/> : <AlertTriangle size={13}/>} {breach ? 'End Breach Simulation' : 'Simulate Bay 3 Breach'}</button></div>
        <div className="overview-grid">
          <section className="panel nav-target" id="camera" data-testid="module-camera">
            <div className="panel-head"><div><div className="panel-title"><Camera size={15} color="#43c4d8"/> Live Camera Feeds <span className="live-dot"/></div><div className="panel-sub">{feed === 'visible' ? 'Bay 3 - Loading Dock Camera (Visible Light)' : 'Thermal IR Seal Feed'}</div></div><div style={{ display: 'flex', gap: 5 }}><button className={`btn ${feed === 'visible' ? 'primary' : 'ghost'}`} onClick={() => setFeed('visible')} data-testid="button-feed-visible">Visible</button><button className={`btn ${feed === 'thermal' ? 'primary' : 'ghost'}`} onClick={() => setFeed('thermal')} data-testid="button-feed-thermal">Thermal IR</button></div></div>
            <div className={`camera-scene ${feed === 'thermal' ? 'thermal' : ''}`} data-testid="camera-scene">
              <div className="scene-ceiling"/><div className={`scene-backdoor ${doorOpen ? 'open' : ''}`}/><div className="scene-aisle"/><div className="scene-floor"/><div className="pallet p1"/><div className="pallet p2"/><div className="pallet p3"/><div className="forklift"/><div className="person"/>
              {feed === 'visible' && <><div className="detection det-person">PERSON 94%</div><div className="detection det-fork">FORKLIFT 98%</div><div className="detection det-pallet">PALLET 88%<br/>AIRFLOW RESTRICTED</div><div className="door-alert" data-testid="status-door-open">{doorOpen ? <><DoorOpen size={12} style={{ verticalAlign: 'middle', marginRight: 4 }}/>DOOR OPEN: {doorSeconds}s [THRESHOLD: 20s]</> : 'DOOR CLOSED · TIMER RESET'}</div></>}
              <div className="cam-topline"><span><span className="live-dot"/> CAM-03 / 192.168.4.23</span><span className="mono">1080p · 30 FPS</span></div>
              {feed === 'thermal' && <div className="thermal-legend">THERMAL SCALE<div className="thermal-bar"/><div style={{ display:'flex', justifyContent:'space-between' }}><span>-25°C</span><span>+28°C</span></div></div>}
              <div className="scene-bottom"><div className="camera-legend">ND-04 / BAY 03<br/>AUTO-TRACK ENABLED</div>{feed === 'visible' && <button className="btn danger" onClick={closeDoor} data-testid="button-close-door"><DoorOpen size={12}/> Close Door</button>}</div>
            </div>
            <div className="camera-footer"><span className="airflow-warning"><Wind size={12} style={{ verticalAlign:'middle', marginRight:5 }}/>Airflow reduction at Aisle 2 detected (-15% circulation)</span><div className="density"><div className="density-label"><span>Personnel density</span><b className="mono" style={{ color:'#e8bf74' }}>3 / 8</b></div><div className="meter"><i style={{ width:'38%' }}/></div></div></div>
          </section>
          <section className="panel" id="metrics">
            <div className="panel-head"><div><div className="panel-title"><Activity size={15} color="#53cde0"/> Facility Telemetry</div><div className="panel-sub">Live readings · 2 second refresh</div></div><span className="live-dot" title="Telemetry live"/></div>
            <div className="metric-grid">
              <div className="panel metric-card"><div className="metric-top">Current Power <Zap size={14} color="#42cde1"/></div><div className="metric-value" data-testid="metric-current-power">{load}<small> kW</small></div><div className="metric-foot up"><ArrowDownRight size={11}/> +12% vs last hour</div></div>
              <div className="panel metric-card"><div className="metric-top">Avg. Facility Temp <Thermometer size={14} color="#48cbe1"/></div><div className="metric-value" data-testid="metric-facility-temp">-19.2<small>°C</small></div><div className="metric-foot">Target -20.0°C <span className="up">· delta +0.8°C</span></div></div>
              <div className="panel metric-card"><div className="metric-top">Ambient Humidity <AudioLines size={14} color="#e3a34c"/></div><div className="metric-value">78<small>%</small></div><div className="metric-foot up">Target 70% · high icing risk</div></div>
              <div className="panel metric-card"><div className="metric-top">Est. Carbon Intensity <Leaf size={14} color="#4cc58f"/></div><div className="metric-value">4.8<small> t</small></div><div className="metric-foot up">CO2/day · +18% vs baseline</div></div>
            </div>
            <div style={{ padding:'0 13px 12px', color:'#75899b', fontSize:9 }}>Cooling demand <span className="mono" style={{ color:'#b5c5d2' }}>HIGH</span> <span style={{ color:'#33485c', margin:'0 6px' }}>/</span> Compressor duty cycle <span className="mono" style={{ color:'#e4ba76' }}>82%</span></div>
          </section>
          <TwinMap zones={zones} breach={breach} doorOpen={doorOpen} onSelect={(zone) => setSelectedZoneId(zone.id)}/>
        </div>
        <div className="chart-grid" style={{ marginTop:14 }}>
          <section className="panel nav-target" id="energy-chart">
            <div className="panel-head"><div><div className="panel-title"><Activity size={15} color="#49ccdf"/> 24-hour Energy Consumption</div><div className="panel-sub">Actual load vs. optimized baseline · peak window highlighted</div></div><div className="chart-legend"><span><i className="legend-line"/>Actual kW</span><span><i className="legend-line dotted"/>Optimized</span><span><i className="legend-line red"/>Peak risk</span></div></div>
            <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs><linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#11bfd7" stopOpacity=".22"/><stop offset="95%" stopColor="#11bfd7" stopOpacity="0"/></linearGradient></defs>
              <CartesianGrid stroke="#233143" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="time" tick={{ fill:'#71859a', fontSize:9 }} tickLine={false} axisLine={{ stroke:'#2a3a4c' }} interval={3}/><YAxis domain={[200,310]} tick={{ fill:'#71859a',fontSize:9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`}/><Tooltip content={({ active, payload, label }) => active && payload?.length ? <div style={{ background:'#111c2b',border:'1px solid #365066',padding:'9px 11px',borderRadius:6,color:'#d8e6ef',fontSize:10 }}><b className="mono">{label}</b><div style={{ color:'#35cce0',marginTop:5 }}>Actual {payload.find((p) => p.dataKey === 'actual')?.value} kW</div><div style={{ color:'#9aa8b4' }}>Optimized {payload.find((p) => p.dataKey === 'baseline')?.value} kW</div><div style={{ color:'#e7b264',marginTop:4 }}>Door-ajar events: {payload[0]?.payload?.doors}</div></div> : null}/><ReferenceArea x1="12:00" x2="16:00" fill="#ef4444" fillOpacity=".065"/><Area type="monotone" dataKey="baseline" stroke="#8996a4" strokeDasharray="4 5" strokeWidth={1.5} fill="none" data={optimized ? chartData.map((point) => ({ ...point, baseline: point.baseline - 8 })) : chartData}/><Area type="monotone" dataKey="actual" stroke="#21c5df" strokeWidth={2} fill="url(#actualFill)" activeDot={{ r:4, fill:'#5ee5f1' }}/></AreaChart></ResponsiveContainer></div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><div className="panel-title"><ShieldAlert size={15} color="#ee9d59"/> Anomaly &amp; Alerts</div><div className="panel-sub">3 active findings · prioritized by thermal impact</div></div><span className="severity critical">3 ACTIVE</span></div>
            <div className="anomaly-list">
              {[
                { id:'COMP-02', severity:'critical', text:'Compressor 2 running 18% over thermal baseline (Runaway cycle predicted in 35 mins).' },
                { id:'BAY-03', severity:'warning', text:'Bay 3 loading door open 42s during peak ambient heat (+32°C outside).' },
                { id:'EVAP-01', severity:'advisory', text:'Evaporator 1 icing detected on coil matrix (Defrost cycle recommended).' },
              ].map((item) => <div className="anomaly" key={item.id} data-testid={`anomaly-${item.id.toLowerCase()}`}><div className="anomaly-top"><span className={`severity ${item.severity}`}>{item.severity.toUpperCase()}</span><span className="mono" style={{ color:'#71859a',fontSize:9 }}>{item.id}</span></div><p>{item.text}</p>
                <div className="anomaly-actions">{acknowledged.includes(item.id) ? <span className="good" style={{ fontSize:9 }}><Check size={11} style={{ verticalAlign:'middle' }}/> Acknowledged</span> : <button className="btn" onClick={() => acknowledge(item.id)} data-testid={`button-ack-${item.id.toLowerCase()}`}>Acknowledge</button>}
                  <button className="btn" onClick={() => dispatch(item.id)} data-testid={`button-dispatch-${item.id.toLowerCase()}`}>Dispatch Tech</button><button className="btn primary" onClick={() => { setStrategy('Off-Peak Night Shift'); setOpenings(60); setDuration(42); setAmbient(32); goTo('simulator','Energy Simulations'); notify(`${item.id} mitigation simulation ready`); }} data-testid={`button-mitigate-${item.id.toLowerCase()}`}>Simulate Mitigation</button></div>
              </div>)}
            </div>
          </section>
        </div>
        <div className="lower-grid">
          <section className="panel nav-target" id="simulator" data-testid="module-simulator">
            <div className="panel-head"><div><div className="panel-title"><Thermometer size={15} color="#48ccdf"/> Thermodynamic Shock Simulator</div><div className="panel-sub">Model thermal ingress, energy impact, and shift strategy</div></div><span className="eyebrow">SIMPY CLIENT MODEL</span></div>
            <div className="sim-body"><div className="sim-layout"><div>
              <div className="slider-row"><div className="slider-label"><span>Daily Bay Openings</span><b>{openings} / day</b></div><input aria-label="Daily Bay Openings" type="range" min="20" max="120" value={openings} onChange={(e) => setOpenings(+e.target.value)} data-testid="slider-daily-openings"/></div>
              <div className="slider-row"><div className="slider-label"><span>Average Open Duration</span><b>{duration} sec</b></div><input aria-label="Average Open Duration" type="range" min="10" max="180" value={duration} onChange={(e) => setDuration(+e.target.value)} data-testid="slider-open-duration"/></div>
              <div className="slider-row"><div className="slider-label"><span>External Ambient Temp</span><b>{ambient}°C</b></div><input aria-label="External Ambient Temperature" type="range" min="-5" max="40" value={ambient} onChange={(e) => setAmbient(+e.target.value)} data-testid="slider-ambient-temp"/></div>
              <label className="eyebrow" htmlFor="strategy-select">Mitigation strategy</label><select id="strategy-select" value={strategy} onChange={(e) => setStrategy(e.target.value)} className="strategy-select" data-testid="select-strategy"><option>Off-Peak Night Shift</option><option>Standard Dynamic</option></select>
              </div><div><div className="result-grid">
              <div className="result"><small>Daily energy · current</small><strong data-testid="sim-current">{simulation.current} <span style={{ fontSize:10 }}>kWh</span></strong></div><div className="result"><small>Alternative schedule</small><strong data-testid="sim-alternative">{simulation.alternative} <span style={{ fontSize:10 }}>kWh</span></strong></div><div className="result saved"><small>Energy reduction</small><strong data-testid="sim-reduction">{reduction}%</strong></div><div className="result saved"><small>Saved / day</small><strong data-testid="sim-saved">{saved} <span style={{ fontSize:10 }}>kWh</span></strong></div>
              </div><div style={{ color:'#8799aa',fontSize:9,margin:'9px 0 12px' }}>Estimated daily bill savings <b className="mono" style={{ color:'#68d7a0' }}>₹{Math.round(saved * 8)} / ${(saved * 0.1083).toFixed(2)}</b></div><button className="btn primary" style={{ width:'100%' }} onClick={applySchedule} data-testid="button-apply-schedule"><Check size={13}/> Apply Optimized Schedule</button>{optimized && <div className="good" style={{ marginTop:8,fontSize:9 }} data-testid="status-schedule-applied">Optimized schedule active · Zone A/B setpoints tightened</div>}</div></div></div>
          </section>
          <section className="panel copilot nav-target" id="copilot" data-testid="module-copilot">
            <div className="panel-head"><div><div className="panel-title"><Sparkles size={15} color="#54d1df"/> Offline Energy Co-Pilot</div><div className="panel-sub">Warehouse operations assistant · locally simulated</div></div><span className="model-tag">Model: Llama 3 / GPT-4o RAG (Warehouse Ops Fine-Tuned)</span></div>
            {ticket && <div className="message ai" style={{ margin:'10px 13px 0',borderColor:'#834149',background:'#281b25' }} data-testid="status-urgent-ticket"><strong style={{ color:'#ff8e94' }}>URGENT MAINTENANCE TICKET · CC-2047</strong><div>Bay 3 seal breach — isolate loading bay, install temporary strip curtain, and replace degraded silicone flap seal. Response window: 18 min.</div></div>}
            <div className="chat-messages" aria-live="polite">{messages.map((message, i) => <div className={`message ${message.from}`} key={`${i}-${message.from}`} data-testid={`chat-message-${i}`}>{message.from === 'ai' && <strong>CO-PILOT / OPS INTELLIGENCE</strong>}<div style={{ whiteSpace:'pre-wrap', marginTop:message.from === 'ai' ? 5 : 0 }}>{message.text}</div></div>)}{streaming && <div className="message ai" data-testid="status-copilot-streaming"><strong>CO-PILOT / OPS INTELLIGENCE</strong><div style={{ color:'#61d8e3',marginTop:5 }}>{streamingText || 'Analyzing facility context…'}</div></div>}</div>
            <div className="chips">{['Generate ESG Audit Report','Diagnose Compressor 2','Simulate 1-hour Door Seal Failure'].map((chip) => <button className="chip" key={chip} onClick={() => sendPrompt(chip)} data-testid={`chip-${chip.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-').replace(/-$/,'')}`}>{chip}</button>)}</div>
            <form className="chat-compose" onSubmit={(e: FormEvent) => { e.preventDefault(); sendPrompt(); }}><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask about energy, thermal risk, or maintenance…" aria-label="Co-Pilot prompt" data-testid="input-copilot-prompt"/><button className="btn primary" type="submit" disabled={!prompt.trim() || streaming} data-testid="button-send-prompt"><Send size={13}/> Send</button></form>
          </section>
        </div>
        <section className="panel nav-target" id="esg" style={{ marginTop:14 }} data-testid="module-esg">
          <div className="panel-head"><div><div className="panel-title"><Leaf size={15} color="#45c58e"/> Audit &amp; ESG Impact</div><div className="panel-sub">Monthly verified facility performance · rolling 30-day window</div></div><button className="btn" onClick={() => sendPrompt('Generate ESG Audit Report')} data-testid="button-generate-esg"><ClipboardCheck size={13}/> Generate ESG Audit Report</button></div>
          <div className="esg-grid"><div className="esg-stat"><small>CO2 avoided this month</small><strong data-testid="esg-co2">12.4 tonnes</strong></div><div className="esg-stat"><small>Energy saved</small><strong data-testid="esg-energy">28,600 kWh</strong></div><div className="esg-stat"><small>Direct bill savings</small><strong data-testid="esg-savings">₹2.1 Lakhs <span style={{ fontSize:11 }}>($2,600 USD)</span></strong></div></div>
          <div className="esg-foot"><span className="tree-badge"><Leaf size={12} style={{ verticalAlign:'middle',marginRight:5 }}/> Equivalent to planting 560 trees</span><div className="ring-wrap"><div className="progress-ring"><b>71%</b></div><span>Net-zero<br/><b style={{ color:'#9ae6b9' }}>Tier 1 progress</b></span></div></div>
        </section>
        <section className="panel nav-target" id="config" style={{ marginTop:14 }}>
          <div className="panel-head"><div><div className="panel-title"><Settings2 size={15} color="#7fa6bd"/> Facility Configuration</div><div className="panel-sub">Local demo facility profile · changes are browser-session only</div></div><span className="severity advisory">READ-ONLY PROFILE</span></div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,padding:14 }}><div className="result"><small>Facility ID</small><strong style={{ fontSize:13 }}>ND-04 / NORTH DOCK</strong></div><div className="result"><small>Site ambient / humidity</small><strong style={{ fontSize:13 }}>+32°C / 78%</strong></div><div className="result"><small>Thermal alarm threshold</small><strong style={{ fontSize:13 }}>20 sec door-open</strong></div></div>
        </section>
      </main>
      ) : (
        <main className="content html-suite-container" style={{ padding: 0, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
          <div className="suite-action-strip" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#0e1524', borderBottom: '1px solid #1F2937' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#42d4b2', display: 'inline-block' }} />
              <strong style={{ fontSize: 13, color: '#F8FAFC' }}>{activeNav}</strong>
              <span className="mono" style={{ fontSize: 11, color: '#64748B' }}>{currentNav?.file}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => { const f = document.getElementById('suite-iframe') as HTMLIFrameElement; if (f) f.src = f.src; }}>
                ↻ Reload
              </button>
              <a href={currentNav?.file} target="_blank" rel="noreferrer" className="btn primary" style={{ fontSize: 11, padding: '5px 14px', textDecoration: 'none' }} data-testid="button-open-standalone">
                ↗ Open in New Window
              </a>
            </div>
          </div>
          <iframe
            id="suite-iframe"
            key={currentNav?.file}
            src={currentNav?.file}
            title={activeNav}
            style={{ width: '100%', flex: 1, border: 'none', background: '#0B1120' }}
          />
        </main>
      )}
    </div>
    <div className={`architecture ${collapsed ? 'shift' : ''}`} data-testid="module-architecture">
      <button className="arch-toggle" onClick={() => setOpenArch(!openArch)} aria-expanded={openArch} data-testid="button-toggle-architecture"><span><Cpu size={13} style={{ verticalAlign:'middle',marginRight:7,color:'#4fc8dc' }}/> DIGITAL TWIN ARCHITECTURE <span style={{ color:'#5f7184',marginLeft:8 }}>5-node offline pipeline</span></span>{openArch ? <ChevronDown size={15}/> : <ChevronUp size={15}/>}</button>
      {openArch && <div className="arch-content"><div className="pipeline">{['CCTV/IP Cameras (YOLOv8)','MQTT Broker Telemetry','Digital Twin Sim Engine','LangChain RAG Co-Pilot','React Dashboard'].map((name, i) => <div style={{ display:'contents' }} key={name}><div className="pipeline-node"><i/>{name}</div>{i < 4 && <ArrowRight size={14} className="pipe-arrow"/>}</div>)}</div><div className="arch-status"><Check size={12} style={{ verticalAlign:'middle',marginRight:5 }}/>All 5 nodes connected and reporting optimal packet latency (12ms).</div></div>}
    </div>
    {toast && <div className="toast-stack"><div className="toast" role="status"><strong>Facility update</strong>{toast}</div></div>}
     {selectedZone && <div role="dialog" aria-modal="true" aria-label={`Zone ${selectedZone.id} details`} className="twin-hud" style={{ position:'fixed',right:24,top:'30%',zIndex:45,width:260 }} data-testid="zone-details-hud"><div className="hud-title"><span>ZONE {selectedZone.id} DETAILS</span><button className="btn ghost" onClick={() => setSelectedZoneId(null)} aria-label="Close zone details" data-testid="button-close-zone-details">×</button></div><div className="panel-sub" style={{ marginBottom:8 }}>{selectedZone.name}</div><div className="hud-row"><span>Current Temperature</span><b>{selectedZone.temp.toFixed(1)}°C</b></div><div className="hud-row"><span>Target Setpoint</span><b>{selectedZone.target.toFixed(1)}°C</b></div><div className="hud-row"><span>Active Compressor ID</span><b>{selectedZone.compressor}</b></div><div className="hud-row"><span>Runaway Thermal Risk Score</span><b style={{ color:selectedZone.risk > 60 ? '#ff8686' : '#71d9a8' }}>{selectedZone.risk}/100</b></div></div>}
  </div>;
}

export default App;
