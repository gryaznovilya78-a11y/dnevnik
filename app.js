/* Дневник — приложение для телефона: дела на день/неделю/месяц и зал.
   Все записи лежат только в этом телефоне (IndexedDB); раздел «Копия»
   сохраняет их в файл и восстанавливает из файла. */
(() => {
'use strict';

/* ================= утилиты ================= */
const $ = (s) => document.querySelector(s);
const SCOPES = ['day', 'week', 'month'];
const GYM_VIEWS = ['workout', 'program', 'progress', 'history'];
const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WD_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const DAYS = ['день', 'дня', 'дней'];
const CHECK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6l3.2 3.1L13 4.6" fill="none" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(cls, text, onClick) { const b = el('button', cls, text); b.type = 'button'; if (onClick) b.addEventListener('click', onClick); return b; }
function data(node, attrs) { for (const k in attrs) node.dataset[k] = attrs[k]; return node; }
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const pad = (n) => String(n).padStart(2, '0');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function plural(n, f) { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return f[2]; if (b > 1 && b < 5) return f[1]; if (b === 1) return f[0]; return f[2]; }

/* ---------- даты ---------- */
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function today() { return startOfDay(new Date()); }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function dayNum(d) { return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }
function mondayOf(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
function isoWeek(d) { const th = addDays(mondayOf(d), 3), y = th.getFullYear(); return { year: y, week: Math.floor((dayNum(th) - dayNum(new Date(y, 0, 1))) / 7) + 1 }; }
function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function weekKey(d) { const w = isoWeek(d); return w.year + '-W' + pad(w.week); }
function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
function keyFor(scope, d) { return scope === 'day' ? dayKey(d) : scope === 'week' ? weekKey(d) : monthKey(d); }
function parseDay(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function mondayFromWeekKey(k) { const p = k.split('-W').map(Number); return addDays(mondayOf(new Date(p[0], 0, 4)), (p[1] - 1) * 7); }
function parseMonth(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, 1); }
function dateOfKey(scope, k) { return scope === 'day' ? parseDay(k) : scope === 'week' ? mondayFromWeekKey(k) : parseMonth(k); }
function normalize(scope, d) { return scope === 'day' ? startOfDay(d) : scope === 'week' ? mondayOf(d) : new Date(d.getFullYear(), d.getMonth(), 1); }
function step(scope, d, n) {
  if (scope === 'day') return addDays(d, n);
  if (scope === 'week') return addDays(mondayOf(d), 7 * n);
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function bounds(scope, a) {
  if (scope === 'day') return [a, a];
  if (scope === 'week') { const m = mondayOf(a); return [m, addDays(m, 6)]; }
  return [new Date(a.getFullYear(), a.getMonth(), 1), new Date(a.getFullYear(), a.getMonth() + 1, 0)];
}
function rel(scope, d, t) {
  if (scope === 'day') return dayNum(d) - dayNum(t);
  if (scope === 'week') return Math.round((dayNum(mondayOf(d)) - dayNum(mondayOf(t))) / 7);
  return (d.getFullYear() * 12 + d.getMonth()) - (t.getFullYear() * 12 + t.getMonth());
}
function fmtRange(mon, short) {
  const sun = addDays(mon, 6), M = short ? MONTHS_SHORT : MONTHS_GEN;
  if (mon.getMonth() === sun.getMonth()) return mon.getDate() + '–' + sun.getDate() + ' ' + M[sun.getMonth()];
  return mon.getDate() + ' ' + M[mon.getMonth()] + ' – ' + sun.getDate() + ' ' + M[sun.getMonth()];
}
function leftText(n) { return n === 1 ? 'последний день' : 'осталось ' + n + ' ' + plural(n, DAYS); }
function shortDate(k) { const d = parseDay(k); return WD_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()]; }
function daysAgoText(ts) {
  const n = dayNum(today()) - dayNum(startOfDay(new Date(ts)));
  if (n <= 0) return 'сегодня';
  if (n === 1) return 'вчера';
  return n + ' ' + plural(n, DAYS) + ' назад';
}

/* ================= хранилище ================= */
const IDB_NAME = 'dnevnik', IDB_STORE = 'kv';
let idb = null, useLocal = false;
function idbOpen() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbGet(key) {
  idb = idb || await idbOpen();
  return new Promise((resolve, reject) => {
    const q = idb.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
async function idbSet(key, val) {
  idb = idb || await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
async function idbDel(key) {
  idb = idb || await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbPrefix(prefix) {
  idb = idb || await idbOpen();
  return new Promise((resolve, reject) => {
    const out = [];
    const q = idb.transaction(IDB_STORE).objectStore(IDB_STORE).openCursor(IDBKeyRange.bound(prefix, prefix + '￿'));
    q.onsuccess = () => { const c = q.result; if (c) { out.push([c.key, c.value]); c.continue(); } else resolve(out); };
    q.onerror = () => reject(q.error);
  });
}

/* Свои фото упражнений лежат отдельно от записей (ключи ph:<id>), чтобы каждое
   сохранение записей не перегонялось вместе с картинками. */
const photoCache = new Map();
async function loadPhotos() {
  try { (await idbPrefix('ph:')).forEach(([k, v]) => { if (typeof v === 'string') photoCache.set(k.slice(3), v); }); } catch (e) { /* без фото */ }
}
function fileToJpeg(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}
async function storePhoto(dataUrl, id) {
  const pid = id || newId();
  await idbSet('ph:' + pid, dataUrl);
  photoCache.set(pid, dataUrl);
  return pid;
}
function dropPhoto(id) { photoCache.delete(id); idbDel('ph:' + id).catch(() => {}); }

function emptyState() {
  return {
    version: 2,
    tasks: {}, notes: {},
    gym: { days: [], workouts: {}, active: null, custom: {}, overrides: {} },
    meta: { createdAt: Date.now(), lastBackup: 0 },
  };
}
function normDay(d) {
  return {
    id: String(d.id || newId()), name: String(d.name || 'Тренировка'), note: String(d.note || ''),
    exercises: Array.isArray(d.exercises) ? d.exercises.filter((e) => e && typeof e === 'object').map((e) => ({
      id: String(e.id || newId()), name: String(e.name || ''), sets: String(e.sets ?? ''), reps: String(e.reps ?? ''),
      weight: String(e.weight ?? ''), note: String(e.note || ''),
    })) : [],
  };
}
function validWorkout(w) { return w && typeof w === 'object' && typeof w.date === 'string' && Array.isArray(w.items); }
function normalizeState(v) {
  const s = emptyState();
  s.tasks = obj(v.tasks);
  s.notes = obj(v.notes);
  const g = obj(v.gym);
  s.gym.days = Array.isArray(g.days) ? g.days.filter((d) => d && typeof d === 'object').map(normDay) : [];
  s.gym.workouts = obj(g.workouts);
  s.gym.active = g.active && typeof g.active === 'object' && Array.isArray(g.active.items) ? g.active : null;
  const strs = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []);
  Object.keys(obj(g.custom)).forEach((id) => {
    const c = g.custom[id];
    if (c && typeof c.name === 'string' && c.name.trim()) s.gym.custom[id] = { id, name: c.name, group: String(c.group || 'Мои упражнения'), tips: strs(c.tips), photos: strs(c.photos), createdAt: Number(c.createdAt) || 0 };
  });
  Object.keys(obj(g.overrides)).forEach((id) => {
    const o = g.overrides[id];
    if (o && typeof o === 'object') s.gym.overrides[id] = { name: typeof o.name === 'string' ? o.name : '', tips: strs(o.tips), photos: strs(o.photos) };
  });
  s.meta = Object.assign(s.meta, obj(v.meta));
  return s;
}

let S = emptyState();
let saveTimer = null, saveChain = Promise.resolve(), persistAsked = false, saveFailed = false;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 200); }
function flush() {
  clearTimeout(saveTimer); saveTimer = null;
  const snapshot = JSON.parse(JSON.stringify(S));
  saveChain = saveChain.then(async () => {
    if (useLocal) localStorage.setItem('dnevnik.state', JSON.stringify(snapshot));
    else await idbSet('state', snapshot);
    saveFailed = false;
  }).catch(() => {
    if (!saveFailed) toast('Телефон не дал сохранить запись. Сохрани копию в разделе «Копия».');
    saveFailed = true;
  });
  askPersist();
  return saveChain;
}
function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
async function load() {
  try {
    const v = await idbGet('state');
    if (v) S = normalizeState(v);
  } catch (e) {
    useLocal = true;
    try { const t = localStorage.getItem('dnevnik.state'); if (t) S = normalizeState(JSON.parse(t)); } catch (e2) { /* пусто */ }
  }
  if (!useLocal) await loadPhotos();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) flush(); });
window.addEventListener('pagehide', () => { if (saveTimer) flush(); });

/* ================= состояние экрана ================= */
const ui = {
  tab: 'diary', scope: 'day', anchor: today(), todayKey: dayKey(today()),
  editing: null, gymView: 'workout', editDay: null, progressEx: null, progressMetric: 'w', openWorkout: null,
};
try {
  const s = JSON.parse(localStorage.getItem('dnevnik.ui') || '{}');
  if (['diary', 'gym', 'backup'].includes(s.tab)) ui.tab = s.tab;
  if (SCOPES.includes(s.scope)) ui.scope = s.scope;
  if (GYM_VIEWS.includes(s.gymView)) ui.gymView = s.gymView;
} catch (e) { /* нет памяти */ }
ui.anchor = normalize(ui.scope, today());
function rememberUi() {
  try { localStorage.setItem('dnevnik.ui', JSON.stringify({ tab: ui.tab, scope: ui.scope, gymView: ui.gymView })); } catch (e) { /* нет памяти */ }
}

/* ================= всплывашки и нижние листы ================= */
let toastTimer = null;
function hideToast() { $('#toast').hidden = true; clearTimeout(toastTimer); }
function toast(msg, undo) {
  const t = $('#toast');
  t.replaceChildren(el('span', null, msg));
  if (undo) t.append(btn('toast-undo', 'Вернуть', () => { hideToast(); undo(); }));
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undo ? 6500 : 4000);
}

let sheetOnClose = null;
function openSheet(title, build, closeLabel) {
  const ov = $('#overlay'), panel = $('#sheetPanel');
  panel.replaceChildren();
  if (title) panel.append(el('p', 'sheet-title', title));
  build(panel);
  panel.append(btn('sheet-btn cancel', closeLabel || 'Отмена', closeSheet));
  panel.scrollTop = 0;
  ov.hidden = false;
}
function closeSheet() {
  $('#overlay').hidden = true;
  const f = sheetOnClose; sheetOnClose = null;
  if (f) f();
}
$('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') closeSheet(); });
function sheetBtn(label, run, cls) { return btn('sheet-btn' + (cls ? ' ' + cls : ''), label, () => { closeSheet(); run(); }); }
function confirmSheet(title, okLabel, danger) {
  return new Promise((resolve) => {
    openSheet(title, (p) => {
      p.append(btn('sheet-btn ' + (danger ? 'danger' : 'ok'), okLabel, () => { resolve(true); closeSheet(); }));
    });
    sheetOnClose = () => resolve(false);
  });
}

/* ================= ДНЕВНИК ================= */
let tasks = [];
const curKey = () => keyFor(ui.scope, ui.anchor);

function validTask(t) { return t && typeof t.text === 'string' && SCOPES.includes(t.scope) && typeof t.period === 'string'; }
function rebuild() {
  tasks = Object.keys(S.tasks)
    .map((id) => Object.assign({ id }, S.tasks[id]))
    .filter(validTask)
    .map((t) => Object.assign(t, { done: !!t.done, important: !!t.important }));
}
function sortTasks(list) {
  return list.slice().sort((a, b) =>
    (a.done - b.done) || ((b.important ? 1 : 0) - (a.important ? 1 : 0)) || ((a.createdAt || 0) - (b.createdAt || 0)));
}

function setTask(id, value) {
  if (value) S.tasks[id] = value; else delete S.tasks[id];
  save(); rebuild(); renderDiary();
}
function addTask(text) {
  const now = Date.now();
  setTask(newId(), { text, scope: ui.scope, period: curKey(), done: false, important: false, createdAt: now, updatedAt: now, doneAt: null });
}
function patch(t, fields) {
  const cur = S.tasks[t.id];
  if (cur) setTask(t.id, Object.assign({}, cur, fields, { updatedAt: Date.now() }));
}
function whereText(scope, key) {
  const t = today();
  if (scope === 'day') {
    const d = parseDay(key), r = dayNum(d) - dayNum(t);
    if (r === 0) return 'на сегодня';
    if (r === 1) return 'на завтра';
    return 'на ' + d.getDate() + ' ' + MONTHS_GEN[d.getMonth()];
  }
  if (scope === 'week') {
    const mon = mondayFromWeekKey(key), r = rel('week', mon, t);
    if (r === 0) return 'на эту неделю';
    if (r === 1) return 'на следующую неделю';
    return 'на неделю ' + fmtRange(mon);
  }
  const d = parseMonth(key);
  return 'на ' + MONTHS_NOM[d.getMonth()] + (d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : '');
}
function shortLabel(scope, key) {
  const d = dateOfKey(scope, key);
  if (scope === 'day') return shortDate(key);
  if (scope === 'week') return fmtRange(d, true);
  return MONTHS_NOM[d.getMonth()];
}
function move(t, scope, key, quiet) {
  if (t.scope === scope && t.period === key) return;
  const prev = { scope: t.scope, period: t.period };
  patch(t, { scope, period: key });
  if (!quiet) toast('Перенесено ' + whereText(scope, key), () => patch(t, prev));
}
function remove(t) {
  const saved = S.tasks[t.id];
  if (!saved) return;
  setTask(t.id, null);
  toast('Дело удалено', () => setTask(t.id, Object.assign({}, saved, { updatedAt: Date.now() })));
}

function taskSheet(t) {
  openSheet(t.text, (p) => {
    const td = today(), base = dateOfKey(t.scope, t.period), cur = keyFor(t.scope, td);
    const nextKey = keyFor(t.scope, step(t.scope, base, 1));
    const nextLabel = t.scope === 'day'
      ? (nextKey === dayKey(addDays(td, 1)) ? 'На завтра' : 'На следующий день')
      : t.scope === 'week' ? 'На следующую неделю' : 'На следующий месяц';
    p.append(sheetBtn(nextLabel, () => move(t, t.scope, nextKey)));
    if (t.period !== cur) p.append(sheetBtn({ day: 'На сегодня', week: 'На эту неделю', month: 'На этот месяц' }[t.scope], () => move(t, t.scope, cur)));
    if (t.scope !== 'week') {
      const wd = t.scope === 'day' ? base : (monthKey(td) === t.period ? td : base);
      p.append(sheetBtn('В планы недели', () => move(t, 'week', weekKey(wd))));
    }
    if (t.scope !== 'month') p.append(sheetBtn('В планы месяца', () => move(t, 'month', monthKey(t.scope === 'week' ? addDays(base, 3) : base))));
    const row = el('div', 'sheet-date');
    const di = el('input');
    di.type = 'date'; di.id = 'sheetDate';
    di.value = t.scope === 'day' ? t.period : dayKey(td);
    di.setAttribute('aria-label', 'Дата, на которую перенести');
    row.append(di, btn(null, 'На дату', () => { if (/^\d{4}-\d{2}-\d{2}$/.test(di.value)) { closeSheet(); move(t, 'day', di.value); } }));
    p.append(row);
    p.append(sheetBtn(t.important ? 'Снять «важно»' : 'Отметить важным', () => patch(t, { important: !t.important })));
    p.append(sheetBtn('Изменить текст', () => {
      const span = document.querySelector('[data-id="' + CSS.escape(t.id) + '"] .text');
      if (span) startEdit(t, span);
    }));
    p.append(sheetBtn('Удалить', () => remove(t), 'danger'));
  });
}

function startEdit(t, span) {
  ui.editing = t.id;
  const input = el('input', 'edit');
  input.type = 'text'; input.maxLength = 500; input.value = t.text; input.id = 'edit-' + t.id;
  input.setAttribute('enterkeyhint', 'done');
  input.setAttribute('aria-label', 'Текст дела');
  let finished = false;
  const finish = (keep) => {
    if (finished) return; finished = true;
    ui.editing = null;
    const v = input.value.trim();
    if (keep && !v) remove(t);
    else if (keep && v !== t.text) patch(t, { text: v });
    else renderDiary();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
  span.replaceWith(input);
  input.focus();
}

function taskEl(t, ctx) {
  const li = el('li', 'task' + (t.done ? ' done' : '') + (t.important ? ' important' : ''));
  li.dataset.id = t.id;
  const mark = btn('mark', '!', () => patch(t, { important: !t.important }));
  mark.setAttribute('aria-label', 'Важное');
  mark.setAttribute('aria-pressed', String(t.important));
  const check = btn('check', null, () => patch(t, { done: !t.done, doneAt: t.done ? null : Date.now() }));
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', String(t.done));
  check.setAttribute('aria-label', t.text);
  check.innerHTML = CHECK_SVG;
  const body = el('div', 'tbody');
  const text = el('span', 'text', t.text);
  text.addEventListener('click', () => startEdit(t, text));
  body.append(text);
  if (ctx.from) body.append(el('span', 'from', ctx.from));
  const side = el('div', 'side');
  if (ctx.quick) side.append(btn('quickbtn', ctx.quick.label, ctx.quick.run));
  const more = btn('more', '⋯', () => taskSheet(t));
  more.setAttribute('aria-label', 'Действия с делом');
  side.append(more);
  li.append(mark, check, body, side);
  return li;
}

function blockHead(title, count, extra) {
  const h = el('div', 'block-h');
  const h3 = el('h3', null, title);
  if (count != null) { h3.append(' '); h3.append(el('span', 'count', String(count))); }
  h.append(h3);
  if (extra) h.append(extra);
  return h;
}

function periodText() {
  const t = today(), d = ui.anchor, r = rel(ui.scope, d, t);
  const yr = d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : '';
  if (ui.scope === 'day') {
    const names = { '-2': 'Позавчера', '-1': 'Вчера', '0': 'Сегодня', '1': 'Завтра', '2': 'Послезавтра' };
    const title = names[String(r)] || cap(WD_LONG[d.getDay()]);
    let sub = (names[String(r)] ? WD_SHORT[d.getDay()] + ', ' : '') + d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + yr;
    if (r > 2) sub += ' · через ' + r + ' ' + plural(r, DAYS);
    if (r < -2) sub += ' · ' + (-r) + ' ' + plural(-r, DAYS) + ' назад';
    const ph = r === 0 ? 'Что сделать сегодня?' : r === 1 ? 'Что сделать завтра?' : 'Что сделать ' + d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + '?';
    return { title, sub, ph };
  }
  if (ui.scope === 'week') {
    const names = { '-1': 'Прошлая неделя', '0': 'Эта неделя', '1': 'Следующая неделя' };
    const title = names[String(r)] || 'Неделя ' + isoWeek(d).week;
    let sub = fmtRange(d) + yr;
    if (r === 0) sub += ' · ' + leftText(7 - ((t.getDay() + 6) % 7));
    const ph = r === 0 ? 'Что сделать на этой неделе?' : r === 1 ? 'Что сделать на следующей неделе?' : 'Что сделать за неделю ' + fmtRange(d) + '?';
    return { title, sub, ph };
  }
  const title = cap(MONTHS_NOM[d.getMonth()]) + yr;
  const names = { '-1': 'прошлый месяц', '0': 'этот месяц', '1': 'следующий месяц' };
  let sub = names[String(r)] || String(d.getFullYear());
  if (r === 0) sub += ' · ' + leftText(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - t.getDate() + 1);
  return { title, sub, ph: 'Что сделать в ' + MONTHS_PREP[d.getMonth()] + '?' };
}

function renderTop() {
  const t = today();
  $('#todayLine').textContent = cap(WD_LONG[t.getDay()]) + ', ' + t.getDate() + ' ' + MONTHS_GEN[t.getMonth()];
}
function renderScopes() {
  const t = today();
  document.querySelectorAll('.scope').forEach((b) => {
    const s = b.dataset.scope, k = keyFor(s, t);
    b.setAttribute('aria-selected', String(s === ui.scope));
    const n = tasks.filter((x) => x.scope === s && x.period === k && !x.done).length;
    const badge = b.querySelector('.badge');
    badge.hidden = !n;
    badge.textContent = String(n);
  });
}
function renderPeriod() {
  const p = periodText();
  $('#pTitle').textContent = p.title;
  $('#pSub').textContent = p.sub;
  $('#addInput').placeholder = p.ph;
  const r = rel(ui.scope, ui.anchor, today());
  const chips = { day: [['Сегодня', 0], ['Завтра', 1]], week: [['Эта неделя', 0], ['Следующая', 1]], month: [['Этот месяц', 0], ['Следующий', 1]] }[ui.scope];
  $('#quick').replaceChildren(...chips.map(([label, n]) => {
    const c = btn('chip', label, () => goRel(n));
    c.setAttribute('aria-pressed', String(r === n));
    return c;
  }));
  const labels = { day: ['Предыдущий день', 'Следующий день'], week: ['Предыдущая неделя', 'Следующая неделя'], month: ['Предыдущий месяц', 'Следующий месяц'] }[ui.scope];
  $('#prevBtn').setAttribute('aria-label', labels[0]);
  $('#nextBtn').setAttribute('aria-label', labels[1]);
}
function renderProgress(items) {
  const box = $('#progress');
  const total = items.length, n = items.filter((t) => t.done).length;
  if (!total) { box.replaceChildren(); box.hidden = true; return; }
  box.hidden = false;
  let vis;
  if (total <= 20) {
    vis = el('div', 'cells');
    for (let i = 0; i < total; i++) vis.append(el('i', 'cell' + (i < n ? ' on' : '')));
  } else {
    vis = el('div', 'bar');
    const fill = el('i'); fill.style.width = Math.round(100 * n / total) + '%'; vis.append(fill);
  }
  vis.setAttribute('aria-hidden', 'true');
  box.replaceChildren(vis, el('span', 'ptext' + (n === total ? ' all' : ''), n === total ? 'Всё сделано: ' + n + ' из ' + total : 'Сделано ' + n + ' из ' + total));
}
function renderTails() {
  const box = $('#tails'), scope = ui.scope, cur = keyFor(scope, today());
  if (curKey() !== cur) { box.hidden = true; return; }
  const tails = tasks
    .filter((x) => x.scope === scope && !x.done && x.period < cur)
    .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : (a.createdAt || 0) - (b.createdAt || 0)));
  if (!tails.length) { box.hidden = true; box.replaceChildren(); return; }
  box.hidden = false;
  const title = { day: 'Не сделано в прошлые дни', week: 'Не сделано на прошлых неделях', month: 'Не сделано в прошлые месяцы' }[scope];
  const allLabel = { day: 'Всё на сегодня', week: 'Всё на неделю', month: 'Всё на месяц' }[scope];
  const quickLabel = { day: '→ сегодня', week: '→ неделя', month: '→ месяц' }[scope];
  const all = btn('quickbtn', allLabel, () => {
    tails.forEach((t) => move(t, scope, cur, true));
    toast('Перенесено ' + whereText(scope, cur) + ': ' + tails.length);
  });
  const ul = el('ul', 'tasks');
  tails.forEach((t) => ul.append(taskEl(t, { from: shortLabel(scope, t.period), quick: { label: quickLabel, run: () => move(t, scope, cur) } })));
  box.replaceChildren(blockHead(title, tails.length, all), ul);
}
function renderUpper() {
  const box = $('#upper');
  if (ui.scope === 'month') { box.hidden = true; box.replaceChildren(); return; }
  const up = ui.scope === 'day' ? 'week' : 'month';
  const upKey = up === 'week' ? weekKey(ui.anchor) : monthKey(addDays(ui.anchor, 3));
  const items = sortTasks(tasks.filter((t) => t.scope === up && t.period === upKey && !t.done));
  if (!items.length) { box.hidden = true; box.replaceChildren(); return; }
  box.hidden = false;
  let label;
  if (ui.scope === 'day') {
    const r = rel('day', ui.anchor, today());
    label = r === 0 ? '→ сегодня' : r === 1 ? '→ завтра' : '→ сюда';
  } else label = '→ неделя';
  const ul = el('ul', 'tasks');
  items.forEach((t) => ul.append(taskEl(t, { quick: { label, run: () => move(t, ui.scope, curKey()) } })));
  box.replaceChildren(blockHead(up === 'week' ? 'Из планов недели' : 'Из планов месяца', items.length), ul);
}
function weekDaysEl() {
  const tKey = dayKey(today()), box = el('div', 'days');
  for (let i = 0; i < 7; i++) {
    const date = addDays(ui.anchor, i), k = dayKey(date);
    const items = sortTasks(tasks.filter((t) => t.scope === 'day' && t.period === k));
    const open = items.filter((t) => !t.done);
    const row = btn('dayrow' + (k === tKey ? ' today' : '') + (i > 4 ? ' we' : ''), null, () => setScope('day', date));
    const name = el('span', 'dname');
    name.append(el('b', null, WD_SHORT[date.getDay()]), ' ', el('span', 'dnum', String(date.getDate())));
    const list = el('span', 'ditems');
    if (!items.length) { list.textContent = 'пусто'; list.classList.add('none'); }
    else if (!open.length) { list.textContent = 'всё сделано'; list.classList.add('ok'); }
    else list.textContent = open.map((t) => t.text).join(' · ');
    row.append(name, list, el('span', 'dcount', items.length ? (items.length - open.length) + '/' + items.length : ''));
    box.append(row);
  }
  return box;
}
function calendarEl() {
  const first = ui.anchor, y = first.getFullYear(), m = first.getMonth();
  const days = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7, tKey = dayKey(today());
  const grid = el('div', 'cal');
  ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].forEach((w, i) => grid.append(el('div', 'cal-h' + (i > 4 ? ' we' : ''), w)));
  for (let i = 0; i < lead; i++) grid.append(el('div'));
  const gymDays = new Set(finishedWorkouts().map((w) => w.date));
  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d), k = dayKey(date);
    const items = sortTasks(tasks.filter((t) => t.scope === 'day' && t.period === k));
    const cls = 'cal-d' + (k === tKey ? ' today' : '') + (k < tKey ? ' past' : '') + ((date.getDay() + 6) % 7 > 4 ? ' we' : '') + (gymDays.has(k) ? ' gym' : '');
    const b = btn(cls, null, () => setScope('day', date));
    b.append(el('span', 'num', String(d)));
    if (items.length) {
      const dots = el('span', 'dots');
      items.slice(0, 4).forEach((t) => dots.append(el('i', 'dot' + (t.done ? ' ok' : k < tKey ? ' miss' : ''))));
      if (items.length > 4) dots.append(el('span', 'more-n', '+' + (items.length - 4)));
      b.append(dots);
    }
    const doneN = items.filter((t) => t.done).length;
    b.setAttribute('aria-label', d + ' ' + MONTHS_GEN[m] + ': ' + (items.length ? 'сделано ' + doneN + ' из ' + items.length : 'дел нет') + (gymDays.has(k) ? ', была тренировка' : ''));
    grid.append(b);
  }
  return grid;
}
function renderExtra() {
  const box = $('#extra');
  if (ui.scope === 'day') { box.hidden = true; box.replaceChildren(); return; }
  box.hidden = false;
  if (ui.scope === 'week') box.replaceChildren(blockHead('По дням'), weekDaysEl());
  else box.replaceChildren(blockHead('Дни ' + MONTHS_GEN[ui.anchor.getMonth()]), calendarEl(),
    el('p', 'legend', 'Точки — дела: синяя запланировано, зелёная сделано, красная пропущено. Полоска в углу — была тренировка.'));
}
function renderNudge() {
  const box = $('#backupNudge');
  const has = Object.keys(S.tasks).length + Object.keys(S.gym.workouts).length > 0;
  const last = S.meta.lastBackup || 0;
  const days = last ? dayNum(today()) - dayNum(startOfDay(new Date(last))) : Infinity;
  const anchorTs = last || S.meta.createdAt || Date.now();
  const age = dayNum(today()) - dayNum(startOfDay(new Date(anchorTs)));
  if (!has || age < 7) { box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren(
    el('span', null, days === Infinity ? 'Копия записей ещё ни разу не сохранялась.' : 'Копия не сохранялась ' + days + ' ' + plural(days, DAYS) + '.'),
    btn('quickbtn', 'Сохранить', exportBackup));
}
function renderDiaryList() {
  if (ui.editing) return;
  const items = sortTasks(tasks.filter((t) => t.scope === ui.scope && t.period === curKey()));
  renderProgress(items);
  $('#list').replaceChildren(...items.map((t) => taskEl(t, {})));
  const empty = $('#empty');
  if (!items.length) {
    empty.hidden = false;
    empty.textContent = 'Пока пусто. Впиши дело в строку выше. «!» на полях отмечает важное, «⋯» переносит или удаляет.';
  } else empty.hidden = true;
  renderTails(); renderUpper(); renderExtra();
}
function rollover() {
  const k = dayKey(today());
  if (k === ui.todayKey) return;
  const r = rel(ui.scope, ui.anchor, parseDay(ui.todayKey));
  ui.todayKey = k;
  ui.anchor = normalize(ui.scope, step(ui.scope, today(), r));
}
function renderDiary() {
  rollover();
  renderTop(); renderScopes(); renderPeriod(); renderDiaryList(); bindNote(); renderNudge();
}
function setScope(scope, date) {
  let d = date;
  if (!d) {
    const t = today(), b = bounds(ui.scope, ui.anchor);
    d = t >= b[0] && t <= b[1] ? t : b[0];
  }
  ui.scope = scope;
  ui.anchor = normalize(scope, d);
  rememberUi();
  if (ui.tab !== 'diary') switchTab('diary');
  else renderDiary();
}
function go(n) { ui.anchor = normalize(ui.scope, step(ui.scope, ui.anchor, n)); renderDiary(); }
function goRel(n) { ui.anchor = normalize(ui.scope, step(ui.scope, today(), n)); renderDiary(); }

/* заметка к периоду */
let noteId = null, noteTimer = null, notePending = null;
const noteText = (id) => { const n = S.notes[id]; return n && typeof n.text === 'string' ? n.text : ''; };
function flushNote() {
  clearTimeout(noteTimer); noteTimer = null;
  const p = notePending; notePending = null;
  if (!p) return;
  const text = p.text.replace(/\s+$/, '');
  if (text.trim()) S.notes[p.id] = { scope: p.scope, period: p.period, text, updatedAt: Date.now() };
  else delete S.notes[p.id];
  save();
  $('#noteState').textContent = 'Сохранено';
}
function bindNote() {
  const ta = $('#noteInput');
  $('#noteLabel').textContent = { day: 'Заметка дня', week: 'Заметка недели', month: 'Заметка месяца' }[ui.scope];
  ta.placeholder = { day: 'Как прошёл день, что мешало, что не забыть…', week: 'Итоги недели, мысли на следующую…', month: 'Главное за месяц, что перенести дальше…' }[ui.scope];
  const id = ui.scope + '-' + curKey();
  if (id !== noteId) {
    flushNote();
    noteId = id;
    $('#noteState').textContent = '';
    ta.value = noteText(id);
    return;
  }
  if (document.activeElement !== ta && !notePending) ta.value = noteText(id);
}
$('#noteInput').addEventListener('input', () => {
  notePending = { id: noteId, scope: ui.scope, period: curKey(), text: $('#noteInput').value };
  $('#noteState').textContent = 'Сохраняю…';
  clearTimeout(noteTimer);
  noteTimer = setTimeout(flushNote, 600);
});
$('#noteInput').addEventListener('blur', flushNote);

document.querySelectorAll('.scope').forEach((b) => b.addEventListener('click', () => setScope(b.dataset.scope)));
$('#prevBtn').addEventListener('click', () => go(-1));
$('#nextBtn').addEventListener('click', () => go(1));
$('#addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#addInput'), v = input.value.trim().slice(0, 500);
  if (!v) return;
  input.value = '';
  addTask(v);
});

/* ================= ЗАЛ ================= */
const normName = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/ё/g, 'е');

/* Каталог = встроенные упражнения (exercises.js) + твои правки к ним (overrides)
   + твои собственные упражнения (custom). Упражнение узнаётся по названию,
   по прежнему названию или по словам, которыми его называют (also). */
const CAT = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
const MY_GROUP = 'Мои упражнения';
const CAT_GROUPS = (Array.isArray(window.EXERCISE_GROUPS) ? window.EXERCISE_GROUPS : []).concat([MY_GROUP]);
let ALL = [], allIndex = new Map();
function rebuildCatalog() {
  const ov = S.gym.overrides || {}, cu = S.gym.custom || {};
  ALL = CAT.map((e) => {
    const o = ov[e.id] || {};
    return {
      key: e.id, kind: 'cat', name: (o.name && o.name.trim()) || e.name, origName: e.name, group: e.group,
      tips: o.tips && o.tips.length ? o.tips : e.tips, photos: o.photos || [], img: e.img, also: e.also || [],
    };
  });
  Object.keys(cu).forEach((id) => {
    const c = cu[id];
    ALL.push({ key: id, kind: 'custom', name: c.name, origName: '', group: CAT_GROUPS.includes(c.group) ? c.group : MY_GROUP, tips: c.tips || [], photos: c.photos || [], img: null, also: [] });
  });
  allIndex = new Map();
  ALL.forEach((e) => allIndex.set(normName(e.name), e));
  ALL.forEach((e) => [e.origName].concat(e.also).forEach((a) => { if (a && !allIndex.has(normName(a))) allIndex.set(normName(a), e); }));
}
const findEx = (name) => allIndex.get(normName(name)) || null;
function exImgs(e) {
  if (!e) return [];
  const own = e.photos.map((id) => photoCache.get(id)).filter(Boolean);
  if (own.length) return own;
  return e.img ? ['ex/' + e.img[0] + '-1.' + e.img[1], 'ex/' + e.img[0] + '-2.' + e.img[1]] : [];
}
const usesCatalogArt = (e) => e && e.kind === 'cat' && e.img && !e.photos.some((id) => photoCache.has(id));
function thumbEl(name) {
  const src = exImgs(findEx(name))[0];
  if (!src) return null;
  const im = el('img', 'thumb');
  im.src = src; im.alt = ''; im.loading = 'lazy';
  return im;
}
/* новое название упражнения расходится везде: программа, текущая и прошлые тренировки */
function renameEverywhere(oldName, newName) {
  const n = normName(oldName);
  if (!n || n === normName(newName)) return;
  S.gym.days.forEach((d) => d.exercises.forEach((e) => { if (normName(e.name) === n) e.name = newName; }));
  if (S.gym.active) S.gym.active.items.forEach((it) => { if (normName(it.name) === n) it.name = newName; });
  Object.keys(S.gym.workouts).forEach((id) => (S.gym.workouts[id].items || []).forEach((it) => { if (normName(it.name) === n) it.name = newName; }));
}

function exerciseSheet(name, note, back) {
  const e = findEx(name);
  openSheet(null, (p) => {
    if (back) p.append(btn('quickbtn back', '‹ Каталог', back));
    p.append(el('h3', 'sheet-h', e ? e.name : name));
    if (e && normName(e.name) !== normName(name)) p.append(el('p', 'muted', 'У тебя записано: «' + name + '»'));
    if (e) {
      const imgs = exImgs(e);
      if (imgs.length) {
        const pics = el('div', 'placard' + (imgs.length === 1 ? ' one' : ''));
        imgs.forEach((src, i) => { const im = el('img'); im.src = src; im.alt = e.name + ', картинка ' + (i + 1); pics.append(im); });
        p.append(pics);
      } else {
        p.append(el('p', 'nophoto', 'Рисунка пока нет. Нажми «Изменить» ниже и добавь своё фото с камеры или из галереи.'));
      }
      p.append(el('span', 'lbl', e.group));
      if (e.tips.length) { const ul = el('ul', 'tips'); e.tips.forEach((t) => ul.append(el('li', null, t))); p.append(ul); }
    } else {
      p.append(el('p', 'muted', 'Этого упражнения нет в каталоге, поэтому нет и фото. Найди такое же в каталоге или создай своё: с названием, фото и подсказками.'));
    }
    if (note && note.trim()) p.append(el('span', 'lbl', 'Твой комментарий'), el('p', 'note-text', note));
    if (e) {
      p.append(btn('sheet-btn', 'Изменить: название, фото, техника', () => editExerciseSheet(e, '', (nn) => exerciseSheet(nn, note, back))));
      if (usesCatalogArt(e)) p.append(el('p', 'credit', 'Рисунки: Everkinetic, CC BY-SA 4.0'));
    } else {
      p.append(btn('sheet-btn ok', 'Найти в каталоге', () => linkToCatalog(name, note)));
      p.append(btn('sheet-btn', 'Создать своё упражнение с фото', () => editExerciseSheet(null, name, (nn) => exerciseSheet(nn, note))));
    }
  }, 'Закрыть');
}
/* упражнение записано своими словами: выбираешь его в каталоге, и оно везде переименовывается */
function linkToCatalog(name, note) {
  pickExercise((chosen) => {
    renameEverywhere(name, chosen);
    save(); renderAll();
    toast('Теперь это «' + chosen + '» везде: в программе и в истории');
    exerciseSheet(chosen, note);
  }, false, true);
}

/* создать своё упражнение или изменить любое: название, группа, фото, подсказки */
function editExerciseSheet(entry, presetName, after) {
  const isCat = !!entry && entry.kind === 'cat';
  const startPhotos = entry ? entry.photos.filter((id) => photoCache.has(id)) : [];
  const draft = startPhotos.slice();
  const added = [];
  let saved = false;
  openSheet(null, (p) => {
    p.append(el('h3', 'sheet-h', entry ? 'Изменить упражнение' : 'Своё упражнение'));
    const nl = el('label', 'lbl', 'Название'); nl.htmlFor = 'exEdName';
    const name = el('input', 'field');
    name.type = 'text'; name.id = 'exEdName'; name.maxLength = 80; name.value = entry ? entry.name : (presetName || '');
    name.placeholder = 'Например, пуловер в тренажёре';
    const gl = el('label', 'lbl', 'Группа мышц'); gl.htmlFor = 'exEdGroup';
    const group = el('select', 'field'); group.id = 'exEdGroup';
    CAT_GROUPS.forEach((g) => { const o = el('option', null, g); o.value = g; group.append(o); });
    group.value = entry ? entry.group : MY_GROUP;
    group.disabled = isCat;
    p.append(nl, name, gl, group, el('span', 'lbl', 'Фото'));
    const pics = el('div', 'photo-grid');
    const drawPics = () => {
      pics.replaceChildren();
      draft.forEach((id) => {
        const cell = el('div', 'photo-cell');
        const im = el('img'); im.src = photoCache.get(id); im.alt = 'Твоё фото';
        const rm = btn('photo-rm', '✕', () => { draft.splice(draft.indexOf(id), 1); drawPics(); });
        rm.setAttribute('aria-label', 'Убрать это фото');
        cell.append(im, rm);
        pics.append(cell);
      });
      if (!draft.length) pics.append(el('p', 'muted', isCat && entry.img ? 'Сейчас показываются рисунки из каталога. Добавишь своё фото — будет показано оно.' : 'Фото пока нет.'));
    };
    drawPics();
    const fileLbl = el('label', 'ghost filebtn', 'Добавить фото: камера или галерея');
    const file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.multiple = true; file.id = 'exEdPhoto';
    file.addEventListener('change', async () => {
      const files = Array.from(file.files || []);
      file.value = '';
      for (const f of files) {
        try { const id = await storePhoto(await fileToJpeg(f, 1000)); added.push(id); draft.push(id); }
        catch (err) { toast('Не получилось добавить фото. Попробуй другое.'); }
      }
      drawPics();
    });
    fileLbl.append(file);
    const tl = el('label', 'lbl', 'Техника: каждая подсказка с новой строки'); tl.htmlFor = 'exEdTips';
    const tips = el('textarea', 'field'); tips.id = 'exEdTips'; tips.rows = 4;
    tips.value = entry ? entry.tips.join('\n') : '';
    tips.placeholder = 'Спина прямая\nЛокти вдоль корпуса';
    p.append(pics, fileLbl, tl, tips);
    p.append(btn('sheet-btn ok', 'Сохранить', () => {
      const nm = name.value.trim().replace(/\s+/g, ' ');
      if (!nm) { toast('Впиши название'); name.focus(); return; }
      const clash = findEx(nm);
      if (clash && (!entry || clash.key !== entry.key)) { toast('«' + clash.name + '» уже есть в каталоге, выбери другое название'); return; }
      const tipList = tips.value.split('\n').map((t) => t.trim()).filter(Boolean);
      const oldName = entry ? entry.name : presetName;
      if (isCat) {
        const base = CAT.find((c) => c.id === entry.key);
        S.gym.overrides[entry.key] = { name: nm === base.name ? '' : nm, tips: tipList.join('\n') === base.tips.join('\n') ? [] : tipList, photos: draft.slice() };
      } else if (entry) {
        Object.assign(S.gym.custom[entry.key], { name: nm, group: group.value, tips: tipList, photos: draft.slice() });
      } else {
        const id = 'my' + newId();
        S.gym.custom[id] = { id, name: nm, group: group.value, tips: tipList, photos: draft.slice(), createdAt: Date.now() };
      }
      startPhotos.filter((id) => !draft.includes(id)).forEach(dropPhoto);
      if (oldName) renameEverywhere(oldName, nm);
      saved = true;
      rebuildCatalog(); save();
      closeSheet(); renderAll();
      toast('Сохранено');
      if (after) after(nm);
    }));
    if (entry && !isCat) {
      p.append(btn('sheet-btn danger', 'Удалить из каталога', () => {
        const c = S.gym.custom[entry.key];
        delete S.gym.custom[entry.key];
        saved = true;
        rebuildCatalog(); save(); closeSheet(); renderAll();
        toast('«' + c.name + '» убрано из каталога', () => { S.gym.custom[entry.key] = c; rebuildCatalog(); save(); renderAll(); });
      }));
    }
    if (isCat && S.gym.overrides[entry.key]) {
      p.append(btn('sheet-btn', 'Вернуть как было в каталоге', () => {
        const o = S.gym.overrides[entry.key], base = CAT.find((c) => c.id === entry.key);
        delete S.gym.overrides[entry.key];
        (o.photos || []).forEach(dropPhoto);
        if (o.name) renameEverywhere(o.name, base.name);
        saved = true;
        rebuildCatalog(); save(); closeSheet(); renderAll();
        toast('Вернул как было в каталоге');
        if (after) after(base.name);
      }));
    }
  });
  sheetOnClose = () => { if (!saved) added.forEach(dropPhoto); };
}

/* выбор упражнения из каталога; browse — просто посмотреть; link — привязать своё название */
function pickExercise(onPick, browse, link) {
  openSheet(browse ? 'Каталог упражнений' : link ? 'Какое это упражнение?' : 'Выбери упражнение', (p) => {
    const search = el('input', 'field');
    search.type = 'search'; search.id = 'catSearch'; search.placeholder = 'Поиск: жим, тяга, присед…';
    search.setAttribute('aria-label', 'Поиск упражнения');
    const list = el('div', 'catlist');
    const reopen = () => pickExercise(onPick, browse, link);
    const own = btn('ghost', '+ Своё упражнение с фото', () => editExerciseSheet(null, search.value.trim(), (nn) => { if (browse) reopen(); else onPick(nn); }));
    const draw = () => {
      const q = normName(search.value);
      list.replaceChildren();
      CAT_GROUPS.forEach((g) => {
        const items = ALL.filter((e) => e.group === g && (!q || normName(e.name).includes(q) || normName(e.origName).includes(q) || e.also.some((a) => normName(a).includes(q))));
        if (!items.length) return;
        list.append(el('span', 'lbl', g));
        items.forEach((e) => {
          const b = btn('catrow', null, () => { if (browse) exerciseSheet(e.name, '', reopen); else { closeSheet(); onPick(e.name); } });
          const src = exImgs(e)[0];
          if (src) { const im = el('img'); im.src = src; im.alt = ''; im.loading = 'lazy'; b.append(im); }
          else b.append(el('span', 'nopic', 'нет фото'));
          b.append(el('span', null, e.name));
          list.append(b);
        });
      });
      if (!browse && !link && search.value.trim()) {
        list.append(btn('sheet-btn', 'Своё название без фото: «' + search.value.trim() + '»', () => { closeSheet(); onPick(search.value.trim()); }));
      }
      if (!list.children.length) list.append(el('p', 'muted', 'Ничего не нашлось. Попробуй другое слово или создай своё упражнение.'));
    };
    search.addEventListener('input', draw);
    p.append(search, own, list);
    draw();
  }, browse ? 'Закрыть' : 'Отмена');
}

/* Поправка дней «Спина», которые пришли из файла 17.10: Илья уточнил упражнения.
   Меняется только то, что осталось ровно как было в файле. */
const IMPORT_FIXES = [
  ['Сгибание рук в тренажёре Скотта', 'тяга снизу вверх', 'Пуловер в тренажёре', 'Сидя, локти на подушках, руки держат рукоять сверху, тянешь вниз до живота.'],
  ['Тяга штанги в наклоне', '5/15/20', 'Тяга верхнего блока стоя', 'Стоя у блока со сменными рукоятками, чуть наклонившись, тянешь вниз к груди. Записано «5/15/20»: понял как 5 подходов по 15 повторов, 20 кг.'],
  ['Тяга в тренажёре', 'Какой это тренажёр', 'Тяга к поясу в тренажёре сидя', 'Сидя, двумя руками за рукояти, тянешь к себе.'],
];
function fixImported() {
  let n = 0;
  S.gym.days.forEach((d) => d.exercises.forEach((e) => IMPORT_FIXES.forEach(([from, mark, to, note]) => {
    if (e.name === from && String(e.note || '').includes(mark)) { e.name = to; e.note = note; n++; }
  })));
  if (n) save();
}
const num = (v) => { const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : NaN; };
const fmtKg = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
const e1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30));
const setStr = (s) => (s.w > 0 ? fmtKg(s.w) + '×' : '') + s.r;
const tonnage = (items) => items.reduce((sum, it) => sum + it.sets.reduce((a, s) => a + (s.w || 0) * s.r, 0), 0);
const fmtInt = (x) => Math.round(x).toLocaleString('ru-RU');
const TICK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function finishedWorkouts() {
  return Object.keys(S.gym.workouts)
    .map((id) => Object.assign({ id }, S.gym.workouts[id]))
    .filter((w) => w && typeof w.date === 'string' && Array.isArray(w.items))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.finishedAt || 0) - (a.finishedAt || 0)));
}
function lastSetsFor(name, excludeId) {
  const n = normName(name);
  for (const w of finishedWorkouts()) {
    if (w.id === excludeId) continue;
    const it = w.items.find((i) => normName(i.name) === n);
    if (it && it.sets && it.sets.length) return { date: w.date, sets: it.sets };
  }
  return null;
}
function knownExerciseNames() {
  const seen = new Map();
  ALL.forEach((e) => seen.set(normName(e.name), e.name));
  S.gym.days.forEach((d) => d.exercises.forEach((e) => { if (e.name.trim() && !seen.has(normName(e.name))) seen.set(normName(e.name), e.name.trim()); }));
  finishedWorkouts().forEach((w) => w.items.forEach((i) => { if (!seen.has(normName(i.name))) seen.set(normName(i.name), i.name); }));
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'ru'));
}
function fillDatalist() {
  $('#exNames').replaceChildren(...knownExerciseNames().map((n) => { const o = el('option'); o.value = n; return o; }));
}
function targetText(sets, reps) {
  const s = String(sets || '').trim(), r = String(reps || '').trim();
  if (s && r) return s + '×' + r;
  return r || (s ? s + ' подх.' : '');
}
function targetReps(target) { const m = String(target || '').match(/[×x*]\s*(\d+)\s*$/i); return m ? m[1] : ''; }
/* Упражнение для тренировки: подходы, повторы и вес сразу вписаны из программы
   (вес — из программы или из прошлого раза), остаётся отмечать галочкой. */
function makeItem(plan) {
  const name = String(plan.name).trim();
  const prev = lastSetsFor(name);
  const n = Math.max(1, Math.min(12, parseInt(plan.sets, 10) || (prev ? prev.sets.length : 3)));
  const target = targetText(plan.sets, plan.reps);
  const tr = targetReps(target);
  const pw = String(plan.weight || '').trim().replace('.', ',');
  const rows = Array.from({ length: n }, (_, j) => {
    const ps = prev ? (prev.sets[j] || prev.sets[prev.sets.length - 1]) : null;
    return { w: pw || (ps && ps.w ? fmtKg(ps.w) : ''), r: tr || (ps ? String(ps.r) : ''), done: false };
  });
  return { id: newId(), name, target, note: String(plan.note || ''), rows };
}
const planFor = (name) => S.gym.days.flatMap((d) => d.exercises).find((e) => e.name.trim() && normName(e.name) === normName(name));
/* Подсказка для подхода: сперва предыдущий подход этой же тренировки,
   потом тот же подход прошлой тренировки; повторы — из плана. */
function placeholderFor(it, j, prev) {
  const ps = prev ? (prev.sets[j] || prev.sets[prev.sets.length - 1]) : null;
  const before = j > 0 ? it.rows[j - 1] : null;
  const tr = targetReps(it.target);
  const w = before && String(before.w).trim() ? String(before.w).trim() : ps && ps.w ? fmtKg(ps.w) : '';
  const r = tr || (before && String(before.r).trim() ? String(before.r).trim() : ps ? String(ps.r) : '');
  return { w, r };
}
function suggestNextDay() {
  const days = S.gym.days.filter((d) => d.exercises.some((e) => e.name.trim()));
  if (!days.length) return null;
  const last = finishedWorkouts().find((w) => w.dayId && days.some((d) => d.id === w.dayId));
  if (!last) return days[0];
  const idx = days.findIndex((d) => d.id === last.dayId);
  return days[(idx + 1) % days.length];
}

function startWorkout(day) {
  if (S.gym.active) { ui.gymView = 'workout'; rememberUi(); renderGym(); toast('Сначала заверши или отмени текущую тренировку'); return; }
  const items = day ? day.exercises.filter((e) => e.name.trim()).map(makeItem) : [];
  S.gym.active = { id: newId(), date: dayKey(today()), dayId: day ? day.id : null, title: day ? day.name : 'Тренировка', startedAt: Date.now(), lastSetAt: 0, note: '', isEdit: false, items };
  ui.gymView = 'workout'; rememberUi();
  save(); renderGym();
  window.scrollTo(0, 0);
}
function editWorkout(id) {
  if (S.gym.active) { toast('Сначала заверши или отмени текущую тренировку'); return; }
  const w = S.gym.workouts[id];
  if (!w) return;
  S.gym.active = {
    id, date: w.date, dayId: w.dayId || null, title: w.title || 'Тренировка', startedAt: w.startedAt || Date.now(), finishedAt: w.finishedAt,
    lastSetAt: 0, note: w.note || '', isEdit: true,
    items: w.items.map((it) => ({ id: newId(), name: it.name, target: it.target || '', note: it.note || '', rows: it.sets.length ? it.sets.map((s) => ({ w: s.w ? fmtKg(s.w) : '', r: String(s.r), done: true })) : [{ w: '', r: '', done: false }] })),
  };
  ui.gymView = 'workout'; rememberUi();
  save(); renderGym();
  window.scrollTo(0, 0);
}
function tickSet(i, j) {
  const a = S.gym.active, it = a && a.items[i], r = it && it.rows[j];
  if (!r) return;
  if (r.done) { r.done = false; save(); renderGym(); return; }
  const ph = placeholderFor(it, j, lastSetsFor(it.name, a.id));
  if (!String(r.w).trim() && ph.w) r.w = ph.w;
  if (!String(r.r).trim() && ph.r) r.r = ph.r;
  const reps = parseInt(r.r, 10);
  if (!(reps > 0)) { toast('Впиши, сколько было повторов'); return; }
  if (String(r.w).trim() && !(num(r.w) >= 0)) { toast('Вес пишется числом, например 62,5'); return; }
  r.r = String(reps);
  r.done = true;
  a.lastSetAt = Date.now();
  save(); renderGym();
}
async function finishWorkout() {
  const a = S.gym.active;
  if (!a) return;
  const items = a.items.map((it) => ({
    name: it.name, target: it.target || '', note: it.note || '',
    sets: it.rows.filter((r) => r.done).map((r) => ({ w: String(r.w).trim() ? num(r.w) || 0 : 0, r: parseInt(r.r, 10) || 0 })).filter((s) => s.r > 0),
  })).filter((it) => it.sets.length);
  if (!items.length) {
    if (!(await confirmSheet('Нет ни одного отмеченного подхода. Удалить эту тренировку?', 'Удалить', true))) return;
    if (a.isEdit) delete S.gym.workouts[a.id];
    S.gym.active = null; save(); renderGym();
    return;
  }
  const total = a.items.reduce((n, it) => n + it.rows.length, 0);
  const ticked = a.items.reduce((n, it) => n + it.rows.filter((r) => r.done).length, 0);
  if (ticked < total && !(await confirmSheet('Отмечено ' + ticked + ' из ' + total + ' ' + plural(total, ['подхода', 'подходов', 'подходов']) + '. Подходы без галочки не попадут в запись. Завершить?', 'Завершить'))) return;
  S.gym.workouts[a.id] = { date: a.date, dayId: a.dayId, title: a.title, startedAt: a.startedAt, finishedAt: a.isEdit && a.finishedAt ? a.finishedAt : Date.now(), note: (a.note || '').trim(), items };
  S.gym.active = null;
  save();
  toast((a.isEdit ? 'Изменения сохранены' : 'Тренировка сохранена') + ': ' + items.length + ' упр., ' + fmtInt(tonnage(items)) + ' кг');
  renderGym();
  window.scrollTo(0, 0);
}
async function cancelWorkout() {
  const a = S.gym.active;
  if (!a) return;
  const ok = await confirmSheet(a.isEdit ? 'Отменить правку? Запись останется как была.' : 'Удалить начатую тренировку? Отмеченные подходы пропадут.', a.isEdit ? 'Отменить правку' : 'Удалить тренировку', !a.isEdit);
  if (!ok) return;
  S.gym.active = null; save(); renderGym();
}
function itemSheet(i) {
  const a = S.gym.active, it = a && a.items[i];
  if (!it) return;
  openSheet(it.name, (p) => {
    p.append(sheetBtn('Как делать', () => exerciseSheet(it.name, it.note)));
    if (i > 0) p.append(sheetBtn('Поднять выше', () => { a.items.splice(i - 1, 0, a.items.splice(i, 1)[0]); save(); renderGym(); }));
    if (i < a.items.length - 1) p.append(sheetBtn('Опустить ниже', () => { a.items.splice(i + 1, 0, a.items.splice(i, 1)[0]); save(); renderGym(); }));
    p.append(sheetBtn('Убрать упражнение', () => {
      const removed = a.items.splice(i, 1)[0];
      save(); renderGym();
      toast('Упражнение убрано', () => { if (S.gym.active === a) { a.items.splice(i, 0, removed); save(); renderGym(); } });
    }, 'danger'));
  });
}

/* ---------- экраны зала ---------- */
function workoutView(box) {
  const a = S.gym.active;
  if (!a) { startView(box); return; }
  const head = el('div', 'card');
  const hrow = el('div', 'row between');
  hrow.append(el('h2', null, a.title));
  if (a.isEdit) hrow.append(el('span', 'pill', 'правка записи'));
  const dateIn = el('input', 'field w-date');
  dateIn.type = 'date'; dateIn.id = 'wDate'; dateIn.value = a.date;
  data(dateIn, { a: 'w-date' });
  dateIn.setAttribute('aria-label', 'Дата тренировки');
  const timers = el('div', 'w-timers');
  const el1 = el('span'); el1.id = 'wElapsed';
  const el2 = el('span'); el2.id = 'wRest';
  timers.append(el1, el2);
  head.append(hrow, dateIn);
  if (!a.isEdit) head.append(timers);
  box.append(head);

  a.items.forEach((it, i) => box.append(itemCard(it, i, a)));

  const add = el('div', 'card');
  add.append(el('span', 'lbl', 'Добавить упражнение'));
  const arow = el('div', 'add');
  const ain = el('input', 'field');
  ain.type = 'text'; ain.id = 'addExInput'; ain.setAttribute('list', 'exNames'); ain.placeholder = 'Например, жим лёжа';
  ain.setAttribute('enterkeyhint', 'done'); ain.maxLength = 80;
  ain.setAttribute('aria-label', 'Название упражнения');
  ain.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addExercise(); } });
  arow.append(ain, data(btn('primary', '+'), { a: 'add-ex' }));
  add.append(arow, data(btn('ghost', 'Выбрать из каталога с картинками'), { a: 'pick-ex' }));
  box.append(add);

  const noteCard = el('div', 'card');
  const nl = el('label', 'lbl', 'Заметка к тренировке'); nl.htmlFor = 'wNote';
  const nt = el('textarea', 'field'); nt.id = 'wNote'; nt.value = a.note || '';
  nt.placeholder = 'Самочувствие, сон, что было тяжело…';
  data(nt, { a: 'w-note' });
  noteCard.append(nl, nt);
  box.append(noteCard);

  const fin = el('div', 'stack');
  fin.append(data(btn('primary', a.isEdit ? 'Сохранить изменения' : 'Завершить тренировку'), { a: 'finish' }));
  fin.append(data(btn('ghost danger', a.isEdit ? 'Отменить правку' : 'Отменить тренировку'), { a: 'cancel' }));
  box.append(fin);
  updateTimers();
}
function itemCard(it, i, a) {
  const prev = lastSetsFor(it.name, a.id);
  const card = el('div', 'card');
  const head = el('div', 'ex-head');
  const thumb = thumbEl(it.name);
  if (thumb) {
    const tb = data(btn('thumbbtn'), { a: 'ex-info', i });
    tb.setAttribute('aria-label', 'Как делать: ' + it.name);
    tb.append(thumb);
    head.append(tb);
  }
  const title = el('div', 'stack');
  title.style.gap = '4px';
  const h = el('h3', null, it.name);
  title.append(h);
  const tags = el('div', 'row');
  if (it.target) tags.append(el('span', 'pill', 'план ' + it.target));
  tags.append(data(btn('linkbtn', 'Как делать'), { a: 'ex-info', i }));
  title.append(tags);
  head.append(title, data(btn('more', '⋯'), { a: 'item-menu', i }));
  head.lastChild.setAttribute('aria-label', 'Действия с упражнением');
  card.append(head);
  if (it.note && it.note.trim()) card.append(el('p', 'ex-note', it.note));
  card.append(el('p', 'ex-prev', prev
    ? 'Прошлый раз, ' + shortDate(prev.date) + ': ' + prev.sets.map(setStr).join(', ')
    : 'Раньше не делал: сравнивать пока не с чем'));
  const sets = el('div', 'sets');
  it.rows.forEach((r, j) => {
    const ph = placeholderFor(it, j, prev);
    const row = el('div', 'set' + (r.done ? ' done' : ''));
    const w = el('input');
    w.type = 'text'; w.inputMode = 'decimal'; w.value = r.w; w.placeholder = ph.w || '—'; w.id = 'w-' + it.id + '-' + j;
    w.setAttribute('aria-label', it.name + ', подход ' + (j + 1) + ', вес в кг');
    data(w, { a: 'set-w', i, j });
    const rp = el('input');
    rp.type = 'text'; rp.inputMode = 'numeric'; rp.value = r.r; rp.placeholder = ph.r || '—'; rp.id = 'r-' + it.id + '-' + j;
    rp.setAttribute('aria-label', it.name + ', подход ' + (j + 1) + ', повторы');
    data(rp, { a: 'set-r', i, j });
    const tick = data(btn('tick'), { a: 'tick', i, j });
    tick.innerHTML = TICK_SVG;
    tick.setAttribute('aria-pressed', String(!!r.done));
    tick.setAttribute('aria-label', r.done ? 'Снять отметку с подхода ' + (j + 1) : 'Отметить подход ' + (j + 1));
    row.append(el('span', 'n', String(j + 1)), w, el('span', 'u', 'кг'), el('span', 'x', '×'), rp, el('span', 'u', 'повт'), tick);
    sets.append(row);
  });
  card.append(sets);
  const foot = el('div', 'row');
  foot.append(data(btn('minor', '+ подход'), { a: 'add-row', i }));
  if (it.rows.length > 1) foot.append(data(btn('minor', '− подход'), { a: 'del-row', i }));
  card.append(foot);
  return card;
}
function startView(box) {
  const next = suggestNextDay();
  const days = S.gym.days.filter((d) => d.exercises.some((e) => e.name.trim()));
  const card = el('div', 'card');
  card.append(el('h2', null, 'Начать тренировку'));
  if (days.length) card.append(el('p', 'muted', 'Выбери день программы: упражнения, подходы, повторы и веса подставятся сами, останется отмечать подходы галочкой.'));
  if (days.length) {
    days.forEach((d) => {
      const b = data(btn('daybtn' + (next && next.id === d.id ? ' next' : '')), { a: 'start', day: d.id });
      b.append(el('b', null, d.name + (next && next.id === d.id ? ' · следующая' : '')),
        el('span', null, d.exercises.filter((e) => e.name.trim()).map((e) => e.name.trim()).join(', ')));
      card.append(b);
    });
  } else {
    card.append(el('p', 'muted', 'Программы пока нет. Её можно записать во вкладке «Программа», а можно начать пустую тренировку и добавлять упражнения по ходу.'));
  }
  card.append(data(btn('ghost', 'Пустая тренировка'), { a: 'start', day: '' }));
  box.append(card);

  const last = finishedWorkouts()[0];
  if (last) {
    const lc = el('div', 'card');
    lc.append(el('span', 'lbl', 'Последняя тренировка'));
    lc.append(el('h3', null, (last.title || 'Тренировка') + ' · ' + shortDate(last.date)));
    last.items.forEach((it) => {
      const p = el('div', 'hitem');
      p.append(el('b', null, it.name + ': '), document.createTextNode(it.sets.length ? it.sets.map(setStr).join(', ') : 'подходы не записаны'));
      lc.append(p);
    });
    box.append(lc);
  }
}
function updateTimers() {
  const a = S.gym.active;
  const e1 = $('#wElapsed'), e2 = $('#wRest');
  if (!a || !e1) return;
  const mins = Math.max(0, Math.floor((Date.now() - a.startedAt) / 60000));
  e1.replaceChildren(document.createTextNode('идёт '), el('b', null, mins < 60 ? mins + ' мин' : Math.floor(mins / 60) + ' ч ' + pad(mins % 60) + ' мин'));
  if (a.lastSetAt) {
    const s = Math.max(0, Math.floor((Date.now() - a.lastSetAt) / 1000));
    e2.replaceChildren(document.createTextNode('отдых '), el('b', null, Math.floor(s / 60) + ':' + pad(s % 60)));
  } else e2.replaceChildren();
}
setInterval(() => { if (ui.tab === 'gym' && ui.gymView === 'workout' && !document.hidden) updateTimers(); }, 1000);

function programView(box) {
  box.append(data(btn('ghost', 'Каталог упражнений с картинками'), { a: 'catalog' }));
  if (!S.gym.days.length) {
    const c = el('div', 'card');
    c.append(el('h2', null, 'Программы пока нет'));
    c.append(el('p', 'muted', 'Запиши тренировочные дни: например, «Спина» с тягой верхнего блока 3×12. Упражнения удобно выбирать из каталога: там правильные названия, рисунки и техника.'));
    c.append(data(btn('primary', '+ Тренировочный день'), { a: 'add-day' }));
    box.append(c);
    return;
  }
  S.gym.days.forEach((d) => box.append(ui.editDay === d.id ? dayEditor(d) : dayCard(d)));
  box.append(data(btn('ghost', '+ Тренировочный день'), { a: 'add-day' }));
}
function planText(e) {
  const t = targetText(e.sets, e.reps);
  const w = String(e.weight || '').trim();
  return [t, w ? w.replace('.', ',') + ' кг' : ''].filter(Boolean).join(' · ');
}
function dayCard(d) {
  const c = el('div', 'card');
  const head = el('div', 'row between');
  head.append(el('h2', null, d.name), data(btn('quickbtn', 'Изменить'), { a: 'edit-day', day: d.id }));
  c.append(head);
  if (d.note && d.note.trim()) c.append(el('p', 'ex-note', d.note));
  const list = d.exercises.filter((e) => e.name.trim());
  if (!list.length) c.append(el('p', 'muted', 'Упражнений пока нет.'));
  list.forEach((e) => {
    const row = data(btn('pday-ex'), { a: 'pex-info', day: d.id, ex: e.id });
    const th = thumbEl(e.name);
    const mid = el('span', 'pday-mid');
    mid.append(el('span', 'pday-name', e.name));
    if (e.note && e.note.trim()) mid.append(el('span', 'pday-note', e.note));
    row.append(th || el('span', 'nopic small', 'нет фото'), mid, el('span', 'pill', planText(e) || '—'));
    c.append(row);
  });
  if (list.length) c.append(data(btn('primary', 'Начать эту тренировку'), { a: 'start', day: d.id }));
  return c;
}
function dayEditor(d) {
  const c = el('div', 'card ped');
  const nl = el('label', 'lbl', 'Название дня'); nl.htmlFor = 'dn-' + d.id;
  const name = el('input', 'field'); name.type = 'text'; name.id = 'dn-' + d.id; name.value = d.name; name.maxLength = 60;
  data(name, { a: 'day-name', day: d.id });
  const dn = el('input', 'field'); dn.type = 'text'; dn.id = 'dnote-' + d.id; dn.value = d.note || ''; dn.maxLength = 300;
  dn.placeholder = 'Разминка или заметка ко дню (необязательно)';
  dn.setAttribute('aria-label', 'Заметка ко дню');
  data(dn, { a: 'day-note', day: d.id });
  c.append(nl, name, dn);
  d.exercises.forEach((e, k) => {
    const row = el('div', 'ped-row');
    const en = el('input', 'field'); en.type = 'text'; en.value = e.name; en.placeholder = 'Упражнение ' + (k + 1); en.setAttribute('list', 'exNames'); en.id = 'pe-' + e.id; en.maxLength = 80;
    en.setAttribute('aria-label', 'Упражнение ' + (k + 1));
    data(en, { a: 'ex-name', day: d.id, ex: e.id });
    const top = el('div', 'ped-top');
    const th = thumbEl(e.name);
    if (th) top.append(th);
    const pick = data(btn('iconbtn', findEx(e.name) ? 'Сменить из каталога' : 'Выбрать из каталога'), { a: 'pex-pick', day: d.id, ex: e.id });
    pick.setAttribute('aria-label', 'Выбрать упражнение ' + (k + 1) + ' из каталога');
    top.append(pick);
    row.append(en);
    const nums = el('div', 'ped-nums');
    const field = (cls, a, val, ph, label, mode, max) => {
      const wrap = el('label', 'ped-num');
      const inp = el('input', 'field num'); inp.type = 'text'; inp.value = val; inp.placeholder = ph; inp.maxLength = max;
      if (mode) inp.inputMode = mode;
      inp.id = a + '-' + e.id;
      data(inp, { a, day: d.id, ex: e.id });
      wrap.append(el('span', 'lbl', label), inp);
      return wrap;
    };
    nums.append(field('', 'ex-sets', e.sets, '3', 'Подходы', 'numeric', 3), field('', 'ex-reps', e.reps, '12', 'Повторы', '', 12), field('', 'ex-weight', e.weight || '', '—', 'Вес, кг', 'decimal', 7));
    const note = el('textarea', 'field'); note.rows = 2; note.style.minHeight = '64px'; note.value = e.note || ''; note.maxLength = 300; note.id = 'pn-' + e.id;
    note.placeholder = 'Комментарий по технике (необязательно)';
    note.setAttribute('aria-label', 'Комментарий к упражнению ' + (k + 1));
    data(note, { a: 'ex-note', day: d.id, ex: e.id });
    const tools = el('div', 'tools');
    if (k > 0) tools.append(data(btn('iconbtn', '↑'), { a: 'ex-up', day: d.id, ex: e.id }));
    if (k < d.exercises.length - 1) tools.append(data(btn('iconbtn', '↓'), { a: 'ex-down', day: d.id, ex: e.id }));
    tools.append(data(btn('iconbtn danger', 'Убрать'), { a: 'ex-del', day: d.id, ex: e.id }));
    tools.querySelectorAll('.iconbtn').forEach((b) => b.setAttribute('aria-label', b.textContent === '↑' ? 'Выше' : b.textContent === '↓' ? 'Ниже' : 'Убрать упражнение'));
    row.append(top, nums, note, tools);
    c.append(row);
  });
  c.append(data(btn('ghost', '+ упражнение'), { a: 'ex-add', day: d.id }));
  c.append(el('p', 'muted', 'Повторы можно писать диапазоном, например 8–10.'));
  const foot = el('div', 'row between');
  foot.append(data(btn('ghost danger', 'Удалить день'), { a: 'del-day', day: d.id }), data(btn('primary', 'Готово'), { a: 'done-day', day: d.id }));
  c.append(foot);
  return c;
}
const LETTERS = 'АБВГДЕЖЗИК';
function addDay() {
  const d = { id: newId(), name: 'Тренировка ' + (LETTERS[S.gym.days.length] || S.gym.days.length + 1), note: '', exercises: [{ id: newId(), name: '', sets: '3', reps: '', weight: '', note: '' }] };
  S.gym.days.push(d);
  ui.editDay = d.id;
  save(); renderGym();
}
const dayById = (id) => S.gym.days.find((d) => d.id === id);

function exerciseStats() {
  const map = new Map();
  finishedWorkouts().slice().reverse().forEach((w) => {
    w.items.forEach((it) => {
      const k = normName(it.name);
      const sets = (it.sets || []).filter((s) => s.r > 0);
      if (!k || !sets.length) return;
      let e = map.get(k);
      if (!e) { e = { key: k, name: it.name, points: [] }; map.set(k, e); }
      e.name = it.name;
      const best = sets.reduce((b, s) => (e1rm(s.w || 0, s.r) > e1rm(b.w || 0, b.r) ? s : b), sets[0]);
      e.points.push({ date: w.date, maxW: Math.max(...sets.map((s) => s.w || 0)), e1: e1rm(best.w || 0, best.r), best, maxR: Math.max(...sets.map((s) => s.r)), sets });
    });
  });
  return Array.from(map.values()).map((e) => {
    e.bw = e.points.every((p) => p.maxW === 0);
    e.last = e.points[e.points.length - 1];
    e.first = e.points[0];
    e.pr = e.bw ? Math.max(...e.points.map((p) => p.maxR)) : Math.max(...e.points.map((p) => p.maxW));
    return e;
  }).sort((a, b) => (a.last.date < b.last.date ? 1 : a.last.date > b.last.date ? -1 : a.name.localeCompare(b.name, 'ru')));
}
function progressView(box) {
  const stats = exerciseStats();
  if (!stats.length) {
    const c = el('div', 'card');
    c.append(el('h2', null, 'Прогресс появится после первой тренировки'));
    c.append(el('p', 'muted', 'Отмечай подходы галочкой и завершай тренировку. Здесь будут лучшие веса, рекорды и график по каждому упражнению.'));
    box.append(c);
    return;
  }
  if (ui.progressEx) {
    const e = stats.find((x) => x.key === ui.progressEx);
    if (e) { exerciseDetail(box, e); return; }
    ui.progressEx = null;
  }
  const list = el('div', 'exlist');
  stats.forEach((e) => {
    const b = data(btn('exrow'), { a: 'prog-open', key: e.key });
    const delta = e.bw ? e.last.maxR - e.first.maxR : e.last.maxW - e.first.maxW;
    const right = el('div', 'right');
    right.append(el('b', null, e.bw ? 'рекорд ' + e.pr + ' повт' : 'рекорд ' + fmtKg(e.pr) + ' кг'));
    if (e.points.length > 1) {
      const dl = el('span', 'delta' + (delta < 0 ? ' neg' : delta === 0 ? ' zero' : ''), (delta > 0 ? '+' : delta < 0 ? '−' : '±') + (e.bw ? Math.abs(delta) + ' повт' : fmtKg(Math.abs(delta)) + ' кг'));
      right.append(dl);
    }
    b.append(el('b', null, e.name), right, el('span', 'sub', shortDate(e.last.date) + ': ' + e.last.sets.map(setStr).join(', ')));
    list.append(b);
  });
  box.append(list);
}
function exerciseDetail(box, e) {
  const back = data(btn('quickbtn', '‹ Все упражнения'), { a: 'prog-back' });
  back.style.justifySelf = 'start';
  box.append(back);
  const c = el('div', 'card');
  const ph = el('div', 'ex-head');
  const pth = thumbEl(e.name);
  if (pth) ph.append(pth);
  const pt = el('div', 'stack');
  pt.style.gap = '4px';
  pt.append(el('h2', null, e.name), data(btn('linkbtn', 'Как делать, фото'), { a: 'prog-info', name: e.name }));
  ph.append(pt);
  c.append(ph);
  const metrics = e.bw ? [['r', 'Повторы']] : [['w', 'Рабочий вес'], ['e', '1ПМ (расчёт)'], ['r', 'Повторы']];
  if (!metrics.some((m) => m[0] === ui.progressMetric)) ui.progressMetric = metrics[0][0];
  if (metrics.length > 1) {
    const seg = el('div', 'seg small');
    metrics.forEach(([k, label]) => {
      const b = data(btn(null, label), { a: 'metric', m: k });
      b.setAttribute('aria-selected', String(ui.progressMetric === k));
      seg.append(b);
    });
    c.append(seg);
  }
  const m = ui.progressMetric;
  const val = m === 'w' ? (p) => p.maxW : m === 'e' ? (p) => p.e1 : (p) => p.maxR;
  const unit = m === 'r' ? 'повт' : 'кг';
  const chart = el('div', 'chart');
  chart.innerHTML = chartSVG(e.points.slice(-24), val, unit);
  c.append(chart);
  if (e.points.length < 2) c.append(el('p', 'muted', 'Для линии нужны хотя бы две тренировки с этим упражнением.'));
  if (m === 'e') c.append(el('p', 'muted', '1ПМ считается по формуле Эпли из лучшего подхода: это оценка, а не настоящий максимум.'));
  box.append(c);
  const hist = el('div', 'card');
  hist.append(el('span', 'lbl', 'Все тренировки с этим упражнением'));
  e.points.slice().reverse().forEach((p) => {
    const row = el('div', 'sess');
    row.append(el('span', 'd', shortDate(p.date)), el('span', null, p.sets.map(setStr).join(', ')));
    hist.append(row);
  });
  box.append(hist);
}
function chartSVG(pts, val, unit) {
  const W = 340, H = 190, L = 44, R = 14, T = 14, B = 28;
  const vals = pts.map(val);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= unit === 'кг' ? 5 : 2; hi += unit === 'кг' ? 5 : 2; }
  const padY = (hi - lo) * 0.15;
  lo = Math.max(0, lo - padY); hi += padY;
  const d0 = dayNum(parseDay(pts[0].date)), d1 = dayNum(parseDay(pts[pts.length - 1].date));
  const x = (p) => (d1 === d0 ? L + (W - L - R) / 2 : L + (dayNum(parseDay(p.date)) - d0) / (d1 - d0) * (W - L - R));
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const fmt = (v) => (unit === 'кг' ? fmtKg(Math.round(v * 2) / 2) : String(Math.round(v)));
  let g = '';
  [lo, (lo + hi) / 2, hi].forEach((v) => {
    const yy = y(v).toFixed(1);
    g += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/>';
    g += '<text class="ax" x="' + (L - 6) + '" y="' + (Number(yy) + 4) + '" text-anchor="end">' + fmt(v) + '</text>';
  });
  const xy = pts.map((p) => [x(p), y(val(p))]);
  const line = xy.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
  const base = (H - B).toFixed(1);
  let area = '';
  if (xy.length > 1) area = '<polygon class="ar" points="' + xy[0][0].toFixed(1) + ',' + base + ' ' + line + ' ' + xy[xy.length - 1][0].toFixed(1) + ',' + base + '"/>';
  const dots = xy.map((q, i) => '<circle class="pt' + (i === xy.length - 1 ? ' last' : '') + '" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="' + (i === xy.length - 1 ? 5 : 3.5) + '"/>').join('');
  const lab = (p, anchor, xx) => '<text class="ax" x="' + xx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + anchor + '">' + parseDay(p.date).getDate() + ' ' + MONTHS_SHORT[parseDay(p.date).getMonth()] + '</text>';
  let xl = lab(pts[0], pts.length > 1 ? 'start' : 'middle', xy[0][0]);
  if (pts.length > 1) xl += lab(pts[pts.length - 1], 'end', xy[xy.length - 1][0]);
  const lastV = '<text class="ax" x="' + Math.min(W - R, xy[xy.length - 1][0]).toFixed(1) + '" y="' + Math.max(12, xy[xy.length - 1][1] - 10).toFixed(1) + '" text-anchor="end" style="fill:var(--ink);font-weight:700">' + fmt(val(pts[pts.length - 1])) + ' ' + unit + '</text>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="График по тренировкам">' + g + area + (xy.length > 1 ? '<polyline class="ln" points="' + line + '"/>' : '') + dots + xl + lastV + '</svg>';
}

function historyView(box) {
  const ws = finishedWorkouts();
  if (!ws.length) {
    const c = el('div', 'card');
    c.append(el('h2', null, 'Тренировок пока нет'));
    c.append(el('p', 'muted', 'Завершённые тренировки появятся здесь, по дате.'));
    box.append(c);
    return;
  }
  const list = el('div', 'hist');
  ws.forEach((w) => {
    const c = el('div', 'card');
    c.style.padding = '0';
    const sets = w.items.reduce((n, it) => n + it.sets.length, 0);
    const open = ui.openWorkout === w.id;
    const row = data(btn('hrow'), { a: 'hist-toggle', id: w.id });
    row.setAttribute('aria-expanded', String(open));
    row.append(el('b', null, shortDate(w.date) + ' · ' + (w.title || 'Тренировка')),
      el('span', 'sub', w.items.length + ' упр. · ' + sets + ' ' + plural(sets, ['подход', 'подхода', 'подходов']) + ' · ' + fmtInt(tonnage(w.items)) + ' кг'));
    c.append(row);
    if (open) {
      const det = el('div', 'hdetail');
      w.items.forEach((it) => {
        const p = data(btn('hitem hbtn'), { a: 'hist-ex', name: it.name, note: it.note || '' });
        const th = thumbEl(it.name);
        const txt = el('span');
        txt.append(el('b', null, it.name + ': '), document.createTextNode(it.sets.length ? it.sets.map(setStr).join(', ') : 'подходы не записаны'));
        if (it.note) txt.append(el('span', 'pday-note', ' · ' + it.note));
        p.append(th || el('span', 'nopic small', 'нет фото'), txt);
        det.append(p);
      });
      if (w.note) det.append(el('p', 'muted', w.note));
      const tools = el('div', 'row');
      tools.append(data(btn('quickbtn', 'Изменить'), { a: 'hist-edit', id: w.id }), data(btn('quickbtn', 'Удалить'), { a: 'hist-del', id: w.id }));
      tools.lastChild.style.color = 'var(--margin)';
      det.append(tools);
      c.append(det);
    }
    list.append(c);
  });
  box.append(list);
}

function renderGym() {
  document.querySelectorAll('.gv').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === ui.gymView)));
  const ws = finishedWorkouts();
  const a = S.gym.active;
  $('#gymLine').textContent = a ? (a.isEdit ? 'Правка тренировки' : 'Идёт тренировка') : ws.length ? 'Последняя: ' + shortDate(ws[0].date) : 'Тренировок пока нет';
  fillDatalist();
  const box = $('#gymBody');
  const y = window.scrollY;
  box.replaceChildren();
  if (ui.gymView === 'workout') workoutView(box);
  else if (ui.gymView === 'program') programView(box);
  else if (ui.gymView === 'progress') progressView(box);
  else historyView(box);
  window.scrollTo(0, y);
}
function addExerciseNamed(name) {
  const a = S.gym.active;
  if (!a || !name) return;
  a.items.push(makeItem(planFor(name) || { name }));
  save(); renderGym();
}
function addExercise() {
  const inp = $('#addExInput');
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) { inp.focus(); return; }
  addExerciseNamed(name);
}
const exById = (dayId, exId) => { const d = dayById(dayId); return d ? d.exercises.find((x) => x.id === exId) : null; };

document.querySelectorAll('.gv').forEach((b) => b.addEventListener('click', () => {
  ui.gymView = b.dataset.view; ui.editDay = null; rememberUi(); renderGym(); window.scrollTo(0, 0);
}));
$('#gymBody').addEventListener('input', (e) => {
  const t = e.target, a = t.dataset.a;
  if (!a) return;
  const act = S.gym.active;
  if ((a === 'set-w' || a === 'set-r') && act) {
    const r = act.items[+t.dataset.i] && act.items[+t.dataset.i].rows[+t.dataset.j];
    if (r) { r[a === 'set-w' ? 'w' : 'r'] = t.value.trim(); save(); }
  } else if (a === 'w-note' && act) { act.note = t.value; save(); }
  else if (a === 'w-date' && act) { if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) { act.date = t.value; save(); } }
  else if (a === 'day-name') { const d = dayById(t.dataset.day); if (d) { d.name = t.value; save(); } }
  else if (a === 'day-note') { const d = dayById(t.dataset.day); if (d) { d.note = t.value; save(); } }
  else if (['ex-name', 'ex-sets', 'ex-reps', 'ex-weight', 'ex-note'].includes(a)) {
    const ex = exById(t.dataset.day, t.dataset.ex);
    if (ex) { ex[a.slice(3)] = t.value; save(); }
  }
});
$('#gymBody').addEventListener('click', async (e) => {
  const t = e.target.closest('[data-a]');
  if (!t || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
  const a = t.dataset.a, act = S.gym.active;
  const i = +t.dataset.i, j = +t.dataset.j;
  if (a === 'start') { startWorkout(t.dataset.day ? dayById(t.dataset.day) : null); }
  else if (a === 'tick') tickSet(i, j);
  else if (a === 'add-row' && act) { const it = act.items[i]; const last = it.rows[it.rows.length - 1]; it.rows.push({ w: last && last.done ? last.w : '', r: '', done: false }); save(); renderGym(); }
  else if (a === 'del-row' && act) { const it = act.items[i]; if (it.rows.length > 1) { it.rows.pop(); save(); renderGym(); } }
  else if (a === 'item-menu') itemSheet(i);
  else if (a === 'ex-info' && act && act.items[i]) exerciseSheet(act.items[i].name, act.items[i].note);
  else if (a === 'add-ex') addExercise();
  else if (a === 'pick-ex') pickExercise(addExerciseNamed);
  else if (a === 'catalog') pickExercise(null, true);
  else if (a === 'pex-info') { const ex = exById(t.dataset.day, t.dataset.ex); if (ex) exerciseSheet(ex.name, ex.note); }
  else if (a === 'pex-pick') {
    const dayId = t.dataset.day, exId = t.dataset.ex;
    pickExercise((name) => { const ex = exById(dayId, exId); if (ex) { ex.name = name; save(); renderGym(); } });
  }
  else if (a === 'finish') finishWorkout();
  else if (a === 'cancel') cancelWorkout();
  else if (a === 'add-day') addDay();
  else if (a === 'edit-day') { ui.editDay = t.dataset.day; renderGym(); }
  else if (a === 'done-day') {
    const d = dayById(t.dataset.day);
    if (d) { d.exercises = d.exercises.filter((x) => x.name.trim()); d.name = d.name.trim() || 'Тренировка'; }
    ui.editDay = null; save(); renderGym();
  } else if (a === 'del-day') {
    const d = dayById(t.dataset.day);
    if (!d || !(await confirmSheet('Удалить «' + d.name + '» из программы? Прошлые тренировки останутся.', 'Удалить день', true))) return;
    const idx = S.gym.days.indexOf(d);
    S.gym.days.splice(idx, 1); ui.editDay = null; save(); renderGym();
    toast('День удалён', () => { S.gym.days.splice(idx, 0, d); save(); renderGym(); });
  } else if (a === 'ex-add') { const d = dayById(t.dataset.day); if (d) { d.exercises.push({ id: newId(), name: '', sets: '3', reps: '', weight: '', note: '' }); save(); renderGym(); const inputs = document.querySelectorAll('[data-a="ex-name"][data-day="' + d.id + '"]'); if (inputs.length) inputs[inputs.length - 1].focus(); } }
  else if (a === 'ex-up' || a === 'ex-down' || a === 'ex-del') {
    const d = dayById(t.dataset.day);
    if (!d) return;
    const k = d.exercises.findIndex((x) => x.id === t.dataset.ex);
    if (k < 0) return;
    if (a === 'ex-del') d.exercises.splice(k, 1);
    else { const to = a === 'ex-up' ? k - 1 : k + 1; if (to >= 0 && to < d.exercises.length) d.exercises.splice(to, 0, d.exercises.splice(k, 1)[0]); }
    save(); renderGym();
  } else if (a === 'prog-open') { ui.progressEx = t.dataset.key; renderGym(); window.scrollTo(0, 0); }
  else if (a === 'prog-back') { ui.progressEx = null; renderGym(); }
  else if (a === 'metric') { ui.progressMetric = t.dataset.m; renderGym(); }
  else if (a === 'hist-toggle') { ui.openWorkout = ui.openWorkout === t.dataset.id ? null : t.dataset.id; renderGym(); }
  else if (a === 'hist-edit') editWorkout(t.dataset.id);
  else if (a === 'hist-ex') exerciseSheet(t.dataset.name, t.dataset.note);
  else if (a === 'prog-info') exerciseSheet(t.dataset.name);
  else if (a === 'hist-del') {
    const id = t.dataset.id, w = S.gym.workouts[id];
    if (!w || !(await confirmSheet('Удалить тренировку ' + shortDate(w.date) + '?', 'Удалить', true))) return;
    delete S.gym.workouts[id]; save(); renderGym();
    toast('Тренировка удалена', () => { S.gym.workouts[id] = w; save(); renderGym(); });
  }
});

/* ================= КОПИЯ ================= */
function renderBackup() {
  const ws = Object.keys(S.gym.workouts).length;
  const st = $('#stats');
  st.replaceChildren();
  [[Object.keys(S.tasks).length, 'дел'], [Object.keys(S.notes).length, 'заметок'], [ws, 'тренировок']].forEach(([n, l]) => {
    const s = el('div', 'stat'); s.append(el('b', null, String(n)), el('span', null, l)); st.append(s);
  });
  $('#lastBackup').textContent = S.meta.lastBackup ? 'Последняя копия: ' + daysAgoText(S.meta.lastBackup) + '.' : 'Копия ещё ни разу не сохранялась.';
  $('#backupLine').textContent = 'файл с записями';
  const line = $('#storageLine');
  line.textContent = '';
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then((p) => {
      line.textContent = p ? 'Телефон отметил записи как важные и не будет удалять их сам.' : 'Телефон может удалить записи, если долго не открывать приложение или кончится место. Копия защищает от этого.';
    }).catch(() => {});
  }
}
function markBackup() { S.meta.lastBackup = Date.now(); save(); renderBackup(); renderNudge(); toast('Копия сохранена'); }
async function exportBackup() {
  await flush();
  const used = new Set();
  Object.values(S.gym.custom).forEach((c) => c.photos.forEach((id) => used.add(id)));
  Object.values(S.gym.overrides).forEach((o) => (o.photos || []).forEach((id) => used.add(id)));
  const photos = {};
  used.forEach((id) => { if (photoCache.has(id)) photos[id] = photoCache.get(id); });
  const text = JSON.stringify(Object.assign({ app: 'dnevnik', exportedAt: new Date().toISOString() }, S, { photos }), null, 1);
  const name = 'dnevnik-' + dayKey(today()) + '.json';
  let file = null;
  try { file = new File([text], name, { type: 'application/json' }); } catch (e) { file = null; }
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Копия дневника' }); markBackup(); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  markBackup();
}
async function importText(text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { toast('Это не копия дневника: текст не читается.'); return; }
  if (!j || typeof j !== 'object' || (!j.tasks && !j.gym)) { toast('В этом файле нет записей дневника.'); return; }
  /* файл-добавка (например, прошлые тренировки): ничего не заменяет, только добавляет новое */
  if (j.kind === 'add') {
    const g = obj(j.gym);
    const have = new Set(S.gym.days.map((d) => normName(d.name)));
    const days = (Array.isArray(g.days) ? g.days : []).filter((d) => d && typeof d === 'object' && !have.has(normName(d.name))).map(normDay);
    const ws = obj(g.workouts);
    const wIds = Object.keys(ws).filter((id) => !S.gym.workouts[id] && validWorkout(ws[id]));
    if (!days.length && !wIds.length) { toast('Всё из этого файла уже есть в дневнике'); return; }
    const parts = [];
    if (days.length) parts.push(days.length + ' ' + plural(days.length, ['день', 'дня', 'дней']) + ' в программу');
    if (wIds.length) parts.push(wIds.length + ' ' + plural(wIds.length, ['тренировку', 'тренировки', 'тренировок']) + ' в историю');
    if (!(await confirmSheet('Добавить ' + parts.join(' и ') + '? То, что уже записано в телефоне, не изменится.', 'Добавить'))) return;
    days.forEach((d) => S.gym.days.push(d));
    wIds.forEach((id) => {
      const w = ws[id];
      S.gym.workouts[id] = {
        date: w.date, title: String(w.title || 'Тренировка'), dayId: null, startedAt: Number(w.startedAt) || 0, finishedAt: Number(w.finishedAt) || 0, note: String(w.note || ''),
        items: w.items.filter((it) => it && typeof it.name === 'string').map((it) => ({
          name: it.name, target: String(it.target || ''), note: String(it.note || ''),
          sets: (Array.isArray(it.sets) ? it.sets : []).map((s) => ({ w: Number(s.w) || 0, r: parseInt(s.r, 10) || 0 })).filter((s) => s.r > 0),
        })),
      };
    });
    fixImported();
    save(); renderAll();
    toast('Добавлено: ' + parts.join(', '));
    return;
  }
  if (j.gym) {
    const has = Object.keys(S.tasks).length + Object.keys(S.gym.workouts).length + S.gym.days.length > 0;
    const when = j.exportedAt ? ' от ' + shortDate(dayKey(new Date(j.exportedAt))) : '';
    if (has && !(await confirmSheet('Заменить все записи на этом телефоне копией' + when + '?', 'Заменить', true))) return;
    const keepBackup = S.meta.lastBackup;
    S = normalizeState(j);
    S.meta.lastBackup = Math.max(keepBackup || 0, S.meta.lastBackup || 0);
    const photos = obj(j.photos);
    for (const id of Object.keys(photos)) {
      if (typeof photos[id] === 'string' && photos[id].startsWith('data:image/')) { try { await storePhoto(photos[id], id); } catch (e) { /* без этого фото */ } }
    }
    rebuildCatalog();
    save(); rebuild(); renderAll();
    toast('Копия восстановлена: ' + Object.keys(S.tasks).length + ' дел, ' + Object.keys(S.gym.workouts).length + ' тренировок');
    return;
  }
  let added = 0, notes = 0;
  Object.keys(obj(j.tasks)).forEach((id) => { const t = j.tasks[id]; if (!S.tasks[id] && validTask(t)) { S.tasks[id] = t; added++; } });
  Object.keys(obj(j.notes)).forEach((id) => { const n = j.notes[id]; if (!S.notes[id] && n && typeof n.text === 'string') { S.notes[id] = n; notes++; } });
  save(); rebuild(); renderAll();
  toast(added || notes ? 'Перенесено с компьютера: ' + added + ' дел, ' + notes + ' заметок' : 'Новых записей в файле нет: всё уже здесь');
}
$('#exportBtn').addEventListener('click', exportBackup);
$('#importFile').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > 20 * 1024 * 1024) { toast('Файл слишком большой для копии дневника.'); return; }
  importText(await f.text());
});
$('#importTextBtn').addEventListener('click', () => { const v = $('#importText').value.trim(); if (v) { importText(v); $('#importText').value = ''; } });

/* ================= вкладки и запуск ================= */
function switchTab(tab) {
  if (ui.editing) document.activeElement && document.activeElement.blur();
  ui.tab = tab;
  rememberUi();
  renderAll();
  window.scrollTo(0, 0);
}
function renderAll() {
  ['diary', 'gym', 'backup'].forEach((t) => { $('#screen-' + t).hidden = t !== ui.tab; });
  document.querySelectorAll('.tabbar button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  if (ui.tab === 'diary') renderDiary();
  else if (ui.tab === 'gym') renderGym();
  else renderBackup();
}
document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAll(); });
function scheduleMidnight() {
  const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
  setTimeout(() => { renderAll(); scheduleMidnight(); }, next - n);
}

function renderInstallHint() {
  const standalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  const box = $('#installHint');
  if (standalone) { box.hidden = true; return; }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  box.hidden = false;
  box.replaceChildren(
    el('b', null, 'Поставь дневник на экран «Домой»'),
    el('span', null, ios
      ? 'В Safari нажми кнопку «Поделиться» (квадрат со стрелкой) → «На экран „Домой“» → «Добавить». Потом открывай дневник с этого значка: записи, сделанные здесь во вкладке Safari, туда не попадут.'
      : 'Открой эту страницу в Safari на iPhone и добавь её на экран «Домой». Записи, сделанные в этом окне, хранятся только в нём.'));
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

load().then(() => {
  rebuildCatalog();
  fixImported();
  rebuild();
  renderInstallHint();
  renderAll();
  scheduleMidnight();
});
})();
