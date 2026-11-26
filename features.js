// ARES GYM — funcionalidades da Fase 1 (biblioteca própria, modelos, colar treino, intervalos, cardio, recados, convite, painel)
// + MODELOS PREDEFINIDOS DE TREINO (Divisão ABCD) para professores/admin
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { $, esc, num, fmt, pad, keyOf, todayKey, parseKey, mondayOf, normalize, uid, clean, ic, ago, MUS } from './util.js';
import * as E from './extras.js';

let C = null;
export const init = c => {
  C = c;
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.id === 'eType') { $('typeFields').innerHTML = typeFieldsHTML(E.defaultsFor(t.value), t.value) }
    else if (t.id === 'eMode') { const d = E.MODE_DEF[t.value] || {}; [['eWork', 'work'], ['eRest', 'rest'], ['eRounds', 'rounds'], ['eMin', 'min']].forEach(([id, k]) => { if ($(id)) $(id).value = d[k] ?? '' }) }
    else if (t.id === 'trackFile') importTrackFile(t);
    else if (t.id === 'alertDays') { pro.alertDays = +t.value; savePro(); C.rerender() }
  });
  document.addEventListener('submit', ev => {
    const f = ev.target.closest('form[data-form=chatSend]'); if (!f) return; ev.preventDefault(); sendChat();
  });
};
const G = () => C.subj();

/* ============ dados do próprio usuário (professor / solo / admin) ============ */
export const pro = { alertDays: 4, seen: {}, inviteCode: '', inviteExp: 0 };
export const lib = { items: [] };
export const tpl = { items: [] };
const base = () => ['users', C.me().uid, 'data'];
export async function loadMine() {
  const names = ['pro', 'library', 'templates'];
  const r = await Promise.all(names.map(n => getDoc(doc(C.db, ...base(), n)).catch(() => null)));
  if (r[0] && r[0].exists()) Object.assign(pro, r[0].data());
  lib.items = (r[1] && r[1].exists() && r[1].data().items) || [];
  tpl.items = (r[2] && r[2].exists() && r[2].data().items) || [];
}
const savePro = () => setDoc(doc(C.db, ...base(), 'pro'), clean(pro)).catch(e => C.toast('Não foi possível salvar.'));
const saveLib = () => setDoc(doc(C.db, ...base(), 'library'), clean(lib)).catch(e => C.toast('Não foi possível salvar.'));
const saveTpl = () => setDoc(doc(C.db, ...base(), 'templates'), clean(tpl)).catch(e => C.toast('Não foi possível salvar.'));

/* ============ formulário de exercício (por tipo) ============ */
const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F'];
export function typeFieldsHTML(e, t) {
  const v = (k, d = '') => esc(e[k] ?? d), inp = (id, label, val, mode = 'numeric') => `<div class="field"><label>${label}</label><input id="${id}" class="wide-input" inputmode="${mode}" value="${val}"></div>`;
  if (t === 'time') return `<div class="two">${inp('eSets', 'SÉRIES', v('sets', '3'))}${inp('eSecs', 'TEMPO POR SÉRIE (S)', v('secs', '30'))}</div>`;
  if (t === 'cardio') return `<div class="two">${inp('eMin', 'TEMPO (MIN)', v('min'), 'decimal')}${inp('eKm', 'DISTÂNCIA (KM)', v('km'), 'decimal')}</div>`;
  if (t === 'interval') return `<div class="field"><label>MODO</label><select id="eMode" class="sel">${Object.entries(E.MODES).map(([k, l]) => `<option value="${k}" ${k === (e.mode || 'tabata') ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="two">${inp('eWork', 'TRABALHO (S)', v('work'))}${inp('eRest', 'DESCANSO (S)', v('rest'))}</div><div class="two">${inp('eRounds', 'RODADAS', v('rounds'))}${inp('eMin', 'DURAÇÃO (MIN) · AMRAP', v('min'))}</div>`;
  return `<div class="two">${inp('eSets', 'SÉRIES', v('sets', '3'))}${inp('eReps', 'REPETIÇÕES', v('reps', '8–12'), 'text')}</div>`;
}
export function exFormHTML(e = {}) {
  const t = e.type || 'reps';
  return `<div class="field"><label>NOME</label><input id="eName" class="wide-input" value="${esc(e.name || '')}" placeholder="Ex.: Agachamento livre"></div>
  <div class="field"><label>TIPO DE BLOCO</label><select id="eType" class="sel">${Object.entries(E.TYPES).map(([k, l]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div id="typeFields">${typeFieldsHTML({ ...E.defaultsFor(t), ...e }, t)}</div>
  <div class="field"><label>GRUPO · BI-SET, TRI-SET OU CIRCUITO (OPCIONAL)</label><select id="eGroup" class="sel"><option value="">Nenhum</option>${GROUPS.map(g => `<option ${g === e.group ? 'selected' : ''}>${g}</option>`).join('')}</select><span class="hint">Exercícios com a mesma letra, em sequência, são feitos sem descanso entre eles.</span></div>
  <div class="field"><label>OBSERVAÇÃO PARA O ALUNO (OPCIONAL)</label><textarea id="eNote" class="wide-input" placeholder="Ex.: descer em 3 segundos, pausa embaixo">${esc(e.note || '')}</textarea></div>
  <div class="field"><label>LINK DE VÍDEO (OPCIONAL)</label><input id="eVideo" class="wide-input" type="url" placeholder="https://youtu.be/…" value="${esc(e.video || '')}"></div>
  <div class="field"><label>COMO EXECUTAR (OPCIONAL)</label><textarea id="eHow" class="wide-input" placeholder="Explicação do professor">${esc(e.howto || '')}</textarea></div>`;
}
export function readExForm() {
  const t = $('eType').value, o = { type: t, name: $('eName').value.trim(), note: $('eNote').value.trim(), video: $('eVideo').value.trim(), howto: $('eHow').value.trim(), group: $('eGroup').value };
  const I = id => String(parseInt($(id).value) || '');
  if (t === 'reps') { o.sets = String(parseInt($('eSets').value) || 3); o.reps = $('eReps').value.trim() || '8–12' }
  else if (t === 'time') { o.sets = String(parseInt($('eSets').value) || 3); o.secs = String(parseInt($('eSecs').value) || 30) }
  else if (t === 'cardio') { o.min = $('eMin').value.trim(); o.km = $('eKm').value.trim() }
  else { o.mode = $('eMode').value; o.work = I('eWork'); o.rest = I('eRest') || '0'; o.rounds = I('eRounds'); o.min = $('eMin').value.trim() }
  return o;
}

/* ============ biblioteca própria (Meus exercícios) ============ */
const MUSCLES = [['', 'Não informar'], ...Object.entries(MUS)];
export const customMatches = q => { const n = normalize(q); return n ? lib.items.filter(i => normalize(i.name + ' ' + (MUS[i.muscle] || '')).includes(n)) : lib.items.slice() };
export const exFromItem = i => ({ id: uid(), name: i.name, type: i.type || 'reps', ...E.defaultsFor(i.type || 'reps'), note: '', lib: '', video: i.video || '', howto: i.howto || '', custom: i.id });
export function renderMyLib() {
  const box = $('myLib'); if (!box) return;
  box.innerHTML = `<div class="row"><p class="muted" style="font-size:13px;line-height:1.5">Crie os seus próprios exercícios, com vídeo e explicação. Eles aparecem na hora de montar uma ficha.</p></div><button class="btn" data-act="myNew">+ Novo exercício</button><div class="stack">${lib.items.map(i => `<button class="urow" data-act="myView" data-id="${i.id}"><div class="avatar">${esc((i.name[0] || '?').toUpperCase())}</div><div class="uinfo"><strong>${esc(i.name)}</strong><small>${esc(E.TYPES[i.type || 'reps'])}${i.muscle ? ' · ' + esc(MUS[i.muscle] || '') : ''}${i.video ? ' · com vídeo' : ''}</small></div>${ic('chevron', 18)}</button>`).join('') || '<div class="empty">Você ainda não criou exercícios. Toque em “+ Novo exercício”.</div>'}</div>`;
}
function itemForm(i = {}) {
  C.openSheet(`<h2>${i.id ? 'Editar exercício' : 'Novo exercício'}</h2><div class="field"><label>NOME</label><input id="cName" class="wide-input" value="${esc(i.name || '')}"></div><div class="two"><div class="field"><label>TIPO</label><select id="cType" class="sel">${Object.entries(E.TYPES).map(([k, l]) => `<option value="${k}" ${k === (i.type || 'reps') ? 'selected' : ''}>${l.split(' (')[0]}</option>`).join('')}</select></div><div class="field"><label>MÚSCULO</label><select id="cMus" class="sel">${MUSCLES.map(([k, l]) => `<option value="${k}" ${k === (i.muscle || '') ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div><div class="field"><label>LINK DE VÍDEO (YOUTUBE OU OUTRO)</label><input id="cVideo" class="wide-input" type="url" value="${esc(i.video || '')}" placeholder="https://youtu.be/…"></div><div class="field"><label>COMO EXECUTAR</label><textarea id="cHow" class="wide-input" style="min-height:120px">${esc(i.howto || '')}</textarea></div><button class="btn block" data-act="mySave" data-id="${i.id || ''}">Salvar</button>`);
}
export function customDetail(src) {
  const v = src.video || '', h = src.howto || '';
  C.openSheet(`<h2>${esc(src.name)}</h2>${E.videoHTML(v) || ''}${h ? `<div class="card"><div class="eyebrow">COMO EXECUTAR</div><p style="font-size:13.5px;line-height:1.65;margin-top:8px;white-space:pre-wrap">${esc(h)}</p></div>` : ''}${!v && !h ? '<div class="empty">Este exercício ainda não tem vídeo nem explicação.</div>' : ''}<button class="btn ghost block" data-act="closeSheet">Fechar</button>`);
}

/* ============ modelos (copiar treino/dieta entre alunos) ============ */
const reId = d => ({ ...d, id: uid(), exercises: (d.exercises || []).map(e => ({ ...e, id: uid() })) });
export function tplSheet(kind) {
  const s = G(), isDiet = kind === 'diet', items = tpl.items.filter(t => isDiet ? t.kind === 'diet' : t.kind !== 'diet');
  C.openSheet(`<h2>Modelos de ${isDiet ? 'dieta' : 'treino'}</h2><p class="muted" style="font-size:12.5px;line-height:1.55">Salve o que você montou e aplique em qualquer aluno depois. Abra outro aluno e toque em “Modelos”.</p>
  <div class="footer-actions">${isDiet ? '<button class="btn small secondary" data-act="tplSave" data-k="diet">Salvar dieta atual</button>' : '<button class="btn small secondary" data-act="tplSave" data-k="day">Salvar dia atual</button><button class="btn small secondary" data-act="tplSave" data-k="plan">Salvar ficha toda</button>'}</div>
  <div class="stack">${items.map(t => `<div class="card stack" style="padding:14px"><div class="row"><div><strong style="font-size:14px">${esc(t.name)}</strong><div class="muted" style="font-size:11.5px;margin-top:3px">${t.kind === 'day' ? 'Um dia · ' + (t.data.exercises || []).length + ' exercícios' : t.kind === 'plan' ? 'Ficha · ' + (t.data.days || []).length + ' dias' : 'Dieta · ' + ((t.data.meals || []).length) + ' refeições'}</div></div></div><div class="footer-actions"><button class="btn small" data-act="tplApply" data-id="${t.id}">Aplicar em ${esc(s.profile.name.split(' ')[0])}</button><button class="btn small ghost" data-act="tplDel" data-id="${t.id}">Excluir</button></div></div>`).join('') || '<div class="empty">Nenhum modelo salvo ainda.</div>'}</div><button class="btn ghost block" data-act="closeSheet">Fechar</button>`);
}

/* ============ DIVISÃO ABCD (modelos predefinidos — professor/admin) ============ */
const ABCD = [
  { letter: 'A', name: 'Treino A · Peito, Ombro e Tríceps', focus: 'Empurrar — membros superiores', color: '#e74c3c', map: [
    ['Supino reto', 'reps', { sets: '4', reps: '8–12' }],
    ['Supino inclinado com halteres', 'reps', { sets: '3', reps: '10–12' }],
    ['Crucifixo', 'reps', { sets: '3', reps: '12–15' }],
    ['Desenvolvimento militar', 'reps', { sets: '3', reps: '8–12' }],
    ['Elevação lateral', 'reps', { sets: '3', reps: '12–15' }],
    ['Tríceps na polia', 'reps', { sets: '3', reps: '10–15' }]
  ]},
  { letter: 'B', name: 'Treino B · Costas e Bíceps', focus: 'Puxar — membros superiores', color: '#3498db', map: [
    ['Barra fixa (ou puxada alta)', 'reps', { sets: '4', reps: '8–10' }],
    ['Remada curvada', 'reps', { sets: '4', reps: '8–12' }],
    ['Puxada na polia alta', 'reps', { sets: '3', reps: '10–12' }],
    ['Remada baixa', 'reps', { sets: '3', reps: '10–12' }],
    ['Rosca direta', 'reps', { sets: '3', reps: '10–12' }],
    ['Rosca alternada', 'reps', { sets: '3', reps: '12' }]
  ]},
  { letter: 'C', name: 'Treino C · Pernas e Glúteos', focus: 'Empurrar — membros inferiores', color: '#2ecc71', map: [
    ['Agachamento livre', 'reps', { sets: '4', reps: '8–10' }],
    ['Leg press 45°', 'reps', { sets: '4', reps: '10–12' }],
    ['Cadeira extensora', 'reps', { sets: '3', reps: '12–15' }],
    ['Mesa flexora', 'reps', { sets: '4', reps: '10–12' }],
    ['Elevação pélvica', 'reps', { sets: '3', reps: '12–15' }],
    ['Panturrilha em pé', 'reps', { sets: '4', reps: '15–20' }]
  ]},
  { letter: 'D', name: 'Treino D · Glúteos, Core e Cardio', focus: 'Potência, centro e condicionamento', color: '#f39c12', map: [
    ['Agachamento sumô', 'reps', { sets: '3', reps: '12' }],
    ['Stiff', 'reps', { sets: '3', reps: '10–12' }],
    ['Abdominal na polia', 'reps', { sets: '3', reps: '15' }],
    ['Prancha', 'time', { sets: '3', secs: '45' }],
    ['Escalador (mountain climber)', 'reps', { sets: '3', reps: '30s' }],
    ['Corrida / bicicleta', 'cardio', { min: '15', km: '' }]
  ]}
];
export function abcdSheet() {
  const me = C.me();
  if (me.role !== 'professor' && me.role !== 'admin') { C.toast('Disponível apenas para professores.'); return }
  const s = G();
  C.openSheet(`<h2>Divisão ABCD</h2><p class="muted" style="font-size:12.5px;line-height:1.55">Modelos prontos de treino. Escolha um dia e aplique em <b style="color:var(--text)">${esc((s.profile && s.profile.name) || 'aluno')}</b> — os exercícios entram na ficha da semana.</p>
  <div class="stack">${ABCD.map(d => `<div class="card stack" style="padding:14px"><div class="row"><div style="display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:10px;background:${d.color};color:#fff;display:grid;place-items:center;font-weight:900;font-size:15px;flex:none">${d.letter}</div><div><strong style="font-size:14px">${esc(d.name)}</strong><div class="muted" style="font-size:11.5px;margin-top:2px">${esc(d.focus)} · ${d.map.length} exercícios</div></div></div></div><div style="display:flex;gap:6px;flex-wrap:wrap">${d.map.map(e => `<span class="tag">${esc(e[0])}</span>`).join('')}</div><div class="footer-actions"><button class="btn small" data-act="abcdApply" data-id="${d.letter}">Aplicar na ficha</button><button class="btn small ghost" data-act="abcdView" data-id="${d.letter}">Ver detalhes</button></div></div>`).join('')}</div><button class="btn ghost block" data-act="closeSheet">Fechar` + `</button>`);
}
function abcdDay(letter) {
  const d = ABCD.find(x => x.letter === letter); if (!d) return null;
  return { id: uid(), name: d.name, color: d.color, exercises: d.map.map(([name, type, p]) => ({ id: uid(), name, type, ...E.defaultsFor(type), ...p, note: '', lib: '', group: '', video: '', howto: '' })) };
}
function abcdView(letter) {
  const d = ABCD.find(x => x.letter === letter); if (!d) return;
  C.openSheet(`<h2 style="display:flex;align-items:center;gap:10px"><span style="width:30px;height:30px;border-radius:9px;background:${d.color};color:#fff;display:grid;place-items:center;font-size:14px;font-weight:900">${d.letter}</span>${esc(d.name)}</h2><p class="muted" style="font-size:12.5px;line-height:1.6">${esc(d.focus)}</p><div class="kv" style="margin-top:6px">${d.map.map(([name, type, p]) => `<div style="padding:10px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:8px"><span>${esc(name)}</span><b style="font-size:12px">${esc(E.exSummary({ name, type, ...p }))}</b></div>`).join('')}</div><button class="btn block" data-act="abcdApply" data-id="${letter}">Aplicar este treino</button><button class="btn ghost block" data-act="closeSheet">Fechar</button>`);
}
function abcdApply(letter) {
  const s = G(), day = abcdDay(letter); if (!day) return;
  s.plan.days.push(day); C.setSel(day.id); C.savePlan(); C.closeSheet(); C.rerender(); C.toast(`Divisão ${letter} aplicada!`);
}

/* ============ colar treino ============ */
let pasted = null;
export function pasteSheet() {
  pasted = null;
  C.openSheet(`<h2>Colar treino</h2><p class="muted" style="font-size:12.5px;line-height:1.55">Cole o treino como está no WhatsApp, PDF ou anotação. O app separa os dias e os exercícios. Você confere antes de importar.</p><textarea id="pasteTxt" class="wide-input" style="min-height:220px" placeholder="Treino A - Peito&#10;Supino reto 4x8-12&#10;Crucifixo 3x12&#10;Prancha 3x30s&#10;Esteira 20 min&#10;&#10;Treino B - Costas&#10;Puxada alta 4x10…"></textarea><button class="btn block" data-act="pasteParse">Analisar texto</button>`);
}
function pastePreview() {
  const r = pasted, n = r.days.reduce((a, d) => a + d.exercises.length, 0);
  if (!n) { C.toast('Não encontrei exercícios nesse texto.'); return }
  C.openSheet(`<h2>Conferir treino</h2><p class="muted" style="font-size:12.5px">Encontrei <b style="color:var(--text)">${r.days.length} dia${r.days.length > 1 ? 's' : ''}</b> e <b style="color:var(--text)">${n} exercícios</b>. Dá para ajustar tudo depois.</p>${r.days.map(d => `<div class="card stack" style="padding:14px"><strong style="font-size:14px">${esc(d.name)}</strong>${d.exercises.map(e => `<div class="meal-row" style="padding:9px 0"><div><strong style="font-size:13px">${esc(e.name)}</strong><small>${esc(E.exSummary(e))}${e.note ? ' · ' + esc(e.note) : ''}</small></div></div>`).join('')}</div>`).join('')}${r.skipped.length ? `<p class="notice">${r.skipped.length} linha${r.skipped.length > 1 ? 's' : ''} ignorada${r.skipped.length > 1 ? 's' : ''}: ${esc(r.skipped.slice(0, 3).join(' | ').slice(0, 160))}${r.skipped.length > 3 ? '…' : ''}</p>` : ''}<button class="btn block" data-act="pasteApply">Importar para a ficha</button><button class="btn ghost block" data-act="pasteOpen">Voltar</button>`);
}

/* ============ cronômetro de intervalos ============ */
const IV = { t: null };
export function ivStart(eid) {
  const ex = C.findEx(eid); if (!ex) return; const phases = E.intervalPhases(ex); if (!phases.length) return;
  Object.assign(IV, { ex, eid, phases, i: 0, paused: false, rounds: 0, lastBeep: -1 });
  C.openSheet(`<h2>${esc(ex.name)}</h2><div class="eyebrow" id="ivLabel" style="text-align:center"></div><div class="timer-number" id="ivTime">00:00</div><div class="notice" id="ivRound" style="text-align:center"></div><div class="progress"><div id="ivProg"></div></div><div class="footer-actions" style="justify-content:center"><button class="btn" id="ivToggle" data-act="ivToggle">Pausar</button><button class="btn secondary" data-act="ivSkip">Pular fase</button></div><button class="btn ghost block" data-act="ivStop">Encerrar</button>`);
  C.wake(); ivPhase(0);
}
function ivPhase(i) {
  IV.i = i; const p = IV.phases[i]; IV.total = p.secs; IV.left = p.secs; IV.end = Date.now() + p.secs * 1000; IV.lastBeep = -1; clearInterval(IV.t); IV.t = setInterval(ivTick, 200); ivPaint(); if (i) C.tone(p.label === 'DESCANSO' ? 520 : 880, 260);
}
function ivPaint() {
  if (!$('ivTime')) return; const p = IV.phases[IV.i];
  $('ivLabel').textContent = p.label; $('ivTime').textContent = E.fmtDur(IV.left); $('ivProg').style.width = (100 * (1 - IV.left / IV.total)) + '%';
  $('ivRound').textContent = p.label === 'AMRAP' ? 'Faça o máximo de rodadas' : `Rodada ${p.round} de ${p.of}`;
}
function ivTick() {
  if (IV.paused) return; IV.left = Math.max(0, Math.ceil((IV.end - Date.now()) / 1000));
  if (IV.left > 0 && IV.left <= 3 && IV.lastBeep !== IV.left) { IV.lastBeep = IV.left; C.tone(660, 110) }
  ivPaint(); if (IV.left <= 0) ivNext();
}
function ivNext() {
  const p = IV.phases[IV.i]; if (p.label !== 'DESCANSO' && p.label !== 'AMRAP') IV.rounds++;
  if (IV.i + 1 < IV.phases.length) ivPhase(IV.i + 1); else ivDone();
}
function ivDone() {
  clearInterval(IV.t); C.releaseWake(); C.tone(1175, 600);
  if (IV.ex.mode === 'amrap') { C.openSheet(`<h2>Tempo!</h2><div class="field"><label>QUANTAS RODADAS VOCÊ COMPLETOU?</label><input id="ivRounds" class="wide-input" inputmode="numeric" placeholder="Ex.: 7"></div><button class="btn block" data-act="ivSave">Salvar</button>`); return }
  C.applyInterval(IV.eid, IV.rounds); C.closeSheet(); C.toast('Intervalos concluídos!');
}
export function stopIntervals() { clearInterval(IV.t); IV.t = null }

/* ============ cardio ============ */
const mon = () => keyOf(mondayOf(new Date()));
export function renderCardio() {
  const s = G(), self = s.self, acts = (s.acts || []).slice().sort((a, b) => b.date.localeCompare(a.date)), wk = acts.filter(a => a.day >= mon());
  const km = wk.reduce((t, a) => t + num(a.km), 0), mn = wk.reduce((t, a) => t + num(a.min), 0);
  $('cardioBody').innerHTML = `<div><div class="eyebrow">${self ? 'Seus treinos fora da musculação' : 'Atividades do aluno'}</div><h2 class="page-title">Cardio</h2><p class="muted" style="font-size:13px">Caminhada, corrida, bicicleta, natação e outras atividades.</p></div>
  <div class="stats"><div class="stat"><div class="label">ESTA SEMANA</div><div class="value">${fmt(km, 1)}</div><div class="sub">km</div></div><div class="stat"><div class="label">TEMPO</div><div class="value">${Math.round(mn)}</div><div class="sub">minutos · ${wk.length} atividade${wk.length === 1 ? '' : 's'}</div></div></div>
  ${self ? `<div class="footer-actions"><button class="btn" data-act="actNew">+ Registrar atividade</button><button class="btn secondary" data-act="actImport">Importar GPX/TCX</button></div><p class="notice">GPX e TCX são os arquivos que Strava, Garmin, relógios e apps de corrida permitem exportar.</p>` : ''}
  <div class="stack">${acts.slice(0, 40).map(a => `<button class="urow" data-act="actView" data-id="${a.id}"><div class="routebox">${E.routeSvg(a.track, 64, 48) || ic('trend', 22)}</div><div class="uinfo"><strong>${esc(E.actLabel(a.type))}${num(a.km) ? ' · ' + fmt(num(a.km), 2) + ' km' : ''}</strong><small>${a.day.slice(8)}/${a.day.slice(5, 7)} · ${Math.round(num(a.min))} min${num(a.km) ? ' · ' + E.fmtPace(num(a.min) * 60, a.km, a.type) : ''}</small></div>${ic('chevron', 18)}</button>`).join('') || `<div class="empty">${self ? 'Nenhuma atividade ainda. Registre a primeira ou importe um arquivo do seu relógio/app.' : 'O aluno ainda não registrou atividades.'}</div>`}</div>`;
}
function actForm(pre) {
  const day = pre && pre.startISO ? keyOf(new Date(pre.startISO)) : todayKey();
  C.openSheet(`<h2>${pre ? 'Importar atividade' : 'Registrar atividade'}</h2>${pre && pre.track ? `<div class="card" style="color:var(--text);padding:10px">${E.routeSvg(pre.track, 320, 150)}</div>` : ''}<div class="field"><label>TIPO</label><select id="aType" class="sel">${E.ACT_TYPES.map(([k, l]) => `<option value="${k}" ${pre && pre.sport === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="two"><div class="field"><label>DATA</label><input id="aDate" class="wide-input" type="date" value="${day}" max="${todayKey()}"></div><div class="field"><label>ESFORÇO (1 A 10)</label><select id="aEff" class="sel"><option value="">—</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option>${n}</option>`).join('')}</select></div></div><div class="two"><div class="field"><label>DURAÇÃO (MIN)</label><input id="aMin" class="wide-input" inputmode="decimal" value="${pre && pre.secs ? Math.round(pre.secs / 60) : ''}"></div><div class="field"><label>DISTÂNCIA (KM)</label><input id="aKm" class="wide-input" inputmode="decimal" value="${pre ? pre.km : ''}"></div></div><div class="field"><label>NOTAS (OPCIONAL)</label><textarea id="aNotes" class="wide-input" placeholder="Como foi? Percurso, clima, sensação…"></textarea></div><button class="btn block" data-act="actSave">Salvar atividade</button>`);
  actPre = pre || null;
}
let actPre = null;
async function importTrackFile(inp) {
  const f = inp.files[0]; inp.value = ''; if (!f) return;
  try { const t = await f.text(); actForm(E.parseTrack(t)) } catch (e) { C.toast(e.message || 'Não consegui ler esse arquivo.') }
}
function actView(id) {
  const s = G(), a = (s.acts || []).find(x => x.id === id); if (!a) return;
  const cell = (l, v) => v ? `<div><b>${v}</b><small>${l}</small></div>` : '';
  C.openSheet(`<h2>${esc(E.actLabel(a.type))}</h2><p class="muted" style="font-size:12px">${new Date(a.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>${a.track ? `<div class="card" style="color:var(--text);padding:10px">${E.routeSvg(a.track, 320, 190)}</div>` : ''}<div class="sum">${cell('DISTÂNCIA', num(a.km) ? fmt(num(a.km), 2) + ' km' : '')}${cell('TEMPO', num(a.min) ? E.fmtDur(num(a.secs) || num(a.min) * 60) : '')}${cell('RITMO', num(a.km) ? E.fmtPace(num(a.secs) || num(a.min) * 60, a.km, a.type) : '')}${cell('ELEVAÇÃO', a.gain ? '+' + a.gain + ' m' : '')}${cell('CALORIAS*', a.kcal ? a.kcal + ' kcal' : '')}${cell('ESFORÇO', a.effort ? a.effort + '/10' : '')}</div>${a.notes ? `<div class="card"><p style="font-size:13.5px;line-height:1.6;white-space:pre-wrap">${esc(a.notes)}</p></div>` : ''}<p class="notice">*Estimativa por tipo de atividade e peso corporal. Não substitui medição por relógio.</p>${s.self ? `<button class="btn danger block" data-act="actDel" data-id="${a.id}">Excluir atividade</button>` : ''}<button class="btn ghost block" data-act="closeSheet">Fechar</button>`);
}

/* ============ recados ============ */
let chatUn = null, msgs = [];
export const stopChat = () => { if (chatUn) { try { chatUn() } catch { } chatUn = null } };
export function onSheetClose() { stopChat(); stopIntervals() }
export async function loadMsgs() {
  const s = G(); try { const r = await getDocs(query(collection(C.db, 'users', s.uid, 'messages'), orderBy('at', 'desc'), limit(20))); s.msgs = r.docs.map(d => ({ id: d.id, ...d.data() })).reverse() } catch { s.msgs = [] }
}
export function unreadForStudent() { const s = G(), seen = (C.state().msgSeenAt || 0); return (s.msgs || []).filter(m => m.from !== C.me().uid && m.at > seen).length }
function markSeen() { const s = G(), me = C.me(); if (s.self) { C.state().msgSeenAt = Date.now(); C.saveStateNow() } else { pro.seen = pro.seen || {}; pro.seen[s.uid] = Date.now(); savePro() } }
export function chatSheet() {
  const s = G(), me = C.me(); stopChat();
  C.openSheet(`<h2>Recados</h2><div class="chat" id="chatList"><div class="empty">Carregando…</div></div><form class="chatform" data-form="chatSend"><textarea id="chatIn" class="wide-input" rows="2" maxlength="1000" placeholder="Escreva um recado…"></textarea><button class="btn">Enviar</button></form><button class="btn ghost block" data-act="closeSheet">Fechar</button>`);
  markSeen();
  chatUn = onSnapshot(query(collection(C.db, 'users', s.uid, 'messages'), orderBy('at', 'desc'), limit(50)), snap => {
    msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse(); s.msgs = msgs.slice(-20);
    const box = $('chatList'); if (!box) return;
    box.innerHTML = msgs.map(m => `<div class="bubble ${m.from === me.uid ? 'mine' : ''}"><div>${esc(m.text)}</div><small>${m.from === me.uid ? '' : esc(m.fromName || '') + ' · '}${new Date(m.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></div>`).join('') || '<div class="empty">Nenhum recado ainda. Escreva o primeiro.</div>';
    box.scrollTop = box.scrollHeight; markSeen();
  }, () => { const b = $('chatList'); if (b) b.innerHTML = '<div class="empty">Não foi possível carregar os recados.</div>' });
}
async function sendChat() {
  const t = ($('chatIn').value || '').trim(); if (!t) return; const s = G(), me = C.me(), at = Date.now(); $('chatIn').value = '';
  try {
await setDoc(doc(collection(C.db, 'users', s.uid, 'messages')), {
  from: me.uid,
  fromName: me.name,
  text: t.slice(0, 1000),
  at
});
    if (s.self) { C.state().lastMsgAt = at; C.saveStateNow(); C.saveSummary() }
  } catch (e) { C.toast('Não foi possível enviar.') }
}

/* ============ convite (link + QR) ============ */
const inviteLink = code => location.origin + location.pathname.replace(/[^/]*$/, '') + '?convite=' + code;
async function newInvite(old) {
  const me = C.me(); if (old && pro.inviteCode) { try { await updateDoc(doc(C.db, 'invites', pro.inviteCode), { active: false }) } catch { } }
  const code = E.makeCode(), exp = Date.now() + 30 * 864e5;
  await setDoc(doc(C.db, 'invites', code), { professorId: me.uid, professorName: me.name, active: true, createdAt: Date.now(), expiresAt: exp });
  pro.inviteCode = code; pro.inviteExp = exp; await savePro(); return code;
}
export async function inviteSheet(renew) {
  C.openSheet('<h2>Convidar aluno</h2><div class="empty">Gerando link…</div>');
  let code = pro.inviteCode;
  try { if (renew || !code || (pro.inviteExp || 0) < Date.now()) code = await newInvite(!!renew) } catch (e) { C.openSheet('<h2>Convidar aluno</h2><div class="empty">Não foi possível gerar o convite. Verifique as regras do Firestore.</div><button class="btn ghost block" data-act="closeSheet">Fechar</button>'); return }
  const link = inviteLink(code), days = Math.max(1, Math.round(((pro.inviteExp || 0) - Date.now()) / 864e5));
  C.openSheet(`<h2>Convidar aluno</h2><p class="muted" style="font-size:12.5px;line-height:1.55">O aluno abre o link, cria o próprio login e já entra na sua lista. Válido por mais ${days} dias.</p><div class="qrbox" id="qrBox"></div><input class="wide-input" id="invLink" readonly value="${esc(link)}" onclick="this.select()"><div class="footer-actions"><button class="btn small" data-act="inviteCopy">Copiar link</button><a class="btn small secondary" style="text-decoration:none;display:inline-block" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent('Entre no meu app de treino: ' + link)}">Enviar no WhatsApp</a></div><button class="btn danger block" data-act="inviteNew">Gerar novo link (o atual deixa de funcionar)</button><button class="btn ghost block" data-act="closeSheet">Fechar</button>`);
  E.qrSvg(link).then(svg => { const b = $('qrBox'); if (b && svg) b.innerHTML = svg });
}

/* ============ painel do professor ============ */
export const sums = {};
export async function loadSummaries(students) {
  await Promise.all(students.map(async u => { try { const s = await getDoc(doc(C.db, 'users', u.uid, 'data', 'summary')); sums[u.uid] = s.exists() ? s.data() : null } catch { sums[u.uid] = null } }));
}
export const alertDays = () => pro.alertDays || 4;
export function metaOf(u) {
  const s = sums[u.uid], today = todayKey(), seen = (pro.seen && pro.seen[u.uid]) || 0, newMsg = !!(s && (s.msgAt || 0) > seen);
  if (!s || !s.lastDay) { const d = Math.floor((Date.now() - (u.createdAt || Date.now())) / 864e5); return { never: true, alert: u.active !== false && d >= alertDays(), newMsg, daysSince: null, wk: 0, planned: 0, pct: null, line: 'Ainda não treinou' } }
  const ds = Math.round((parseKey(today) - parseKey(s.lastDay)) / 864e5), wk = (s.days || []).filter(d => d >= mon()).length, planned = s.planned || 0, p = (s.pcts || []).slice(-4), pct = p.length ? Math.round(p.reduce((a, x) => a + (x.p || 0), 0) / p.length) : null;
  return { alert: u.active !== false && ds >= alertDays(), newMsg, daysSince: ds, wk, planned, pct, line: `Último treino ${ds <= 0 ? 'hoje' : ds === 1 ? 'ontem' : 'há ' + ds + ' dias'} · ${wk}${planned ? '/' + planned : ''} na semana${pct != null ? ' · ' + pct + '% das séries' : ''}` };
}
export function dashHTML(students) {
  const act = students.filter(u => u.active !== false), metas = act.map(u => ({ u, m: metaOf(u) })), risk = metas.filter(x => x.m.alert), trained = metas.filter(x => x.m.wk > 0).length;
  return `<div class="stats"><div class="stat"><div class="label">TREINARAM NA SEMANA</div><div class="value">${trained}<span style="font-size:16px;color:var(--mut)">/${act.length}</span></div><div class="sub">alunos ativos</div></div><div class="stat"><div class="label">PRECISAM DE ATENÇÃO</div><div class="value">${risk.length}</div><div class="sub">sem treinar há ${alertDays()}+ dias</div></div></div>
  ${risk.length ? `<div class="card stack"><h3 class="section-title">Atenção</h3>${risk.slice(0, 6).map(({ u, m }) => `<button class="urow" data-act="openStudent" data-id="${u.uid}"><div class="avatar">${esc((u.name[0] || '?').toUpperCase())}</div><div class="uinfo"><strong>${esc(u.name)}</strong><small>${esc(m.line)}</small></div>${ic('chevron', 18)}</button>`).join('')}</div>` : ''}
  <div class="row"><span class="muted" style="font-size:12.5px">Alertar após</span><select id="alertDays" class="sel" style="width:120px">${[2, 3, 4, 5, 7, 10, 14].map(n => `<option value="${n}" ${n === alertDays() ? 'selected' : ''}>${n} dias</option>`).join('')}</select></div>`;
}

/* ============ ações ============ */
export const ACT = {
  libMode: d => { const mine = d.m === 'mine'; document.querySelectorAll('#libSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === d.m)); $('libDb').classList.toggle('hidden', mine); $('myLib').classList.toggle('hidden', !mine); if (mine) renderMyLib() },
  myNew: () => itemForm(), myEdit: d => itemForm(lib.items.find(i => i.id === d.id)),
  mySave: d => {
    const name = $('cName').value.trim(); if (!name) { alert('Digite o nome.'); return }
    const it = { id: d.id || uid(), name, type: $('cType').value, muscle: $('cMus').value, video: $('cVideo').value.trim(), howto: $('cHow').value.trim() };
    const i = lib.items.findIndex(x => x.id === it.id); if (i >= 0) lib.items[i] = it; else lib.items.push(it); saveLib(); C.closeSheet(); renderMyLib();
  },
  myDel: d => { if (!confirm('Excluir este exercício da sua biblioteca? Fichas que já o usam não mudam.')) return; lib.items = lib.items.filter(i => i.id !== d.id); saveLib(); C.closeSheet(); renderMyLib() },
  myView: d => { const i = lib.items.find(x => x.id === d.id); if (!i) return; C.openSheet(`<h2>${esc(i.name)}</h2><div class="tags"><span class="tag">${esc(E.TYPES[i.type || 'reps'].split(' (')[0])}</span>${i.muscle ? `<span class="tag">${esc(MUS[i.muscle] || '')}</span>` : ''}</div>${E.videoHTML(i.video)}${i.howto ? `<div class="card"><p style="font-size:13.5px;line-height:1.65;white-space:pre-wrap">${esc(i.howto)}</p></div>` : ''}<button class="btn secondary block" data-act="myEdit" data-id="${i.id}">Editar</button><button class="btn danger block" data-act="myDel" data-id="${i.id}">Excluir</button><button class="btn ghost block" data-act="closeSheet">Fechar</button>`) },
  usePickCustom: d => { const i = lib.items.find(x => x.id === d.id); if (i) C.addPicked(exFromItem(i)) },
  customDemo: d => { const day = C.curDay(), e = day && day.exercises.find(x => x.id === d.eid); if (e) customDetail(e) },
  tplOpen: d => tplSheet(d.k),
  tplSave: d => {
    const s = G(), name = prompt('Nome do modelo:', d.k === 'day' ? (C.curDay() || {}).name || '' : d.k === 'plan' ? 'Ficha de ' + s.profile.name : 'Dieta de ' + s.profile.name); if (!name || !name.trim()) return;
    const data = d.k === 'day' ? reId(C.curDay()) : d.k === 'plan' ? { days: s.plan.days.map(reId) } : clean(s.diet);
    tpl.items.push({ id: uid(), kind: d.k, name: name.trim(), data: clean(data), at: Date.now() }); saveTpl(); tplSheet(d.k === 'diet' ? 'diet' : 'workout'); C.toast('Modelo salvo!');
  },
  tplApply: d => {
    const t = tpl.items.find(x => x.id === d.id), s = G(); if (!t) return;
    if (t.kind === 'diet') { if (s.diet.meals.length && !confirm('Substituir a dieta atual pelo modelo?')) return; s.diet = { ...s.diet, ...clean(t.data), meals: (t.data.meals || []).map(m => ({ ...m, id: uid() })) }; C.saveDiet(); C.closeSheet(); C.rerender(); C.toast('Modelo aplicado!'); return }
    const days = t.kind === 'day' ? [reId(t.data)] : t.data.days.map(reId); s.plan.days.push(...days); C.setSel(days[0].id); C.savePlan(); C.closeSheet(); C.rerender(); C.toast('Modelo aplicado!');
  },
  tplDel: d => { if (!confirm('Excluir este modelo?')) return; const k = (tpl.items.find(x => x.id === d.id) || {}).kind; tpl.items = tpl.items.filter(x => x.id !== d.id); saveTpl(); tplSheet(k === 'diet' ? 'diet' : 'workout') },
  pasteOpen: () => pasteSheet(),
  pasteParse: () => { const t = $('pasteTxt').value; if (!t.trim()) { alert('Cole o texto do treino.'); return } pasted = E.parseWorkoutText(t); pastePreview() },
  pasteApply: () => {
    if (!pasted) return; const s = G(); let first = null;
    pasted.days.forEach(d => { const day = { id: uid(), name: d.name, exercises: d.exercises.map(e => ({ id: uid(), lib: '', group: '', video: '', howto: '', ...e })) }; s.plan.days.push(day); if (!first) first = day.id });
    C.setSel(first); C.savePlan(); C.closeSheet(); C.rerender(); C.toast('Treino importado! Confira os exercícios.'); pasted = null;
  },
  ivStart: d => ivStart(d.eid), ivToggle: () => { IV.paused = !IV.paused; if (IV.paused) IV.left = Math.max(0, Math.ceil((IV.end - Date.now()) / 1000)); else IV.end = Date.now() + IV.left * 1000; if ($('ivToggle')) $('ivToggle').textContent = IV.paused ? 'Continuar' : 'Pausar' },
  ivSkip: () => ivNext(), ivStop: () => { if (!confirm('Encerrar os intervalos?')) return; stopIntervals(); C.releaseWake(); C.closeSheet() },
  ivSave: () => { const n = Math.max(0, parseInt($('ivRounds').value) || 0); C.applyInterval(IV.eid, n); C.closeSheet(); C.toast('Rodadas salvas!') },
  timeStart: d => C.startTimer(+d.s || 30, 'EXERCÍCIO'),
  actNew: () => actForm(null), actImport: () => $('trackFile').click(), actView: d => actView(d.id),
  actSave: () => {
    const s = G(), min = num($('aMin').value), km = num($('aKm').value); if (!min && !km) { alert('Informe a duração ou a distância.'); return }
    const type = $('aType').value, day = $('aDate').value || todayKey(), kg = (C.state().weights.slice(-1)[0] || {}).weight;
    const secs = actPre && actPre.secs && Math.round(actPre.secs / 60) === Math.round(min) ? actPre.secs : Math.round(min * 60);
    const a = { date: actPre && actPre.startISO && keyOf(new Date(actPre.startISO)) === day ? actPre.startISO : new Date(day + 'T12:00:00').toISOString(), day, type, min: min || '', km: km || '', secs, effort: $('aEff').value, notes: $('aNotes').value.trim(), kcal: E.kcalEstimate(type, min, kg), source: actPre ? 'arquivo' : 'manual' };
    if (actPre) { a.gain = actPre.gain || 0; a.track = actPre.track || [] }
    const ref = doc(collection(C.db, 'users', s.uid, 'activities')); setDoc(ref, clean(a)).catch(() => C.toast('Não foi possível salvar na nuvem agora.'));
    s.acts = [...(s.acts || []), { ...a, id: ref.id }]; C.saveSummary(); C.closeSheet(); renderCardio(); C.toast('Atividade salva!'); actPre = null;
  },
  actDel: d => { if (!confirm('Excluir esta atividade?')) return; const s = G(); deleteDoc(doc(C.db, 'users', s.uid, 'activities', d.id)).catch(() => { }); s.acts = (s.acts || []).filter(a => a.id !== d.id); C.saveSummary(); C.closeSheet(); renderCardio() },
  chatOpen: () => chatSheet(),
  inviteOpen: () => inviteSheet(false), inviteNew: () => { if (confirm('Gerar um novo link? O link atual deixará de funcionar.')) inviteSheet(true) },
  inviteCopy: () => { const v = $('invLink').value; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => C.toast('Link copiado!')).catch(() => { $('invLink').select(); C.toast('Selecione e copie o link.') }) },

  // AÇÕES DA DIVISÃO ABCD (professor/admin)
  abcdOpen: () => abcdSheet(),
  abcdView: d => abcdView(d.letter),
  abcdApply: d => abcdApply(d.letter)
};
