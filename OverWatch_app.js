/// PLEASE READ 

// Edit the file name to app.js before using

'use strict';


const CONFIG = {
// Throw away openrouter key : Will be deleted soon
  OPENROUTER_KEY: ' ', // place your own openrouter key
  OPENROUTER_URL: 'https://openrouter.ai/api/v1/chat/completions',
  MAX_TOKENS: 400,          
  REQUEST_TIMEOUT_MS: 15000,
};


const GEO = {
  factory:  { pos: [12.9716, 77.5946], name: 'FACTORY — INCIDENT SITE' },
  junctions: {
    1: { pos: [12.9795, 77.5842], name: 'JUNCTION 1' },
    2: { pos: [12.9802, 77.6058], name: 'JUNCTION 2' },
    3: { pos: [12.9612, 77.5952], name: 'JUNCTION 3' },
  },
  bases: {
    police: { pos: [12.9902, 77.5742], name: 'POLICE BASE',  cls: 'police', unit: 'PATROL UNIT',  routePref: [1, 2, 3] },
    fire:   { pos: [12.9914, 77.6164], name: 'FIRE BASE',    cls: 'fire',   unit: 'FIRE ENGINE',  routePref: [2, 1, 3] },
    medic:  { pos: [12.9498, 77.5964], name: 'TRAUMA BASE',  cls: 'medic',  unit: 'AMBULANCE',    routePref: [3, 2, 1] },
  },
};



const ROUTE_COLORS = { police: '#4DA6FF', fire: '#FF003C', medic: '#FFB000' };


const map = L.map('map', { zoomControl: true, attributionControl: true })
  .setView(GEO.factory.pos, 14);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

function divMarker(pos, html, size, anchorMid = true) {
  return L.marker(pos, {
    icon: L.divIcon({
      className: '',
      html,
      iconSize: [size, size],
      iconAnchor: anchorMid ? [size / 2, size / 2] : [size / 2, size],
    }),
    interactive: false,
  }).addTo(map);
}










const factoryMarker = divMarker(
  GEO.factory.pos,
  `<div class="mk mk-factory" id="factory-mk" style="width:56px;height:56px;">
     <div class="mk-ring"></div><div class="mk-ring r2"></div>
     <div class="mk-core"></div>
     <div class="mk-label">${GEO.factory.name}</div>
   </div>`,
  56,
);


for (const [id, j] of Object.entries(GEO.junctions)) {
  divMarker(j.pos,
    `<div class="mk mk-junction" style="width:24px;">
       <div class="mk-core"></div>
       <div class="mk-label">${j.name}</div>
     </div>`, 24);
}


for (const b of Object.values(GEO.bases)) {
  b.marker = divMarker(b.pos,
    `<div class="mk mk-base ${b.cls}" id="base-${b.cls}" style="width:24px;">
       <div class="mk-core"></div>
       <div class="mk-label">${b.name}</div>
     </div>`, 24);
}


const termEl = document.getElementById('terminal');
const termStatus = document.getElementById('term-cursor-status');
let termQueue = [];
let termBusy = false;

function termLog(text, cls = '') {
  termQueue.push({ text, cls });
  if (!termBusy) drainTerm();
}

async function drainTerm() {
  termBusy = true;
  termStatus.textContent = '// PROCESSING';
  termStatus.classList.add('busy');
  while (termQueue.length) {
    const { text, cls } = termQueue.shift();
    const line = document.createElement('div');
    line.className = `term-line ${cls}`;
    const span = document.createElement('span');
    span.className = 'cursor';
    line.appendChild(span);
    termEl.appendChild(line);
    for (let i = 0; i < text.length; i++) {
      span.textContent += text[i];
      termEl.scrollTop = termEl.scrollHeight;
      await sleep(text.length > 60 ? 4 : 10);
    }
    span.classList.remove('cursor');
    await sleep(90);
  }
  termStatus.textContent = '// IDLE';
  termStatus.classList.remove('busy');
  termBusy = false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


setInterval(() => {
  document.getElementById('hud-clock').textContent =
    new Date().toISOString().slice(11, 19) + 'Z';
}, 500);


const SYSTEM_PROMPT = `You are OVERWATCH, an emergency dispatch AI for an industrial facility.
You receive two inputs: an INTEL feed (road/traffic conditions at Junctions 1-3) and a CRISIS report.

Rules:
- If intel indicates a junction is blocked/impassable (protest, bad road, accident, flooding, closure), mark it blocked.
- Choose which emergency units to dispatch: "fire" (fire/smoke/explosion/chemical), "police" (intrusion/violence/theft/armed threat/riot), "medic" (injury/medical/casualty/unconscious/trauma). Multiple units may be needed.
- Respond ONLY with valid JSON, no markdown fences, exactly this shape:
{"blocked_junctions":[<ints 1-3>],"units":["fire"|"police"|"medic",...],"reasoning":["short terse uppercase log line",...]}
- reasoning: 3-6 short tactical log lines explaining your parsing and routing decisions.`;

async function queryAgent(intel, crisis, model, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(CONFIG.OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'Project Overwatch',
      },
      body: JSON.stringify({
        model,
        max_tokens: CONFIG.MAX_TOKENS,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `INTEL FEED:\n${intel || '(no intel)'}\n\nCRISIS REPORT:\n${crisis}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    const jsonText = raw.replace(/```json|```/g, '').trim();
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON in model output');
    const parsed = JSON.parse(match[0]);
    return sanitize(parsed);
  } finally {
    clearTimeout(timer);
  }
}

function sanitize(p) {
  const blocked = [...new Set((p.blocked_junctions || []).map(Number).filter((n) => n >= 1 && n <= 3))];
  const units = [...new Set((p.units || []).filter((u) => ['fire', 'police', 'medic'].includes(u)))];
  const reasoning = Array.isArray(p.reasoning) ? p.reasoning.slice(0, 8).map(String) : [];
  return { blocked, units, reasoning };
}


function localAgent(intel, crisis) {
  const blocked = [];
  const iLow = intel.toLowerCase();
  for (const id of [1, 2, 3]) {
    const re = new RegExp(`(junction|jn|j)\\s*-?\\s*${id}`);
    if (re.test(iLow) && /(block|protest|riot|bad|closed|closure|flood|accident|jam|damag|collaps|impass)/.test(iLow)) {
      blocked.push(id);
    }
  }
  const cLow = crisis.toLowerCase();
  const units = [];
  if (/(fire|smoke|blaze|burn|explos|chemical|gas leak|flame)/.test(cLow)) units.push('fire');
  if (/(intrusion|intruder|armed|gun|weapon|theft|attack|hostage|riot|violence|breach|trespass)/.test(cLow)) units.push('police');
  if (/(injur|fell|fall|head|blood|unconscious|medical|casualt|hurt|fracture|collapse[d]? worker|trauma|wound)/.test(cLow)) units.push('medic');

  const reasoning = [
    'LOCAL HEURISTIC CORE ENGAGED — NO UPLINK REQUIRED.',
    ...blocked.map((b) => `INTEL PATTERN MATCH: JUNCTION ${b} FLAGGED IMPASSABLE.`),
    units.length
      ? `CRISIS LEXICON MATCH → UNITS: ${units.map((u) => u.toUpperCase()).join(' + ')}.`
      : 'NO DISPATCH KEYWORDS DETECTED IN CRISIS REPORT.',
  ];
  return { blocked, units, reasoning };
}


function planRoute(baseKey, blockedSet) {
  const base = GEO.bases[baseKey];
  const viable = base.routePref.filter((j) => !blockedSet.has(j));
  const via = viable.length ? viable[0] : null; 
  const pts = [base.pos];
  if (via !== null) pts.push(GEO.junctions[via].pos);
  pts.push(GEO.factory.pos);
  return {
    via,
    rerouted: via !== null && via !== base.routePref[0],
    emergencyDirect: via === null,
    latlngs: pts.map(bowSegmented).flat(),
  };
}


let _prev = null;
function bowSegmented(pt, idx, arr) {
  if (idx === 0) { _prev = pt; return [pt]; }
  const [aLat, aLng] = _prev, [bLat, bLng] = pt;
  const out = [];
  const STEPS = 12;
  // perpendicular bow offset
  const dLat = bLat - aLat, dLng = bLng - aLng;
  const mag = Math.hypot(dLat, dLng) || 1;
  const bow = mag * 0.12;
  for (let s = 1; s <= STEPS; s++) {
    const t = s / STEPS;
    const arc = Math.sin(Math.PI * t) * bow;
    out.push([
      aLat + dLat * t + (-dLng / mag) * arc,
      aLng + dLng * t + (dLat / mag) * arc,
    ]);
  }
  _prev = pt;
  return out;
}


let activeLayers = [];   
let unitAnimations = [];
let opsGeneration = 0;   

function clearOps() {
  opsGeneration++;
  activeLayers.forEach((l) => map.removeLayer(l));
  activeLayers = [];
  unitAnimations.forEach(cancelAnimationFrame);
  unitAnimations = [];
  document.querySelectorAll('.mk-base').forEach((el) => el.classList.remove('dispatched'));
  document.getElementById('factory-mk')?.classList.remove('crisis');
}

function markBlocked(junctionId) {
  const j = GEO.junctions[junctionId];
  const m = divMarker(j.pos,
    `<div class="mk mk-blocked" style="width:40px;height:40px;">
       <div class="x1"></div><div class="x2"></div>
       <div class="mk-label">${j.name} — DENIED</div>
     </div>`, 40);
  activeLayers.push(m);
}

function drawRoute(baseKey, latlngs) {
  const color = ROUTE_COLORS[baseKey];
  const glow = L.polyline(latlngs, {
    color, weight: 9, opacity: 0.25, className: 'route-glow', interactive: false,
  }).addTo(map);
  const line = L.polyline(latlngs, {
    color, weight: 2.5, opacity: 0.95, className: 'route-line', interactive: false,
  }).addTo(map);
  activeLayers.push(glow, line);
}


function animateUnit(baseKey, latlngs, durationMs = 5000) {
  const base = GEO.bases[baseKey];
  const unit = divMarker(latlngs[0],
    `<div class="mk mk-unit ${base.cls}" style="width:18px;">
       <div class="mk-core"></div>
       <div class="mk-label">${base.unit}</div>
     </div>`, 18);
  activeLayers.push(unit);

  
  const cum = [0];
  for (let i = 1; i < latlngs.length; i++) {
    const [aLat, aLng] = latlngs[i - 1], [bLat, bLng] = latlngs[i];
    cum.push(cum[i - 1] + Math.hypot(bLat - aLat, bLng - aLng));
  }
  const total = cum[cum.length - 1];
  const gen = opsGeneration;

  
  function run() {
    const start = performance.now();
    function frame(now) {
      if (gen !== opsGeneration) return; 
      const t = Math.min((now - start) / durationMs, 1);
      const dist = t * total;
      let i = 1;
      while (i < cum.length && cum[i] < dist) i++;
      if (i >= cum.length) i = cum.length - 1;
      const segT = (dist - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      const [aLat, aLng] = latlngs[i - 1], [bLat, bLng] = latlngs[i];
      unit.setLatLng([aLat + (bLat - aLat) * segT, aLng + (bLng - aLng) * segT]);
      if (t < 1) unitAnimations.push(requestAnimationFrame(frame));
      else setTimeout(() => {
        if (gen !== opsGeneration) return;
        unit.setLatLng(latlngs[0]);
        run();
      }, 1500);
    }
    unitAnimations.push(requestAnimationFrame(frame));
  }
  run();
}


const btn = document.getElementById('execute-btn');
const coreStatus = document.getElementById('core-status');
const gridStatus = document.getElementById('grid-status');

document.getElementById('api-key').value = CONFIG.OPENROUTER_KEY;

btn.addEventListener('click', executeDispatch);

async function executeDispatch() {
  const intel = document.getElementById('intel-input').value.trim();
  const crisis = document.getElementById('crisis-input').value.trim();
  const model = document.getElementById('model-select').value;
  const key = document.getElementById('api-key').value.trim();

  if (!crisis) {
    termLog('> ERROR: CRISIS TRIGGER EMPTY. NOTHING TO DISPATCH.', 'crit');
    return;
  }

  btn.disabled = true;
  clearOps();
  setStatus(coreStatus, '● ANALYZING', 'warn');
  setStatus(gridStatus, '● CRISIS ACTIVE', 'crit');

  termLog('> ════════ DISPATCH PROTOCOL INITIATED ════════', 'dim');
  termLog(`> INGESTING CRISIS REPORT: "${crisis.toUpperCase().slice(0, 70)}${crisis.length > 70 ? '…' : ''}"`);
  if (intel) termLog(`> INGESTING INTEL FEED: "${intel.toUpperCase().slice(0, 70)}${intel.length > 70 ? '…' : ''}"`, 'warn');
  else termLog('> INTEL FEED EMPTY — ASSUMING ALL JUNCTIONS GREEN.', 'dim');

  let result;
  if (model === 'LOCAL' || !key) {
    result = localAgent(intel, crisis);
  } else {
    termLog(`> UPLINK → ${model.toUpperCase()} …`, 'dim');
    try {
      result = await queryAgent(intel, crisis, model, key);
      termLog('> AI CORE RESPONSE VALIDATED. PARSING DIRECTIVE.', 'ok');
    } catch (err) {
      termLog(`> UPLINK FAILURE [${err.message}] — FAILING OVER TO LOCAL HEURISTIC CORE.`, 'crit');
      result = localAgent(intel, crisis);
    }
  }

  for (const line of result.reasoning) termLog(`> ${line.toUpperCase()}`);


  const blockedSet = new Set(result.blocked);
  for (const b of result.blocked) {
    termLog(`> INTEL CONFIRMED: JUNCTION ${b} BLOCKED — MARKING DENIED ZONE.`, 'crit');
    markBlocked(b);
  }

  if (!result.units.length) {
    termLog('> ASSESSMENT: NO EMERGENCY UNITS REQUIRED. STANDING DOWN.', 'dim');
    setStatus(coreStatus, '● STANDBY', 'ok');
    setStatus(gridStatus, '● NOMINAL', 'ok');
    btn.disabled = false;
    return;
  }

  document.getElementById('factory-mk')?.classList.add('crisis');

  // dispatch each selected unit
  for (const unitKey of result.units) {
    const base = GEO.bases[unitKey];
    const plan = planRoute(unitKey, blockedSet);
    document.getElementById(`base-${base.cls}`)?.classList.add('dispatched');

    termLog(`> DISPATCHING ${base.unit} FROM ${base.name}.`, unitKey === 'fire' ? 'crit' : unitKey === 'medic' ? 'warn' : '');
    if (plan.emergencyDirect) {
      termLog(`> ALL JUNCTIONS DENIED — ${base.unit} AUTHORIZED FOR DIRECT OFF-ROUTE APPROACH.`, 'crit');
    } else if (plan.rerouted) {
      termLog(`> PRIMARY ROUTE VIA JUNCTION ${base.routePref[0]} COMPROMISED → REROUTING VIA JUNCTION ${plan.via}.`, 'warn');
    } else {
      termLog(`> OPTIMAL VECTOR LOCKED: VIA JUNCTION ${plan.via}. ETA NOMINAL.`, 'ok');
    }

    drawRoute(unitKey, plan.latlngs);
    animateUnit(unitKey, plan.latlngs);
    await sleep(500);
  }

  termLog(`> ${result.units.length} UNIT(S) EN ROUTE. TRACKING VECTORS LIVE.`, 'ok');
  termLog('> ════════ PROTOCOL COMPLETE — OVERWATCH MONITORING ════════', 'dim');
  setStatus(coreStatus, '● ENGAGED', 'crit');
  btn.disabled = false;
}

function setStatus(el, text, cls) {
  el.textContent = text;
  el.className = cls;
}

/* boot lines */
termLog('> THEATER MAP SYNCED — SECTOR 7G INDUSTRIAL ZONE.', 'dim');
termLog('> 3 JUNCTION NODES, 3 RESPONSE BASES REGISTERED.', 'dim');
