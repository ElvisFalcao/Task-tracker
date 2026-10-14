'use strict';

/* ==========================================================================
   Storage
   ========================================================================== */

const STORAGE_KEY = 'workload-tracker-v1';
const UI_KEY = 'workload-ui-v1';
const DRAFT_KEYS = { task: 'workload-draft-task-v1', entry: 'workload-draft-entry-v1' };

const DEFAULT_STATE = {
  tasks: [],
  entries: [],
  active: null, // { taskId, start }
  settings: {
    name: '', email: '', address: '', payment: '',
    rate: 50, currency: 'USD', tax: 0, nextInvoiceNo: 1,
  },
};

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function writeJson(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // storage blocked or full; the app still works for this visit
  }
}

/** Best guess at a currency for a first visit, from the browser's region. */
function guessCurrency() {
  const byRegion = {
    US: 'USD', GB: 'GBP', IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', PT: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR',
    GH: 'GHS', NG: 'NGN', KE: 'KES', ZA: 'ZAR', IN: 'INR', CA: 'CAD', AU: 'AUD', NZ: 'NZD', AE: 'AED', JP: 'JPY', BR: 'BRL', MX: 'MXN',
  };
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return byRegion[region] || 'USD';
  } catch {
    return 'USD';
  }
}

function load() {
  const data = readJson(STORAGE_KEY);
  if (!data) {
    const fresh = structuredClone(DEFAULT_STATE);
    fresh.settings.currency = guessCurrency();
    return fresh;
  }
  return { ...structuredClone(DEFAULT_STATE), ...data, settings: { ...DEFAULT_STATE.settings, ...data.settings } };
}

let state = load();

function save() {
  if (!writeJson(STORAGE_KEY, state)) {
    toast("We couldn't save your changes. This browser's storage may be full or turned off, so download a backup from Settings.");
  }
}

const ui = Object.assign(
  { view: 'today', sort: { key: 'suggested', dir: 1 }, lastPriority: 'medium', lastClient: '', lastBillable: false, lastTaskId: '' },
  readJson(UI_KEY) || {},
);
function saveUi() { writeJson(UI_KEY, ui); }

/* ==========================================================================
   Helpers
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function icon(name) {
  return `<svg class="i" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
}

function none() {
  return '<span class="none"><span aria-hidden="true">—</span><span class="sr-only">None</span></span>';
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
function pad(n) { return String(n).padStart(2, '0'); }

/** Local YYYY-MM-DD for a Date. */
function dateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

function daysUntil(due) {
  if (!due) return null;
  return Math.round((parseDate(due) - parseDate(dateStr())) / 86400000);
}

function fmtDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  if (total > 0 && total < 60) return `${s}s`;
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
}

function fmtStopwatch(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtHM(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtClock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtDay(s) {
  return parseDate(s).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDayShort(s) {
  const d = parseDate(s);
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString([], opts);
}

function fmtDayHeading(s) {
  const d = daysUntil(s);
  if (d === 0) return 'Today';
  if (d === -1) return 'Yesterday';
  return parseDate(s).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function money(n) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: state.settings.currency || 'USD' }).format(n);
  } catch {
    return `${state.settings.currency || ''} ${n.toFixed(2)}`;
  }
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const taskById = id => state.tasks.find(t => t.id === id);
const entryById = id => state.entries.find(e => e.id === id);
const sumMs = list => list.reduce((a, e) => a + (e.end - e.start), 0);

function trackedMs(taskId) {
  let ms = sumMs(state.entries.filter(e => e.taskId === taskId));
  if (state.active?.taskId === taskId) ms += Date.now() - state.active.start;
  return ms;
}

function clients() {
  return [...new Set(state.tasks.map(t => t.client?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function clientOptions(selected, anyLabel) {
  const list = clients();
  const value = list.includes(selected) ? selected : '';
  return {
    value,
    html: `<option value="">${esc(anyLabel)}</option>` + list.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join(''),
  };
}

/* ==========================================================================
   Prioritisation
   ========================================================================== */

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

/**
 * Higher score = do it sooner. Priority sets the base; a due date that is
 * close (or already passed) pushes the task up.
 */
function score(t) {
  const d = daysUntil(t.due);
  const urgency = d === null ? 0 : d < 0 ? 10 : Math.max(0, 7 - d);
  return PRIORITY_WEIGHT[t.priority] * 4 + urgency;
}

function byScore(a, b) {
  return score(b) - score(a)
    || (a.due || '9999').localeCompare(b.due || '9999')
    || (a.dueTime || '99').localeCompare(b.dueTime || '99')
    || a.createdAt - b.createdAt;
}

const VIEWS = {
  today: t => t.status !== 'done' && ((t.due && t.due <= dateStr()) || (!t.due && t.priority === 'high')),
  week: t => t.status !== 'done' && t.due && t.due <= addDays(dateStr(), 6),
  all: t => t.status !== 'done',
  done: t => t.status === 'done',
};
const VIEW_LABELS = { today: 'Today', week: 'This week', all: 'All open', done: 'Done' };

function suggestedNextId() {
  return state.tasks.filter(t => t.status !== 'done').sort(byScore)[0]?.id;
}

function dueInfo(t) {
  if (!t.due) return { text: 'No date', tone: 'none' };
  const d = daysUntil(t.due);
  const time = t.dueTime ? `, ${fmtClock(t.dueTime)}` : '';
  if (t.status !== 'done' && d < 0) return { text: `Overdue · ${fmtDayShort(t.due)}`, tone: 'overdue' };
  if (d === 0) return { text: `Today${time}`, tone: 'today' };
  if (d === 1) return { text: `Tomorrow${time}`, tone: 'soon' };
  return { text: `${fmtDayShort(t.due)}${time}`, tone: 'later' };
}

function timeText(t) {
  const ms = trackedMs(t.id);
  const est = t.estimateMin ? t.estimateMin * 60000 : 0;
  if (!ms && !est) return '';
  return `${fmtDuration(ms)}${est ? ` / ${fmtDuration(est)}` : ''}`;
}

/* ==========================================================================
   Overlays: slide-overs, the confirmation dialog and the phone menu.
   One at a time, focus trapped inside, focus returned to the trigger.
   ========================================================================== */

const scrim = $('#scrim');
const appEl = $('.app');
let overlay = null;

function focusables(root) {
  return $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
    .filter(el => el.getClientRects().length > 0);
}

function panelShow(el) {
  return () => { el.hidden = false; el.getBoundingClientRect(); el.dataset.open = 'true'; };
}

function panelHide(el) {
  return () => {
    el.dataset.open = 'false';
    setTimeout(() => { if (el.dataset.open === 'false') el.hidden = true; }, 150);
  };
}

function openOverlay(o) {
  if (overlay) closeOverlay({ restoreFocus: false });
  hideTip();
  closePopover();
  const trigger = document.activeElement;
  const row = trigger?.closest?.('tr[data-id]');
  overlay = {
    trigger,
    // Rows are re-rendered while a panel is open, so keep a way to find the same row again.
    triggerSel: row ? `#${row.parentElement.id} tr[data-id="${CSS.escape(row.dataset.id)}"] .row-title` : null,
    inert: [appEl],
    ...o,
  };
  overlay.show();
  scrim.hidden = false;
  scrim.getBoundingClientRect();
  scrim.dataset.open = 'true';
  overlay.inert.forEach(el => { el.inert = true; });
  document.documentElement.classList.add('is-locked');
  const target = overlay.initialFocus?.() || focusables(overlay.el)[0];
  target?.focus();
}

function closeOverlay({ restoreFocus = true } = {}) {
  if (!overlay) return;
  const o = overlay;
  overlay = null;
  o.hide();
  scrim.dataset.open = 'false';
  setTimeout(() => { if (!overlay) scrim.hidden = true; }, 150);
  o.inert.forEach(el => { el.inert = false; });
  document.documentElement.classList.remove('is-locked');
  if (!restoreFocus) return;
  let t = o.trigger;
  if (!(t?.isConnected && t.getClientRects().length) && o.triggerSel) t = $(o.triggerSel);
  if (t && t !== document.body && t.isConnected && t.getClientRects().length) t.focus({ preventScroll: true });
  else focusPageHeading();
}

function dismissOverlay() {
  if (!overlay) return;
  if (overlay.onEscape) overlay.onEscape();
  else closeOverlay();
}

scrim.addEventListener('click', dismissOverlay);

function trapTab(e, root) {
  const nodes = focusables(root);
  if (!nodes.length) return;
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
    e.preventDefault();
    first.focus();
  }
}

/** Opens the confirmation dialog. Resolves true when the action is confirmed. */
function confirmDialog({ title, body, confirmLabel, danger = true }) {
  return new Promise(resolve => {
    const dlg = $('#confirm'), ok = $('#confirm-ok'), cancel = $('#confirm-cancel');
    $('#confirm-title').textContent = title;
    $('#confirm-body').textContent = body;
    ok.textContent = confirmLabel;
    ok.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
    dlg.setAttribute('role', danger ? 'alertdialog' : 'dialog');
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      ok.onclick = cancel.onclick = null;
      closeOverlay();
      resolve(value);
    };
    ok.onclick = () => finish(true);
    cancel.onclick = () => finish(false);
    openOverlay({
      kind: 'dialog', el: dlg, show: panelShow(dlg), hide: panelHide(dlg),
      onEscape: () => finish(false),
      initialFocus: () => (danger ? cancel : ok),
    });
  });
}

/* ---------- Phone menu (the sidebar becomes a drawer) ---------- */

function openNav() {
  const sb = $('#sidebar'), btn = $('#nav-open');
  openOverlay({
    kind: 'nav', el: sb, inert: [$('#main-col')],
    show: () => { sb.dataset.open = 'true'; btn.setAttribute('aria-expanded', 'true'); },
    hide: () => { sb.dataset.open = 'false'; btn.setAttribute('aria-expanded', 'false'); },
    initialFocus: () => $('.nav-link[aria-current="page"]') || $('.nav-link'),
  });
}

matchMedia('(min-width: 768px)').addEventListener('change', e => {
  if (e.matches && overlay?.kind === 'nav') closeOverlay({ restoreFocus: false });
});

/* ---------- Popovers (non-modal) ---------- */

let openPop = null;

function openPopover(btn) {
  const pop = $(`#${btn.getAttribute('aria-controls')}`);
  closePopover();
  pop.hidden = false;
  pop.getBoundingClientRect();
  pop.dataset.open = 'true';
  btn.setAttribute('aria-expanded', 'true');
  openPop = { btn, pop };
  focusables(pop)[0]?.focus();
}

function closePopover(returnFocus = false) {
  if (!openPop) return;
  const { btn, pop } = openPop;
  openPop = null;
  pop.dataset.open = 'false';
  pop.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
  if (returnFocus) btn.focus();
}

document.addEventListener('pointerdown', e => {
  if (openPop && !openPop.pop.contains(e.target) && !openPop.btn.contains(e.target)) closePopover();
});
document.addEventListener('focusout', e => {
  if (!openPop || !e.relatedTarget) return;
  if (!openPop.pop.contains(e.relatedTarget) && e.relatedTarget !== openPop.btn) closePopover();
});

for (const id of ['task-filter-btn', 'time-filter-btn']) {
  $(`#${id}`).addEventListener('click', e => {
    const btn = e.currentTarget;
    if (openPop?.btn === btn) closePopover();
    else openPopover(btn);
  });
}

/* ---------- Tooltips (hover and keyboard focus) ---------- */

const tipEl = $('#tooltip');
let tipFor = null;
let tipTimer = 0;

function showTip(el) {
  tipFor = el;
  const kbd = el.dataset.kbd;
  tipEl.innerHTML = `<span>${esc(el.dataset.tip)}</span>${kbd ? `<kbd>${esc(kbd)}</kbd>` : ''}`;
  tipEl.hidden = false;
  const r = el.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.left + r.width / 2 - t.width / 2, innerWidth - t.width - 8));
  let top = r.bottom + 8;
  if (top + t.height > innerHeight - 8) top = r.top - t.height - 8;
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${top}px`;
  el.setAttribute('aria-describedby', 'tooltip');
  tipEl.getBoundingClientRect();
  tipEl.dataset.open = 'true';
}

function hideTip() {
  clearTimeout(tipTimer);
  if (!tipFor) return;
  tipFor.removeAttribute('aria-describedby');
  tipFor = null;
  tipEl.dataset.open = 'false';
  tipEl.hidden = true;
}

document.addEventListener('mouseover', e => {
  const el = e.target.closest?.('[data-tip]');
  if (el === tipFor) return;
  hideTip();
  if (el) tipTimer = setTimeout(() => showTip(el), 300);
});
document.addEventListener('focusin', e => {
  const el = e.target.closest?.('[data-tip]');
  hideTip();
  if (el && el.matches(':focus-visible')) showTip(el);
});
document.addEventListener('focusout', hideTip);
addEventListener('scroll', hideTip, { passive: true, capture: true });

/* ---------- Toasts ---------- */

function toast(message, { action } = {}) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  const p = document.createElement('p');
  p.textContent = message;
  el.append(p);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-action';
    b.textContent = action.label;
    b.addEventListener('click', () => { remove(); action.run(); });
    el.append(b);
  }
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'icon-btn';
  x.setAttribute('aria-label', 'Dismiss message');
  x.dataset.tip = 'Dismiss message';
  x.innerHTML = icon('x');
  x.addEventListener('click', remove);
  el.append(x);
  box.append(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  const timer = setTimeout(remove, action ? 8000 : 5000);
  function remove() {
    clearTimeout(timer);
    if (el.contains(document.activeElement)) focusPageHeading();
    el.remove();
    hideTip();
  }
}

/* ==========================================================================
   Routing: #/tasks, #/tasks/new, #/tasks/edit/<id>, #/time, #/time/new,
   #/time/edit/<id>, #/invoice, #/settings
   ========================================================================== */

const PAGES = { tasks: 'Tasks', time: 'Time log', invoice: 'Invoice', settings: 'Settings' };
let route = { page: null, mode: null, id: null };
let lastHash = null;
let drawerPushed = false;

function parseHash(hash) {
  const m = hash.match(/^#\/(tasks|time|invoice|settings)(?:\/(new|edit)(?:\/([\w-]+))?)?$/);
  return m ? { page: m[1], mode: m[2] || null, id: m[3] || null } : null;
}

function navigate(path, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState'](null, '', `#/${path}`);
  handleLocation();
}

function openDrawerRoute(path) {
  navigate(path);
  drawerPushed = true;
}

function leaveDrawer() {
  if (drawerPushed) {
    drawerPushed = false;
    history.back();
  } else {
    navigate(route.page, { replace: true });
  }
}

function handleLocation() {
  if (location.hash.startsWith('#add=')) { importFromLink(); return; }
  if (location.hash === lastHash) return;
  const r = parseHash(location.hash);
  if (!r) {
    history.replaceState(null, '', '#/tasks');
    handleLocation();
    return;
  }
  lastHash = location.hash;
  const prevPage = route.page;
  route = r;
  if (r.page !== prevPage) showPage(r.page, prevPage !== null);
  syncDrawers();
}

function syncDrawers() {
  const want = route.mode && (route.page === 'tasks' ? 'task' : route.page === 'time' ? 'entry' : null);
  if (want === 'task') openTaskDrawer(route.mode, route.id);
  else if (want === 'entry') openEntryDrawer(route.mode, route.id);
  else {
    if (overlay?.kind === 'task' || overlay?.kind === 'entry') {
      drawerPushed = false;
      closeOverlay();
    }
    if (route.mode) {
      history.replaceState(null, '', `#/${route.page}`);
      lastHash = location.hash;
    }
  }
}

function showPage(page, userNav) {
  for (const p of Object.keys(PAGES)) $(`#page-${p}`).hidden = p !== page;
  for (const a of $$('.nav-link')) {
    if (a.dataset.route === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (overlay?.kind === 'nav') closeOverlay({ restoreFocus: false });
  closePopover();
  if (page === 'settings') renderSettings();
  else refreshPage();
  updateTitle();
  if (userNav) {
    scrollTo(0, 0);
    focusPageHeading();
  }
}

function focusPageHeading() {
  $(`#h-${route.page}`)?.focus({ preventScroll: true });
}

function updateTitle() {
  if (state.active) return; // the running timer owns the title
  document.title = `${PAGES[route.page] || 'Tasks'} · Workload`;
}

/** Re-renders the visible page from state. Settings forms are left alone so unsaved edits survive. */
function refreshPage() {
  renderNav();
  if (route.page === 'tasks') renderTasks();
  else if (route.page === 'time') renderTime();
  else if (route.page === 'invoice') renderInvoice();
  else if (route.page === 'settings') renderNotifStatus();
}

/** Re-render while keeping keyboard focus on the same control in the same row. */
function refreshKeepingFocus() {
  const a = document.activeElement;
  const row = a?.closest?.('tr[data-id]');
  const act = a?.dataset?.act;
  refreshPage();
  if (!row) return;
  const id = CSS.escape(row.dataset.id);
  ($(`tr[data-id="${id}"] [data-act="${act}"]`) || $(`tr[data-id="${id}"] .row-title`))?.focus({ preventScroll: true });
}

function renderNav() {
  const n = state.tasks.filter(VIEWS.today).length;
  $('#nav-today').innerHTML = n ? `${n}<span class="sr-only"> for today</span>` : '';
}

/* ==========================================================================
   Global controls
   ========================================================================== */

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('tbody')) return; // table rows handle their own actions
  switch (el.dataset.act) {
    case 'skip': e.preventDefault(); focusPageHeading(); break;
    case 'new-task': openDrawerRoute('tasks/new'); break;
    case 'new-entry': startNewEntry(); break;
    case 'close-drawer': leaveDrawer(); break;
    case 'stop-timer': stopTimer(); break;
    case 'open-nav': openNav(); break;
    case 'close-nav': closeOverlay(); break;
    case 'close-popover': closePopover(true); break;
    case 'clear-task-filters': clearTaskFilters(); break;
    case 'clear-time-filters': clearTimeFilters(); break;
    case 'set-view': setView(el.dataset.view); break;
    case 'export-csv': exportCsv(); break;
    case 'mark-invoiced': markInvoiced(); break;
    case 'print-invoice': printInvoice(); break;
    case 'reset-invoice': resetInvoiceForm(); break;
    case 'export-backup': exportBackup(); break;
    case 'restore-backup': $('#restore-file').click(); break;
    case 'discard-task-draft': discardTaskDraft(); break;
    case 'discard-entry-draft': discardEntryDraft(); break;
    case 'delete-task': deleteTaskFlow(taskForm.dataset.id, true); break;
    case 'delete-entry': deleteEntryFlow(entryForm.dataset.id, true); break;
    case 'add-to-calendar': addToCalendar(); break;
    default: break;
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideTip();
    if (overlay) { e.preventDefault(); dismissOverlay(); return; }
    if (openPop) { e.preventDefault(); closePopover(true); return; }
  }
  if (e.key === 'Tab' && overlay) trapTab(e, overlay.el);
  if (e.key === '/' && !overlay && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
    const search = $(`#page-${route.page} [data-search]`);
    if (search) { e.preventDefault(); search.focus(); }
  }
});

function isTyping(el) {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

// Open the browser's picker when clicking anywhere in a date or time field, not only on its small icon.
document.addEventListener('click', e => {
  const el = e.target;
  if (el.matches?.('input[type=date], input[type=time], input[type=datetime-local]')) {
    try { el.showPicker?.(); } catch { /* not allowed in some browsers; the field still works */ }
  }
});

function renderChips(box, chips, clearAct) {
  box.hidden = !chips.length;
  box.innerHTML = chips.map(c =>
    `<button type="button" class="chip" data-chip="${esc(c.key)}" aria-label="Remove filter: ${esc(c.label)}">${esc(c.label)}${icon('x')}</button>`,
  ).join('') + (chips.length ? `<button type="button" class="link-btn" data-act="${clearAct}">Clear all filters</button>` : '');
}

function pagerHtml({ total, page, pages, start, shown, noun, note = '' }) {
  const range = total ? `${start + 1}–${start + shown} of ${total}` : '0';
  return `<p class="pager-info"><span>Showing ${range} ${noun}</span>${note}</p>
    <div class="pager-btns">
      <button type="button" class="btn btn-sm" data-page="prev" ${page <= 1 ? 'disabled' : ''}>${icon('chevron-left')}Previous</button>
      <button type="button" class="btn btn-sm" data-page="next" ${page >= pages ? 'disabled' : ''}>Next${icon('chevron-right')}</button>
    </div>`;
}

const PAGE_SIZE = 25;

/* ==========================================================================
   Tasks page — List / Index
   ========================================================================== */

const taskState = { q: '', priorities: new Set(), client: '', billing: 'any', page: 1 };

function taskFiltersActive() {
  return taskState.priorities.size > 0 || !!taskState.client || taskState.billing !== 'any';
}

function taskComparator() {
  const { key, dir } = ui.sort;
  if (key === 'suggested') return ui.view === 'done' ? (a, b) => (b.doneAt || 0) - (a.doneAt || 0) : byScore;
  const value = {
    title: t => t.title.toLowerCase(),
    priority: t => -PRIORITY_WEIGHT[t.priority],
    due: t => (t.due ? `${t.due} ${t.dueTime || '99'}` : '9999'),
    client: t => (t.client || '\uffff').toLowerCase(),
    time: t => trackedMs(t.id),
  }[key];
  return (a, b) => {
    const x = value(a), y = value(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir || byScore(a, b);
  };
}

function filteredTasks() {
  const q = taskState.q.trim().toLowerCase();
  return state.tasks.filter(t =>
    VIEWS[ui.view](t)
    && (!q || `${t.title} ${t.notes || ''} ${t.client || ''}`.toLowerCase().includes(q))
    && (!taskState.priorities.size || taskState.priorities.has(t.priority))
    && (!taskState.client || (t.client || '') === taskState.client)
    && (taskState.billing === 'any' || (taskState.billing === 'billable') === !!t.billable),
  ).sort(taskComparator());
}

function renderTasks() {
  renderNav();

  for (const tab of $$('#page-tasks .tab')) {
    const v = tab.dataset.view, selected = v === ui.view;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.querySelector('.tab-count').textContent = state.tasks.filter(VIEWS[v]).length;
  }
  $('#task-frame').setAttribute('aria-labelledby', `tab-${ui.view}`);

  for (const th of $$('#page-tasks thead th')) {
    const b = th.querySelector('.sort');
    if (b && b.dataset.sort === ui.sort.key) th.setAttribute('aria-sort', ui.sort.dir > 0 ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
  }

  // Filter panel and chips
  const opts = clientOptions(taskState.client, 'Any client');
  const sel = $('#tf-filter-client');
  sel.innerHTML = opts.html;
  sel.value = taskState.client = opts.value;
  for (const cb of $$('#task-filters input[name="priority"]')) cb.checked = taskState.priorities.has(cb.value);
  for (const r of $$('#task-filters input[name="billing"]')) r.checked = r.value === taskState.billing;
  const chips = [];
  for (const p of ['high', 'medium', 'low']) if (taskState.priorities.has(p)) chips.push({ key: `priority:${p}`, label: `Priority: ${cap(p)}` });
  if (taskState.client) chips.push({ key: 'client', label: `Client: ${taskState.client}` });
  if (taskState.billing !== 'any') chips.push({ key: 'billing', label: taskState.billing === 'billable' ? 'Billable only' : 'Not billable' });
  renderChips($('#task-chips'), chips, 'clear-task-filters');
  $('#task-filter-count').textContent = chips.length ? ` ${chips.length}` : '';

  // Rows
  const list = filteredTasks();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  taskState.page = Math.min(taskState.page, pages);
  const start = (taskState.page - 1) * PAGE_SIZE;
  const slice = list.slice(start, start + PAGE_SIZE);
  const nextId = suggestedNextId();
  $('#task-rows').innerHTML = slice.map(t => taskRow(t, t.id === nextId)).join('');

  const empty = $('#task-empty');
  empty.hidden = list.length > 0;
  if (!list.length) empty.innerHTML = taskEmptyHtml();

  const sortNote = ui.sort.key === 'suggested'
    ? `<span>· ${ui.view === 'done' ? 'Newest first' : 'In suggested order'}</span>`
    : `<span>· Sorted by ${esc($(`#page-tasks .sort[data-sort="${ui.sort.key}"]`).textContent.toLowerCase())}</span><button type="button" class="link-btn" data-sort-reset>Use suggested order</button>`;
  $('#task-pager').innerHTML = pagerHtml({ total: list.length, page: taskState.page, pages, start, shown: slice.length, noun: list.length === 1 ? 'task' : 'tasks', note: sortNote });
}

function taskRow(t, isNext) {
  const running = state.active?.taskId === t.id;
  const done = t.status === 'done';
  const due = dueInfo(t);
  const time = timeText(t);
  const ms = trackedMs(t.id);
  const over = t.estimateMin && ms > t.estimateMin * 60000;
  const firstNote = (t.notes || '').split('\n').find(Boolean) || '';
  const sub = [
    isNext && !done && !running ? '<span class="next-tag">Up next</span>' : '',
    running ? '<span class="next-tag">Timer running</span>' : '',
    esc(firstNote),
  ].filter(Boolean).join(' · ');
  const meta = [
    `<span><span class="prio prio-${t.priority}">${cap(t.priority)}</span></span>`,
    `<span class="due due-${due.tone}">${esc(due.text)}</span>`,
    t.client ? `<span>${esc(t.client)}</span>` : '',
    time ? `<span class="${over ? 'is-over' : ''}">${esc(time)}</span>` : '',
  ].filter(Boolean).join('');
  const timerLabel = running ? 'Stop timer' : 'Start timer';

  return `<tr class="row${done ? ' is-done' : ''}${running ? ' is-running' : ''}" data-id="${esc(t.id)}">
    <td class="col-check"><label class="check-hit"><input type="checkbox" data-act="done" ${done ? 'checked' : ''} aria-label="${done ? 'Mark as not done' : 'Mark as done'}: ${esc(t.title)}"></label></td>
    <td class="col-title">
      <button type="button" class="row-title" data-act="open">${esc(t.title)}</button>
      ${sub ? `<span class="row-sub">${sub}</span>` : ''}
      <span class="row-meta">${meta}</span>
    </td>
    <td class="col-priority"><span class="prio prio-${t.priority}">${cap(t.priority)}</span></td>
    <td class="col-due"><span class="due due-${due.tone}">${esc(due.text)}</span></td>
    <td class="col-client">${t.client ? esc(t.client) : none()}</td>
    <td class="col-time num${over ? ' is-over' : ''}" data-tracked="${esc(t.id)}">${time ? esc(time) : none()}</td>
    <td class="col-actions">${done ? '' : `<button type="button" class="icon-btn${running ? ' is-active' : ''}" data-act="timer" aria-label="${timerLabel}: ${esc(t.title)}" data-tip="${timerLabel}">${icon(running ? 'stop' : 'play')}</button>`}<span class="chev">${icon('chevron-right')}</span></td>
  </tr>`;
}

function taskEmptyHtml() {
  const newBtn = `<button type="button" class="btn btn-primary" data-act="new-task">${icon('plus')}New task</button>`;
  if (!state.tasks.length) {
    return `<h2>No tasks yet</h2>
      <p>Add what you need to do today or this week, and the list puts it in order for you.</p>
      <div class="empty-actions">${newBtn}</div>`;
  }
  if (taskState.q.trim() || taskFiltersActive()) {
    return `<h2>No tasks match your search or filters</h2>
      <p>Try a different search, or clear the filters to see every task in ${esc(VIEW_LABELS[ui.view])}.</p>
      <div class="empty-actions"><button type="button" class="btn" data-act="clear-task-filters">Clear all filters</button>${newBtn}</div>`;
  }
  const allBtn = '<button type="button" class="btn" data-act="set-view" data-view="all">View all open tasks</button>';
  const copy = {
    today: ['Nothing due today', 'Overdue tasks, tasks due today and high-priority tasks without a date show up here.', allBtn + newBtn],
    week: ['Nothing due in the next 7 days', 'Give a task a due date and it shows up here when the date is close.', allBtn + newBtn],
    all: ['Every task is done', 'Add the next thing you need to do.', newBtn],
    done: ['No finished tasks yet', 'Tick a task when it is done and it moves here.', allBtn],
  }[ui.view];
  return `<h2>${copy[0]}</h2><p>${copy[1]}</p><div class="empty-actions">${copy[2]}</div>`;
}

function setView(view, focusTab = false) {
  ui.view = view;
  taskState.page = 1;
  saveUi();
  if (route.page !== 'tasks') navigate('tasks');
  renderTasks();
  if (focusTab) $(`#tab-${view}`).focus();
}

function clearTaskFilters() {
  taskState.priorities.clear();
  taskState.client = '';
  taskState.billing = 'any';
  taskState.q = '';
  taskState.page = 1;
  $('#task-q').value = '';
  renderTasks();
  closePopover();
  $('#task-q').focus();
}

$('#page-tasks .tabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (tab) setView(tab.dataset.view);
});

$('#page-tasks .tabs').addEventListener('keydown', e => {
  const order = Object.keys(VIEWS);
  let i = order.indexOf(ui.view);
  if (e.key === 'ArrowRight') i = (i + 1) % order.length;
  else if (e.key === 'ArrowLeft') i = (i - 1 + order.length) % order.length;
  else if (e.key === 'Home') i = 0;
  else if (e.key === 'End') i = order.length - 1;
  else return;
  e.preventDefault();
  setView(order[i], true);
});

$('#task-q').addEventListener('input', e => {
  taskState.q = e.target.value;
  taskState.page = 1;
  renderTasks();
});

$('#task-filters').addEventListener('change', e => {
  const el = e.target;
  if (el.name === 'priority') el.checked ? taskState.priorities.add(el.value) : taskState.priorities.delete(el.value);
  if (el.name === 'client') taskState.client = el.value;
  if (el.name === 'billing') taskState.billing = el.value;
  taskState.page = 1;
  renderTasks();
});

$('#task-chips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const [kind, value] = chip.dataset.chip.split(':');
  if (kind === 'priority') taskState.priorities.delete(value);
  if (kind === 'client') taskState.client = '';
  if (kind === 'billing') taskState.billing = 'any';
  renderTasks();
  ($('#task-chips .chip') || $('#task-filter-btn')).focus();
});

$('#page-tasks thead').addEventListener('click', e => {
  const b = e.target.closest('.sort');
  if (!b) return;
  const key = b.dataset.sort;
  ui.sort = ui.sort.key === key ? { key, dir: -ui.sort.dir } : { key, dir: 1 };
  saveUi();
  renderTasks();
  $(`#page-tasks .sort[data-sort="${key}"]`).focus();
});

$('#task-pager').addEventListener('click', e => {
  if (e.target.closest('[data-sort-reset]')) {
    ui.sort = { key: 'suggested', dir: 1 };
    saveUi();
    renderTasks();
    ($('#task-pager .pager-btns .btn:not(:disabled)') || $('#h-tasks')).focus();
    return;
  }
  const b = e.target.closest('[data-page]');
  if (!b) return;
  taskState.page += b.dataset.page === 'next' ? 1 : -1;
  renderTasks();
  $('#task-frame').scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
});

$('#task-rows').addEventListener('change', e => {
  if (e.target.dataset.act !== 'done') return;
  toggleDone(e.target.closest('tr').dataset.id);
});

$('#task-rows').addEventListener('click', e => {
  const row = e.target.closest('tr.row');
  if (!row || e.target.closest('.col-check')) return;
  const id = row.dataset.id;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'timer') {
    if (state.active?.taskId === id) stopTimer();
    else startTimer(id);
    return;
  }
  row.querySelector('.row-title').focus({ preventScroll: true }); // focus returns here when the panel closes
  openDrawerRoute(`tasks/edit/${id}`);
});

function setDone(id, done) {
  const t = taskById(id);
  if (!t) return;
  if (done) {
    if (state.active?.taskId === id) stopTimer(true);
    t.status = 'done';
    t.doneAt = Date.now();
  } else {
    t.status = 'todo';
    t.doneAt = null;
  }
  save();
}

function toggleDone(id) {
  const t = taskById(id);
  if (!t) return;
  const nowDone = t.status !== 'done';
  setDone(id, nowDone);
  refreshKeepingFocus();
  const stillHere = $(`#task-rows tr[data-id="${CSS.escape(id)}"] [data-act="done"]`);
  if (!stillHere && document.activeElement === document.body) ($('#task-rows [data-act="done"]') || $('#h-tasks')).focus();
  toast(nowDone ? `Marked "${t.title}" as done.` : `Moved "${t.title}" back to open tasks.`, {
    action: { label: 'Undo', run: () => { setDone(id, !nowDone); refreshPage(); } },
  });
}

/* ---------- Task slide-over ---------- */

const taskForm = $('#task-form');
const taskDrawer = $('#task-drawer');
const titleInput = $('#tf-title');
let taskDraftTimer = 0;

function openTaskDrawer(mode, id) {
  const key = `${mode}:${id || ''}`;
  if (overlay?.kind === 'task' && overlay.key === key) return;
  let t = null;
  if (mode === 'edit') {
    t = taskById(id);
    if (!t) {
      toast("That task isn't in your list any more.");
      navigate('tasks', { replace: true });
      return;
    }
  }
  fillTaskForm(t);
  openOverlay({
    kind: 'task', key, el: taskDrawer, show: panelShow(taskDrawer), hide: panelHide(taskDrawer),
    onEscape: leaveDrawer, initialFocus: () => titleInput,
  });
}

function setTaskFormValues(v) {
  const f = taskForm.elements;
  f.title.value = v.title || '';
  for (const r of $$('input[name="priority"]', taskForm)) r.checked = r.value === (v.priority || 'medium');
  f.due.value = v.due || '';
  f.dueTime.value = v.dueTime || '';
  f.remindAt.value = v.remindAt || '';
  f.client.value = v.client || '';
  f.estimateMin.value = v.estimateMin ?? '';
  f.billable.checked = !!v.billable;
  f.notes.value = v.notes || '';
}

function readTaskForm() {
  const f = taskForm.elements;
  return {
    title: f.title.value.trim(),
    priority: $('input[name="priority"]:checked', taskForm)?.value || 'medium',
    due: f.due.value,
    dueTime: f.dueTime.value,
    remindAt: f.remindAt.value,
    client: f.client.value.trim(),
    estimateMin: f.estimateMin.value ? Number(f.estimateMin.value) : null,
    billable: f.billable.checked,
    notes: f.notes.value.trim(),
  };
}

function fillTaskForm(t) {
  taskForm.reset();
  clearFieldError(titleInput);
  taskForm.dataset.mode = t ? 'edit' : 'new';
  taskForm.dataset.id = t?.id || '';
  $('#task-drawer-title').textContent = t ? 'Edit task' : 'New task';
  $('#task-save').textContent = t ? 'Save changes' : 'Create task';
  $('#task-delete').hidden = !t;
  $('#task-extra').hidden = !t;
  $('#task-draft-note').hidden = true;
  $('#client-list').innerHTML = clients().map(c => `<option value="${esc(c)}"></option>`).join('');

  if (t) {
    setTaskFormValues(t);
    const ms = trackedMs(t.id);
    const est = t.estimateMin ? t.estimateMin * 60000 : 0;
    $('#task-tracked').textContent = ms || est
      ? `Time tracked: ${fmtDuration(ms)}${est ? ` of ${fmtDuration(est)} estimated` : ''}.`
      : 'No time tracked yet. Start the timer from the task list.';
    return;
  }
  const draft = readJson(DRAFT_KEYS.task);
  if (draft?.data) {
    setTaskFormValues(draft.data);
    $('#task-draft-text').textContent = `Draft restored from ${new Date(draft.updatedAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.`;
    $('#task-draft-note').hidden = false;
  } else {
    setTaskFormValues({ priority: ui.lastPriority, due: ui.view === 'today' ? dateStr() : '', client: ui.lastClient, billable: ui.lastBillable });
  }
}

function saveTaskDraft() {
  if (taskForm.dataset.mode !== 'new') return;
  clearTimeout(taskDraftTimer);
  taskDraftTimer = setTimeout(() => {
    const data = readTaskForm();
    writeJson(DRAFT_KEYS.task, data.title || data.notes ? { data, updatedAt: Date.now() } : null);
  }, 500);
}

function discardTaskDraft() {
  writeJson(DRAFT_KEYS.task, null);
  clearTimeout(taskDraftTimer);
  fillTaskForm(null);
  titleInput.focus();
}

taskForm.addEventListener('input', saveTaskDraft);

function fieldMsg(input) {
  return $(`#${input.getAttribute('aria-describedby')?.split(' ')[0]}`);
}

function setFieldError(input, message) {
  input.setAttribute('aria-invalid', 'true');
  const m = fieldMsg(input);
  if (!m) return;
  if (!m.classList.contains('is-error')) m.dataset.hint = m.textContent;
  m.textContent = message;
  m.classList.add('is-error');
}

function clearFieldError(input) {
  input.removeAttribute('aria-invalid');
  const m = fieldMsg(input);
  if (m?.classList.contains('is-error')) {
    m.textContent = m.dataset.hint || '';
    m.classList.remove('is-error');
  }
}

const TITLE_ERROR = 'Enter a name for the task, like "Send the Ghana invoice".';
titleInput.addEventListener('blur', () => {
  if (overlay?.kind === 'task' && !titleInput.value.trim()) setFieldError(titleInput, TITLE_ERROR);
});
titleInput.addEventListener('focus', () => clearFieldError(titleInput));
titleInput.addEventListener('input', () => clearFieldError(titleInput));

taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const data = readTaskForm();
  if (!data.title) {
    titleInput.focus();
    setFieldError(titleInput, TITLE_ERROR);
    return;
  }

  if (taskForm.dataset.mode === 'edit') {
    const t = taskById(taskForm.dataset.id);
    if (!t) { leaveDrawer(); return; }
    if (t.remindAt !== data.remindAt) t.reminded = false;
    Object.assign(t, data);
    save();
    toast('Changes saved.');
  } else {
    const t = { id: uid(), status: 'todo', createdAt: Date.now(), reminded: false, ...data };
    state.tasks.push(t);
    save();
    clearTimeout(taskDraftTimer);
    writeJson(DRAFT_KEYS.task, null);
    Object.assign(ui, { lastPriority: data.priority, lastClient: data.client, lastBillable: data.billable });
    saveUi();
    if (VIEWS[ui.view](t)) {
      toast('Task added.');
    } else {
      const where = VIEWS.today(t) ? 'today' : VIEWS.week(t) ? 'week' : 'all';
      toast(`Task added to ${VIEW_LABELS[where]}.`, { action: { label: `View ${VIEW_LABELS[where].toLowerCase()}`, run: () => setView(where) } });
    }
  }
  leaveDrawer();
  refreshPage();
});

function nextWeekday(target) { // 0 = Sunday … 6 = Saturday; today counts if it matches
  const d = parseDate(dateStr());
  d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7));
  return dateStr(d);
}

function localDateTime(d) {
  return `${dateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

$$('.quick', taskForm).forEach(group => group.addEventListener('click', e => {
  const v = e.target.closest('[data-v]')?.dataset.v;
  if (!v) return;
  const f = taskForm.elements;

  if (group.dataset.quick === 'due') {
    const monday = nextWeekday(1);
    const map = {
      today: dateStr(),
      tomorrow: addDays(dateStr(), 1),
      friday: nextWeekday(5),
      nextweek: monday === dateStr() ? addDays(monday, 7) : monday,
      clear: '',
    };
    f.due.value = map[v];
    if (v === 'clear') f.dueTime.value = '';
  } else if (v === 'clear') {
    f.remindAt.value = '';
  } else {
    const d = new Date();
    if (v === '1h') d.setTime(d.getTime() + 3600000);
    if (v === 'evening') d.setHours(18, 0, 0, 0);
    if (v === 'tomorrow9') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
    if (v === 'beforedue') {
      if (!f.due.value) {
        toast('Set a due date first, then choose a reminder before it.');
        f.due.focus();
        return;
      }
      d.setTime(new Date(`${f.due.value}T${f.dueTime.value || '09:00'}`).getTime() - 3600000);
    }
    f.remindAt.value = localDateTime(d);
  }
  saveTaskDraft();
}));

async function deleteTaskFlow(id, fromDrawer) {
  const t = taskById(id);
  if (!t) return;
  const entries = state.entries.filter(e => e.taskId === id);
  const body = entries.length
    ? `This also removes its ${plural(entries.length, 'time entry', 'time entries')} (${fmtDuration(sumMs(entries))}). This can't be undone.`
    : "This can't be undone.";
  const drawerTrigger = overlay?.trigger;
  if (fromDrawer) closeOverlay({ restoreFocus: false }); // never stack the dialog on the panel
  const ok = await confirmDialog({ title: `Delete task "${t.title}"?`, body, confirmLabel: 'Delete task' });
  if (!ok) {
    if (fromDrawer) {
      openOverlay({
        kind: 'task', key: `edit:${id}`, el: taskDrawer, show: panelShow(taskDrawer), hide: panelHide(taskDrawer),
        onEscape: leaveDrawer, initialFocus: () => $('#task-delete'),
      });
      overlay.trigger = drawerTrigger;
    }
    return;
  }
  if (state.active?.taskId === id) state.active = null;
  state.tasks = state.tasks.filter(x => x.id !== id);
  state.entries = state.entries.filter(e => e.taskId !== id);
  save();
  if (fromDrawer) leaveDrawer();
  refreshPage();
  tickTimer();
  focusPageHeading();
  toast(`Deleted "${t.title}".`);
}

function addToCalendar() {
  const data = { id: taskForm.dataset.id || uid(), ...readTaskForm() };
  if (!data.due && !data.remindAt) {
    toast('Set a due date or a reminder first, so the calendar knows when to put it.');
    $('#tf-due').focus();
    return;
  }
  exportIcs(data);
}

/* ==========================================================================
   Timer
   ========================================================================== */

function startTimer(taskId) {
  if (state.active) stopTimer(true);
  state.active = { taskId, start: Date.now() };
  save();
  refreshKeepingFocus();
  tickTimer();
}

function stopTimer(silent = false) {
  if (!state.active) return;
  const { taskId, start } = state.active;
  const end = Date.now();
  state.active = null;
  // Ignore accidental clicks shorter than 5 seconds.
  if (end - start >= 5000) {
    state.entries.push({ id: uid(), taskId, start, end, note: '' });
    if (!silent) toast(`Logged ${fmtDuration(end - start)} on "${taskById(taskId)?.title ?? 'a deleted task'}".`);
  }
  save();
  if (silent) return;
  refreshKeepingFocus();
  tickTimer();
}

function tickTimer() {
  const a = state.active;
  const card = $('#timer-card'), chip = $('#timer-chip');
  if (!a) {
    card.hidden = true;
    chip.hidden = true;
    updateTitle();
    return;
  }
  const t = taskById(a.taskId);
  const elapsed = fmtStopwatch(Date.now() - a.start);
  card.hidden = false;
  chip.hidden = false;
  $('#timer-task').textContent = t?.title ?? 'Deleted task';
  $('#timer-elapsed').textContent = elapsed;
  $('#timer-chip-elapsed').textContent = elapsed;
  chip.setAttribute('aria-label', `Stop timer for ${t?.title ?? 'task'}`);
  document.title = `${elapsed} · ${t?.title ?? 'Workload'}`;
  const cell = $(`[data-tracked="${CSS.escape(a.taskId)}"]`);
  if (cell && t) cell.textContent = timeText(t);
}

/* ==========================================================================
   Reminders
   ========================================================================== */

function notify(title, body) {
  toast(`Reminder: ${title}${body ? `. ${body}` : ''}`);
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, tag: title }); } catch { /* some mobile browsers only allow service-worker notifications */ }
  }
}

function checkReminders() {
  const now = Date.now();
  let changed = false;
  for (const t of state.tasks) {
    if (t.status === 'done' || !t.remindAt || t.reminded) continue;
    if (new Date(t.remindAt).getTime() <= now) {
      notify(t.title, t.due ? `Due ${fmtDay(t.due)}${t.dueTime ? ` at ${fmtClock(t.dueTime)}` : ''}` : '');
      t.reminded = true;
      changed = true;
    }
  }
  if (changed) { save(); refreshPage(); }
}

function dailyBriefing() {
  const today = dateStr();
  const open = state.tasks.filter(t => t.status !== 'done');
  const overdue = open.filter(t => t.due && t.due < today).length;
  const dueToday = open.filter(t => t.due === today).length;
  if (!overdue && !dueToday) return;
  const parts = [];
  if (dueToday) parts.push(`${dueToday} due today`);
  if (overdue) parts.push(`${overdue} overdue`);
  toast(`You have ${parts.join(' and ')}.`, ui.view === 'today' && route.page === 'tasks'
    ? {}
    : { action: { label: 'View today', run: () => setView('today') } });
}

function renderNotifStatus() {
  const status = $('#notif-status');
  const btn = $('#notif-enable');
  if (!('Notification' in window)) {
    status.textContent = "Not available in this browser. Reminders still pop up inside the app.";
    btn.hidden = true;
    return;
  }
  const p = Notification.permission;
  status.textContent = p === 'granted'
    ? 'On'
    : p === 'denied'
      ? 'Blocked by your browser. Allow notifications for this site in the browser settings.'
      : 'Off';
  btn.hidden = p !== 'default';
}

$('#notif-enable').addEventListener('click', async () => {
  await Notification.requestPermission();
  renderNotifStatus();
  if (Notification.permission === 'granted') notify('Notifications are on', 'Reminders will appear here.');
});

/* ==========================================================================
   Calendar (.ics) export
   ========================================================================== */

function icsDate(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function icsText(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function exportIcs(t) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Workload Tracker//EN', 'BEGIN:VEVENT',
    `UID:${t.id}@workload-tracker`, `DTSTAMP:${icsDate(new Date())}`, `SUMMARY:${icsText(t.title || 'Task')}`];
  if (t.notes) lines.push(`DESCRIPTION:${icsText(t.notes)}`);

  let start;
  if (t.due && t.dueTime) start = new Date(`${t.due}T${t.dueTime}`);
  else if (t.remindAt) start = new Date(t.remindAt);

  if (start) {
    lines.push(`DTSTART:${icsDate(start)}`, `DTEND:${icsDate(new Date(start.getTime() + (t.estimateMin || 30) * 60000))}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${t.due.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(t.due, 1).replace(/-/g, '')}`);
  }

  // Alarm at the reminder time if set, otherwise at the start (9:00 for all-day tasks).
  const trigger = t.remindAt
    ? `TRIGGER;VALUE=DATE-TIME:${icsDate(new Date(t.remindAt))}`
    : start ? 'TRIGGER:PT0M' : 'TRIGGER:PT9H';
  lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(t.title)}`, trigger, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');

  const slug = (t.title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'task';
  download(`${slug}.ics`, lines.join('\r\n'), 'text/calendar');
  toast('Calendar file downloaded. Open it to add the task and its alarm to your calendar.');
}

/* ==========================================================================
   Time log page — List / Index
   ========================================================================== */

const timeState = { q: '', client: '', status: 'any', from: '', to: '', page: 1 };

function timeFiltersActive() {
  return !!(timeState.client || timeState.from || timeState.to) || timeState.status !== 'any';
}

function filteredEntries() {
  const q = timeState.q.trim().toLowerCase();
  const from = timeState.from ? parseDate(timeState.from).getTime() : -Infinity;
  const to = timeState.to ? parseDate(addDays(timeState.to, 1)).getTime() : Infinity;
  return state.entries.filter(e => {
    const t = taskById(e.taskId);
    if (e.start < from || e.start >= to) return false;
    if (timeState.client && (t?.client || '') !== timeState.client) return false;
    if (timeState.status === 'open' && e.invoiceNo) return false;
    if (timeState.status === 'invoiced' && !e.invoiceNo) return false;
    if (q && !`${t?.title || ''} ${t?.client || ''} ${e.note || ''}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => b.start - a.start);
}

function weekStart() {
  const d = parseDate(dateStr());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
}

function renderTime() {
  renderNav();

  const todayStart = parseDate(dateStr()).getTime();
  const unbilled = state.entries.filter(e => !e.invoiceNo && taskById(e.taskId)?.billable);
  $('#time-desc').textContent = state.entries.length
    ? `${fmtDuration(sumMs(state.entries.filter(e => e.start >= todayStart)))} today · ${fmtDuration(sumMs(state.entries.filter(e => e.start >= weekStart())))} this week · ${fmtDuration(sumMs(unbilled))} of billable time not yet invoiced.`
    : 'Every timer you stop, and any time you add by hand, shows up here.';

  // Filter panel and chips
  const opts = clientOptions(timeState.client, 'Any client');
  const sel = $('#time-filter-client');
  sel.innerHTML = opts.html;
  sel.value = timeState.client = opts.value;
  $('#time-from').value = timeState.from;
  $('#time-to').value = timeState.to;
  for (const r of $$('#time-filters input[name="status"]')) r.checked = r.value === timeState.status;
  const chips = [];
  if (timeState.from || timeState.to) {
    chips.push({ key: 'dates', label: `Dates: ${timeState.from ? fmtDayShort(timeState.from) : 'start'} to ${timeState.to ? fmtDayShort(timeState.to) : 'today'}` });
  }
  if (timeState.client) chips.push({ key: 'client', label: `Client: ${timeState.client}` });
  if (timeState.status !== 'any') chips.push({ key: 'status', label: timeState.status === 'open' ? 'Not invoiced' : 'Invoiced' });
  renderChips($('#time-chips'), chips, 'clear-time-filters');
  $('#time-filter-count').textContent = chips.length ? ` ${chips.length}` : '';

  // Rows, grouped by day
  const list = filteredEntries();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  timeState.page = Math.min(timeState.page, pages);
  const start = (timeState.page - 1) * PAGE_SIZE;
  const slice = list.slice(start, start + PAGE_SIZE);
  const dayTotals = {};
  for (const e of list) {
    const day = dateStr(new Date(e.start));
    dayTotals[day] = (dayTotals[day] || 0) + (e.end - e.start);
  }
  let lastDay = null;
  let html = '';
  for (const e of slice) {
    const day = dateStr(new Date(e.start));
    if (day !== lastDay) {
      html += `<tr class="group"><th scope="colgroup" colspan="6"><span class="group-line"><span>${esc(fmtDayHeading(day))}</span><span class="group-total">${fmtDuration(dayTotals[day])}</span></span></th></tr>`;
      lastDay = day;
    }
    html += entryRow(e);
  }
  $('#time-rows').innerHTML = html;

  const empty = $('#time-empty');
  empty.hidden = list.length > 0;
  if (!list.length) empty.innerHTML = timeEmptyHtml();

  $('#time-pager').innerHTML = pagerHtml({ total: list.length, page: timeState.page, pages, start, shown: slice.length, noun: list.length === 1 ? 'entry' : 'entries', note: '<span>· Newest first</span>' });
}

function entryRow(e) {
  const t = taskById(e.taskId);
  const span = e.manual ? 'Added by hand' : `${fmtTime(e.start)}–${fmtTime(e.end)}`;
  const meta = [t?.client, span, e.invoiceNo ? `Invoice #${e.invoiceNo}` : ''].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('');
  return `<tr class="row" data-id="${esc(e.id)}">
    <td class="col-title">
      <button type="button" class="row-title" data-act="open">${esc(t?.title ?? 'Deleted task')}</button>
      ${e.note ? `<span class="row-sub">${esc(e.note)}</span>` : ''}
      <span class="row-meta">${meta}</span>
    </td>
    <td class="col-client">${t?.client ? esc(t.client) : none()}</td>
    <td class="col-span">${esc(span)}</td>
    <td class="col-dur num">${fmtDuration(e.end - e.start)}</td>
    <td class="col-inv">${e.invoiceNo ? `#${esc(e.invoiceNo)}` : none()}</td>
    <td class="col-actions"><span class="chev">${icon('chevron-right')}</span></td>
  </tr>`;
}

function timeEmptyHtml() {
  const addBtn = `<button type="button" class="btn btn-primary" data-act="new-entry">${icon('plus')}Add time</button>`;
  if (!state.entries.length) {
    return `<h2>No time logged yet</h2>
      <p>Start the timer on a task, or add time you've already spent, to see where your hours go.</p>
      <div class="empty-actions">${addBtn}<a class="btn" href="#/tasks">Go to tasks</a></div>`;
  }
  return `<h2>No time entries match your search or filters</h2>
    <p>Try a wider date range or a different search.</p>
    <div class="empty-actions"><button type="button" class="btn" data-act="clear-time-filters">Clear all filters</button>${addBtn}</div>`;
}

function clearTimeFilters() {
  Object.assign(timeState, { q: '', client: '', status: 'any', from: '', to: '', page: 1 });
  $('#time-q').value = '';
  renderTime();
  closePopover();
  $('#time-q').focus();
}

$('#time-q').addEventListener('input', e => {
  timeState.q = e.target.value;
  timeState.page = 1;
  renderTime();
});

$('#time-filters').addEventListener('change', e => {
  const el = e.target;
  if (el.name === 'client') timeState.client = el.value;
  if (el.name === 'status') timeState.status = el.value;
  if (el.name === 'from') timeState.from = el.value;
  if (el.name === 'to') timeState.to = el.value;
  timeState.page = 1;
  renderTime();
});

$('#time-chips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const kind = chip.dataset.chip;
  if (kind === 'dates') { timeState.from = ''; timeState.to = ''; }
  if (kind === 'client') timeState.client = '';
  if (kind === 'status') timeState.status = 'any';
  renderTime();
  ($('#time-chips .chip') || $('#time-filter-btn')).focus();
});

$('#time-pager').addEventListener('click', e => {
  const b = e.target.closest('[data-page]');
  if (!b) return;
  timeState.page += b.dataset.page === 'next' ? 1 : -1;
  renderTime();
});

$('#time-rows').addEventListener('click', e => {
  const row = e.target.closest('tr.row');
  if (!row) return;
  row.querySelector('.row-title').focus({ preventScroll: true });
  openDrawerRoute(`time/edit/${row.dataset.id}`);
});

function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // keep spreadsheets from running it as a formula
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv() {
  const list = filteredEntries();
  if (!list.length) {
    toast('There are no time entries to export. Clear the filters or add some time first.');
    return;
  }
  const rows = [['Date', 'Start', 'End', 'Hours', 'Task', 'Client', 'Billable', 'Invoice', 'Note']];
  for (const e of [...list].reverse()) {
    const t = taskById(e.taskId);
    rows.push([
      dateStr(new Date(e.start)), e.manual ? '' : fmtHM(e.start), e.manual ? '' : fmtHM(e.end),
      ((e.end - e.start) / 3600000).toFixed(2), t?.title, t?.client, t?.billable ? 'Yes' : 'No', e.invoiceNo || '', e.note || '',
    ]);
  }
  download(`time-log-${dateStr()}.csv`, rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv');
  toast(`Exported ${plural(list.length, 'time entry', 'time entries')}.`);
}

/* ---------- Time entry slide-over ---------- */

const entryForm = $('#entry-form');
const entryDrawer = $('#entry-drawer');
let entryDraftTimer = 0;

function startNewEntry() {
  if (!state.tasks.length) {
    toast('Add a task first, then log time against it.', {
      action: { label: 'Create task', run: () => { navigate('tasks'); openDrawerRoute('tasks/new'); } },
    });
    return;
  }
  openDrawerRoute('time/new');
}

function openEntryDrawer(mode, id) {
  const key = `${mode}:${id || ''}`;
  if (overlay?.kind === 'entry' && overlay.key === key) return;
  let en = null;
  if (mode === 'edit') {
    en = entryById(id);
    if (!en) {
      toast("That time entry isn't in your log any more.");
      navigate('time', { replace: true });
      return;
    }
  } else if (!state.tasks.length) {
    navigate('time', { replace: true });
    startNewEntry();
    return;
  }
  fillEntryForm(en);
  openOverlay({
    kind: 'entry', key, el: entryDrawer, show: panelShow(entryDrawer), hide: panelHide(entryDrawer),
    onEscape: leaveDrawer, initialFocus: () => $('#ef-task'),
  });
}

function fillEntryForm(en) {
  const f = entryForm.elements;
  entryForm.reset();
  clearFieldError(f.date);
  clearTimeError();
  entryForm.dataset.mode = en ? 'edit' : 'new';
  entryForm.dataset.id = en?.id || '';
  $('#entry-drawer-title').textContent = en ? 'Edit time' : 'Add time';
  $('#entry-save').textContent = en ? 'Save changes' : 'Add time';
  $('#entry-delete').hidden = !en;
  $('#entry-draft-note').hidden = true;
  $('#entry-invoiced').hidden = !en?.invoiceNo;
  if (en?.invoiceNo) $('#entry-invoiced').textContent = `This time is on invoice #${en.invoiceNo}. Changes here won't change that invoice.`;

  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const open = state.tasks.filter(t => t.status !== 'done').sort(byTitle);
  const done = state.tasks.filter(t => t.status === 'done').sort(byTitle);
  const opt = t => `<option value="${esc(t.id)}">${esc(t.title)}${t.client ? ` (${esc(t.client)})` : ''}</option>`;
  f.taskId.innerHTML = (open.length ? `<optgroup label="Open tasks">${open.map(opt).join('')}</optgroup>` : '')
    + (done.length ? `<optgroup label="Done">${done.map(opt).join('')}</optgroup>` : '');

  if (en) {
    f.taskId.value = en.taskId;
    f.date.value = dateStr(new Date(en.start));
    if (en.manual) f.minutes.value = Math.round((en.end - en.start) / 60000);
    else { f.from.value = fmtHM(en.start); f.to.value = fmtHM(en.end); }
    f.note.value = en.note || '';
    return;
  }
  const draft = readJson(DRAFT_KEYS.entry);
  const preferred = [draft?.data?.taskId, state.active?.taskId, ui.lastTaskId].find(id => id && taskById(id));
  f.taskId.value = preferred || open[0]?.id || done[0]?.id || '';
  f.date.value = dateStr();
  if (draft?.data) {
    for (const k of ['date', 'from', 'to', 'minutes', 'note']) if (draft.data[k]) f[k].value = draft.data[k];
    $('#entry-draft-text').textContent = `Draft restored from ${new Date(draft.updatedAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.`;
    $('#entry-draft-note').hidden = false;
  }
}

function discardEntryDraft() {
  writeJson(DRAFT_KEYS.entry, null);
  clearTimeout(entryDraftTimer);
  fillEntryForm(null);
  $('#ef-task').focus();
}

entryForm.addEventListener('input', e => {
  const f = entryForm.elements;
  if (['from', 'to', 'minutes'].includes(e.target.name)) clearTimeError();
  if (e.target.name === 'date') clearFieldError(f.date);
  if (entryForm.dataset.mode !== 'new') return;
  clearTimeout(entryDraftTimer);
  entryDraftTimer = setTimeout(() => {
    const data = { taskId: f.taskId.value, date: f.date.value, from: f.from.value, to: f.to.value, minutes: f.minutes.value, note: f.note.value };
    writeJson(DRAFT_KEYS.entry, data.from || data.to || data.minutes || data.note ? { data, updatedAt: Date.now() } : null);
  }, 500);
});

const TIME_HINT = 'Enter a start and end time, or just the number of minutes.';
function clearTimeError() {
  const m = $('#ef-time-msg');
  m.textContent = TIME_HINT;
  m.classList.remove('is-error');
  for (const n of ['from', 'to', 'minutes']) entryForm.elements[n].removeAttribute('aria-invalid');
}

function showTimeError(message, focusName) {
  const m = $('#ef-time-msg');
  const f = entryForm.elements;
  f[focusName].focus();
  m.textContent = message;
  m.classList.add('is-error');
  f[focusName].setAttribute('aria-invalid', 'true');
}

$('#ef-date').addEventListener('blur', e => {
  if (overlay?.kind === 'entry' && !e.target.value) setFieldError(e.target, 'Enter the date you did the work.');
});
$('#ef-date').addEventListener('focus', e => clearFieldError(e.target));

entryForm.addEventListener('submit', e => {
  e.preventDefault();
  const f = entryForm.elements;
  if (!f.date.value) {
    f.date.focus();
    setFieldError(f.date, 'Enter the date you did the work.');
    return;
  }
  let start, end, manual = false;
  if (f.from.value && f.to.value) {
    start = new Date(`${f.date.value}T${f.from.value}`).getTime();
    end = new Date(`${f.date.value}T${f.to.value}`).getTime();
    if (end <= start) end += 86400000; // e.g. 23:00 → 01:00 runs past midnight
  } else if (Number(f.minutes.value) > 0) {
    const d = parseDate(f.date.value);
    d.setHours(9, 0, 0, 0);
    start = d.getTime();
    end = start + Number(f.minutes.value) * 60000;
    manual = true;
  } else if (f.from.value || f.to.value) {
    showTimeError(`Enter the ${f.from.value ? 'end' : 'start'} time too, or use minutes instead.`, f.from.value ? 'to' : 'from');
    return;
  } else {
    showTimeError('Enter a start and end time, or the number of minutes you spent.', 'from');
    return;
  }

  const data = { taskId: f.taskId.value, start, end, note: f.note.value.trim(), manual };
  if (entryForm.dataset.mode === 'edit') {
    const en = entryById(entryForm.dataset.id);
    if (en) {
      Object.assign(en, data);
      if (!manual) delete en.manual;
    }
    toast('Changes saved.');
  } else {
    state.entries.push({ id: uid(), ...data });
    clearTimeout(entryDraftTimer);
    writeJson(DRAFT_KEYS.entry, null);
    toast(`Added ${fmtDuration(end - start)} to "${taskById(data.taskId)?.title}".`);
  }
  ui.lastTaskId = data.taskId;
  saveUi();
  save();
  leaveDrawer();
  refreshPage();
});

async function deleteEntryFlow(id, fromDrawer) {
  const en = entryById(id);
  if (!en) return;
  const t = taskById(en.taskId);
  const drawerTrigger = overlay?.trigger;
  if (fromDrawer) closeOverlay({ restoreFocus: false });
  const ok = await confirmDialog({
    title: `Delete ${fmtDuration(en.end - en.start)} logged on "${t?.title ?? 'task'}"?`,
    body: `It's removed from the time log and from the task's total.${en.invoiceNo ? ` Invoice #${en.invoiceNo} has already been made and won't change.` : ''} This can't be undone.`,
    confirmLabel: 'Delete entry',
  });
  if (!ok) {
    if (fromDrawer) {
      openOverlay({
        kind: 'entry', key: `edit:${id}`, el: entryDrawer, show: panelShow(entryDrawer), hide: panelHide(entryDrawer),
        onEscape: leaveDrawer, initialFocus: () => $('#entry-delete'),
      });
      overlay.trigger = drawerTrigger;
    }
    return;
  }
  state.entries = state.entries.filter(x => x.id !== id);
  save();
  if (fromDrawer) leaveDrawer();
  refreshPage();
  focusPageHeading();
  toast('Time entry deleted.');
}

/* ==========================================================================
   Invoice page — Reporting (report runner): parameters and result together
   ========================================================================== */

const invForm = $('#inv-form');
let invReady = false;
let currentInvoice = null;

function resetInvoiceForm() {
  invReady = false;
  invForm.elements.client.value = '';
  invForm.elements.unbilledOnly.checked = true;
  invForm.elements.billableOnly.checked = true;
  renderInvoice();
  invForm.elements.from.focus();
}

function renderInvoice() {
  renderNav();
  const f = invForm.elements;
  if (!invReady) {
    f.from.value = `${dateStr().slice(0, 8)}01`;
    f.to.value = dateStr();
    f.rate.value = state.settings.rate;
    f.tax.value = state.settings.tax;
    invReady = true;
  }
  const opts = clientOptions(f.client.value, 'All clients');
  f.client.innerHTML = opts.html;
  f.client.value = opts.value;

  const doc = $('#invoice-doc'), empty = $('#invoice-empty'), summary = $('#inv-summary');
  if (!f.from.value || !f.to.value) {
    currentInvoice = null;
    doc.hidden = true;
    empty.hidden = false;
    empty.innerHTML = '<h2>Choose the dates to invoice</h2><p>Set both a start and an end date above to build the invoice.</p>';
    summary.textContent = '';
    return;
  }

  const [fromDay, toDay] = [f.from.value, f.to.value].sort();
  const from = parseDate(fromDay).getTime();
  const to = parseDate(addDays(toDay, 1)).getTime();
  const rate = Math.max(0, Number(f.rate.value) || 0);
  const taxPct = Math.max(0, Number(f.tax.value) || 0);

  const entries = state.entries.filter(en => {
    const t = taskById(en.taskId);
    if (!t || en.start < from || en.start >= to) return false;
    if (f.client.value && t.client !== f.client.value) return false;
    if (f.unbilledOnly.checked && en.invoiceNo) return false;
    if (f.billableOnly.checked && !t.billable) return false;
    return true;
  });

  if (!entries.length) {
    currentInvoice = null;
    doc.hidden = true;
    empty.hidden = false;
    summary.textContent = 'No time matches these settings yet.';
    const anyBillable = state.entries.some(en => taskById(en.taskId)?.billable);
    empty.innerHTML = anyBillable || !f.billableOnly.checked
      ? `<h2>No time matches these settings</h2>
         <p>Widen the dates, choose All clients, or include time that's already invoiced.</p>
         <div class="empty-actions"><button type="button" class="btn" data-act="reset-invoice">Reset settings</button></div>`
      : `<h2>No billable time yet</h2>
         <p>Open a task, tick Billable, and track time on it. That time shows up here ready to invoice.</p>
         <div class="empty-actions"><a class="btn btn-primary" href="#/tasks">Go to tasks</a></div>`;
    return;
  }

  const lines = {};
  for (const en of entries) {
    const t = taskById(en.taskId);
    (lines[t.id] ??= { description: t.title, ms: 0 }).ms += en.end - en.start;
  }
  const items = Object.values(lines).map(l => {
    const hours = Math.round(l.ms / 36000) / 100; // 2 decimals
    return { ...l, hours, amount: Math.round(hours * rate * 100) / 100 };
  });
  const subtotal = items.reduce((a, i) => a + i.amount, 0);
  const tax = Math.round(subtotal * taxPct) / 100;
  const hours = items.reduce((a, i) => a + i.hours, 0);
  const s = state.settings;
  const number = String(s.nextInvoiceNo).padStart(4, '0');
  currentInvoice = { number, entryIds: entries.map(en => en.id) };
  const entryClients = [...new Set(entries.map(en => taskById(en.taskId).client).filter(Boolean))];
  const billTo = f.client.value || (entryClients.length === 1 ? entryClients[0] : '');

  summary.innerHTML = `<strong>${plural(entries.length, 'time entry', 'time entries')}</strong> · <strong>${hours.toFixed(2)}</strong> hours · Total due <strong>${esc(money(subtotal + tax))}</strong>`
    + (entryClients.length > 1 && !billTo ? `. It covers ${entryClients.length} clients, so choose one to fill in Bill to.` : '');
  empty.hidden = true;
  doc.hidden = false;
  doc.innerHTML = `
    <div class="inv-head">
      <div>
        <p class="inv-title">Invoice</p>
        <p class="inv-muted">Number ${esc(number)}
Issued ${esc(fmtDay(dateStr()))}
For work ${esc(fmtDay(fromDay))} to ${esc(fmtDay(toDay))}</p>
      </div>
      <div class="inv-from">
        <strong>${esc(s.name || 'Your name')}</strong>
        <p class="inv-muted">${esc([s.email, s.address].filter(Boolean).join('\n'))}</p>
      </div>
    </div>
    <div class="inv-billto"><span class="inv-label">Bill to</span><strong>${esc(billTo)}</strong></div>
    <table class="inv-table">
      <thead><tr><th scope="col">Description</th><th scope="col" class="num">Hours</th><th scope="col" class="num">Rate</th><th scope="col" class="num">Amount</th></tr></thead>
      <tbody>${items.map(i => `<tr><td>${esc(i.description)}</td><td class="num">${i.hours.toFixed(2)}</td><td class="num">${esc(money(rate))}</td><td class="num">${esc(money(i.amount))}</td></tr>`).join('')}</tbody>
    </table>
    <table class="inv-totals">
      <tr><td>Subtotal</td><td class="num">${esc(money(subtotal))}</td></tr>
      ${taxPct ? `<tr><td>Tax (${taxPct}%)</td><td class="num">${esc(money(tax))}</td></tr>` : ''}
      <tr class="grand"><td>Total due</td><td class="num">${esc(money(subtotal + tax))}</td></tr>
    </table>
    ${s.payment ? `<p class="inv-payment">${esc(s.payment)}</p>` : ''}`;
}

invForm.addEventListener('input', renderInvoice);
invForm.addEventListener('change', renderInvoice);
invForm.addEventListener('submit', e => e.preventDefault());

function printInvoice() {
  if (!currentInvoice) {
    toast('There is nothing to print yet. Change the dates or client to include some time.');
    return;
  }
  print();
}

function markInvoiced() {
  if (!currentInvoice) {
    toast('There is no time to mark yet. Change the dates or client to include some.');
    return;
  }
  const { number, entryIds } = currentInvoice;
  const ids = new Set(entryIds);
  const prevNext = Number(state.settings.nextInvoiceNo);
  state.entries.forEach(en => { if (ids.has(en.id)) en.invoiceNo = number; });
  state.settings.nextInvoiceNo = prevNext + 1;
  save();
  refreshPage();
  toast(`Marked ${plural(ids.size, 'time entry', 'time entries')} as invoice #${number}.`, {
    action: {
      label: 'Undo',
      run: () => {
        state.entries.forEach(en => { if (ids.has(en.id) && en.invoiceNo === number) delete en.invoiceNo; });
        if (Number(state.settings.nextInvoiceNo) === prevNext + 1) state.settings.nextInvoiceNo = prevNext;
        save();
        refreshPage();
      },
    },
  });
}

/* ==========================================================================
   Settings page — Configuration
   ========================================================================== */

const CURRENCIES = ['USD', 'EUR', 'GBP', 'GHS', 'NGN', 'KES', 'ZAR', 'INR', 'CAD', 'AUD', 'NZD', 'AED', 'JPY', 'BRL', 'MXN'];
const businessForm = $('#form-business');
const invoiceDefaultsForm = $('#form-invoice');

function currencyName(code) {
  try { return new Intl.DisplayNames([], { type: 'currency' }).of(code); } catch { return code; }
}

function renderSettings() {
  renderNav();
  const s = state.settings;
  const b = businessForm.elements, c = invoiceDefaultsForm.elements;
  b.name.value = s.name || '';
  b.email.value = s.email || '';
  b.address.value = s.address || '';
  const codes = CURRENCIES.includes(s.currency) ? CURRENCIES : [s.currency, ...CURRENCIES];
  c.currency.innerHTML = codes.map(code => `<option value="${esc(code)}">${esc(code)} · ${esc(currencyName(code))}</option>`).join('');
  c.currency.value = s.currency;
  c.rate.value = s.rate;
  c.tax.value = s.tax;
  c.nextInvoiceNo.value = s.nextInvoiceNo;
  c.payment.value = s.payment || '';
  for (const input of [b.email, c.rate, c.nextInvoiceNo]) clearFieldError(input);
  renderNotifStatus();
}

const EMAIL_ERROR = 'Enter an email like name@example.com, or leave it empty.';
const validEmail = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const RATE_ERROR = 'Enter an hourly rate of 0 or more.';
const NEXT_ERROR = 'Enter a whole number of 1 or more.';
const validRate = v => v !== '' && Number(v) >= 0;
const validNext = v => /^\d+$/.test(v) && Number(v) >= 1;

function wireValidation(input, isValid, message) {
  input.addEventListener('blur', () => { if (!isValid(input.value.trim())) setFieldError(input, message); });
  input.addEventListener('focus', () => clearFieldError(input));
  input.addEventListener('input', () => clearFieldError(input));
}
wireValidation(businessForm.elements.email, validEmail, EMAIL_ERROR);
wireValidation(invoiceDefaultsForm.elements.rate, validRate, RATE_ERROR);
wireValidation(invoiceDefaultsForm.elements.nextInvoiceNo, validNext, NEXT_ERROR);

businessForm.addEventListener('submit', e => {
  e.preventDefault();
  const b = businessForm.elements;
  if (!validEmail(b.email.value.trim())) {
    b.email.focus();
    setFieldError(b.email, EMAIL_ERROR);
    return;
  }
  Object.assign(state.settings, { name: b.name.value.trim(), email: b.email.value.trim(), address: b.address.value.trim() });
  save();
  toast('Business details saved.');
});

invoiceDefaultsForm.addEventListener('submit', e => {
  e.preventDefault();
  const c = invoiceDefaultsForm.elements;
  const checks = [[c.rate, validRate, RATE_ERROR], [c.nextInvoiceNo, validNext, NEXT_ERROR]];
  const bad = checks.find(([input, ok]) => !ok(input.value.trim()));
  if (bad) {
    bad[0].focus();
    setFieldError(bad[0], bad[2]);
    return;
  }
  Object.assign(state.settings, {
    rate: Number(c.rate.value),
    currency: c.currency.value,
    tax: Math.max(0, Number(c.tax.value) || 0),
    nextInvoiceNo: Number(c.nextInvoiceNo.value),
    payment: c.payment.value.trim(),
  });
  save();
  invReady = false; // the invoice page picks up the new defaults
  toast('Invoice defaults saved.');
});

$('.settings-nav').addEventListener('click', e => {
  const link = e.target.closest('.settings-link');
  if (!link) return;
  for (const l of $$('.settings-link')) l.removeAttribute('aria-current');
  link.setAttribute('aria-current', 'true');
  const section = $(`#${link.dataset.target}`);
  section.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  const h = section.querySelector('h2');
  h.tabIndex = -1;
  h.focus({ preventScroll: true });
});

function exportBackup() {
  download(`workload-backup-${dateStr()}.json`, JSON.stringify(state, null, 2), 'application/json');
  toast('Backup downloaded.');
}

$('#restore-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
    if (!Array.isArray(data.tasks) || !Array.isArray(data.entries)) throw new Error('not a backup');
  } catch {
    toast("This file isn't a Workload backup. Choose a .json file you downloaded from Settings.");
    return;
  }
  const ok = await confirmDialog({
    title: `Replace all data with "${file.name}"?`,
    body: `Your ${plural(state.tasks.length, 'task')} and ${plural(state.entries.length, 'time entry', 'time entries')} in this browser are replaced by the ${plural(data.tasks.length, 'task')} and ${plural(data.entries.length, 'time entry', 'time entries')} in the file. Download a backup first if you might need what's here now.`,
    confirmLabel: 'Replace all data',
  });
  if (!ok) return;
  state = { ...structuredClone(DEFAULT_STATE), ...data, settings: { ...DEFAULT_STATE.settings, ...data.settings } };
  save();
  invReady = false;
  renderSettings();
  tickTimer();
  toast('Backup restored.');
});

/* ==========================================================================
   Adding tasks from a link
   A link ending in #add=<base64url JSON array of tasks> adds those tasks to
   the existing list (it never replaces anything). Tasks whose id is already
   present are skipped, so opening the same link twice does not duplicate.
   ========================================================================== */

let importing = false;

async function importFromLink() {
  const m = location.hash.match(/^#add=(.+)$/);
  history.replaceState(null, '', '#/tasks');
  lastHash = null;
  handleLocation();
  if (!m || importing) return;
  let incoming;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    incoming = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(incoming)) throw new Error('not a list');
  } catch {
    toast('That task link is incomplete. Copy the whole link and open it again.');
    return;
  }
  const fresh = incoming.filter(t => t?.title && !taskById(t.id));
  if (!fresh.length) {
    toast('Those tasks are already in your list.');
    return;
  }
  importing = true;
  const ok = await confirmDialog({
    title: `Add ${plural(fresh.length, 'task')} to your list?`,
    body: 'Your existing tasks stay as they are.',
    confirmLabel: `Add ${plural(fresh.length, 'task')}`,
    danger: false,
  });
  importing = false;
  if (!ok) return;
  for (const t of fresh) {
    state.tasks.push({
      id: t.id || uid(), title: String(t.title), notes: t.notes || '',
      priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
      due: t.due || '', dueTime: t.dueTime || '', remindAt: t.remindAt || '',
      client: t.client || '', estimateMin: t.estimateMin ?? null, billable: !!t.billable,
      status: 'todo', createdAt: Date.now(), reminded: false,
    });
  }
  save();
  setView('all');
  toast(`Added ${plural(fresh.length, 'task')}.`);
}

/* ==========================================================================
   Boot
   ========================================================================== */

// Keep tabs in sync if the app is open in more than one window.
addEventListener('storage', e => {
  if (e.key !== STORAGE_KEY) return;
  state = load();
  refreshPage();
  tickTimer();
});

addEventListener('popstate', handleLocation);
addEventListener('hashchange', handleLocation);

handleLocation();
tickTimer();
setInterval(tickTimer, 1000);
setInterval(checkReminders, 15000);
checkReminders();
dailyBriefing();
