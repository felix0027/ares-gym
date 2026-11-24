// ARES GYM — funções puras: tipos de bloco, importador de texto, GPX/TCX, vídeo e QR
import { esc, fmt, normalize, pad } from './util.js';

/* ---------- tipos de bloco ---------- */
export const TYPES = {
  reps: 'Séries e repetições',
  time: 'Tempo (prancha, ioga, alongamento)',
  cardio: 'Cardio (tempo e distância)',
  interval: 'Intervalos (HIIT, Tabata, EMOM, AMRAP)'
};
export const MODES = { tabata: 'Tabata', hiit: 'HIIT', emom: 'EMOM', amrap: 'AMRAP' };
export const MODE_DEF = {
  tabata: { work: 20, rest: 10, rounds: 8, min: '' },
  hiit: { work: 30, rest: 30, rounds: 8, min: '' },
  emom: { work: 60, rest: 0, rounds: 10, min: '' },
  amrap: { work: '', rest: '', rounds: '', min: 10 }
};
export const typeOf = e => (e && e.type) || 'reps';
export function defaultsFor(t) {
  if (t === 'time') return { sets: '3', secs: '30' };
  if (t === 'cardio') return { min: '20', km: '' };
  if (t === 'interval') return { mode: 'tabata', ...MODE_DEF.tabata };
  return { sets: '3', reps: '8–12' };
}
export function exSummary(e) {
  const t = typeOf(e);
  if (t === 'time') return `${e.sets || 1} séries · ${e.secs || '—'} s`;
  if (t === 'cardio') { const p = []; if (e.min) p.push(e.min + ' min'); if (e.km) p.push(e.km + ' km'); return p.join(' · ') || 'Livre' }
  if (t === 'interval') {
    const m = MODES[e.mode] || 'Intervalos';
    if (e.mode === 'amrap') return `AMRAP · ${e.min || '—'} min`;
    if (e.mode === 'emom') return `EMOM · ${e.rounds || '—'} min`;
    return `${m} · ${e.rounds || '—'} × ${e.work || '—'}s / ${e.rest || 0}s`;
  }
  return `${e.sets || '—'} séries · ${e.reps || '—'} reps`;
}
export const FIELDS = ['kg', 'reps', 'secs', 'km', 'min', 'rounds'];
export const blankRow = () => ({ kg: '', reps: '', secs: '', km: '', min: '', rounds: '', done: false });
export const rowHasData = r => !!r && FIELDS.some(f => r[f] !== '' && r[f] != null);
export const rowsPlanned = (e, n) => { const t = typeOf(e); return (t === 'cardio' || t === 'interval') ? 1 : n };

const nn = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0 };
export function fmtDur(secs) { secs = Math.round(secs || 0); const h = Math.floor(secs / 3600), m = Math.floor(secs % 3600 / 60), s = secs % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}` }
export function fmtPace(secs, km, sport) {
  secs = nn(secs); km = nn(km); if (!secs || !km) return '';
  if (sport === 'bike') return fmt(km / (secs / 3600), 1) + ' km/h';
  if (sport === 'natacao') return fmtDur(secs / (km * 10)) + ' /100m';
  return fmtDur(secs / km) + ' /km';
}
export function fmtRow(type, r) {
  if (type === 'time') return `${r.secs || 0} s${nn(r.kg) ? ' · ' + fmt(nn(r.kg)) + ' kg' : ''}`;
  if (type === 'cardio') { const p = fmtPace(nn(r.min) * 60, r.km); return `${r.km ? fmt(nn(r.km), 2) + ' km · ' : ''}${r.min || 0} min${p ? ' · ' + p : ''}` }
  if (type === 'interval') return `${r.rounds || 0} rodadas`;
  return `${fmt(nn(r.kg))} kg × ${r.reps || 0}`;
}
// fases do cronômetro de intervalos
export function intervalPhases(e) {
  const mode = e.mode || 'tabata', out = [];
  if (mode === 'amrap') { out.push({ label: 'AMRAP', secs: Math.max(1, Math.round(nn(e.min) * 60)), round: 1, of: 1 }); return out }
  const rounds = Math.max(1, Math.round(nn(e.rounds) || 1)), work = Math.max(1, Math.round(nn(e.work) || 20)), rest = Math.max(0, Math.round(nn(e.rest)));
  for (let r = 1; r <= rounds; r++) {
    out.push({ label: mode === 'emom' ? 'MINUTO' : 'TRABALHO', secs: work, round: r, of: rounds });
    if (rest > 0 && r < rounds) out.push({ label: 'DESCANSO', secs: rest, round: r, of: rounds });
  }
  return out;
}

/* ---------- importador de texto (WhatsApp, anotações, PDF copiado) ---------- */
const WEEK = /^(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\b/i;
const SETS = /(\d{1,2})\s*(?:[x×*]|s[ée]ries?\s*(?:de|x)?)\s*(\d{1,3}(?:\s*[-–a]\s*\d{1,3})?|falha|m[aá]x\w*)/i;
const TIMEX = /(\d{1,2})\s*[x×*]\s*(\d{1,4})\s*(min(?:utos?)?|seg(?:undos?)?|s)\b/i;
const MINS = /(\d{1,3})\s*(?:min(?:utos?)?)\b/i;
const KMS = /(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:km|quil[oô]metros?)\b/i;
const REST = /(?:desc(?:anso)?|int(?:ervalo)?|rest)\s*[:\-]?\s*(\d{1,3})\s*(min(?:utos?)?|seg(?:undos?)?|s)\b/i;
const INTV = /\b(tabata|emom|amrap|hiit)\b/i;
const CARDIO_W = /(esteira|corrida|caminhada|bike|bicicleta|el[ií]ptico|remo|nata[cç][aã]o|escada|cardio|trote|pedal|spinning|ergom|transport|trilha)/i;

function isHeader(line) {
  const t = line.trim().replace(/^[#*\s]+|[*\s]+$/g, '');
  if (!t || t.length > 60) return false;
  if (SETS.test(t) || TIMEX.test(t)) return false;
  if (/^(treino|dia|ficha|semana)\b/i.test(t)) return true;
  if (WEEK.test(t)) return true;
  if (/:\s*$/.test(t)) return true;
  if (/^[A-Fa-f]\s*[\)\-–:.]\s*\S/.test(t) && !/\d/.test(t)) return true;
  if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\/\-–]{3,30}$/.test(t) && !/\d/.test(t)) return true;
  return false;
}
function headerName(line) {
  let t = line.trim().replace(/^[#*\s]+|[*\s]+$/g, '').replace(/\s*:\s*$/, '');
  const w = t.match(/^(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?\s*[:\-–]?\s*(.*)$/i);
  if (w) { const d = w[1].toLowerCase(); return d.charAt(0).toUpperCase() + d.slice(1) + (w[2] ? ' · ' + w[2].trim() : '') }
  const tr = t.match(/^(treino|dia)\s+([A-Za-z0-9]+)\s*[:\-–]\s*(.+)$/i); if (tr) return tr[1].charAt(0).toUpperCase() + tr[1].slice(1).toLowerCase() + ' ' + tr[2].toUpperCase() + ' · ' + tr[3].trim();
  const m = t.match(/^(?:treino\s+)?([A-Fa-f])\s*[\)\-–:.]?\s*$/i); if (m) return 'Treino ' + m[1].toUpperCase();
  const a = t.match(/^([A-Fa-f])\s*[\)\-–:.]\s*(.+)$/); if (a) return 'Treino ' + a[1].toUpperCase() + ' · ' + a[2].trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function cleanName(t) {
  t = t.replace(/[\s\-–:;,|•·]+$/g, '').replace(/^[\s\-–:;,|•·]+/g, '').replace(/\s{2,}/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}
const normReps = s => { s = String(s).replace(/\s+/g, ''); if (/falha/i.test(s)) return 'Falha'; if (/m[aá]x/i.test(s)) return 'Máx'; return s.replace(/[-–a]/g, '–') };

function parseLine(raw) {
  let t = raw.replace(/\t/g, ' ').trim();
  t = t.replace(/^[\-\*•·▪►>✅☑]+\s*/u, '').replace(/^\d{1,2}\s*[\.\)\-–]\s+(?=[^\d\s])/, '');
  if (!t) return null;
  const notes = [];
  t = t.replace(/\(([^)]*)\)/g, (m, g) => { if (g.trim()) notes.push(g.trim()); return ' ' });
  let restSec = 0;
  t = t.replace(REST, (m, n, u) => { restSec = +n * (/^min/i.test(u) ? 60 : 1); return ' ' });
  if (restSec) notes.push('Descanso ' + (restSec >= 60 && restSec % 60 === 0 ? restSec / 60 + ' min' : restSec + ' s'));
  let m;
  if ((m = t.match(INTV))) {
    const mode = m[1].toLowerCase(); let rest = t.replace(INTV, ' '); const o = { type: 'interval', mode, ...MODE_DEF[mode] };
    const rwr = rest.match(/(\d{1,2})\s*[x×]\s*(\d{1,3})\s*s?\s*\/\s*(\d{1,3})\s*s?\b/); if (rwr) { o.rounds = +rwr[1]; o.work = +rwr[2]; o.rest = +rwr[3]; rest = rest.replace(rwr[0], ' ') }
    const wr = rest.match(/(\d{1,3})\s*s?\s*\/\s*(\d{1,3})\s*s?/); if (wr) { o.work = +wr[1]; o.rest = +wr[2]; rest = rest.replace(wr[0], ' ') }
    const rd = rest.match(/(\d{1,2})\s*(?:rounds?|rodadas?|voltas?|vezes)/i) || rest.match(/[x×]\s*(\d{1,2})\b/i); if (rd) { o.rounds = +rd[1]; rest = rest.replace(rd[0], ' ') }
    const mn = rest.match(MINS); if (mn) { if (mode === 'amrap') o.min = +mn[1]; else if (mode === 'emom') o.rounds = +mn[1]; rest = rest.replace(mn[0], ' ') }
    o.name = cleanName(rest) || MODES[mode]; o.note = notes.join('; '); return o;
  }
  if ((m = t.match(/(\d{1,2})\s*[x×]\s*(\d{1,3})\s*s?\s*\/\s*(\d{1,3})\s*s?\b/))) return { type: 'interval', mode: 'hiit', work: +m[2], rest: +m[3], rounds: +m[1], min: '', name: cleanName(t.replace(m[0], ' ')) || 'Intervalos', note: notes.join('; ') };
  if ((m = t.match(TIMEX))) {
    const secs = +m[2] * (/^min/i.test(m[3]) ? 60 : 1);
    return { type: 'time', sets: String(+m[1]), secs: String(secs), name: cleanName(t.replace(m[0], ' ')), note: notes.join('; ') };
  }
  if ((m = t.match(SETS))) {
    return { type: 'reps', sets: String(+m[1]), reps: normReps(m[2]), name: cleanName(t.replace(m[0], ' ')), note: notes.join('; ') };
  }
  const km = t.match(KMS), mn = t.match(MINS);
  if (km || mn) {
    let rest = t; if (km) rest = rest.replace(km[0], ' '); if (mn) rest = rest.replace(mn[0], ' '); const name = cleanName(rest);
    if (km || CARDIO_W.test(normalize(name))) return { type: 'cardio', min: mn ? String(+mn[1]) : '', km: km ? String(km[1]).replace(',', '.') : '', name: name || 'Cardio', note: notes.join('; ') };
    return { type: 'time', sets: '1', secs: String(+mn[1] * 60), name, note: notes.join('; ') };
  }
  return { plain: true, name: cleanName(t), note: notes.join('; ') };
}
export function parseWorkoutText(text) {
  const days = [], skipped = []; let cur = null;
  const start = name => { cur = { name, exercises: [] }; days.push(cur) };
  String(text || '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim(); if (!line) return;
    if (/^(obs|nota|dica|observa[cç][aã]o)\b\.?:?/i.test(line) && cur && cur.exercises.length) {
      const last = cur.exercises[cur.exercises.length - 1], n = line.replace(/^(obs|nota|dica|observa[cç][aã]o)\b\.?:?\s*/i, '');
      last.note = last.note ? last.note + '; ' + n : n; return;
    }
    if (isHeader(line)) { start(headerName(line)); return }
    const p = parseLine(line);
    if (!p) return;
    if (p.plain) {
      const words = p.name.split(/\s+/).length;
      if (cur && p.name.length >= 3 && p.name.length <= 50 && words <= 7 && !/[:]/.test(p.name)) cur.exercises.push({ type: 'reps', sets: '3', reps: '8–12', name: p.name, note: p.note });
      else skipped.push(line);
      return;
    }
    if (!p.name) { skipped.push(line); return }
    if (!cur) start('Treino');
    cur.exercises.push(p);
  });
  return { days: days.filter(d => d.exercises.length), skipped };
}

/* ---------- atividades (cardio) ---------- */
export const ACT_TYPES = [['caminhada', 'Caminhada'], ['corrida', 'Corrida'], ['bike', 'Bicicleta'], ['natacao', 'Natação'], ['trilha', 'Trilha'], ['remo', 'Remo'], ['eliptico', 'Elíptico'], ['outro', 'Outro']];
export const actLabel = k => (ACT_TYPES.find(a => a[0] === k) || [0, 'Atividade'])[1];
const MET = { caminhada: 3.5, corrida: 9.8, bike: 7.5, natacao: 6, trilha: 6, remo: 7, eliptico: 5, outro: 5 };
export const kcalEstimate = (type, min, kg) => Math.round((MET[type] || 5) * (nn(kg) || 70) * (nn(min) / 60));
const SPORT = [[/run|corr/i, 'corrida'], [/bik|cycl|ciclis/i, 'bike'], [/walk|camin/i, 'caminhada'], [/hik|trilh/i, 'trilha'], [/swim|nata/i, 'natacao'], [/row|remo/i, 'remo']];
const hav = (a, b) => { const R = 6371, d = Math.PI / 180, dl = (b[0] - a[0]) * d, dn = (b[1] - a[1]) * d, x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * d) * Math.cos(b[0] * d) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)) };
export function parseTrack(text) {
  const doc = new DOMParser().parseFromString(String(text), 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Arquivo inválido');
  const t0 = (el, tag) => { const x = el.getElementsByTagName(tag)[0]; return x ? x.textContent.trim() : '' };
  let pts = [], sportRaw = '';
  const gpx = [...doc.getElementsByTagName('trkpt')];
  if (gpx.length) {
    pts = gpx.map(p => ({ lat: parseFloat(p.getAttribute('lat')), lon: parseFloat(p.getAttribute('lon')), ele: parseFloat(t0(p, 'ele')), t: Date.parse(t0(p, 'time')) }));
    const ty = doc.getElementsByTagName('type')[0]; sportRaw = ty ? ty.textContent : (doc.getElementsByTagName('name')[0] || {}).textContent || '';
  } else {
    pts = [...doc.getElementsByTagName('Trackpoint')].map(p => ({ lat: parseFloat(t0(p, 'LatitudeDegrees')), lon: parseFloat(t0(p, 'LongitudeDegrees')), ele: parseFloat(t0(p, 'AltitudeMeters')), t: Date.parse(t0(p, 'Time')) }));
    const a = doc.getElementsByTagName('Activity')[0]; sportRaw = a ? a.getAttribute('Sport') || '' : '';
  }
  pts = pts.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (pts.length < 2) throw new Error('O arquivo não tem trajeto (pontos de GPS).');
  let km = 0, gain = 0, ref = null;
  for (let i = 1; i < pts.length; i++) km += hav([pts[i - 1].lat, pts[i - 1].lon], [pts[i].lat, pts[i].lon]);
  pts.forEach(p => { if (!Number.isFinite(p.ele)) return; if (ref === null) ref = p.ele; else if (p.ele - ref >= 3) { gain += p.ele - ref; ref = p.ele } else if (ref - p.ele >= 3) ref = p.ele });
  const ts = pts.map(p => p.t).filter(Number.isFinite), secs = ts.length > 1 ? Math.round((ts[ts.length - 1] - ts[0]) / 1000) : 0;
  const step = Math.max(1, Math.ceil(pts.length / 200)), track = [];
  for (let i = 0; i < pts.length; i += step) track.push(+pts[i].lat.toFixed(5), +pts[i].lon.toFixed(5));
  const last = pts[pts.length - 1]; if ((pts.length - 1) % step) track.push(+last.lat.toFixed(5), +last.lon.toFixed(5));
  const sport = (SPORT.find(s => s[0].test(sportRaw)) || [0, 'outro'])[1];
  return { km: +km.toFixed(2), secs, gain: Math.round(gain), track, startISO: ts.length ? new Date(ts[0]).toISOString() : '', sport };
}
export function routeSvg(track, w = 160, h = 110) {
  if (!track || track.length < 4) return '';
  const la = [], lo = []; for (let i = 0; i < track.length; i += 2) { la.push(track[i]); lo.push(track[i + 1]) }
  const mnLa = Math.min(...la), mxLa = Math.max(...la), mnLo = Math.min(...lo), mxLo = Math.max(...lo), k = Math.cos((mnLa + mxLa) / 2 * Math.PI / 180);
  const sw = (mxLo - mnLo) * k || 1e-5, sh = (mxLa - mnLa) || 1e-5, pad_ = 8, s = Math.min((w - pad_ * 2) / sw, (h - pad_ * 2) / sh);
  const ox = (w - sw * s) / 2, oy = (h - sh * s) / 2;
  const P = la.map((v, i) => `${(ox + (lo[i] - mnLo) * k * s).toFixed(1)},${(oy + (mxLa - v) * s).toFixed(1)}`);
  return `<svg class="route" viewBox="0 0 ${w} ${h}" role="img" aria-label="Trajeto"><polyline points="${P.join(' ')}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${P[0].split(',')[0]}" cy="${P[0].split(',')[1]}" r="3.5" fill="currentColor"/><circle cx="${P[P.length - 1].split(',')[0]}" cy="${P[P.length - 1].split(',')[1]}" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}

/* ---------- vídeo ---------- */
export const ytId = u => { const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/); return m ? m[1] : '' };
export function videoHTML(u) {
  u = String(u || '').trim(); if (!/^https?:\/\//i.test(u)) return '';
  const id = ytId(u);
  if (id) return `<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Vídeo do exercício" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return `<video class="vidfile" src="${esc(u)}" controls playsinline></video>`;
  return `<a class="btn secondary block" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Abrir vídeo</a>`;
}
export const videoThumb = u => { const id = ytId(u); return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '' };

/* ---------- convite / QR ---------- */
export function makeCode(n = 10) { const A = 'abcdefghjkmnpqrstuvwxyz23456789', b = new Uint32Array(n); (self.crypto || window.crypto).getRandomValues(b); return Array.from(b, x => A[x % A.length]).join('') }
let qrLib = null;
export async function qrSvg(text) {
  try {
    if (!qrLib) { const m = await import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm'); qrLib = m.default || m }
    const qr = qrLib(0, 'M'); qr.addData(text); qr.make(); return qr.createSvgTag(5, 2);
  } catch { return '' }
}
