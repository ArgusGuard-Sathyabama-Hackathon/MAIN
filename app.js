/* ══════════════════════════════════════════════════════════
   ARGUS GUARD — factory floor evacuation simulation.
   Workers wander the floor; when a hazard is placed they are
   routed to safe exits via A*, optionally directed by an AI
   core over OpenRouter (with a guaranteed local fallback).
   ══════════════════════════════════════════════════════════ */

'use strict';

/* ── CONFIG ─────────────────────────────────────────────── */
const CONFIG = {
  OPENROUTER_URL: 'https://openrouter.ai/api/v1/chat/completions',
  MAX_TOKENS: 350,
  REQUEST_TIMEOUT_MS: 15000,
};

const COLS = 48, ROWS = 32, CELL = 20;
const W = COLS * CELL, H = ROWS * CELL;

/* ── FLOOR GEOMETRY ─────────────────────────────────────── */
// Dense maze layout: machine blocks separated by 2-cell corridors, with
// several blocks extended across corridors (and loose pallet/drum piles)
// to force detours. Connectivity of every corridor cell is verified offline.
const MACHINES = [
  // row 1
  { x: 3,  y: 3,  w: 8, h: 6, label: 'SMELTER LINE' },
  { x: 11, y: 3,  w: 6, h: 6, label: 'PRESS SHOP' },
  { x: 19, y: 3,  w: 6, h: 6, label: 'CNC BAY' },
  { x: 27, y: 3,  w: 6, h: 6, label: 'ASSEMBLY A' },
  { x: 35, y: 3,  w: 6, h: 6, label: 'ASSEMBLY B' },
  { x: 43, y: 3,  w: 2, h: 6, label: 'ELEC' },
  // row 2
  { x: 3,  y: 11, w: 6, h: 4, label: 'COIL STORE' },
  { x: 11, y: 11, w: 6, h: 4, label: 'PRESS B' },
  { x: 19, y: 11, w: 6, h: 6, label: 'FORGE' },
  { x: 27, y: 11, w: 6, h: 4, label: 'ROBOT CELL' },
  { x: 35, y: 9,  w: 6, h: 6, label: 'QA LAB' },
  { x: 43, y: 11, w: 2, h: 4, label: 'HV PANEL' },
  // row 3
  { x: 3,  y: 17, w: 6, h: 4, label: 'RACKING A' },
  { x: 11, y: 17, w: 6, h: 4, label: 'PACKING' },
  { x: 19, y: 17, w: 6, h: 4, label: 'PAINT BOOTH' },
  { x: 27, y: 17, w: 8, h: 4, label: 'CHEM TANKS' },
  { x: 37, y: 17, w: 4, h: 4, label: 'TOOLING' },
  { x: 43, y: 17, w: 2, h: 4, label: 'COMPRESSOR' },
  // row 4
  { x: 3,  y: 23, w: 6, h: 6, label: 'WAREHOUSE A' },
  { x: 11, y: 23, w: 6, h: 6, label: 'WAREHOUSE B' },
  { x: 19, y: 23, w: 6, h: 6, label: 'KITTING' },
  { x: 27, y: 23, w: 6, h: 6, label: 'DOCK STAGING' },
  { x: 35, y: 23, w: 6, h: 6, label: 'LOADING' },
  { x: 43, y: 23, w: 2, h: 6, label: 'PUMP HOUSE' },
  // corridor obstructions
  { x: 9,  y: 15, w: 2, h: 2, label: 'PALLETS' },
  { x: 41, y: 11, w: 2, h: 2, label: 'DRUMS' },
  { x: 25, y: 21, w: 2, h: 2, label: 'CRATES' },
];

// Numbered exits: narrow 2-cell gaps on the border + an "inside" rally cell.
const EXITS = {
  1: { gap: [{ x: 5, y: 0 }, { x: 6, y: 0 }],                 inside: { x: 5, y: 2 },   side: 'N' },
  2: { gap: [{ x: 25, y: 0 }, { x: 26, y: 0 }],               inside: { x: 25, y: 2 },  side: 'N' },
  3: { gap: [{ x: COLS - 1, y: 5 }, { x: COLS - 1, y: 6 }],   inside: { x: 45, y: 6 },  side: 'E' },
  4: { gap: [{ x: COLS - 1, y: 21 }, { x: COLS - 1, y: 22 }], inside: { x: 45, y: 21 }, side: 'E' },
  5: { gap: [{ x: 37, y: ROWS - 1 }, { x: 38, y: ROWS - 1 }], inside: { x: 37, y: 29 }, side: 'S' },
  6: { gap: [{ x: 13, y: ROWS - 1 }, { x: 14, y: ROWS - 1 }], inside: { x: 13, y: 29 }, side: 'S' },
  7: { gap: [{ x: 0, y: 17 }, { x: 0, y: 18 }],               inside: { x: 2, y: 18 },  side: 'W' },
};

// Static walkability grid (walls + machines). Hazards are handled dynamically.
const baseBlocked = [];
(function buildGrid() {
  const exitCells = new Set();
  for (const e of Object.values(EXITS)) for (const c of e.gap) exitCells.add(c.x + ',' + c.y);
  for (let y = 0; y < ROWS; y++) {
    baseBlocked[y] = [];
    for (let x = 0; x < COLS; x++) {
      const border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      baseBlocked[y][x] = border && !exitCells.has(x + ',' + y);
    }
  }
  for (const m of MACHINES)
    for (let y = m.y; y < m.y + m.h; y++)
      for (let x = m.x; x < m.x + m.w; x++) baseBlocked[y][x] = true;
})();

const INTERIOR_CELLS = (() => {
  let n = 0;
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (!baseBlocked[y][x]) n++;
  return n;
})();

// LED evacuation signs: auto-placed at corridor junctions (free cells open
// in both axes with 3+ free orthogonal neighbours), spaced apart.
const SIGNS = (() => {
  const picked = [];
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++) {
      if (baseBlocked[y][x]) continue;
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (!baseBlocked[y + dy]?.[x + dx]) n++;
      const horiz = !baseBlocked[y][x - 1] || !baseBlocked[y][x + 1];
      const vert = !baseBlocked[y - 1]?.[x] || !baseBlocked[y + 1]?.[x];
      if (n >= 3 && horiz && vert &&
          picked.every((p) => Math.hypot(p.x - x, p.y - y) >= 7))
        picked.push({ x, y });
    }
  return picked;
})();

function sectorAt(px, py) {
  return px < W / 2 ? (py < H / 2 ? 'A' : 'C') : (py < H / 2 ? 'B' : 'D');
}

/* ── STATE ──────────────────────────────────────────────── */
const sim = { speed: 1, time: 0, running: true };
let workers = [];
let hazards = [];          // {type:'fire'|'gas', px, py, r, maxR, rate}
let evacuatedCount = 0;
let injuredCount = 0;
let armedHazard = null;    // 'fire' | 'gas' while placing
let directive = { primary: null, avoid: [] };
let ai = { connected: false, key: '', model: '' };
let allClearLogged = false;

const HAZARD_SPECS = {
  fire: { r0: 14, maxR: 120, rate: 3.2, name: 'FIRE' },
  gas:  { r0: 18, maxR: 185, rate: 5.0, name: 'GAS LEAK' },
};

/* ── DOM ────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const canvas = $('floor');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

/* ── INCIDENT LOG ───────────────────────────────────────── */
function timestamp() { return new Date().toTimeString().slice(0, 8); }

function logEvent(msg, cls = '') {
  const el = document.createElement('div');
  el.className = 'log-line ' + cls;
  el.textContent = `${timestamp()} | ${msg}`;
  const log = $('incident-log');
  log.appendChild(el);
  while (log.children.length > 80) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

/* ── HAZARD FIELD HELPERS ───────────────────────────────── */
function hazardDistAt(px, py) {
  // signed distance to nearest hazard edge (negative = inside)
  let min = Infinity;
  for (const h of hazards) min = Math.min(min, Math.hypot(px - h.px, py - h.py) - h.r);
  return min;
}

function cellCenter(c) { return { px: c.x * CELL + CELL / 2, py: c.y * CELL + CELL / 2 }; }

function cellBlocked(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS || baseBlocked[y][x]) return true;
  const { px, py } = cellCenter({ x, y });
  return hazardDistAt(px, py) < 0;
}

function cellDanger(x, y) {
  // extra A* cost for skirting close to a hazard
  const { px, py } = cellCenter({ x, y });
  const d = hazardDistAt(px, py);
  if (d < CELL * 2) return 24;
  if (d < CELL * 4) return 6;
  return 0;
}

/* ── A* PATHFINDING ─────────────────────────────────────── */
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.4], [1, -1, 1.4], [-1, 1, 1.4], [-1, -1, 1.4],
];

function astar(start, goal) {
  if (cellBlocked(goal.x, goal.y)) return null;
  const key = (x, y) => y * COLS + x;
  const open = [{ x: start.x, y: start.y, g: 0, f: 0 }];
  const gScore = new Map([[key(start.x, start.y), 0]]);
  const came = new Map();
  const closed = new Set();

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (cur.x === goal.x && cur.y === goal.y) {
      const path = [];
      let k = ck;
      while (came.has(k)) { path.push({ x: k % COLS, y: Math.floor(k / COLS) }); k = came.get(k); }
      path.push(start);
      return path.reverse();
    }

    for (const [dx, dy, cost] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (cellBlocked(nx, ny)) continue;
      if (dx && dy && (cellBlocked(cur.x + dx, cur.y) || cellBlocked(cur.x, cur.y + dy))) continue; // no corner cutting
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const g = gScore.get(ck) + cost + cellDanger(nx, ny);
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, ck);
        const hcost = Math.hypot(goal.x - nx, goal.y - ny);
        open.push({ x: nx, y: ny, g, f: g + hcost });
      }
    }
  }
  return null;
}

function nearestFreeCell(cx, cy) {
  if (!cellBlocked(cx, cy)) return { x: cx, y: cy };
  for (let r = 1; r < 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (!cellBlocked(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
  return null;
}

function randomFreeCell() {
  for (let i = 0; i < 400; i++) {
    const x = 2 + Math.floor(Math.random() * (COLS - 4));
    const y = 2 + Math.floor(Math.random() * (ROWS - 4));
    if (!cellBlocked(x, y)) return { x, y };
  }
  return { x: 2, y: 16 };
}

/* ── WORKERS ────────────────────────────────────────────── */
function spawnWorker() {
  const c = randomFreeCell();
  const { px, py } = cellCenter(c);
  return {
    x: px, y: py,
    state: 'active',       // active | evacuating | injured
    path: [],
    speed: 21 + Math.random() * 9,
    exposure: 0,
    dwell: Math.random() * 3,
    repath: Math.random() * 1.5,
    exit: null,
  };
}

function addWorkers(n) {
  for (let i = 0; i < n; i++) workers.push(spawnWorker());
  if (hazards.length) logEvent(`${n} ADDITIONAL PERSONNEL DETECTED — ISSUING EVAC ORDER`, 'warn');
}

/* choose an exit + path for a worker under current directive */
function planEvacuation(w) {
  const start = nearestFreeCell(Math.floor(w.x / CELL), Math.floor(w.y / CELL));
  if (!start) return false;

  const statuses = exitStatuses();
  const names = Object.keys(EXITS)
    .filter((n) => statuses[n] !== 'BLOCKED')
    .sort((a, b) => rankExit(a, w, statuses) - rankExit(b, w, statuses));

  for (const name of [...names, ...Object.keys(EXITS)]) { // blocked exits as last resort
    const path = astar(start, EXITS[name].inside);
    if (path) { w.path = path.map(cellCenter); w.exit = name; return true; }
  }
  return false;
}

function rankExit(name, w, statuses) {
  const { px, py } = cellCenter(EXITS[name].inside);
  let score = Math.hypot(px - w.x, py - w.y);
  if (statuses[name] === 'CAUTION') score += 260;
  if (directive.avoid.includes(name)) score += 400;
  if (directive.primary === name) score -= 220;
  return score;
}

function updateWorker(w, dt) {
  if (w.state === 'injured') return;

  // hazard exposure
  const d = hazardDistAt(w.x, w.y);
  if (d < 0) {
    w.exposure += dt * 0.65;
    if (w.exposure >= 1) {
      w.state = 'injured';
      injuredCount++;
      logEvent(`MAN DOWN — SECTOR ${sectorAt(w.x, w.y)} — MEDICAL FLAG RAISED`, 'crit');
      return;
    }
  } else if (w.exposure > 0) {
    w.exposure = Math.max(0, w.exposure - dt * 0.25);
  }

  if (hazards.length && w.state === 'active') {
    w.state = 'evacuating';
    planEvacuation(w);
  }

  if (w.state === 'evacuating') {
    w.repath -= dt;
    // re-plan periodically (hazards grow) or when the path was invalidated
    if (w.repath <= 0 || !w.path.length) {
      w.repath = 1.2 + Math.random() * 0.8;
      planEvacuation(w);
    }
    moveAlongPath(w, dt, w.speed * 1.35); // hurried walk — no sprinting in corridors
    // reached exit rally point?
    if (w.exit && !w.path.length) {
      const { px, py } = cellCenter(EXITS[w.exit].inside);
      if (Math.hypot(w.x - px, w.y - py) < CELL) {
        evacuatedCount++;
        logEvent(`WORKER CLEARED VIA EXIT ${w.exit}`, 'ok');
        w.state = 'gone';
      }
    }
  } else {
    // idle wander
    if (w.path.length) {
      moveAlongPath(w, dt, w.speed * 0.6);
    } else {
      w.dwell -= dt;
      if (w.dwell <= 0) {
        w.dwell = 1 + Math.random() * 4;
        const start = nearestFreeCell(Math.floor(w.x / CELL), Math.floor(w.y / CELL));
        const path = start && astar(start, randomFreeCell());
        if (path) w.path = path.map(cellCenter);
      }
    }
  }
}

function moveAlongPath(w, dt, speed) {
  let dist = speed * dt;
  while (dist > 0 && w.path.length) {
    const t = w.path[0];
    const dx = t.px - w.x, dy = t.py - w.y;
    const len = Math.hypot(dx, dy);
    if (len <= dist) { w.x = t.px; w.y = t.py; w.path.shift(); dist -= len; }
    else { w.x += (dx / len) * dist; w.y += (dy / len) * dist; dist = 0; }
  }
}

/* ── EXIT STATUS ────────────────────────────────────────── */
function exitStatuses() {
  const out = {};
  for (const [name, e] of Object.entries(EXITS)) {
    const { px, py } = cellCenter(e.inside);
    const d = hazardDistAt(px, py);
    out[name] = d < CELL * 1.5 ? 'BLOCKED' : d < CELL * 7 ? 'CAUTION' : 'CLEAR';
  }
  return out;
}

/* ── EVACUATION FLOW FIELD (drives the LED arrow signs) ─── */
// Multi-source Dijkstra from every usable exit, hazard-aware. Each sign's
// arrow points down the distance gradient toward the nearest usable exit.
let flowField = null;

function computeFlowField() {
  const st = exitStatuses();
  const names = Object.keys(EXITS);
  let usable = names.filter((n) => st[n] !== 'BLOCKED' && !directive.avoid.includes(n));
  if (!usable.length) usable = names.filter((n) => st[n] !== 'BLOCKED');
  if (!usable.length) usable = names;

  const dist = new Float64Array(COLS * ROWS).fill(Infinity);
  const open = [];
  for (const n of usable) {
    const c = EXITS[n].inside;
    if (cellBlocked(c.x, c.y)) continue;
    dist[c.y * COLS + c.x] = 0;
    open.push({ x: c.x, y: c.y, d: 0 });
  }
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].d < open[bi].d) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.d > dist[cur.y * COLS + cur.x]) continue;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (cellBlocked(nx, ny)) continue;
      if (dx && dy && (cellBlocked(cur.x + dx, cur.y) || cellBlocked(cur.x, cur.y + dy))) continue;
      const nd = cur.d + cost + cellDanger(nx, ny);
      if (nd < dist[ny * COLS + nx]) {
        dist[ny * COLS + nx] = nd;
        open.push({ x: nx, y: ny, d: nd });
      }
    }
  }
  flowField = dist;
}

function signDirection(s) {
  // angle (radians) toward the best neighbouring cell, or null if trapped
  if (!flowField) return null;
  let best = null, bd = flowField[s.y * COLS + s.x];
  for (const [dx, dy] of DIRS) {
    const nx = s.x + dx, ny = s.y + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    const nd = flowField[ny * COLS + nx];
    if (nd < bd) { bd = nd; best = Math.atan2(dy, dx); }
  }
  return best;
}

let lastExitStatuses = {};
function renderExitCards() {
  const st = exitStatuses();
  for (const [name, status] of Object.entries(st)) {
    if (lastExitStatuses[name] === status) continue;
    const badge = $('exit-' + name).querySelector('.badge');
    badge.textContent = status;
    badge.className = 'badge ' + status.toLowerCase();
    if (lastExitStatuses[name] && status === 'BLOCKED')
      logEvent(`EXIT ${name} COMPROMISED — MARKED BLOCKED`, 'crit');
    else if (lastExitStatuses[name] === 'BLOCKED' && status !== 'BLOCKED')
      logEvent(`EXIT ${name} STATUS DOWNGRADED TO ${status}`, 'warn');
  }
  lastExitStatuses = st;
}

/* ── HAZARD COVERAGE / THREAT LEVEL ─────────────────────── */
function coveragePct() {
  let covered = 0;
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++) {
      if (baseBlocked[y][x]) continue;
      const { px, py } = cellCenter({ x, y });
      if (hazardDistAt(px, py) < 0) covered++;
    }
  return Math.round((covered / INTERIOR_CELLS) * 100);
}

let threatLevel = 'SECURE';
function updateThreat(coverage) {
  const next = !hazards.length ? 'SECURE'
    : (coverage >= 8 || injuredCount > 0) ? 'CRITICAL' : 'ELEVATED';
  if (next !== threatLevel) {
    threatLevel = next;
    document.querySelectorAll('.threat-seg').forEach((el) =>
      el.classList.toggle('lit', el.dataset.level === next));
    logEvent(`THREAT LEVEL → ${next}`, next === 'CRITICAL' ? 'crit' : next === 'ELEVATED' ? 'warn' : 'ok');
  }
}

/* ── AI DIRECTIVE ───────────────────────────────────────── */
const SYSTEM_PROMPT = `You are ARGUS, an AI evacuation coordinator for a maze-like factory floor with 7 numbered exits ("1" through "7").
You receive a JSON situation report: active hazards (type, sector, coverage) and per-exit distance from the nearest hazard in meters (larger = safer).
Respond ONLY with valid JSON, no markdown fences, exactly:
{"primary_exit":"<exit number as string>","avoid_exits":["<exit numbers>"],"reasoning":["short terse uppercase log line",...]}
- primary_exit: the safest exit to rally workers toward.
- avoid_exits: exits too close to hazards to use.
- reasoning: 2-4 short tactical log lines.`;

function buildSituation() {
  const st = exitStatuses();
  const exits = {};
  for (const [name, e] of Object.entries(EXITS)) {
    const { px, py } = cellCenter(e.inside);
    exits[name] = { status: st[name], hazard_distance_m: Math.max(0, Math.round(hazardDistAt(px, py) / 4)) };
  }
  return {
    hazards: hazards.map((h) => ({ type: h.type, sector: sectorAt(h.px, h.py) })),
    coverage_pct: coveragePct(),
    workers_on_floor: workers.filter((w) => w.state === 'active' || w.state === 'evacuating').length,
    exits,
  };
}

function localDirective() {
  const st = exitStatuses();
  let best = null, bestD = -Infinity;
  const avoid = [];
  for (const [name, e] of Object.entries(EXITS)) {
    const { px, py } = cellCenter(e.inside);
    const d = hazardDistAt(px, py);
    if (st[name] === 'BLOCKED') avoid.push(name);
    if (d > bestD) { bestD = d; best = name; }
  }
  return {
    primary_exit: best,
    avoid_exits: avoid,
    reasoning: [
      'LOCAL HEURISTIC CORE ENGAGED — NO UPLINK.',
      `MAX HAZARD STANDOFF AT EXIT ${best} — DESIGNATED PRIMARY.`,
      ...(avoid.length ? [`EXITS ${avoid.join(' + ')} DENIED — PROXIMITY VIOLATION.`] : []),
    ],
  };
}

async function queryAI(situation) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(CONFIG.OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${ai.key}`,
        'Content-Type': 'application/json',
        'X-Title': 'Argus Guard',
      },
      body: JSON.stringify({
        model: ai.model,
        max_tokens: CONFIG.MAX_TOKENS,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(situation) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    const match = raw.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON in model output');
    return JSON.parse(match[0]);
  } finally {
    clearTimeout(timer);
  }
}

let directiveGen = 0;
async function issueDirective() {
  const gen = ++directiveGen;

  // apply local directive instantly so evacuation never waits on the network
  applyDirective(localDirective(), !ai.connected);

  if (!ai.connected) return;
  logEvent(`UPLINK → ${ai.model.split('/').pop().toUpperCase()} — REQUESTING DIRECTIVE`, 'ai');
  try {
    const result = await queryAI(buildSituation());
    if (gen !== directiveGen || !hazards.length) return; // stale response
    applyDirective(sanitizeDirective(result), true);
  } catch (err) {
    if (gen !== directiveGen) return;
    logEvent(`UPLINK FAILURE [${err.message}] — LOCAL DIRECTIVE STANDS`, 'crit');
  }
}

function sanitizeDirective(p) {
  const names = Object.keys(EXITS);
  return {
    primary_exit: names.includes(String(p.primary_exit)) ? String(p.primary_exit) : localDirective().primary_exit,
    avoid_exits: Array.isArray(p.avoid_exits) ? p.avoid_exits.map(String).filter((n) => names.includes(n)) : [],
    reasoning: Array.isArray(p.reasoning) ? p.reasoning.slice(0, 5).map(String) : [],
  };
}

function applyDirective(d, announce) {
  directive = { primary: d.primary_exit, avoid: d.avoid_exits };
  if (!announce) return;
  for (const line of d.reasoning) logEvent(`ARGUS: ${line.toUpperCase()}`, 'ai');
  logEvent(`ARGUS DIRECTIVE: ROUTE TO EXIT ${d.primary_exit}`, 'ok');
  for (const w of workers) if (w.state === 'evacuating') w.repath = 0; // re-plan under new directive
}

/* ── HAZARD PLACEMENT ───────────────────────────────────── */
function armHazard(type) {
  armedHazard = armedHazard === type ? null : type;
  $('btn-fire').classList.toggle('armed', armedHazard === 'fire');
  $('btn-gas').classList.toggle('armed', armedHazard === 'gas');
  $('hazard-hint').classList.toggle('hidden', !armedHazard);
  $('place-hint').classList.toggle('hidden', !armedHazard);
  $('canvas-wrap').classList.toggle('placing', !!armedHazard);
}

canvas.addEventListener('click', (ev) => {
  if (!armedHazard) return;
  const rect = canvas.getBoundingClientRect();
  const px = ((ev.clientX - rect.left) / rect.width) * W;
  const py = ((ev.clientY - rect.top) / rect.height) * H;
  if (px < CELL || py < CELL || px > W - CELL || py > H - CELL) return;

  const spec = HAZARD_SPECS[armedHazard];
  hazards.push({ type: armedHazard, px, py, r: spec.r0, maxR: spec.maxR, rate: spec.rate });
  logEvent(`${spec.name} DETECTED — SECTOR ${sectorAt(px, py)}`, 'crit');
  logEvent('EVACUATION PROTOCOL INITIATED — ALL PERSONNEL TO EXITS', 'warn');
  allClearLogged = false;
  armHazard(null);
  issueDirective();
});

/* ── RENDER ─────────────────────────────────────────────── */
function render() {
  ctx.clearRect(0, 0, W, H);

  // floor
  ctx.fillStyle = '#0a1220';
  ctx.fillRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = 'rgba(0,255,136,0.045)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); }
  for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); }
  ctx.stroke();

  // sector labels
  ctx.font = '700 64px "Share Tech Mono", monospace';
  ctx.fillStyle = 'rgba(74,96,128,0.10)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('A', W * 0.25, H * 0.25); ctx.fillText('B', W * 0.75, H * 0.25);
  ctx.fillText('C', W * 0.25, H * 0.75); ctx.fillText('D', W * 0.75, H * 0.75);

  // outer wall
  ctx.strokeStyle = '#1f3a50';
  ctx.lineWidth = 4;
  ctx.strokeRect(CELL / 2, CELL / 2, W - CELL, H - CELL);

  // machines
  for (const m of MACHINES) {
    const x = m.x * CELL, y = m.y * CELL, w = m.w * CELL, h = m.h * CELL;
    ctx.fillStyle = '#101e2e';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#22405c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(74,96,128,0.75)';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText(m.label, x + w / 2, y + h / 2);
  }

  // exits
  const st = exitStatuses();
  const exitColor = { CLEAR: '#00ff88', CAUTION: '#ffaa00', BLOCKED: '#ff2244' };
  const labelOffset = { N: [0, 26], S: [0, -26], E: [-34, 0], W: [34, 0] };
  for (const [name, e] of Object.entries(EXITS)) {
    const color = exitColor[st[name]];
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    for (const c of e.gap) ctx.fillRect(c.x * CELL + 2, c.y * CELL + 2, CELL - 4, CELL - 4);
    ctx.shadowBlur = 0;
    const gc = e.gap.reduce((a, c) => ({ x: a.x + c.x / e.gap.length, y: a.y + c.y / e.gap.length }), { x: 0, y: 0 });
    const [ox, oy] = labelOffset[e.side];
    ctx.fillStyle = color;
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.fillText(`EXIT ${name}`, gc.x * CELL + CELL / 2 + ox, gc.y * CELL + CELL / 2 + oy);
  }

  // LED evacuation arrow signs
  const evacActive = hazards.length > 0;
  const pulse = evacActive ? 0.6 + 0.4 * Math.sin(sim.time * 7) : 1;
  for (const s of SIGNS) {
    const { px, py } = cellCenter(s);
    const angle = signDirection(s);
    ctx.save();
    ctx.translate(px, py);
    // sign panel
    ctx.fillStyle = 'rgba(4,7,12,0.92)';
    ctx.strokeStyle = evacActive ? `rgba(255,34,68,${0.85 * pulse})` : 'rgba(255,34,68,0.30)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-9, -9, 18, 18, 3);
    ctx.fill();
    ctx.stroke();
    if (angle === null) {
      // no usable route from here — LED shows an X
      ctx.strokeStyle = `rgba(255,34,68,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -4); ctx.lineTo(4, 4);
      ctx.moveTo(4, -4); ctx.lineTo(-4, 4);
      ctx.stroke();
    } else {
      ctx.rotate(angle);
      const a = evacActive ? pulse : 0.35;
      ctx.strokeStyle = `rgba(255,48,80,${a})`;
      ctx.fillStyle = `rgba(255,48,80,${a})`;
      ctx.shadowColor = '#ff2244';
      ctx.shadowBlur = evacActive ? 9 : 3;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(2, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(1, -4.5); ctx.lineTo(7.5, 0); ctx.lineTo(1, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // hazards
  for (const h of hazards) {
    const flicker = h.type === 'fire' ? 0.85 + Math.random() * 0.15 : 1;
    const grad = ctx.createRadialGradient(h.px, h.py, 2, h.px, h.py, h.r);
    if (h.type === 'fire') {
      grad.addColorStop(0, `rgba(255,240,180,${0.95 * flicker})`);
      grad.addColorStop(0.35, `rgba(255,120,30,${0.75 * flicker})`);
      grad.addColorStop(1, 'rgba(255,34,68,0.10)');
    } else {
      grad.addColorStop(0, 'rgba(190,255,120,0.65)');
      grad.addColorStop(0.6, 'rgba(140,220,60,0.30)');
      grad.addColorStop(1, 'rgba(120,200,40,0.05)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(h.px, h.py, h.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = h.type === 'fire' ? 'rgba(255,34,68,0.5)' : 'rgba(190,255,120,0.4)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(h.px, h.py, h.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = h.type === 'fire' ? '#ff2244' : '#cdff70';
    ctx.font = '12px "Share Tech Mono", monospace';
    ctx.fillText(h.type === 'fire' ? '🔥 FIRE' : '☣ GAS', h.px, h.py - h.r - 10);
  }

  // workers
  for (const w of workers) {
    if (w.state === 'gone') continue;
    if (w.state === 'injured') {
      ctx.strokeStyle = '#ff2244';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(w.x - 5, w.y - 5); ctx.lineTo(w.x + 5, w.y + 5);
      ctx.moveTo(w.x + 5, w.y - 5); ctx.lineTo(w.x - 5, w.y + 5);
      ctx.stroke();
      continue;
    }
    const color = w.state === 'evacuating' ? '#00ff88' : '#35a6ff';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(w.x, w.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/* ── STATS / HUD ────────────────────────────────────────── */
function formatTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function updateHUD() {
  const active = workers.filter((w) => w.state === 'active' || w.state === 'evacuating').length;
  $('ws-active').textContent = active;
  $('ws-evac').textContent = evacuatedCount;
  $('ws-injured').textContent = injuredCount;
  $('stat-time').textContent = formatTime(sim.time);
  $('stat-evac').textContent = evacuatedCount;
  $('stat-injured').textContent = injuredCount;
  const cov = coveragePct();
  $('stat-coverage').textContent = cov + '%';
  updateThreat(cov);
  renderExitCards();

  if (hazards.length && active === 0 && !allClearLogged) {
    allClearLogged = true;
    logEvent(`FLOOR SWEEP COMPLETE — ${evacuatedCount} EVACUATED / ${injuredCount} CASUALTIES`, injuredCount ? 'warn' : 'ok');
  }
}

/* ── MAIN LOOP ──────────────────────────────────────────── */
let lastFrame = performance.now();
let hudTimer = 0;
let flowTimer = 0;

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05) * sim.speed;
  lastFrame = now;
  sim.time += dt;

  for (const h of hazards) h.r = Math.min(h.maxR, h.r + h.rate * dt);
  for (const w of workers) updateWorker(w, dt);
  workers = workers.filter((w) => w.state !== 'gone');

  flowTimer -= dt;
  if (flowTimer <= 0) { flowTimer = 0.4; computeFlowField(); }

  hudTimer -= dt;
  if (hudTimer <= 0) { hudTimer = 0.25; updateHUD(); }

  render();
  requestAnimationFrame(frame);
}

/* ── UI WIRING ──────────────────────────────────────────── */
$('btn-fire').addEventListener('click', () => armHazard('fire'));
$('btn-gas').addEventListener('click', () => armHazard('gas'));

$('speed-slider').addEventListener('input', (e) => {
  sim.speed = parseFloat(e.target.value);
  $('speed-readout').textContent = sim.speed.toFixed(1) + 'x';
});

$('btn-add').addEventListener('click', () => addWorkers(5));

$('btn-reset').addEventListener('click', () => {
  hazards = [];
  directive = { primary: null, avoid: [] };
  directiveGen++;
  evacuatedCount = 0;
  injuredCount = 0;
  sim.time = 0;
  allClearLogged = false;
  workers = [];
  addWorkers(24);
  armHazard(null);
  logEvent('SIMULATION RESET — ALL SECTORS NOMINAL', 'ok');
});

$('btn-connect').addEventListener('click', () => {
  const key = $('api-key').value.trim();
  const model = $('model-select').value;
  if (!key) {
    logEvent('NO UPLINK KEY — RUNNING LOCAL HEURISTIC CORE', 'warn');
    $('ai-status').innerHTML = 'UPLINK: <span class="dim">OFFLINE — LOCAL HEURISTIC CORE</span>';
    ai.connected = false;
    $('btn-connect').classList.remove('connected');
    return;
  }
  ai = { connected: true, key, model };
  $('btn-connect').classList.add('connected');
  $('ai-status').innerHTML = `UPLINK: <span class="ok">● ${model.split('/').pop().toUpperCase()}</span>`;
  logEvent(`AI UPLINK ESTABLISHED — ${model.toUpperCase()}`, 'ai');
});

/* ── BOOT ───────────────────────────────────────────────── */
// build exit status cards for the numbered exits
for (const name of Object.keys(EXITS)) {
  const card = document.createElement('div');
  card.className = 'exit-card';
  card.id = 'exit-' + name;
  card.innerHTML = `<span class="exit-name">EXIT ${name}</span><span class="badge clear">CLEAR</span>`;
  $('exit-grid').appendChild(card);
}

document.querySelector('.threat-seg[data-level="SECURE"]').classList.add('lit');
addWorkers(24);
computeFlowField();
logEvent(`SURVEILLANCE FEED LIVE — ${Object.keys(EXITS).length} EXITS, ${SIGNS.length} LED ROUTE SIGNS REGISTERED`, 'dim');
logEvent(`${workers.length} PERSONNEL ON FLOOR — TRACKING ACTIVE`, 'dim');
requestAnimationFrame(frame);
