// ARES GYM — aplicativo (login, professor, aluno e administrador)
import { firebaseConfig } from './firebase-config.js';
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, orderBy, limit, onSnapshot, writeBatch, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { $, esc, num, fmt, pad, keyOf, todayKey, parseKey, mondayOf, normalize, ago, uid, mmss, clean, initial, ic, lineChart, dayLabel, mus, eqp, LV, CAT, FORCE, MUSCLE_CHIPS, X, loadDB, retryDB, searchDB, scoreEx, rank, toGroups, exName, exInstr, hasPT, exFor, demoHTML } from './Util.js';

window.__ares = 1;
const CONFIGURED = !/COLE_AQUI/.test(firebaseConfig.apiKey || 'COLE_AQUI');
let app, auth, db;
if (CONFIGURED) {
  app = initializeApp(firebaseConfig); auth = getAuth(app);
  try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) } catch (e) { db = getFirestore(app) }
}

/* ============ estado global ============ */
let me = null, subj = null, page = '', sel = null, usersCache = [], unsubs = [], adminExists = null, registering = false, authMsg = '';
const FAKE = '@aresgym.app';
const S = () => subj.state;
const WD = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const ROLE = { aluno: 'Aluno', professor: 'Professor', admin: 'Administrador' };
const TEMPLATE = {
  'Terça · Peito/ombro/tríceps': [['Supino deitado na máquina', '3', '8–12'], ['Supino inclinado com halteres', '3', '8–12'], ['Peck deck / crucifixo', '3', '10–15'], ['Elevação lateral', '3', '12–15'], ['Tríceps francês na polia', '2', '10–12'], ['Tríceps corda', '2', '10–15']],
  'Quarta · Pernas moderado': [['Cadeira extensora', '2', '12–15'], ['Leg press 45°', '2', '10–12'], ['Mesa flexora', '3', '10–15'], ['Cadeira abdutora', '2', '12–15'], ['Panturrilha em pé na máquina', '3', '12–15']],
  'Quinta · Costas/bíceps/ombro': [['Puxada alta aberta', '3', '8–12'], ['Remada baixa triângulo', '3', '8–12'], ['Puxada alta triângulo', '2', '10–12'], ['Remada cavalinho máquina', '2', '8–12'], ['Elevação lateral', '2', '12–15'], ['Peck deck invertido', '3', '12–15'], ['Rosca alternada', '3', '8–12'], ['Rosca martelo', '2', '10–12']],
  'Sábado · Opcional': [['Tríceps francês', '2', '10–12'], ['Tríceps corda', '2', '10–15'], ['Rosca direta barra W', '3', '8–12'], ['Rosca martelo', '2', '10–12'], ['Mesa flexora', '2', '10–15'], ['Panturrilha sentado', '3', '12–15']]
};
const templatePlan = () => ({ days: Object.entries(TEMPLATE).map(([name, l]) => ({ id: uid(), name, exercises: l.map(([n, s, r]) => ({ id: uid(), name: n, sets: s, reps: r, note: '', lib: '' })) })) });
const freshState = () => ({ v: 3, weights: [], foods: [], foodDate: todayKey(), proteinGoal: 130, proteinLog: {}, recentFoods: [], drafts: {}, settings: { autoRest: true, rest: 90 }, mealsDone: {} });

const AERR = {
  'auth/invalid-credential': 'Login ou senha incorretos.', 'auth/wrong-password': 'Login ou senha incorretos.', 'auth/user-not-found': 'Login ou senha incorretos.', 'auth/invalid-email': 'Login inválido.',
  'auth/email-already-in-use': 'Esse login já está em uso.', 'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.', 'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'auth/network-request-failed': 'Sem conexão com a internet.', 'auth/user-disabled': 'Conta desativada.', 'auth/requires-recent-login': 'Entre novamente para fazer essa alteração.', 'auth/operation-not-allowed': 'Ative o login por e-mail/senha no Firebase.'
};
const errMsg = e => AERR[e && e.code] || (e && e.code === 'permission-denied' ? 'Sem permissão para essa ação.' : 'Algo deu errado. Tente novamente.');
const toEmail = s => { s = String(s || '').trim().toLowerCase(); return s.includes('@') ? s : s.replace(/\s+/g, '') + FAKE };
const loginOf = e => String(e || '').endsWith(FAKE) ? e.slice(0, -FAKE.length) : e;
const validLogin = s => { s = String(s || '').trim().toLowerCase(); return s.includes('@') ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) : /^[a-z0-9._-]{3,}$/.test(s) };

/* ============ telas ============ */
function showScreen(n) { $('splash').classList.toggle('hidden', n !== 'splash'); $('auth').classList.toggle('hidden', n !== 'auth'); $('shell').classList.toggle('hidden', n !== 'shell') }
function splash(m) { $('splashMsg').textContent = m || ''; showScreen('splash') }
function toast(msg) { const o = document.querySelector('.toast'); if (o) o.remove(); const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 2600) }
function openSheet(html) { $('sheetBody').innerHTML = '<div class="sheet-handle"></div>' + html; $('sheet').classList.remove('hidden'); document.body.style.overflow = 'hidden'; $('sheetBody').scrollTop = 0 }
function closeSheet() { $('sheet').classList.add('hidden'); $('sheetBody').innerHTML = ''; document.body.style.overflow = '' }
function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('aresTheme', t) } catch { } const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'light' ? '#f5f5f3' : '#0b0b0c' }

/* ============ login ============ */
function renderAuth(mode = 'login', msg = '', ok = '') {
  showScreen('auth'); const c = $('authCard'); let h = '<div class="logo">A</div>';
  if (!CONFIGURED) {
    h += `<div><h1>Falta configurar</h1></div><p class="sub">O site já está pronto, mas ainda não está ligado ao Firebase (o banco de dados com os logins).</p><div class="auth-ok">Siga o passo a passo do arquivo <b>COMO-CONFIGURAR.md</b> e cole as chaves em <b>firebase-config.js</b>. Leva uns 10 minutos.</div>`;
  } else if (mode === 'login') {
    h += `<div><h1>Entrar</h1></div><p class="sub">Acesse seus treinos, dietas e evolução.</p>
    <form class="stack" data-form="login"><div class="field"><label>E-MAIL OU USUÁRIO</label><input id="aLogin" class="wide-input" autocomplete="username" autocapitalize="none" autocorrect="off" required></div>
    <div class="field"><label>SENHA</label><input id="aPass" class="wide-input" type="password" autocomplete="current-password" required></div>
    <div class="auth-err" id="aErr">${esc(msg)}</div>${ok ? `<div class="auth-ok">${esc(ok)}</div>` : ''}<button class="btn block" id="aBtn">Entrar</button></form>
    <button class="linkbtn" data-act="authMode" data-m="forgot">Esqueci minha senha</button>${adminExists === false ? '<button class="linkbtn" data-act="authMode" data-m="setup">Primeiro acesso? Criar administrador</button>' : ''}`;
  } else if (mode === 'forgot') {
    h += `<div><h1>Recuperar senha</h1></div><p class="sub">Enviaremos um link para o seu e-mail.</p><form class="stack" data-form="forgot"><div class="field"><label>E-MAIL</label><input id="aLogin" class="wide-input" type="email" autocomplete="email" required></div><div class="auth-err" id="aErr"></div><button class="btn block" id="aBtn">Enviar link</button></form>
    <span class="hint">Contas criadas só com “usuário” (sem e-mail) não têm recuperação: peça ao seu professor ou administrador.</span><button class="linkbtn" data-act="authMode" data-m="login">Voltar</button>`;
  } else if (mode === 'setup') {
    h += `<div><h1>Criar administrador</h1></div><p class="sub">A primeira conta criada controla todo o sistema. Faça isso agora, antes de divulgar o site.</p>
    <form class="stack" data-form="setup"><div class="field"><label>NOME</label><input id="aName" class="wide-input" autocomplete="name" required></div><div class="field"><label>E-MAIL</label><input id="aLogin" class="wide-input" type="email" autocomplete="email" required></div><div class="field"><label>SENHA (MÍNIMO 6)</label><input id="aPass" class="wide-input" type="password" autocomplete="new-password" minlength="6" required></div><div class="auth-err" id="aErr"></div><button class="btn block" id="aBtn">Criar administrador</button></form><button class="linkbtn" data-act="authMode" data-m="login">Voltar</button>`;
  }
  c.innerHTML = h; const f = $('aLogin'); if (f && !('ontouchstart' in window)) f.focus();
}
const setAuthErr = m => { const e = $('aErr'); if (e) e.textContent = m || '' };
const FORM = {
  login: async () => { const b = $('aBtn'); b.disabled = true; setAuthErr(''); try { await signInWithEmailAndPassword(auth, toEmail($('aLogin').value), $('aPass').value) } catch (e) { setAuthErr(errMsg(e)); b.disabled = false } },
  forgot: async () => {
    const e = $('aLogin').value.trim().toLowerCase(), b = $('aBtn'); if (e.endsWith(FAKE)) { setAuthErr('Esta conta não tem e-mail. Peça ao seu professor ou administrador.'); return }
    b.disabled = true; try { await sendPasswordResetEmail(auth, e); renderAuth('login', '', 'Se o e-mail estiver cadastrado, o link chegou na sua caixa de entrada.') } catch (er) { setAuthErr(errMsg(er)); b.disabled = false }
  },
  setup: async () => {
    const name = $('aName').value.trim(), email = $('aLogin').value.trim().toLowerCase(), pw = $('aPass').value, b = $('aBtn');
    if (!name) { setAuthErr('Digite seu nome.'); return } b.disabled = true; setAuthErr(''); registering = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pw), id = cred.user.uid, batch = writeBatch(db);
      batch.set(doc(db, 'meta', 'admin'), { uid: id, createdAt: Date.now() });
      batch.set(doc(db, 'users', id), { name, email, role: 'admin', active: true, professorId: null, createdAt: Date.now() });
      await batch.commit(); adminExists = true; registering = false; await boot(cred.user);
    } catch (e) { registering = false; setAuthErr(errMsg(e)); b.disabled = false; if (auth.currentUser) { try { await signOut(auth) } catch { } } }
  },
  createUser: async f => {
    const role = f.dataset.role, name = $('cuName').value.trim(), login = $('cuLogin').value.trim(), pw = $('cuPass').value, b = $('cuBtn'), err = $('cuErr');
    if (!name) { err.textContent = 'Digite o nome.'; return } if (!validLogin(login)) { err.textContent = 'Use um e-mail ou um usuário (letras, números, ponto; mínimo 3).'; return } if (pw.length < 6) { err.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return }
    b.disabled = true; err.textContent = '';
    try {
      const email = toEmail(login), id = await createAuthUser(email, pw);
      const prof = { name, email, role, active: true, professorId: role === 'aluno' ? me.uid : null, createdAt: Date.now() };
      await setDoc(doc(db, 'users', id), prof);
      if (role === 'aluno' && $('cuTpl') && $('cuTpl').checked) await setDoc(doc(db, 'users', id, 'data', 'plan'), clean(templatePlan()));
      usersCache.push({ uid: id, ...prof }); closeSheet(); go(page); toast(ROLE[role] + ' criado!');
      openSheet(`<h2>Conta criada</h2><p class="muted" style="font-size:13px;line-height:1.6">Passe estes dados para ${esc(name)}. Ele pode trocar a senha depois, em <b>Conta</b>.</p><div class="card stack"><div><div class="eyebrow">LOGIN</div><div style="font-size:17px;font-weight:750;margin-top:5px;word-break:break-all">${esc(loginOf(email))}</div></div><div><div class="eyebrow">SENHA PROVISÓRIA</div><div style="font-size:17px;font-weight:750;margin-top:5px;word-break:break-all">${esc(pw)}</div></div></div><button class="btn block" data-act="closeSheet">Pronto</button>`);
    } catch (e) { err.textContent = errMsg(e); b.disabled = false }
  }
};
// cria o login em um app secundário, para o professor/admin não ser desconectado
async function createAuthUser(email, pw) {
  const a2 = initializeApp(firebaseConfig, 'sec' + Date.now());
  try { const cred = await createUserWithEmailAndPassword(getAuth(a2), email, pw); const id = cred.user.uid; await signOut(getAuth(a2)); return id } finally { try { await deleteApp(a2) } catch { } }
}
async function checkAdminExists() { if (adminExists !== null) return; try { adminExists = (await getDoc(doc(db, 'meta', 'admin'))).exists() } catch { adminExists = true } }
async function authFail(msg) { authMsg = msg; try { await signOut(auth) } catch { renderAuth('login', msg) } }

/* ============ entrada no sistema ============ */
async function boot(user) {
  splash('Carregando…');
  let snap; try { snap = await getDoc(doc(db, 'users', user.uid)) } catch (e) { return authFail('Não foi possível carregar sua conta. Verifique a internet.') }
  if (!snap.exists()) return authFail('Esta conta não tem perfil no sistema. Fale com o administrador.');
  me = { uid: user.uid, ...snap.data() };
  if (me.active === false) return authFail('Sua conta está desativada. Fale com ' + (me.role === 'aluno' ? 'seu professor' : 'o administrador') + '.');
  try {
    if (me.role === 'aluno') { await openSubject(me.uid, me, true); setSelDefault(); showScreen('shell'); go('home') }
    else { await loadUsers(); showScreen('shell'); go(me.role === 'admin' ? 'professors' : 'students') }
  } catch (e) { console.error(e); authFail('Erro ao carregar seus dados: ' + errMsg(e)); return }
  loadDB(() => { rerender(); if (page === 'library') renderLibResults(); paintLibStatus() });
  document.documentElement.scrollTop = 0;
}
async function loadUsers() {
  const q = me.role === 'admin' ? collection(db, 'users') : query(collection(db, 'users'), where('professorId', '==', me.uid));
  const s = await getDocs(q); usersCache = s.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== me.uid);
  usersCache.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
function watch(ref, apply) {
  return new Promise(res => {
    let first = true;
    const un = onSnapshot(ref, snap => { apply(snap); if (first) { first = false; res() } else if (!snap.metadata.hasPendingWrites) rerender() }, err => { console.warn(err); if (first) { first = false; res() } });
    unsubs.push(un);
  });
}
function stopSubject() { unsubs.forEach(u => { try { u() } catch { } }); unsubs = [] }
async function openSubject(id, profile, self) {
  stopSubject(); stopAllTimers();
  subj = { uid: id, profile, self, canEdit: !self, plan: { days: [] }, diet: { meals: [], goal: 0, guidance: '' }, state: freshState(), sessions: [] };
  const base = ['users', id, 'data'];
  await Promise.all([
    watch(doc(db, ...base, 'plan'), s => { const p = s.exists() ? s.data() : {}; subj.plan = { days: (p.days || []).map(d => ({ ...d, exercises: d.exercises || [] })) } }),
    watch(doc(db, ...base, 'diet'), s => { const p = s.exists() ? s.data() : {}; subj.diet = { meals: [], goal: 0, guidance: '', ...p } }),
    (async () => {
      if (self) { const s = await getDoc(doc(db, ...base, 'state')); if (s.exists()) subj.state = { ...freshState(), ...s.data(), settings: { ...freshState().settings, ...(s.data().settings || {}) } } }
      else { try { const s = await getDoc(doc(db, ...base, 'state')); if (s.exists()) subj.state = { ...freshState(), ...s.data() } } catch { } }
    })(),
    (async () => { const s = await getDocs(query(collection(db, 'users', id, 'sessions'), orderBy('date', 'desc'), limit(400))); subj.sessions = s.docs.map(d => ({ id: d.id, ...d.data() })).reverse() })()
  ]);
  if (self && S().foodDate !== todayKey()) { S().foodDate = todayKey(); S().foods = [] }
  sel = null; setSelDefault();
}
function setSelDefault() { const d = subj.plan.days; if (!d.find(x => x.id === sel)) { const s = suggestedDay(); sel = s ? s.id : (d[0] ? d[0].id : null) } }
async function openStudent(id) {
  const p = usersCache.find(u => u.uid === id); if (!p) return; splash('Abrindo aluno…');
  try { await openSubject(id, p, false); showScreen('shell'); go('workouts') } catch (e) { showScreen('shell'); toast(errMsg(e)); go(page || 'students') }
}
function closeStudent() { stopSubject(); subj = null; go(me.role === 'admin' ? 'students' : 'students') }
function rerender() { if (!subj) return; if (page === 'workouts') renderWorkouts(); else if (page === 'diet') renderDiet(); else if (page === 'home') renderHome(); else if (page === 'sdetail') renderSDetail(); else if (page === 'progress') renderProgress() }

/* ============ navegação ============ */
function navItems() {
  if (subj && !subj.self) return [['workouts', 'dumbbell', 'Treinos'], ['diet', 'utensils', 'Dieta'], ['progress', 'trend', 'Evolução'], ['sdetail', 'user', 'Aluno']];
  if (me.role === 'aluno') return [['home', 'home', 'Início'], ['workouts', 'dumbbell', 'Treinos'], ['diet', 'utensils', 'Dieta'], ['progress', 'trend', 'Evolução'], ['library', 'grid', 'Biblioteca']];
  if (me.role === 'professor') return [['students', 'users', 'Alunos'], ['library', 'grid', 'Biblioteca'], ['account', 'user', 'Conta']];
  return [['professors', 'shield', 'Professores'], ['students', 'users', 'Alunos'], ['library', 'grid', 'Biblioteca'], ['account', 'user', 'Conta']];
}
function renderNav() { $('navInner').innerHTML = navItems().map(([p, i, l]) => `<button class="${p === page ? 'active' : ''}" data-act="go" data-p="${p}"><span class="ib">${ic(i, 20)}</span>${l}</button>`).join('') }
function renderHeader() {
  const h = $('hdr');
  if (subj && !subj.self) { h.innerHTML = `<button class="back" data-act="closeStudent">${ic('back', 18)}Voltar</button><div class="hdr-mid"><small>Aluno</small><strong>${esc(subj.profile.name)}</strong></div><span style="width:40px"></span>`; return }
  h.innerHTML = `<div class="brand"><div class="logo">A</div><div><h1>ARES GYM</h1><p>${ROLE[me.role]}</p></div></div><div class="head-right">${me.role === 'aluno' ? `<button class="icon-btn" data-act="openTimer" aria-label="Cronômetro de descanso">${ic('timer', 19)}</button>` : ''}<button class="avatar" data-act="go" data-p="account" aria-label="Minha conta">${esc(initial(me.name))}</button></div>`;
}
const RENDER = { home: () => renderHome(), workouts: () => renderWorkouts(), diet: () => renderDiet(), progress: () => renderProgress(), library: () => enterLibrary(), students: () => renderStudents(), professors: () => renderProfessors(), sdetail: () => renderSDetail(), account: () => renderAccount() };
function go(p) {
  page = p; document.querySelectorAll('.page').forEach(e => e.classList.add('hidden')); $('page-' + p).classList.remove('hidden');
  renderNav(); renderHeader(); (RENDER[p] || (() => { }))(); window.scrollTo({ top: 0 });
}

/* ============ estatísticas ============ */
function sessionDays() { const m = {}; subj.sessions.forEach(s => { m[s.day] = (m[s.day] || 0) + 1 }); return m }
function weekStats() { const mon = keyOf(mondayOf(new Date())); let n = 0, vol = 0; subj.sessions.forEach(s => { if (s.day >= mon) { n++; vol += s.volume || 0 } }); return { n, vol } }
function weekStreak() { const w = new Set(subj.sessions.map(s => keyOf(mondayOf(parseKey(s.day))))); let c = mondayOf(new Date()), n = 0; if (!w.has(keyOf(c))) c.setDate(c.getDate() - 7); while (w.has(keyOf(c))) { n++; c.setDate(c.getDate() - 7) } return n }
function lastPerf(name) { const k = normalize(name); for (let i = subj.sessions.length - 1; i >= 0; i--) { const en = subj.sessions[i].entries.find(e => normalize(e.exercise) === k && (num(e.load) > 0 || (e.setsData && e.setsData.length))); if (en) return { en, date: subj.sessions[i].date } } return null }
function lastSet(name, s) { const p = lastPerf(name); if (!p) return null; const sd = p.en.setsData; if (sd && sd.length) { const r = sd[Math.min(s, sd.length - 1)]; return { kg: String(r.kg ?? ''), reps: String(r.reps ?? '') } } return { kg: String(p.en.load || ''), reps: String(p.en.reps || '') } }
function maxLoadBefore(name) { const k = normalize(name); let m = 0; subj.sessions.forEach(s => s.entries.forEach(e => { if (normalize(e.exercise) === k) { const l = e.setsData && e.setsData.length ? Math.max(0, ...e.setsData.map(x => num(x.kg))) : num(e.load); if (l > m) m = l } })); return m }
const est1RM = (kg, r) => r <= 1 ? kg : kg * (1 + r / 30);
function suggestedDay() { const t = WD[new Date().getDay()]; return subj && subj.plan.days.find(d => normalize(d.name).startsWith(t)) || null }
const proteinGoal = () => (subj.diet && subj.diet.goal) || S().proteinGoal || 130;
function foodTotal() { if (S().foodDate !== todayKey()) { S().foodDate = todayKey(); S().foods = []; saveState() } return Math.round(S().foods.reduce((s, f) => s + Number(f.protein || 0), 0) * 10) / 10 }

/* ============ salvar ============ */
let saveT = null;
function saveState() { if (!subj || !subj.self) return; clearTimeout(saveT); saveT = setTimeout(saveStateNow, 1200) }
function saveStateNow() { clearTimeout(saveT); if (!subj || !subj.self) return; const st = S(), keys = Object.keys(st.mealsDone || {}).sort(); keys.slice(0, Math.max(0, keys.length - 14)).forEach(k => delete st.mealsDone[k]); setDoc(doc(db, 'users', subj.uid, 'data', 'state'), clean(st)).catch(e => { console.warn(e); toast('Não foi possível salvar na nuvem agora.') }) }
const savePlan = () => setDoc(doc(db, 'users', subj.uid, 'data', 'plan'), clean(subj.plan)).catch(e => toast(errMsg(e)));
const saveDiet = () => setDoc(doc(db, 'users', subj.uid, 'data', 'diet'), clean(subj.diet)).catch(e => toast(errMsg(e)));

/* ============ início (aluno) ============ */
function readLegacy() { try { if (localStorage.getItem('aresLegacyDone')) return null; const x = JSON.parse(localStorage.getItem('aresGymDataV1')); return x && ((x.sessions && x.sessions.length) || (x.weights && x.weights.length)) ? x : null } catch { return null } }
function renderHome() {
  const days = subj.plan.days, tk = todayKey(), h = new Date().getHours(), g = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite', sug = suggestedDay(), first = String(me.name).split(' ')[0];
  $('heroEyebrow').textContent = g + ', ' + first;
  const btn = $('heroBtn'); btn.classList.remove('hidden');
  if (!days.length) { $('heroTitle').textContent = 'Aguardando seu treino.'; $('heroText').textContent = 'Seu professor ainda vai montar a sua ficha. Assim que ele publicar, ela aparece aqui.'; btn.classList.add('hidden') }
  else if (!sug) { $('heroTitle').textContent = 'Hoje é dia livre.'; $('heroText').textContent = 'Descanse ou escolha uma ficha para treinar mesmo assim.'; btn.textContent = 'Abrir meus treinos' }
  else if (subj.sessions.some(s => s.day === tk && s.name === sug.name)) { $('heroTitle').textContent = 'Treino de hoje concluído.'; $('heroText').textContent = 'Boa! Agora é recuperar: proteína, água e sono.'; btn.textContent = 'Ver treinos' }
  else { const prog = S().drafts[sug.id] && S().drafts[sug.id].startedAt; $('heroTitle').textContent = sug.name.split(' · ')[1] || sug.name; $('heroText').textContent = sug.exercises.length + ' exercícios planejados para hoje.' + (prog ? ' Você já começou — continue de onde parou.' : ''); btn.textContent = prog ? 'Continuar treino' : 'Iniciar treino' }
  const lg = readLegacy();
  $('legacyBox').innerHTML = lg ? `<div class="card stack banner"><p><b>Encontramos dados antigos neste aparelho</b> (${(lg.sessions || []).length} treinos). Quer trazer o histórico para a sua conta?</p><div class="footer-actions"><button class="btn small" data-act="importLegacy">Importar histórico</button><button class="btn small ghost" data-act="skipLegacy">Agora não</button></div></div>` : '';
  const mon = mondayOf(new Date()), days_ = sessionDays(), L = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  $('weekStrip').innerHTML = L.map((l, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); const k = keyOf(d); return `<div class="wd ${days_[k] ? 'on' : ''} ${k === tk ? 'today' : ''}">${l}<i></i></div>` }).join('');
  const ws = weekStats(); $('weekCount').textContent = ws.n + ' treino' + (ws.n === 1 ? '' : 's');
  $('statWeek').textContent = ws.n; $('statTotal').textContent = subj.sessions.length + ' no total'; $('statStreak').textContent = weekStreak(); $('statVol').textContent = fmt(ws.vol, 0);
  $('statProtein').textContent = fmt(foodTotal()) + ' g'; $('proteinSub').textContent = 'meta: ' + proteinGoal() + ' g';
  const last = subj.sessions[subj.sessions.length - 1];
  $('lastCard').innerHTML = last ? `<div class="row"><h3 class="section-title">Último treino</h3><button class="btn small ghost" data-act="viewSession" data-id="${esc(last.id)}">Ver</button></div><div><strong style="font-size:14.5px">${esc(last.name)}</strong><div class="muted" style="font-size:12px;margin-top:5px">${ago(last.date)} · ${fmt(last.volume || 0, 0)} kg de volume${last.duration ? ' · ' + Math.round(last.duration / 60) + ' min' : ''}</div></div>${(last.prs && last.prs.length) ? `<div class="pr">${last.prs.length} recorde${last.prs.length > 1 ? 's' : ''} de carga nesse treino</div>` : ''}` : `<h3 class="section-title">Último treino</h3><div class="empty">Conclua seu primeiro treino para ver o resumo aqui.</div>`;
}

/* ============ treinos ============ */
const curDay = () => subj.plan.days.find(d => d.id === sel) || null;
const findEx = eid => { const d = curDay(); return d && d.exercises.find(e => e.id === eid) };
const draftOf = () => S().drafts[sel] || (S().drafts[sel] = { startedAt: null, note: '', sets: {}, n: {}, notes: {} });
function nSets(e) { const d = S().drafts[sel]; return d && d.n && d.n[e.id] != null ? d.n[e.id] : (parseInt(e.sets) || 3) }
function setRow(eid, s) { const d = draftOf(), a = d.sets[eid] || (d.sets[eid] = []); while (a.length <= s) a.push({ kg: '', reps: '', done: false }); return a[s] }
const thumbHTML = ex => { const e = exFor(ex); return e ? demoHTML(e, 'sm') : '<span>Ver<br>demo</span>' };
function renderWorkouts() {
  const self = subj.self, edit = subj.canEdit, days = subj.plan.days; setSelDefault(); const day = curDay();
  $('wTitle').textContent = self ? 'Meus treinos' : 'Treinos do aluno'; $('wEyebrow').textContent = self ? 'Planejamento' : 'Ficha do aluno';
  $('wSub').textContent = self ? 'Marque cada série ao terminar — o descanso começa sozinho.' : 'Monte a ficha. O aluno vê as alterações na hora.';
  $('workoutPills').innerHTML = days.map(d => `<button class="pill ${d.id === sel ? 'active' : ''}" data-act="selDay" data-id="${d.id}">${esc(d.name)}</button>`).join('') + (edit ? `<button class="pill" data-act="newDay">＋ Novo dia</button>` : '');
  $('workoutHeading').textContent = day ? day.name : 'Treino';
  $('addExBtn').classList.toggle('hidden', !edit || !day); $('dayMenuBtn').classList.toggle('hidden', !edit || !day);
  $('wp').classList.toggle('hidden', !self || !day); $('wFooter').classList.toggle('hidden', !self || !day);
  if (!day) { $('exerciseList').innerHTML = `<div class="empty">${self ? 'Seu professor ainda não montou o seu treino.' : 'Nenhum dia de treino ainda. Toque em “＋ Novo dia” para começar.'}</div>`; return }
  const d = S().drafts[sel] || { sets: {}, notes: {} };
  $('sessNote').value = d.note || '';
  $('exerciseList').innerHTML = day.exercises.map((e, i) => {
    const lp = lastPerf(e.name), lastTxt = lp ? `${self ? 'Última vez' : 'Última carga do aluno'}: ${lp.en.setsData && lp.en.setsData.length ? lp.en.setsData.map(x => fmt(num(x.kg)) + '×' + x.reps).join(' · ') : fmt(num(lp.en.load)) + ' kg × ' + (lp.en.reps || '—')} (${ago(lp.date)})` : '';
    const head = `<div class="ex-head"><button class="thumb" data-act="demo" data-eid="${e.id}" aria-label="Ver demonstração">${thumbHTML(e)}</button><div class="ex-info"><h3>${i + 1}. ${esc(e.name)}</h3><p>${esc(e.sets)} séries · ${esc(e.reps)} reps</p>${e.note ? `<p class="obs">${esc(e.note)}</p>` : ''}${lastTxt ? `<p class="last">${esc(lastTxt)}</p>` : ''}</div>${edit ? `<button class="icon-btn" data-act="exMenu" data-eid="${e.id}" aria-label="Opções">${ic('more', 18)}</button>` : ''}</div>`;
    if (!self) return `<div class="exercise">${head}${((d.notes && d.notes[e.id]) ? '' : '')}</div>`;
    const rows = nSets(e), arr = d.sets[e.id] || []; let all = rows > 0, rh = '';
    for (let s = 0; s < rows; s++) {
      const r = arr[s] || {}, ls = lastSet(e.name, s); if (!r.done) all = false;
      rh += `<div class="setrow ${r.done ? 'on' : ''}"><span class="sn">${s + 1}</span><input class="setin" inputmode="decimal" data-eid="${e.id}" data-s="${s}" data-f="kg" value="${esc(r.kg || '')}" placeholder="${esc(ls ? ls.kg || '0' : '0')}" aria-label="Carga série ${s + 1}"><input class="setin" inputmode="numeric" data-eid="${e.id}" data-s="${s}" data-f="reps" value="${esc(r.reps || '')}" placeholder="${esc(ls ? ls.reps || '0' : '0')}" aria-label="Repetições série ${s + 1}"><label class="chk"><input type="checkbox" class="setchk" data-eid="${e.id}" data-s="${s}" ${r.done ? 'checked' : ''} aria-label="Série ${s + 1} concluída"><span></span></label></div>`;
    }
    const nv = (d.notes && d.notes[e.id]) || '';
    return `<div class="exercise ${all ? 'done' : ''}" data-eid="${e.id}">${head}<div class="sets"><div class="sethead"><span>#</span><span>CARGA (KG)</span><span>REPS</span><span>OK</span></div>${rh}<div class="set-actions"><button class="btn small ghost" data-act="addSet" data-eid="${e.id}">+ série</button>${rows > 1 ? `<button class="btn small ghost" data-act="rmSet" data-eid="${e.id}">− série</button>` : ''}</div></div><details class="note" ${nv ? 'open' : ''}><summary>Anotação deste exercício${nv ? ' ·' : ''}</summary><textarea class="wide-input" data-exnote="${e.id}" placeholder="Ex.: sentei o banco no 4, senti o ombro…">${esc(nv)}</textarea></details></div>`;
  }).join('') || `<div class="empty">${self ? 'Esta ficha ainda não tem exercícios.' : 'Nenhum exercício nesta ficha. Toque em “+ Exercício”.'}</div>`;
  updateWP();
}
function updateWP() {
  if (page !== 'workouts' || !subj || !subj.self) return; const day = curDay(); if (!day) return;
  const d = S().drafts[sel]; let tot = 0, done = 0;
  day.exercises.forEach(e => { const n = nSets(e); tot += n; if (d && d.sets[e.id]) d.sets[e.id].forEach((r, s) => { if (s < n && r.done) done++ }) });
  $('wpText').textContent = done + '/' + tot + ' séries'; $('wpBar').style.width = (tot ? done / tot * 100 : 0) + '%';
  const st = d && d.startedAt; if (st) { const sec = Math.floor((Date.now() - st) / 1000); $('wpTime').textContent = Math.floor(sec / 60) + ':' + pad(sec % 60) } else $('wpTime').textContent = 'ainda não iniciado';
}
setInterval(updateWP, 1000);
function touch() { const d = draftOf(); if (!d.startedAt) d.startedAt = Date.now(); wake() }
function finishWorkout() {
  const day = curDay(); if (!day) return; const d = S().drafts[sel]; const entries = []; let vol = 0, total = 0; const prs = [];
  day.exercises.forEach(e => {
    const rows = ((d && d.sets[e.id]) || []).filter(r => r.done || r.kg !== '' || r.reps !== ''), sd = rows.map(r => ({ kg: num(r.kg), reps: num(r.reps) }));
    let best = { kg: 0, reps: 0 }; sd.forEach(x => { if (x.kg > best.kg || (x.kg === best.kg && x.reps > best.reps)) best = x }); sd.forEach(x => { vol += x.kg * x.reps }); total += sd.length;
    if (best.kg > 0) { const prev = maxLoadBefore(e.name); if (prev > 0 && best.kg > prev) prs.push({ exercise: e.name, load: best.kg, prev }) }
    entries.push({ eid: e.id, exercise: e.name, load: best.kg || '', reps: best.reps || '', sets: String(sd.length || e.sets), done: sd.length > 0, setsData: sd, note: (d && d.notes && d.notes[e.id]) || '' });
  });
  if (!total) { alert('Marque ao menos uma série (ou preencha carga/repetições) antes de concluir.'); return }
  const dur = d && d.startedAt ? Math.round((Date.now() - d.startedAt) / 1000) : 0;
  const sess = { date: new Date().toISOString(), day: todayKey(), name: day.name, duration: dur, volume: Math.round(vol), prs, entries, note: (d && d.note) || '' };
  const ref = doc(collection(db, 'users', subj.uid, 'sessions')); setDoc(ref, clean(sess)).catch(e => toast('Não foi possível salvar na nuvem agora.'));
  subj.sessions.push({ ...sess, id: ref.id }); delete S().drafts[sel]; saveStateNow(); releaseWake(); dismissTimer(); renderWorkouts();
  openSheet(`<h2>Treino concluído</h2><div class="sum"><div><b>${dur ? Math.max(1, Math.round(dur / 60)) : '—'}</b><small>MINUTOS</small></div><div><b>${total}</b><small>SÉRIES</small></div><div><b>${fmt(vol, 0)}</b><small>KG DE VOLUME</small></div></div>${prs.length ? prs.map(p => `<div class="pr">Novo recorde: ${esc(p.exercise)} — ${fmt(p.load)} kg <span class="muted">(antes ${fmt(p.prev)} kg)</span></div>`).join('') : '<p class="muted" style="font-size:13px">Treino salvo no histórico. Seu professor consegue ver suas anotações.</p>'}<button class="btn block" data-act="closeSheet">Fechar</button>`);
}
function viewSession(id) {
  const s = subj.sessions.find(x => x.id === id); if (!s) return;
  openSheet(`<h2>${esc(s.name)}</h2><p class="muted" style="font-size:12px">${new Date(s.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}${s.duration ? ' · ' + Math.round(s.duration / 60) + ' min' : ''} · ${fmt(s.volume || 0, 0)} kg de volume</p>${(s.prs || []).map(p => `<div class="pr">Recorde: ${esc(p.exercise)} — ${fmt(p.load)} kg</div>`).join('')}${s.note ? `<div class="card"><div class="eyebrow">ANOTAÇÃO DO TREINO</div><p style="font-size:13.5px;line-height:1.6;margin-top:8px;white-space:pre-wrap">${esc(s.note)}</p></div>` : ''}<div class="stack">${s.entries.map(e => `<div class="meal-row"><div><strong>${e.done ? '✓' : '•'} ${esc(e.exercise)}</strong><small>${e.setsData && e.setsData.length ? e.setsData.map(x => fmt(x.kg) + ' kg × ' + x.reps).join(' · ') : (fmt(num(e.load)) + ' kg × ' + (e.reps || '—') + ' (' + e.sets + ' séries)')}${e.note ? '<br>“' + esc(e.note) + '”' : ''}</small></div></div>`).join('')}</div>${subj.self ? `<button class="btn danger block" data-act="delSession" data-id="${esc(s.id)}">Excluir este treino</button>` : ''}<button class="btn ghost block" data-act="closeSheet">Fechar</button>`);
}

/* ---- edição da ficha (professor/admin) ---- */
function exMenu(eid) {
  const d = curDay(), i = d.exercises.findIndex(e => e.id === eid), e = d.exercises[i], n = d.exercises.length;
  openSheet(`<h2>${esc(e.name)}</h2><button class="menu-btn" data-act="demo" data-eid="${eid}">Ver demonstração</button><button class="menu-btn" data-act="pickSwap" data-eid="${eid}">Trocar demonstração</button><button class="menu-btn" data-act="editEx" data-eid="${eid}">Editar nome, séries, repetições e observação</button>${i > 0 ? `<button class="menu-btn" data-act="moveEx" data-eid="${eid}" data-d="-1">Mover para cima</button>` : ''}${i < n - 1 ? `<button class="menu-btn" data-act="moveEx" data-eid="${eid}" data-d="1">Mover para baixo</button>` : ''}<button class="menu-btn" data-act="delEx" data-eid="${eid}" style="color:var(--mut)">Remover da ficha</button>`);
}
const exFields = (e = {}) => `<div class="field"><label>NOME</label><input id="eName" class="wide-input" value="${esc(e.name || '')}" placeholder="Ex.: Agachamento livre"></div><div class="two"><div class="field"><label>SÉRIES</label><input id="eSets" class="wide-input" inputmode="numeric" value="${esc(e.sets || '3')}"></div><div class="field"><label>REPETIÇÕES</label><input id="eReps" class="wide-input" value="${esc(e.reps || '8–12')}"></div></div><div class="field"><label>OBSERVAÇÃO PARA O ALUNO (OPCIONAL)</label><textarea id="eNote" class="wide-input" placeholder="Ex.: descer em 3 segundos, pausa embaixo">${esc(e.note || '')}</textarea></div>`;
function pickSheet(mode, eid) {
  pick = { mode, eid }; openSheet(`<h2>${mode === 'add' ? 'Adicionar da biblioteca' : 'Trocar demonstração'}</h2><p class="muted" style="font-size:12.5px">Busque em português ou inglês.</p><input id="pickQ" class="wide-input" type="search" value="${esc(mode === 'swap' ? findEx(eid).name : '')}" placeholder="Ex.: supino inclinado" autocomplete="off"><div id="pickRes" class="stack"></div>${mode === 'swap' ? `<button class="btn ghost block" data-act="unlink" data-eid="${esc(eid)}">Sem demonstração</button>` : ''}`); renderPick();
}
let pick = { mode: 'add', eid: null };
function renderPick() {
  const box = $('pickRes'); if (!box) return;
  if (X.state !== 'ok') { box.innerHTML = `<div class="empty">${X.state === 'error' ? 'Não foi possível carregar a biblioteca. Verifique a internet.' : 'Carregando biblioteca…'}</div>`; if (X.state !== 'loading') loadDB(renderPick); return }
  const q = $('pickQ').value.trim(), r = (q ? searchDB(q, false) : X.DB).slice(0, 20);
  box.innerHTML = r.map(e => `<div class="pick-row"><div class="pth">${demoHTML(e, 'sm')}</div><div><strong>${esc(exName(e))}</strong><small>${esc(e.primaryMuscles.map(mus).join(', '))} · ${esc(eqp(e.equipment))}</small></div><button class="btn small" data-act="usePick" data-id="${esc(e.id)}">${pick.mode === 'add' ? 'Adicionar' : 'Usar'}</button></div>`).join('') || '<div class="empty">Nenhum resultado. Tente outro termo.</div>';
}
function dayForm(title, val, act) { openSheet(`<h2>${title}</h2><div class="field"><label>NOME DO DIA</label><input id="dName" class="wide-input" value="${esc(val)}" placeholder="Ex.: Segunda · Peito e tríceps"></div><button class="btn block" data-act="${act}">Salvar</button>`); setTimeout(() => { const i = $('dName'); if (i) { i.focus(); i.select() } }, 60) }

/* ---- detalhe do exercício (biblioteca) ---- */
let trCache = {}; try { trCache = JSON.parse(localStorage.getItem('aresTr') || '{}') } catch { }
const favs = () => { try { return JSON.parse(localStorage.getItem('aresFavs') || '[]') } catch { return [] } };
const setFavs = a => { try { localStorage.setItem('aresFavs', JSON.stringify(a)) } catch { } };
async function autoTranslate(texts) {
  try {
    if (!('Translator' in self)) return null; const o = { sourceLanguage: 'en', targetLanguage: 'pt' };
    if ((await Translator.availability(o)) === 'unavailable') return null; const t = await Translator.create(o); const out = []; for (const s of texts) out.push(await t.translate(s)); return out;
  } catch { return null }
}
function instrHTML(e) {
  const pt = hasPT(e) ? exInstr(e) : trCache[e.id];
  if (pt) return `<h3>Como executar</h3><ol>${pt.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;
  if (!e.instructions.length) return '';
  return `<h3>Como executar</h3><ol>${e.instructions.map(t => `<li>${esc(t)}</li>`).join('')}</ol><button class="btn secondary block" data-act="translate" data-id="${esc(e.id)}">Traduzir para português</button><p class="notice">Este texto ainda está em inglês. O botão traduz neste aparelho.</p>`;
}
function detailSheet(id, eid) {
  const e = X.MAP[id]; if (!e) return; const fav = favs().includes(id);
  const tags = [LV[e.level], CAT[e.category], eqp(e.equipment), e.mechanic && (e.mechanic === 'compound' ? 'Composto' : 'Isolado'), e.force && FORCE[e.force]].filter(Boolean);
  openSheet(`${demoHTML(e)}<div class="row"><h2>${esc(exName(e))}</h2><button class="icon-btn" data-act="fav" data-id="${esc(id)}" aria-label="Favoritar">${fav ? '★' : '☆'}</button></div><div class="tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div><div class="kv"><b>Principal:</b> ${esc(e.primaryMuscles.map(mus).join(', ') || '—')}<br><b>Secundários:</b> ${esc(e.secondaryMuscles.map(mus).join(', ') || '—')}</div>${eid && subj && subj.canEdit ? `<button class="btn secondary block" data-act="pickSwap" data-eid="${esc(eid)}">Trocar demonstração</button>` : ''}<div id="instrBox" class="stack">${instrHTML(e)}</div><button class="btn ghost block" data-act="closeSheet">Fechar</button>`);
}

/* ============ biblioteca ============ */
const lib = { q: '', muscle: '', equip: '', level: '', favs: false, shown: 24 }; let libBuilt = false;
function enterLibrary() { if (X.state === 'idle' || X.state === 'error') loadDB(() => { buildLibUI(); renderLibResults(); paintLibStatus() }); buildLibUI(); paintLibStatus(); renderLibResults() }
function buildLibUI() {
  if (libBuilt || !X.DB.length) return; libBuilt = true;
  $('libChips').innerHTML = MUSCLE_CHIPS.map(([v, l]) => `<button class="chip ${v === lib.muscle ? 'active' : ''}" data-act="libMuscle" data-v="${v}">${l}</button>`).join('');
  const eqs = [...new Set(X.DB.map(e => e.equipment || 'other'))].sort((a, b) => eqp(a).localeCompare(eqp(b)));
  $('libEquip').innerHTML = '<option value="">Todos equipamentos</option>' + eqs.map(v => `<option value="${esc(v)}">${esc(eqp(v))}</option>`).join('');
  $('libLevel').innerHTML = '<option value="">Todos níveis</option>' + Object.keys(LV).map(v => `<option value="${v}">${LV[v]}</option>`).join('');
}
function libFiltered() {
  let a = X.DB;
  if (lib.muscle) { const ms = lib.muscle.split('|'); a = a.filter(e => e.primaryMuscles.some(m => ms.includes(m))) }
  if (lib.equip) a = a.filter(e => (e.equipment || 'other') === lib.equip); if (lib.level) a = a.filter(e => e.level === lib.level);
  if (lib.favs) { const f = favs(); a = a.filter(e => f.includes(e.id)) }
  if (lib.q.trim()) { const g = toGroups(lib.q); if (g.length) a = a.map(e => ({ e, s: scoreEx(e, g) })).filter(x => x.s.nm + x.s.hm === g.length).sort((x, y) => rank(y.e, y.s) - rank(x.e, x.s)).map(x => x.e) }
  return a;
}
function paintLibStatus() { const s = $('libStatus'); if (!s) return; s.innerHTML = X.state === 'loading' ? '<div class="empty">Carregando biblioteca de exercícios…</div>' : X.state === 'error' ? '<div class="empty">Não foi possível carregar a biblioteca (precisa de internet na primeira vez).<br><br><button class="btn small" data-act="retryDB">Tentar novamente</button></div>' : '' }
function renderLibResults() {
  if (X.state !== 'ok') { $('libGrid').innerHTML = ''; $('libCount').textContent = ''; $('libMore').classList.add('hidden'); return }
  const a = libFiltered(), show = a.slice(0, lib.shown), f = favs();
  $('libCount').textContent = a.length + ' exercício' + (a.length === 1 ? '' : 's');
  $('libGrid').innerHTML = show.map(e => `<button class="lib-card" data-act="openEx" data-id="${esc(e.id)}">${demoHTML(e)}${f.includes(e.id) ? '<span class="star">★</span>' : ''}<div><strong>${esc(exName(e))}</strong><small>${esc(e.primaryMuscles.map(mus).join(', '))} · ${esc(eqp(e.equipment))}</small></div></button>`).join('') || '<div class="empty" style="grid-column:1/-1">Nenhum exercício encontrado com esses filtros.</div>';
  $('libMore').classList.toggle('hidden', a.length <= lib.shown); $('libFav').classList.toggle('active', lib.favs); $('libFav').textContent = (lib.favs ? '★' : '☆') + ' Favoritos';
}

/* ============ evolução ============ */
function exerciseSeries(name) {
  const k = normalize(name), pts = [];
  subj.sessions.forEach(s => { const en = s.entries.find(e => normalize(e.exercise) === k); if (!en) return; const sd = en.setsData && en.setsData.length ? en.setsData : [{ kg: num(en.load), reps: num(en.reps) }]; const l = Math.max(...sd.map(x => num(x.kg))); if (l > 0) pts.push({ v: l, l: dayLabel(s.day), rm: sd.reduce((m, x) => Math.max(m, est1RM(num(x.kg), num(x.reps))), 0) }) });
  return pts;
}
function renderProgress() {
  const self = subj.self; $('pEyebrow').textContent = self ? 'Dados reais, evolução real' : 'Acompanhamento do aluno';
  const ws = weekStats(), totalVol = subj.sessions.reduce((s, x) => s + (x.volume || 0), 0);
  $('progStats').innerHTML = `<div class="stat"><div class="label">TREINOS</div><div class="value">${subj.sessions.length}</div><div class="sub">no total</div></div><div class="stat"><div class="label">SEQUÊNCIA</div><div class="value">${weekStreak()}</div><div class="sub">semanas seguidas</div></div><div class="stat"><div class="label">VOLUME TOTAL</div><div class="value">${fmt(totalVol / 1000, 1)}t</div><div class="sub">${fmt(ws.vol, 0)} kg nesta semana</div></div><div class="stat"><div class="label">RECORDES</div><div class="value">${subj.sessions.reduce((s, x) => s + (x.prs ? x.prs.length : 0), 0)}</div><div class="sub">de carga batidos</div></div>`;
  const days = sessionDays(), mon = mondayOf(new Date()); mon.setDate(mon.getDate() - 77); let h = '';
  for (let w = 0; w < 12; w++)for (let d = 0; d < 7; d++) { const dt = new Date(mon); dt.setDate(dt.getDate() + w * 7 + d); const k = keyOf(dt), c = days[k] || 0; h += `<i class="${c >= 2 ? 'l2' : c === 1 ? 'l1' : ''} ${dt > new Date() ? 'fut' : ''}" title="${k}"></i>` }
  $('heat').innerHTML = h;
  const names = [...new Set(subj.sessions.flatMap(s => s.entries.filter(e => num(e.load) > 0 || (e.setsData && e.setsData.some(x => num(x.kg) > 0))).map(e => e.exercise)))].sort((a, b) => a.localeCompare(b)), cur = $('exSel').value;
  $('exSel').innerHTML = names.length ? names.map(n => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('') : '<option value="">Nenhum exercício registrado</option>'; renderExChart();
  const w = S().weights.slice(-12); $('weightChart').innerHTML = lineChart(w.map(x => ({ v: Number(x.weight), l: dayLabel(x.date) })), 'peso corporal'); $('weightEmpty').classList.toggle('hidden', w.length > 0);
  $('bwRow').classList.toggle('hidden', !self); $('undoWeightWrap').classList.toggle('hidden', !self || !w.length); $('cSettings').classList.toggle('hidden', !self); $('cBackup').classList.toggle('hidden', !self);
  const notes = []; subj.sessions.slice().reverse().slice(0, 30).forEach(s => { if (s.note) notes.push({ d: s.date, t: s.name, x: s.note }); (s.entries || []).forEach(e => { if (e.note) notes.push({ d: s.date, t: e.exercise, x: e.note }) }) });
  $('notesList').innerHTML = notes.slice(0, 10).map(n => `<div class="meal-row"><div><strong>${esc(n.t)}</strong><small>${new Date(n.d).toLocaleDateString('pt-BR')} · ${esc(n.x)}</small></div></div>`).join('') || '<div class="empty">As anotações feitas nos treinos aparecem aqui.</div>';
  $('historyCount').textContent = subj.sessions.length + ' sessões';
  $('historyList').innerHTML = subj.sessions.slice().reverse().slice(0, 15).map(s => `<div class="meal-row"><div><strong>${esc(s.name)}${(s.prs && s.prs.length) ? ' · recorde' : ''}</strong><small>${new Date(s.date).toLocaleDateString('pt-BR')} · ${s.entries.filter(e => e.done).length}/${s.entries.length} exercícios${s.volume ? ' · ' + fmt(s.volume, 0) + ' kg' : ''}</small></div><button class="btn small ghost" data-act="viewSession" data-id="${esc(s.id)}">Ver</button></div>`).join('') || '<div class="empty">Os treinos concluídos aparecerão aqui.</div>';
  if (self) { $('setAuto').checked = !!S().settings.autoRest; $('setRest').innerHTML = [30, 45, 60, 90, 120, 150, 180, 240].map(s => `<option value="${s}" ${s === S().settings.rest ? 'selected' : ''}>${Math.floor(s / 60)}:${pad(s % 60)}</option>`).join('') }
}
function renderExChart() {
  const n = $('exSel').value, box = $('exChart'), info = $('exInfo'); if (!n) { box.innerHTML = '<div class="empty">Conclua treinos com carga registrada para ver a evolução.</div>'; info.textContent = ''; return }
  const pts = exerciseSeries(n).slice(-12); box.innerHTML = lineChart(pts, 'carga de ' + n); const best = Math.max(...pts.map(p => p.v)), rm = Math.max(...pts.map(p => p.rm));
  info.innerHTML = `Maior carga: <b style="color:var(--text)">${fmt(best)} kg</b> · 1RM estimado: <b style="color:var(--text)">${fmt(rm, 0)} kg</b> · ${pts.length} registro${pts.length === 1 ? '' : 's'}`;
}
async function importData(x) {
  const have = new Set(subj.sessions.map(s => s.date)), fresh = (x.sessions || []).filter(s => s && s.date && Array.isArray(s.entries) && !have.has(s.date));
  for (let i = 0; i < fresh.length; i += 400) { const b = writeBatch(db); fresh.slice(i, i + 400).forEach(s => { const r = doc(collection(db, 'users', subj.uid, 'sessions')), o = clean({ ...s }); delete o.id; b.set(r, o); subj.sessions.push({ ...o, id: r.id }) }); await b.commit() }
  subj.sessions.sort((a, b) => a.date.localeCompare(b.date)); const ws = S().weights;
  (x.weights || []).forEach(w => { if (w && w.date && Number(w.weight) && !ws.some(q => q.date === w.date)) ws.push({ date: w.date, weight: Number(w.weight) }) }); ws.sort((a, b) => a.date.localeCompare(b.date));
  saveStateNow(); return fresh.length;
}

/* ============ dieta ============ */
const mealsSorted = () => subj.diet.meals.slice().sort((a, b) => String(a.time || '99').localeCompare(String(b.time || '99')));
function renderDiet() {
  const self = subj.self, edit = subj.canEdit, D = subj.diet, tk = todayKey(), done = (S().mealsDone && S().mealsDone[tk]) || [];
  $('dTitle').textContent = self ? 'Minha dieta' : 'Dieta do aluno'; $('dEyebrow').textContent = self ? 'Combustível para treinar' : 'Plano alimentar';
  $('dSub').textContent = self ? 'Siga as refeições do seu professor e registre a proteína do dia.' : 'Monte as refeições e a meta. O aluno vê na hora.';
  let h = edit ? `<div class="footer-actions"><button class="btn small secondary" data-act="addMeal">+ Refeição</button><button class="btn small ghost" data-act="dietGoal">Meta e orientações</button></div>` : '';
  if (D.guidance || D.goal) h += `<div class="card stack"><div class="eyebrow">ORIENTAÇÕES DO PROFESSOR</div>${D.goal ? `<div style="font-size:15px;font-weight:700">Meta de proteína: ${fmt(D.goal, 0)} g por dia</div>` : ''}${D.guidance ? `<p style="font-size:13.5px;line-height:1.65;white-space:pre-wrap">${esc(D.guidance)}</p>` : ''}</div>`;
  h += mealsSorted().map(m => `<div class="card mealcard ${self && done.includes(m.id) ? 'done' : ''}"><div class="top"><div><div class="mtime">${esc(m.time || '')}</div><h3>${esc(m.name)}</h3></div>${edit ? `<div class="minirow"><button data-act="editMeal" data-id="${m.id}" aria-label="Editar">✎</button><button data-act="delMeal" data-id="${m.id}" aria-label="Remover">×</button></div>` : `<button class="btn small ${done.includes(m.id) ? 'secondary' : ''}" data-act="mealDone" data-id="${m.id}">${done.includes(m.id) ? 'Feita ✓' : 'Marcar feita'}</button>`}</div><ul>${(m.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>${m.note ? `<div class="note">${esc(m.note)}</div>` : ''}</div>`).join('');
  if (!D.meals.length) h += `<div class="empty">${self ? 'Seu professor ainda não montou a sua dieta.' : 'Nenhuma refeição cadastrada. Toque em “+ Refeição”.'}</div>`;
  if (!self) { const pr = (S().proteinLog && S().proteinLog[tk]) || 0; h += `<div class="card stack"><h3 class="section-title">Registro do aluno hoje</h3><div class="muted" style="font-size:13px;line-height:1.6">Proteína registrada: <b style="color:var(--text)">${fmt(pr)} g</b> de ${fmt(proteinGoal(), 0)} g · Refeições marcadas: <b style="color:var(--text)">${done.length}</b> de ${D.meals.length}</div></div>` }
  $('dietPlan').innerHTML = h; $('dietTracker').classList.toggle('hidden', !self); if (self) renderTracker();
}
function renderTracker() {
  const t = foodTotal(), g = proteinGoal(), st = S();
  $('proteinTotal').textContent = fmt(t) + ' g'; $('proteinGoalText').textContent = fmt(g, 0) + ' g'; $('proteinGoal').value = st.proteinGoal; $('proteinProgress').style.width = Math.min(100, t / g * 100) + '%'; $('goalRow').classList.toggle('hidden', !!subj.diet.goal);
  $('foodList').innerHTML = st.foods.map((f, i) => `<div class="meal-row"><div><strong>${esc(f.name)}</strong><small>${fmt(Number(f.protein))} g de proteína</small></div><button class="btn small ghost" data-act="rmFood" data-i="${i}" aria-label="Remover">×</button></div>`).join('') || '<div class="empty">Adicione alimentos para acompanhar sua proteína.</div>';
  $('recentChips').innerHTML = st.recentFoods.slice(0, 8).map((f, i) => `<button class="chip" data-act="recent" data-i="${i}">${esc(f.name)} · ${fmt(f.protein)}g</button>`).join(''); $('recentChips').classList.toggle('hidden', !st.recentFoods.length);
  const out = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = keyOf(d); out.push({ k, v: k === todayKey() ? t : (st.proteinLog[k] || 0) }) }
  const mx = Math.max(g, ...out.map(o => o.v)); $('proteinChart').innerHTML = out.map(o => `<div class="barwrap"><div class="barval">${o.v ? fmt(o.v, 0) : ''}</div><div class="bar" style="height:${Math.max(3, o.v / mx * 90)}px;${o.v >= g ? '' : 'opacity:.55'}"></div><div class="barlabel">${o.k.slice(8)}/${o.k.slice(5, 7)}</div></div>`).join('');
}
function mealSheet(id) {
  const m = id ? subj.diet.meals.find(x => x.id === id) : null;
  openSheet(`<h2>${m ? 'Editar refeição' : 'Nova refeição'}</h2><div class="two"><div class="field"><label>HORÁRIO</label><input id="mTime" class="wide-input" type="time" value="${esc(m ? m.time : '08:00')}"></div><div class="field"><label>NOME</label><input id="mName" class="wide-input" value="${esc(m ? m.name : '')}" placeholder="Ex.: Café da manhã"></div></div><div class="field"><label>ALIMENTOS (UM POR LINHA)</label><textarea id="mItems" class="wide-input" style="min-height:130px" placeholder="2 ovos mexidos&#10;1 fatia de pão integral&#10;1 banana">${esc(m ? (m.items || []).join('\n') : '')}</textarea></div><div class="field"><label>OBSERVAÇÃO (OPCIONAL)</label><input id="mNote" class="wide-input" value="${esc(m ? m.note || '' : '')}" placeholder="Ex.: pode trocar o pão por tapioca"></div><button class="btn block" data-act="saveMeal" data-id="${m ? m.id : ''}">Salvar refeição</button>`);
}

/* ============ professor / admin ============ */
const badge = u => u.active === false ? '<span class="badge off">Desativado</span>' : '<span class="badge">Ativo</span>';
let studentQ = '';
function renderStudents() {
  const adm = me.role === 'admin', list = usersCache.filter(u => u.role === 'aluno'), act = list.filter(u => u.active !== false).length;
  $('studentsBody').innerHTML = `<div><div class="eyebrow">${adm ? 'Visão geral' : 'Seus alunos'}</div><h2 class="page-title">Alunos</h2><p class="muted" style="font-size:13px">${adm ? 'Todos os alunos do sistema.' : 'Crie contas, monte treinos e dietas e acompanhe a evolução.'}</p></div>
  <div class="stats"><div class="stat"><div class="label">TOTAL</div><div class="value">${list.length}</div><div class="sub">alunos</div></div><div class="stat"><div class="label">ATIVOS</div><div class="value">${act}</div><div class="sub">${list.length - act} desativado${list.length - act === 1 ? '' : 's'}</div></div></div>
  <div class="row" style="gap:8px"><input id="studentQ" class="wide-input" type="search" placeholder="Buscar aluno…" value="${esc(studentQ)}" autocomplete="off">${adm ? '' : `<button class="btn" data-act="newUser" data-role="aluno" style="white-space:nowrap">+ Novo</button>`}</div><div class="stack" id="studentList"></div>`;
  paintStudents();
}
function paintStudents() {
  const q = normalize(studentQ), adm = me.role === 'admin';
  const list = usersCache.filter(u => u.role === 'aluno' && (!q || normalize(u.name + ' ' + loginOf(u.email)).includes(q)));
  $('studentList').innerHTML = list.map(u => { const p = adm ? usersCache.find(x => x.uid === u.professorId) : null; return `<button class="urow" data-act="openStudent" data-id="${u.uid}"><div class="avatar">${esc(initial(u.name))}</div><div class="uinfo"><strong>${esc(u.name)}</strong><small>${esc(loginOf(u.email))}${p ? ' · Prof. ' + esc(p.name) : ''}</small></div>${badge(u)}</button>` }).join('') || `<div class="empty">${usersCache.some(u => u.role === 'aluno') ? 'Nenhum aluno encontrado.' : (adm ? 'Ainda não há alunos cadastrados.' : 'Você ainda não tem alunos. Toque em “+ Novo” para criar o primeiro.')}</div>`;
}
function renderProfessors() {
  const list = usersCache.filter(u => u.role === 'professor'), act = list.filter(u => u.active !== false).length, total = usersCache.filter(u => u.role === 'aluno').length;
  $('professorsBody').innerHTML = `<div><div class="eyebrow">Controle geral</div><h2 class="page-title">Professores</h2><p class="muted" style="font-size:13px">Ative ou desative o acesso de cada professor.</p></div>
  <div class="stats"><div class="stat"><div class="label">PROFESSORES</div><div class="value">${list.length}</div><div class="sub">${act} ativo${act === 1 ? '' : 's'}</div></div><div class="stat"><div class="label">ALUNOS</div><div class="value">${total}</div><div class="sub">no sistema</div></div></div>
  <button class="btn" data-act="newUser" data-role="professor">+ Novo professor</button>
  <div class="stack">${list.map(u => { const n = usersCache.filter(s => s.professorId === u.uid).length; return `<button class="urow" data-act="profSheet" data-id="${u.uid}"><div class="avatar">${esc(initial(u.name))}</div><div class="uinfo"><strong>${esc(u.name)}</strong><small>${esc(loginOf(u.email))} · ${n} aluno${n === 1 ? '' : 's'}</small></div>${badge(u)}</button>` }).join('') || '<div class="empty">Nenhum professor ainda. Toque em “+ Novo professor”.</div>'}</div>`;
}
function newUserSheet(role) {
  openSheet(`<h2>${role === 'aluno' ? 'Novo aluno' : 'Novo professor'}</h2><form class="stack" data-form="createUser" data-role="${role}"><div class="field"><label>NOME</label><input id="cuName" class="wide-input" autocomplete="off" required></div><div class="field"><label>E-MAIL OU USUÁRIO</label><input id="cuLogin" class="wide-input" autocapitalize="none" autocorrect="off" autocomplete="off" required><span class="hint">Use e-mail se quiser que a pessoa possa recuperar a senha. Ou um usuário simples, como joao.silva.</span></div><div class="field"><label>SENHA PROVISÓRIA (MÍNIMO 6)</label><input id="cuPass" class="wide-input" autocomplete="off" required></div>${role === 'aluno' ? `<label class="switch"><span>Começar com treino modelo</span><input type="checkbox" id="cuTpl"></label>` : ''}<div class="auth-err" id="cuErr"></div><button class="btn block" id="cuBtn">Criar conta</button></form>`);
}
function profSheet(id) {
  const u = usersCache.find(x => x.uid === id); if (!u) return; const st = usersCache.filter(s => s.professorId === id);
  openSheet(`<div class="profile"><div class="avatar lg">${esc(initial(u.name))}</div><div><h2>${esc(u.name)}</h2><p>${esc(loginOf(u.email))}</p>${badge(u)}</div></div>
  <div class="field"><label>NOME</label><div class="row" style="gap:8px"><input id="rnName" class="wide-input" value="${esc(u.name)}"><button class="btn secondary small" data-act="renameUser" data-id="${id}">Salvar</button></div></div>
  <button class="btn ${u.active === false ? '' : 'secondary'} block" data-act="toggleUser" data-id="${id}">${u.active === false ? 'Reativar professor' : 'Desativar professor'}</button>
  ${String(u.email).endsWith(FAKE) ? '' : `<button class="btn ghost block" data-act="resetPw" data-id="${id}">Enviar link de nova senha</button>`}
  <h3>Alunos deste professor (${st.length})</h3><div class="stack">${st.map(s => `<button class="urow" data-act="openStudent" data-id="${s.uid}"><div class="avatar">${esc(initial(s.name))}</div><div class="uinfo"><strong>${esc(s.name)}</strong><small>${esc(loginOf(s.email))}</small></div>${badge(s)}</button>`).join('') || '<div class="empty">Sem alunos.</div>'}</div>
  <p class="notice">Desativar impede o login. Os dados são mantidos e você pode reativar quando quiser.</p>`);
}
function renderSDetail() {
  const u = subj.profile, ws = weekStats(), last = subj.sessions[subj.sessions.length - 1], tk = todayKey();
  $('sdetailBody').innerHTML = `<div class="card stack"><div class="profile"><div class="avatar lg">${esc(initial(u.name))}</div><div><h2>${esc(u.name)}</h2><p>${esc(loginOf(u.email))}</p>${badge(u)}</div></div></div>
  <div class="stats"><div class="stat"><div class="label">TREINOS</div><div class="value">${subj.sessions.length}</div><div class="sub">${ws.n} nesta semana</div></div><div class="stat"><div class="label">ÚLTIMO TREINO</div><div class="value" style="font-size:20px;margin-top:14px">${last ? ago(last.date) : '—'}</div><div class="sub">${last ? esc(last.name.split(' · ')[0]) : 'sem registros'}</div></div></div>
  <div class="card stack"><h3 class="section-title">Gerenciar aluno</h3><div class="field"><label>NOME</label><div class="row" style="gap:8px"><input id="rnName" class="wide-input" value="${esc(u.name)}"><button class="btn secondary small" data-act="renameUser" data-id="${subj.uid}">Salvar</button></div></div><button class="btn ${u.active === false ? '' : 'secondary'} block" data-act="toggleUser" data-id="${subj.uid}">${u.active === false ? 'Reativar aluno' : 'Desativar aluno'}</button><p class="notice">Desativado, o aluno não consegue entrar. Treinos e histórico são mantidos.</p></div>
  <div class="card stack"><h3 class="section-title">Treinos recentes</h3>${subj.sessions.slice().reverse().slice(0, 8).map(s => `<div class="meal-row"><div><strong>${esc(s.name)}</strong><small>${new Date(s.date).toLocaleDateString('pt-BR')}${s.volume ? ' · ' + fmt(s.volume, 0) + ' kg' : ''}${s.note ? ' · “' + esc(s.note.slice(0, 60)) + '”' : ''}</small></div><button class="btn small ghost" data-act="viewSession" data-id="${esc(s.id)}">Ver</button></div>`).join('') || '<div class="empty">O aluno ainda não registrou treinos.</div>'}</div>`;
}
async function setActive(id, val) {
  try { await updateDoc(doc(db, 'users', id), { active: val }) } catch (e) { toast(errMsg(e)); return }
  const u = usersCache.find(x => x.uid === id); if (u) u.active = val; if (subj && subj.uid === id) subj.profile.active = val;
  toast(val ? 'Conta reativada.' : 'Conta desativada.'); closeSheet(); go(page);
}

/* ============ conta ============ */
function renderAccount() {
  const dark = document.documentElement.dataset.theme !== 'light';
  $('accountBody').innerHTML = `<div><div class="eyebrow">Perfil</div><h2 class="page-title">Conta</h2></div>
  <div class="card"><div class="profile"><div class="avatar lg">${esc(initial(me.name))}</div><div><h2>${esc(me.name)}</h2><p>${esc(loginOf(me.email))}</p><span class="badge plain">${ROLE[me.role]}</span></div></div></div>
  <div class="card stack"><h3 class="section-title">Aparência</h3><div class="seg"><button class="${dark ? 'on' : ''}" data-act="theme" data-t="dark">Escuro</button><button class="${dark ? '' : 'on'}" data-act="theme" data-t="light">Claro</button></div></div>
  <div class="card stack"><h3 class="section-title">Alterar senha</h3><div class="field"><label>SENHA ATUAL</label><input id="pwCur" class="wide-input" type="password" autocomplete="current-password"></div><div class="field"><label>NOVA SENHA (MÍNIMO 6)</label><input id="pwNew" class="wide-input" type="password" autocomplete="new-password"></div><div class="auth-err" id="pwErr"></div><button class="btn secondary" data-act="changePw">Atualizar senha</button></div>
  <button class="btn ghost block" data-act="logout">Sair da conta</button>`;
}

/* ============ cronômetro de descanso ============ */
const T = { total: 90, remaining: 90, running: false, end: 0, iv: null, active: false }; let AC = null;
function ac() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume() } catch { } }
document.addEventListener('click', ac, { once: true });
function beep() { try { ac();[0, .22, .44].forEach((t, i) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = i === 2 ? 1175 : 880; const n = AC.currentTime + t; g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(.35, n + .02); g.gain.exponentialRampToValueAtTime(.0001, n + .18); o.connect(g); g.connect(AC.destination); o.start(n); o.stop(n + .2) }) } catch { } }
function startRest(sec) { T.total = sec; T.remaining = sec; T.active = true; runTimer() }
function runTimer() { clearInterval(T.iv); T.running = true; T.end = Date.now() + T.remaining * 1000; T.iv = setInterval(tick, 250); renderTimer() }
function tick() { T.remaining = Math.max(0, Math.ceil((T.end - Date.now()) / 1000)); if (T.remaining <= 0) { clearInterval(T.iv); T.running = false; beep(); try { navigator.vibrate && navigator.vibrate([250, 100, 250]) } catch { } toast('Descanso finalizado! Próxima série.'); setTimeout(() => { if (!T.running && T.remaining <= 0) { T.active = false; renderTimer() } }, 4000) } renderTimer() }
function toggleTimer() { if (T.running) { clearInterval(T.iv); T.running = false; renderTimer() } else { if (T.remaining <= 0) T.remaining = T.total; T.active = true; runTimer() } }
function resetTimer() { clearInterval(T.iv); T.running = false; T.remaining = T.total; renderTimer() }
function dismissTimer() { clearInterval(T.iv); T.running = false; T.active = false; T.remaining = T.total; renderTimer() }
const stopAllTimers = dismissTimer;
function addTime(s) { T.remaining = Math.max(1, T.remaining + s); T.total = Math.max(T.total, T.remaining); if (T.running) T.end = Date.now() + T.remaining * 1000; renderTimer() }
function renderTimer() {
  $('restBar').classList.toggle('hidden', !T.active); const pct = T.total ? 100 * (1 - T.remaining / T.total) : 0;
  $('rbTime').textContent = mmss(T.remaining); $('rbProg').style.width = pct + '%'; $('rbToggle').textContent = T.running ? 'Pausar' : 'Iniciar'; $('rbLabel').textContent = T.remaining <= 0 ? 'BORA!' : 'DESCANSO';
  const d = $('tsDisplay'); if (d) { d.textContent = mmss(T.remaining); $('tsProg').style.width = pct + '%'; $('tsToggle').textContent = T.running ? 'Pausar' : 'Iniciar'; document.querySelectorAll('.tpresets button').forEach(b => b.classList.toggle('active', +b.dataset.s === T.total)) }
}
function timerSheet() { openSheet(`<h2>Descanso</h2><div class="timer-number" id="tsDisplay">${mmss(T.remaining)}</div><div class="progress"><div id="tsProg"></div></div><div class="tpresets">${[30, 60, 90, 120, 180].map(s => `<button data-act="tPreset" data-s="${s}">${mmss(s)}</button>`).join('')}</div><div class="footer-actions" style="justify-content:center"><button class="btn" id="tsToggle" data-act="tToggle">Iniciar</button><button class="btn secondary" data-act="tReset">Zerar</button></div><button class="btn ghost block" data-act="closeSheet">Fechar</button>`); renderTimer() }
let wl = null;
async function wake() { try { if ('wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null }) } } catch { } }
function releaseWake() { try { wl && wl.release(); wl = null } catch { } }
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden') { saveStateNow(); return }
  if (subj && subj.self && Object.values(S().drafts).some(d => d && d.startedAt)) wake();
  if (me && auth && auth.currentUser) { try { const s = await getDoc(doc(db, 'users', me.uid)); if (s.exists() && s.data().active === false) authFail('Sua conta foi desativada.') } catch { } }
});

/* ============ ações (delegação de eventos) ============ */
const ACT = {
  go: d => { if (subj && !subj.self && ['students', 'professors', 'account', 'library'].includes(d.p)) { stopSubject(); subj = null } go(d.p) },
  closeSheet: () => closeSheet(), closeStudent: () => closeStudent(),
  authMode: d => renderAuth(d.m), logout: async () => { saveStateNow(); stopSubject(); try { await signOut(auth) } catch { } },
  theme: d => { setTheme(d.t); renderAccount() },
  changePw: async () => {
    const cur = $('pwCur').value, nw = $('pwNew').value, err = $('pwErr'); err.textContent = ''; if (nw.length < 6) { err.textContent = 'A nova senha precisa ter pelo menos 6 caracteres.'; return }
    try { await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, cur)); await updatePassword(auth.currentUser, nw); $('pwCur').value = ''; $('pwNew').value = ''; toast('Senha atualizada!') } catch (e) { err.textContent = errMsg(e) }
  },
  startToday: () => { const s = suggestedDay(); if (s && !subj.sessions.some(x => x.day === todayKey() && x.name === s.name)) sel = s.id; go('workouts') },
  selDay: d => { sel = d.id; renderWorkouts() },
  newDay: () => dayForm('Novo dia de treino', '', 'saveNewDay'),
  saveNewDay: () => { const n = $('dName').value.trim(); if (!n) return; const day = { id: uid(), name: n, exercises: [] }; subj.plan.days.push(day); sel = day.id; savePlan(); closeSheet(); renderWorkouts() },
  dayMenu: () => openSheet(`<h2>${esc(curDay().name)}</h2><button class="menu-btn" data-act="renameDay">Renomear este dia</button><button class="menu-btn" data-act="newDay">Novo dia de treino</button><button class="menu-btn" data-act="delDay" style="color:var(--mut)">Excluir este dia</button>`),
  renameDay: () => dayForm('Renomear dia', curDay().name, 'saveRename'),
  saveRename: () => { const n = $('dName').value.trim(); if (n) { curDay().name = n; savePlan() } closeSheet(); renderWorkouts() },
  delDay: () => { if (!confirm('Excluir "' + curDay().name + '" e todos os seus exercícios? O histórico do aluno é mantido.')) return; subj.plan.days = subj.plan.days.filter(d => d.id !== sel); sel = null; setSelDefault(); savePlan(); closeSheet(); renderWorkouts() },
  addExMenu: () => openSheet(`<h2>Novo exercício</h2><button class="menu-btn" data-act="pickAdd">Escolher na biblioteca (com demonstração)</button><p class="muted" style="font-size:12px">…ou crie manualmente:</p>${exFields()}<button class="btn block" data-act="createEx">Adicionar à ficha</button>`),
  pickAdd: () => pickSheet('add'), pickSwap: d => pickSheet('swap', d.eid),
  createEx: () => { const n = $('eName').value.trim(); if (!n) { alert('Digite o nome do exercício.'); return } curDay().exercises.push({ id: uid(), name: n, sets: String(parseInt($('eSets').value) || 3), reps: $('eReps').value.trim() || '8–12', note: $('eNote').value.trim(), lib: '' }); savePlan(); closeSheet(); renderWorkouts() },
  exMenu: d => exMenu(d.eid),
  editEx: d => { const e = findEx(d.eid); openSheet(`<h2>Editar exercício</h2>${exFields(e)}<button class="btn block" data-act="saveEx" data-eid="${d.eid}">Salvar</button>`) },
  saveEx: d => { const e = findEx(d.eid), n = $('eName').value.trim(); if (!n) { alert('Digite o nome.'); return } e.name = n; e.sets = String(parseInt($('eSets').value) || 3); e.reps = $('eReps').value.trim() || '8–12'; e.note = $('eNote').value.trim(); savePlan(); closeSheet(); renderWorkouts() },
  moveEx: d => { const a = curDay().exercises, i = a.findIndex(e => e.id === d.eid), j = i + +d.d; if (j < 0 || j >= a.length) return;[a[i], a[j]] = [a[j], a[i]]; savePlan(); closeSheet(); renderWorkouts() },
  delEx: d => { if (!confirm('Remover este exercício da ficha?')) return; const day = curDay(); day.exercises = day.exercises.filter(e => e.id !== d.eid); savePlan(); closeSheet(); renderWorkouts() },
  usePick: d => {
    const e = X.MAP[d.id]; if (!e) return;
    if (pick.mode === 'add') { curDay().exercises.push({ id: uid(), name: exName(e), sets: '3', reps: '8–12', note: '', lib: e.id }); toast('Adicionado — ajuste séries e reps em ⋯') }
    else { const x = findEx(pick.eid); if (x) x.lib = e.id; toast('Demonstração atualizada!') }
    savePlan(); closeSheet(); renderWorkouts();
  },
  unlink: d => { const x = findEx(d.eid); if (x) x.lib = 'none'; savePlan(); closeSheet(); renderWorkouts() },
  addSet: d => { const e = findEx(d.eid), dr = draftOf(); dr.n[e.id] = nSets(e) + 1; saveState(); renderWorkouts() },
  rmSet: d => { const e = findEx(d.eid), n = nSets(e); if (n <= 1) return; const dr = draftOf(); dr.n[e.id] = n - 1; if (dr.sets[e.id]) dr.sets[e.id].length = Math.min(dr.sets[e.id].length, n - 1); saveState(); renderWorkouts() },
  clearDraft: () => { if (!confirm('Limpar todos os campos deste treino?')) return; delete S().drafts[sel]; saveStateNow(); renderWorkouts() },
  finish: () => finishWorkout(),
  demo: d => { const e = findEx(d.eid), x = e && exFor(e); if (x) detailSheet(x.id, d.eid); else if (subj.canEdit) pickSheet('swap', d.eid); else toast(X.state === 'ok' ? 'Sem demonstração para este exercício.' : 'Carregando demonstrações…') },
  openEx: d => detailSheet(d.id), fav: (d, el) => { const f = favs(), i = f.indexOf(d.id); if (i >= 0) f.splice(i, 1); else f.push(d.id); setFavs(f); el.textContent = f.includes(d.id) ? '★' : '☆'; if (page === 'library') renderLibResults() },
  translate: async (d, el) => {
    const e = X.MAP[d.id]; el.disabled = true; el.textContent = 'Traduzindo…'; const out = await autoTranslate(e.instructions);
    if (out) { trCache[e.id] = out; try { localStorage.setItem('aresTr', JSON.stringify(trCache)) } catch { } $('instrBox').innerHTML = instrHTML(e) }
    else { window.open('https://translate.google.com/?sl=en&tl=pt&op=translate&text=' + encodeURIComponent(e.instructions.join('\n\n')), '_blank', 'noopener'); el.disabled = false; el.textContent = 'Traduzir para português' }
  },
  libMuscle: (d, el) => { lib.muscle = d.v; lib.shown = 24; document.querySelectorAll('#libChips .chip').forEach(c => c.classList.toggle('active', c === el)); renderLibResults() },
  libFav: () => { lib.favs = !lib.favs; lib.shown = 24; renderLibResults() }, libMore: () => { lib.shown += 24; renderLibResults() },
  retryDB: () => retryDB(() => { buildLibUI(); renderLibResults(); paintLibStatus(); rerender() }),
  viewSession: d => viewSession(d.id),
  delSession: d => { if (!confirm('Excluir este treino do histórico?')) return; deleteDoc(doc(db, 'users', subj.uid, 'sessions', d.id)).catch(e => toast(errMsg(e))); subj.sessions = subj.sessions.filter(s => s.id !== d.id); closeSheet(); rerender() },
  saveWeight: () => { const v = num($('bodyWeight').value); if (!v || v < 1 || v > 500) { alert('Digite um peso válido em kg.'); return } const k = todayKey(), ex = S().weights.find(w => w.date === k); if (ex) ex.weight = v; else S().weights.push({ date: k, weight: v }); S().weights.sort((a, b) => a.date.localeCompare(b.date)); saveStateNow(); $('bodyWeight').value = ''; renderProgress(); toast('Peso salvo!') },
  undoWeight: () => { S().weights.pop(); saveStateNow(); renderProgress() },
  export: () => { const x = { exportedAt: new Date().toISOString(), sessions: subj.sessions.map(s => { const o = { ...s }; delete o.id; return o }), weights: S().weights, proteinLog: S().proteinLog }; const url = URL.createObjectURL(new Blob([JSON.stringify(x, null, 2)], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = 'ares-gym-backup-' + todayKey() + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) },
  importLegacy: async () => { const x = readLegacy(); if (!x) return; try { const n = await importData(x); localStorage.setItem('aresLegacyDone', '1'); toast(n + ' treinos importados!'); renderHome() } catch (e) { toast(errMsg(e)) } },
  skipLegacy: () => { try { localStorage.setItem('aresLegacyDone', '1') } catch { } renderHome() },
  saveGoal: () => { const v = num($('proteinGoal').value); if (!v || v < 1 || v > 500) { alert('Informe uma meta válida.'); return } S().proteinGoal = Math.round(v); saveStateNow(); renderTracker(); toast('Meta atualizada!') },
  addFood: () => { const n = $('foodName').value.trim(), p = num($('foodProtein').value); if (!n || !$('foodProtein').value || p < 0 || p > 500) { alert('Preencha o alimento e uma quantidade válida de proteína.'); return } const st = S(); st.foods.push({ name: n, protein: p }); st.recentFoods = [{ name: n, protein: p }, ...st.recentFoods.filter(f => f.name.toLowerCase() !== n.toLowerCase())].slice(0, 12); st.proteinLog[todayKey()] = foodTotal(); saveStateNow(); $('foodName').value = ''; $('foodProtein').value = ''; renderTracker(); toast('Consumo registrado!') },
  recent: d => { const f = S().recentFoods[+d.i]; if (!f) return; $('foodName').value = f.name; $('foodProtein').value = f.protein; $('foodProtein').focus() },
  rmFood: d => { S().foods.splice(+d.i, 1); S().proteinLog[todayKey()] = foodTotal(); saveStateNow(); renderTracker() },
  resetFood: () => { if (!confirm('Zerar os registros de alimentação de hoje?')) return; S().foods = []; S().foodDate = todayKey(); S().proteinLog[todayKey()] = 0; saveStateNow(); renderTracker() },
  mealDone: d => { const tk = todayKey(), md = S().mealsDone || (S().mealsDone = {}), a = md[tk] || (md[tk] = []), i = a.indexOf(d.id); if (i >= 0) a.splice(i, 1); else a.push(d.id); saveStateNow(); renderDiet() },
  addMeal: () => mealSheet(''), editMeal: d => mealSheet(d.id),
  saveMeal: d => { const name = $('mName').value.trim(); if (!name) { alert('Digite o nome da refeição.'); return } const m = { id: d.id || uid(), time: $('mTime').value || '', name, items: $('mItems').value.split('\n').map(s => s.trim()).filter(Boolean), note: $('mNote').value.trim() }; const a = subj.diet.meals, i = a.findIndex(x => x.id === m.id); if (i >= 0) a[i] = m; else a.push(m); saveDiet(); closeSheet(); renderDiet() },
  delMeal: d => { if (!confirm('Remover esta refeição?')) return; subj.diet.meals = subj.diet.meals.filter(m => m.id !== d.id); saveDiet(); renderDiet() },
  dietGoal: () => openSheet(`<h2>Meta e orientações</h2><div class="field"><label>META DE PROTEÍNA (G POR DIA)</label><input id="gGoal" class="wide-input" type="number" inputmode="numeric" min="0" max="500" value="${subj.diet.goal || ''}" placeholder="Ex.: 140"></div><div class="field"><label>ORIENTAÇÕES GERAIS</label><textarea id="gText" class="wide-input" style="min-height:140px" placeholder="Água, horários, suplementos, o que evitar…">${esc(subj.diet.guidance || '')}</textarea></div><button class="btn block" data-act="saveGoalDiet">Salvar</button>`),
  saveGoalDiet: () => { subj.diet.goal = Math.max(0, Math.round(num($('gGoal').value))) || 0; subj.diet.guidance = $('gText').value.trim(); saveDiet(); closeSheet(); renderDiet() },
  newUser: d => newUserSheet(d.role), openStudent: d => { closeSheet(); openStudent(d.id) }, profSheet: d => profSheet(d.id),
  renameUser: async d => { const n = $('rnName').value.trim(); if (!n) return; try { await updateDoc(doc(db, 'users', d.id), { name: n }) } catch (e) { toast(errMsg(e)); return } const u = usersCache.find(x => x.uid === d.id); if (u) u.name = n; if (subj && subj.uid === d.id) subj.profile.name = n; toast('Nome atualizado.'); closeSheet(); go(page) },
  toggleUser: d => { const u = usersCache.find(x => x.uid === d.id); if (!u) return; const off = u.active !== false; if (!confirm(off ? `Desativar ${u.name}? A pessoa não conseguirá mais entrar.` : `Reativar ${u.name}?`)) return; setActive(d.id, !off) },
  resetPw: async d => { const u = usersCache.find(x => x.uid === d.id); try { await sendPasswordResetEmail(auth, u.email); toast('Link enviado para ' + u.email) } catch (e) { toast(errMsg(e)) } },
  openTimer: () => timerSheet(), tToggle: () => { ac(); toggleTimer() }, tReset: () => resetTimer(), tDismiss: () => dismissTimer(), tAdd: d => addTime(+d.s), tPreset: d => { ac(); T.total = +d.s; T.remaining = +d.s; T.active = true; runTimer() }
};
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; const f = ACT[el.dataset.act]; if (f) f(el.dataset, el) });
document.addEventListener('submit', e => { const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault(); const fn = FORM[f.dataset.form]; if (fn) fn(f) });
document.addEventListener('input', e => {
  const t = e.target;
  if (t.classList.contains('setin') && subj && subj.self) { const r = setRow(t.dataset.eid, +t.dataset.s); r[t.dataset.f] = t.value; touch(); saveState() }
  else if (t.dataset.exnote !== undefined && subj && subj.self) { draftOf().notes[t.dataset.exnote] = t.value; touch(); saveState() }
  else if (t.id === 'sessNote' && subj && subj.self) { draftOf().note = t.value; saveState() }
  else if (t.id === 'libQ') { lib.q = t.value; lib.shown = 24; renderLibResults() }
  else if (t.id === 'pickQ') renderPick()
  else if (t.id === 'studentQ') { studentQ = t.value; paintStudents() }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.classList.contains('setchk')) {
    const eid = t.dataset.eid, s = +t.dataset.s, r = setRow(eid, s), row = t.closest('.setrow'), ex = findEx(eid); r.done = t.checked;
    if (t.checked) {
      const ls = lastSet(ex.name, s), prev = s > 0 ? setRow(eid, s - 1) : null, kgIn = row.querySelector('[data-f="kg"]'), rpIn = row.querySelector('[data-f="reps"]');
      if (!r.kg) { const v = (ls && ls.kg) || (prev && prev.kg) || ''; if (v) { r.kg = v; kgIn.value = v } } if (!r.reps) { const v = (ls && ls.reps) || (prev && prev.reps) || ''; if (v) { r.reps = v; rpIn.value = v } }
    }
    row.classList.toggle('on', t.checked); const n = nSets(ex), a = draftOf().sets[eid] || []; t.closest('.exercise').classList.toggle('done', a.length >= n && a.slice(0, n).every(x => x.done));
    touch(); saveState(); updateWP(); if (t.checked && S().settings.autoRest) { ac(); startRest(S().settings.rest) }
  }
  else if (t.id === 'exSel') renderExChart();
  else if (t.id === 'libEquip') { lib.equip = t.value; lib.shown = 24; renderLibResults() } else if (t.id === 'libLevel') { lib.level = t.value; lib.shown = 24; renderLibResults() }
  else if (t.id === 'setAuto') { S().settings.autoRest = t.checked; saveStateNow() } else if (t.id === 'setRest') { S().settings.rest = +t.value; saveStateNow() }
  else if (t.id === 'importFile') {
    const file = t.files[0]; if (!file) return; const rd = new FileReader();
    rd.onload = async () => { try { const x = JSON.parse(rd.result); if (!Array.isArray(x.sessions)) throw Error(); const n = await importData(x); renderProgress(); toast(n + ' treinos importados!') } catch { alert('Não foi possível importar. Escolha um backup válido do ARES GYM.') } }; rd.readAsText(file); t.value = '';
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('sheet').classList.contains('hidden')) closeSheet() });

/* ============ início ============ */
if (!CONFIGURED) { renderAuth('login') }
else {
  onAuthStateChanged(auth, async user => {
    if (registering) return;
    if (!user) { me = null; stopSubject(); subj = null; dismissTimer(); closeSheet(); await checkAdminExists(); const m = authMsg; authMsg = ''; renderAuth('login', m); return }
    await boot(user);
  });
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));