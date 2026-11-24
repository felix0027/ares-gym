// ARES GYM — utilitários, ícones e biblioteca de exercícios
export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0 };
export const fmt = (n, d = 1) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: d });
export const pad = n => String(n).padStart(2, '0');
export const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const todayKey = () => keyOf(new Date());
export const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) };
export const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x };
export const normalize = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const stem = w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) ? w.slice(0, -1) : w;
export const ago = iso => { const d = Math.round((parseKey(todayKey()) - parseKey(keyOf(new Date(iso)))) / 864e5); return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : 'há ' + d + ' dias' };
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const mmss = s => pad(Math.floor(s / 60)) + ':' + pad(s % 60);
export const clean = o => JSON.parse(JSON.stringify(o));
export const initial = n => (String(n || '?').trim()[0] || '?').toUpperCase();

/* ---------- ícones (traço fino) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  utensils: '<path d="M5 3v7a2 2 0 0 0 2 2v9M9 3v7a2 2 0 0 1-2 2M7 3v7"/><path d="M17 21V3c-2.5 1.5-4 4.5-4 8h4"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.6 3.5 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'
};
export const ic = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- gráfico de linha ---------- */
const dlabel = k => { const [, m, d] = k.split('-'); return d + '/' + m };
export const dayLabel = dlabel;
export function lineChart(pts, unit) {
  if (!pts.length) return '';
  const W = 320, H = 150, pl = 36, pr = 12, pt = 14, pb = 24;
  let min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v));
  if (min === max) { min -= 1; max += 1 } const padv = (max - min) * .15; min -= padv; max += padv;
  const x = i => pl + (pts.length === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (pts.length - 1)), y = v => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
  const area = line + ` L${x(pts.length - 1).toFixed(1)} ${H - pb} L${x(0).toFixed(1)} ${H - pb} Z`;
  let g = ''; [0, .5, 1].forEach(t => { const v = min + (max - min) * t, yy = y(v); g += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}"/><text class="ax" x="${pl - 5}" y="${yy + 3}" text-anchor="end">${fmt(v, 1)}</text>` });
  const lbls = pts.map((p, i) => (i === 0 || i === pts.length - 1 || (pts.length > 4 && i === Math.floor(pts.length / 2))) ? `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">${esc(p.l)}</text>` : '').join('');
  return `<svg class="lc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de ${esc(unit)}"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0"/><stop offset="1" stop-opacity="0"/></linearGradient></defs>${g}<path class="ar" d="${area}"/><path class="ln" d="${line}"/>${pts.map((p, i) => `<circle class="pt" cx="${x(i)}" cy="${y(p.v)}" r="3.5"/>`).join('')}${lbls}</svg>`;
}

/* ---------- dicionários (PT-BR) ---------- */
export const MUS = { abdominals: 'Abdômen', abductors: 'Abdutores', adductors: 'Adutores', biceps: 'Bíceps', calves: 'Panturrilha', chest: 'Peito', forearms: 'Antebraço', glutes: 'Glúteos', hamstrings: 'Posterior de coxa', lats: 'Dorsais', 'lower back': 'Lombar', 'middle back': 'Meio das costas', neck: 'Pescoço', quadriceps: 'Quadríceps', shoulders: 'Ombros', traps: 'Trapézio', triceps: 'Tríceps' };
export const EQ = { 'body only': 'Peso do corpo', machine: 'Máquina', other: 'Outro', 'foam roll': 'Rolo de espuma', kettlebells: 'Kettlebell', cable: 'Polia', dumbbell: 'Halteres', barbell: 'Barra', bands: 'Elástico', 'medicine ball': 'Medicine ball', 'exercise ball': 'Bola suíça', 'e-z curl bar': 'Barra W' };
export const LV = { beginner: 'Iniciante', intermediate: 'Intermediário', expert: 'Avançado' };
export const CAT = { strength: 'Força', stretching: 'Alongamento', plyometrics: 'Pliométrico', strongman: 'Strongman', powerlifting: 'Powerlifting', cardio: 'Cardio', 'olympic weightlifting': 'Levantamento olímpico' };
export const FORCE = { push: 'Empurrar', pull: 'Puxar', static: 'Estático' };
export const mus = m => MUS[m] || m;
export const eqp = e => EQ[e || 'other'] || e;
export const MUSCLE_CHIPS = [['', 'Todos'], ['chest', 'Peito'], ['lats|middle back|lower back|traps', 'Costas'], ['shoulders', 'Ombros'], ['biceps', 'Bíceps'], ['triceps', 'Tríceps'], ['quadriceps', 'Quadríceps'], ['hamstrings', 'Posterior'], ['glutes', 'Glúteos'], ['calves', 'Panturrilha'], ['abdominals', 'Abdômen'], ['forearms', 'Antebraço']];

const PT = {
  'peck deck invertido': 'reverse fly|flye', 'peck deck': 'butterfly|fly|flye', 'crucifixo inclinado': 'incline fly|flye', 'crucifixo': 'fly|flye', 'cross over': 'cable crossover|cross', 'crossover': 'cable crossover|cross',
  'supino inclinado': 'incline bench press', 'supino declinado': 'decline bench press', 'supino reto': 'bench press', 'supino deitado': 'bench press', 'supino': 'bench press',
  'elevacao lateral': 'lateral raise', 'elevacao frontal': 'front raise', 'desenvolvimento': 'shoulder press', 'encolhimento': 'shrug',
  'triceps frances': 'triceps extension', 'triceps corda': 'triceps pushdown rope', 'triceps testa': 'lying triceps press|extension', 'triceps': 'triceps',
  'biceps': 'biceps', 'rosca alternada': 'curl alternate bicep', 'rosca martelo': 'hammer curl', 'rosca direta': 'curl', 'rosca scott': 'preacher curl', 'rosca concentrada': 'concentration curl', 'rosca': 'curl',
  'barra w': 'ez bar', 'barra fixa': 'pullup|chin', 'barra': 'barbell|bar',
  'puxada': 'lat pulldown', 'remada baixa': 'seated cable row', 'remada cavalinho': 't bar row', 'remada curvada': 'bent over row', 'remada': 'row',
  'leg press': 'leg press', 'cadeira extensora': 'leg extension', 'extensora': 'leg extension', 'mesa flexora': 'lying leg curl', 'cadeira flexora': 'seated leg curl', 'flexora': 'leg curl', 'cadeira abdutora': 'abductor', 'abdutora': 'abductor', 'cadeira adutora': 'adductor', 'adutora': 'adductor',
  'panturrilha': 'calf|calves raise|press', 'agachamento': 'squat', 'afundo': 'lunge', 'avanco': 'lunge', 'levantamento terra': 'deadlift', 'stiff': 'stiff leg deadlift', 'terra': 'deadlift', 'elevacao pelvica': 'glute|hip bridge|thrust', 'hip thrust': 'hip thrust|bridge',
  'abdominal': 'crunch', 'prancha': 'plank', 'flexao': 'pushup|push', 'paralela': 'dip', 'mergulho': 'dip',
  'halteres': 'dumbbell', 'halter': 'dumbbell', 'maquina': 'machine', 'polia': 'cable', 'corda': 'rope', 'triangulo': 'close', 'aberta': 'wide', 'fechada': 'close', 'inclinado': 'incline', 'sentado': 'seated', 'sentada': 'seated', 'em pe': 'standing', 'unilateral': 'single|one', 'invertido': 'reverse', 'martelo': 'hammer',
  'peito': 'chest', 'peitoral': 'chest', 'costas': 'lats|back', 'ombro': 'shoulders', 'ombros': 'shoulders', 'perna': 'quadriceps|leg', 'pernas': 'quadriceps|leg', 'gluteo': 'glutes', 'gluteos': 'glutes', 'posterior': 'hamstrings', 'quadriceps': 'quadriceps', 'antebraco': 'forearms', 'trapezio': 'traps', 'lombar': 'lower back', 'abdomen': 'abdominals', 'bracos': 'biceps|triceps',
  'aquecimento': '', 'alta': '', 'baixa': '', 'deitado': '', 'reto': '', 'neutra': '', 'livre': ''
};
const STOP = new Set('de da do das dos na no nas nos em com a o e as os para por ao um uma ou'.split(' '));
export function toGroups(q) {
  const w = normalize(q).split(' ').filter(Boolean), out = [];
  for (let i = 0; i < w.length;) {
    let hit = null, len = 0;
    for (let n = Math.min(3, w.length - i); n >= 1; n--) { const k = w.slice(i, i + n).join(' '); if (PT[k] !== undefined) { hit = PT[k]; len = n; break } }
    if (hit !== null) { hit.split(' ').filter(Boolean).forEach(g => out.push(g.split('|').map(stem))); i += len }
    else { const t = w[i++]; if (/^\d+$/.test(t) || STOP.has(t)) continue; out.push([stem(t)]) }
  }
  return out;
}

/* ---------- biblioteca de exercícios (Free Exercise DB) ---------- */
export const DB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
export const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
// X.tr = tradução opcional (exercicios-pt.json): { "<id>": { n: "nome em PT", i: ["passo 1", ...] } }
export const X = { DB: [], MAP: {}, state: 'idle', tr: {} };
const wset = s => new Set(normalize(s).split(' ').filter(Boolean).map(stem));
export const exName = e => (X.tr[e.id] && X.tr[e.id].n) || e.name;
export const exInstr = e => (X.tr[e.id] && X.tr[e.id].i) || e.instructions;
export const hasPT = e => !!(X.tr[e.id] && X.tr[e.id].i);
function prep(e) {
  e.primaryMuscles = e.primaryMuscles || []; e.secondaryMuscles = e.secondaryMuscles || []; e.instructions = e.instructions || []; e.images = e.images || [];
  e._nw = wset(e.name); const t = X.tr[e.id]; if (t && t.n) wset(t.n).forEach(w => e._nw.add(w));
  e._hw = new Set(e._nw);
  [...e.primaryMuscles, ...e.secondaryMuscles].forEach(m => { wset(m).forEach(x => e._hw.add(x)); wset(mus(m)).forEach(x => e._hw.add(x)) });
  const eq = e.equipment || 'other'; wset(eq).forEach(x => e._hw.add(x)); wset(eqp(eq)).forEach(x => e._hw.add(x));
  [e.category, CAT[e.category], e.level, LV[e.level]].forEach(v => v && wset(v).forEach(x => e._hw.add(x)));
  return e;
}
export function loadDB(done) {
  if (X.state === 'loading' || X.state === 'ok') return;
  X.state = 'loading';
  const trP = fetch('exercicios-pt.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
  fetch(DB_URL).then(r => { if (!r.ok) throw new Error('http'); return r.json() }).then(async j => {
    X.tr = (await trP) || {};
    X.DB = j.map(prep).sort((a, b) => exName(a).localeCompare(exName(b)));
    X.MAP = {}; X.DB.forEach(e => X.MAP[e.id] = e); autoCache = {}; X.state = 'ok'; done && done();
  }).catch(() => { X.state = 'error'; done && done() });
}
export function retryDB(done) { if (X.state === 'error') X.state = 'idle'; loadDB(done) }
function hasWord(set, a) { if (set.has(a)) return true; if (a.length >= 4) { for (const w of set) if (w.startsWith(a)) return true } return false }
export function scoreEx(e, groups) { let nm = 0, hm = 0; for (const g of groups) { if (g.some(a => hasWord(e._nw, a))) nm++; else if (g.some(a => hasWord(e._hw, a))) hm++ } return { nm, hm } }
export const rank = (e, s) => s.nm * 2 + s.hm - e._nw.size * .05;
export function searchDB(q, strict) { const g = toGroups(q); if (!g.length) return []; return X.DB.map(e => ({ e, s: scoreEx(e, g) })).filter(x => strict ? x.s.nm + x.s.hm === g.length : x.s.nm + x.s.hm >= 1).sort((a, b) => rank(b.e, b.s) - rank(a.e, a.s)).map(x => x.e) }
let autoCache = {};
function autoMatch(name) {
  let best = null, bs = -1;
  name.split('/').forEach(part => { const g = toGroups(part); if (!g.length) return; X.DB.forEach(e => { const s = scoreEx(e, g), cov = s.nm / g.length; if (s.nm >= 1 && cov >= .66) { const sc = cov * 10 - e._nw.size * .12; if (sc > bs) { bs = sc; best = e } } }) });
  return best;
}
// exercício da ficha → exercício da biblioteca (vínculo do professor ou sugestão automática)
export function exFor(ex) {
  if (ex.lib === 'none') return null;
  if (ex.lib && X.MAP[ex.lib]) return X.MAP[ex.lib];
  if (!X.DB.length) return null;
  const k = normalize(ex.name); if (!(k in autoCache)) autoCache[k] = autoMatch(ex.name);
  return autoCache[k];
}
export const imgURL = p => IMG_BASE + p.split('/').map(encodeURIComponent).join('/');
export function demoHTML(e, cls = '') {
  if (!e || !e.images.length) return '';
  return `<div class="demo ${cls}">${e.images.slice(0, 2).map((p, i) => `<img src="${esc(imgURL(p))}" alt="${i ? '' : esc(exName(e))}" ${i ? 'aria-hidden="true"' : ''} loading="lazy" decoding="async" onerror="this.style.display='none'">`).join('')}</div>`;
}
