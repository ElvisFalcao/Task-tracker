'use strict';

/* ---------- Storage ---------- */

const STORAGE_KEY = 'workload-tracker-v1';

const DEFAULT_STATE = {
  tasks: [],
  entries: [],
  active: null, // { taskId, start }
  settings: {
    name: '', email: '', address: '', payment: '',
    rate: 50, currency: 'USD', tax: 0, nextInvoiceNo: 1,
  },
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const data = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...data, settings: { ...DEFAULT_STATE.settings, ...data.settings } };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

let state = load();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('Could not save. Your browser storage may be full or blocked.');
  }
}

/* ---------- Helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

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

function fmtDuration(ms, withSeconds = false) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  if (withSeconds) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  if (total > 0 && total < 60) return `${s}s`;
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
}

function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDay(s) {
  return parseDate(s).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function money(n) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: state.settings.currency || 'USD' }).format(n);
  } catch {
    return `${state.settings.currency || ''} ${n.toFixed(2)}`;
  }
}

function toast(msg, onClick) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  el.onclick = () => { el.remove(); onClick?.(); };
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 7000);
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

function trackedMs(taskId) {
  let ms = state.entries.filter(e => e.taskId === taskId).reduce((a, e) => a + (e.end - e.start), 0);
  if (state.active?.taskId === taskId) ms += Date.now() - state.active.start;
  return ms;
}

function clients() {
  return [...new Set(state.tasks.map(t => t.client?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/* ---------- Prioritisation ---------- */

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

/* ---------- Tabs ---------- */

$$('.tab').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

function showTab(name) {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.panel').forEach(p => { p.hidden = p.id !== `tab-${name}`; });
  if (name === 'time') renderTime();
  if (name === 'invoice') prepareInvoiceForm();
  if (name === 'settings') renderSettings();
}

/* ---------- Tasks ---------- */

let view = 'today';
let search = '';

const VIEWS = {
  today: t => t.status !== 'done' && ((t.due && t.due <= dateStr()) || (!t.due && t.priority === 'high')),
  week: t => t.status !== 'done' && t.due && t.due <= addDays(dateStr(), 6),
  all: t => t.status !== 'done',
  done: t => t.status === 'done',
};

$$('.chip[data-view]').forEach(c => c.addEventListener('click', () => {
  view = c.dataset.view;
  renderTasks();
}));

$('#search').addEventListener('input', e => { search = e.target.value.toLowerCase(); renderTasks(); });

const form = $('#task-form');

form.addEventListener('submit', e => {
  e.preventDefault();
  const f = form.elements;
  const data = {
    title: f.title.value.trim(),
    priority: f.priority.value,
    due: f.due.value,
    dueTime: f.dueTime.value,
    remindAt: f.remindAt.value,
    client: f.client.value.trim(),
    estimateMin: f.estimateMin.value ? Number(f.estimateMin.value) : null,
    billable: f.billable.checked,
    notes: f.notes.value.trim(),
  };
  if (!data.title) return;

  if (f.id.value) {
    const t = taskById(f.id.value);
    if (t.remindAt !== data.remindAt) t.reminded = false;
    Object.assign(t, data);
    toast('Task updated');
  } else {
    state.tasks.push({ id: uid(), status: 'todo', createdAt: Date.now(), reminded: false, ...data });
  }
  save();
  resetForm();
  renderTasks();
});

$('#task-cancel').addEventListener('click', resetForm);

function resetForm() {
  const keepClient = form.elements.client.value;
  const keepBillable = form.elements.billable.checked;
  form.reset();
  form.elements.id.value = '';
  // Keep client/billable between adds — usually you add several tasks for the same client.
  if (!form.dataset.editing) {
    form.elements.client.value = keepClient;
    form.elements.billable.checked = keepBillable;
  }
  delete form.dataset.editing;
  $('#task-submit').textContent = 'Add task';
  $('#task-cancel').hidden = true;
}

function editTask(id) {
  const t = taskById(id);
  const f = form.elements;
  f.id.value = t.id;
  f.title.value = t.title;
  f.priority.value = t.priority;
  f.due.value = t.due || '';
  f.dueTime.value = t.dueTime || '';
  f.remindAt.value = t.remindAt || '';
  f.client.value = t.client || '';
  f.estimateMin.value = t.estimateMin ?? '';
  f.billable.checked = !!t.billable;
  f.notes.value = t.notes || '';
  form.dataset.editing = '1';
  $('#task-submit').textContent = 'Save changes';
  $('#task-cancel').hidden = false;
  form.scrollIntoView({ behavior: 'smooth' });
  f.title.focus();
}

function toggleDone(id) {
  const t = taskById(id);
  if (t.status === 'done') {
    t.status = 'todo';
    t.doneAt = null;
  } else {
    if (state.active?.taskId === id) stopTimer();
    t.status = 'done';
    t.doneAt = Date.now();
  }
  save();
  renderTasks();
}

function deleteTask(id) {
  const t = taskById(id);
  const n = state.entries.filter(e => e.taskId === id).length;
  const msg = n ? `Delete "${t.title}" and its ${n} time entr${n === 1 ? 'y' : 'ies'}?` : `Delete "${t.title}"?`;
  if (!confirm(msg)) return;
  if (state.active?.taskId === id) state.active = null;
  state.tasks = state.tasks.filter(x => x.id !== id);
  state.entries = state.entries.filter(e => e.taskId !== id);
  save();
  renderAll();
}

function dueBadge(t) {
  if (!t.due) return '';
  const d = daysUntil(t.due);
  const time = t.dueTime ? ` ${t.dueTime}` : '';
  if (t.status !== 'done' && d < 0) return `<span class="badge overdue">Overdue · ${esc(fmtDay(t.due))}</span>`;
  if (d === 0) return `<span class="badge today">Due today${esc(time)}</span>`;
  if (d === 1) return `<span class="badge">Due tomorrow${esc(time)}</span>`;
  return `<span class="badge">Due ${esc(fmtDay(t.due))}${esc(time)}</span>`;
}

function renderTasks() {
  $$('.chip[data-view]').forEach(c => {
    c.classList.toggle('active', c.dataset.view === view);
    const n = state.tasks.filter(VIEWS[c.dataset.view]).length;
    c.innerHTML = `${esc(c.textContent.replace(/\s*\d+$/, ''))}<span class="count">${n}</span>`;
  });

  let list = state.tasks.filter(VIEWS[view]);
  if (search) {
    list = list.filter(t => `${t.title} ${t.notes} ${t.client}`.toLowerCase().includes(search));
  }
  list.sort(view === 'done' ? (a, b) => b.doneAt - a.doneAt : byScore);

  $('#task-list').innerHTML = list.map(t => {
    const running = state.active?.taskId === t.id;
    const ms = trackedMs(t.id);
    const overEst = t.estimateMin && ms > t.estimateMin * 60000;
    return `
      <li class="task p-${t.priority} ${t.status === 'done' ? 'done' : ''} ${running ? 'running' : ''}" data-id="${t.id}">
        <input type="checkbox" data-act="done" ${t.status === 'done' ? 'checked' : ''} aria-label="Mark done">
        <div>
          <div class="title">${esc(t.title)}</div>
          ${t.notes ? `<div class="notes">${esc(t.notes)}</div>` : ''}
          <div class="meta">
            <span class="badge">${t.priority[0].toUpperCase() + t.priority.slice(1)}</span>
            ${dueBadge(t)}
            ${t.client ? `<span class="badge">${esc(t.client)}</span>` : ''}
            ${t.billable ? '<span class="badge">$ billable</span>' : ''}
            ${ms || t.estimateMin ? `<span class="badge ${overEst ? 'over-est' : ''}" data-tracked="${t.id}">⏱ ${fmtDuration(ms)}${t.estimateMin ? ` / ${fmtDuration(t.estimateMin * 60000)}` : ''}</span>` : ''}
            ${t.remindAt && !t.reminded && t.status !== 'done' ? `<span class="badge">🔔 ${esc(new Date(t.remindAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))}</span>` : ''}
          </div>
        </div>
        <div class="actions">
          ${t.status !== 'done' ? `<button class="btn small ${running ? 'danger' : ''}" data-act="timer">${running ? '■ Stop' : '▶ Start'}</button>` : ''}
          ${t.due || t.remindAt ? '<button class="icon-btn" data-act="ics" title="Add to your calendar with an alarm">📅 Calendar</button>' : ''}
          <button class="icon-btn" data-act="edit">Edit</button>
          <button class="icon-btn" data-act="delete">Delete</button>
        </div>
      </li>`;
  }).join('');

  $('#task-empty').hidden = list.length > 0;
  $('#task-empty').textContent = view === 'today'
    ? 'Nothing due today 🎉 Look at "This week" or "All open".'
    : 'Nothing here. Add a task above.';

  renderNextUp();
  $('#client-list').innerHTML = clients().map(c => `<option value="${esc(c)}">`).join('');
}

function renderNextUp() {
  const open = state.tasks.filter(t => t.status !== 'done').sort(byScore);
  const next = open[0];
  const el = $('#next-up');
  if (!next || state.active?.taskId === next.id) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <span class="label">Suggested next</span>
    <span class="title">${esc(next.title)}</span>
    ${dueBadge(next)}
    <button class="btn small primary" data-start="${next.id}">▶ Start</button>`;
}

$('#next-up').addEventListener('click', e => {
  const id = e.target.dataset.start;
  if (id) startTimer(id);
});

$('#task-list').addEventListener('click', e => {
  const act = e.target.dataset.act;
  if (!act) return;
  const id = e.target.closest('.task').dataset.id;
  if (act === 'done') toggleDone(id);
  if (act === 'edit') editTask(id);
  if (act === 'delete') deleteTask(id);
  if (act === 'ics') exportIcs(id);
  if (act === 'timer') state.active?.taskId === id ? stopTimer() : startTimer(id);
});

/* ---------- Timer ---------- */

function startTimer(taskId) {
  if (state.active) stopTimer(true);
  state.active = { taskId, start: Date.now() };
  save();
  renderAll();
}

function stopTimer(silent = false) {
  if (!state.active) return;
  const { taskId, start } = state.active;
  const end = Date.now();
  state.active = null;
  // Ignore accidental clicks shorter than 5 seconds.
  if (end - start >= 5000) {
    state.entries.push({ id: uid(), taskId, start, end, note: '' });
    if (!silent) toast(`Logged ${fmtDuration(end - start)} on "${taskById(taskId)?.title}"`);
  }
  save();
  renderAll();
}

$('#timer-stop').addEventListener('click', () => stopTimer());

function tickTimer() {
  const bar = $('#timer-bar');
  if (!state.active) { bar.hidden = true; document.title = 'Workload Tracker'; return; }
  const t = taskById(state.active.taskId);
  const elapsed = fmtDuration(Date.now() - state.active.start, true);
  bar.hidden = false;
  $('#timer-task').textContent = t?.title ?? '';
  $('#timer-elapsed').textContent = elapsed;
  document.title = `⏱ ${elapsed} · ${t?.title ?? ''}`;
  const badge = $(`[data-tracked="${state.active.taskId}"]`);
  if (badge) {
    const est = t.estimateMin ? ` / ${fmtDuration(t.estimateMin * 60000)}` : '';
    badge.textContent = `⏱ ${fmtDuration(trackedMs(t.id))}${est}`;
  }
}

/* ---------- Reminders ---------- */

function notify(title, body) {
  toast(`🔔 ${title}${body ? ' · ' + body : ''}`);
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, tag: title }); } catch { /* some mobile browsers only allow SW notifications */ }
  }
}

function checkReminders() {
  const now = Date.now();
  let changed = false;
  for (const t of state.tasks) {
    if (t.status === 'done' || !t.remindAt || t.reminded) continue;
    if (new Date(t.remindAt).getTime() <= now) {
      notify(t.title, t.due ? `Due ${fmtDay(t.due)}${t.dueTime ? ' ' + t.dueTime : ''}` : 'Reminder');
      t.reminded = true;
      changed = true;
    }
  }
  if (changed) { save(); renderTasks(); }
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
  toast(`Good to see you. You have ${parts.join(' and ')}.`);
}

function renderNotifStatus() {
  const status = $('#notif-status');
  const btn = $('#notif-enable');
  if (!('Notification' in window)) {
    status.textContent = 'Not supported in this browser. In-app pop-ups will still appear.';
    btn.hidden = true;
    return;
  }
  const p = Notification.permission;
  status.textContent = p === 'granted' ? 'Enabled' : p === 'denied' ? 'Blocked. Allow notifications in your browser site settings.' : 'Not enabled yet';
  btn.hidden = p !== 'default';
}

$('#notif-enable').addEventListener('click', async () => {
  await Notification.requestPermission();
  renderNotifStatus();
  if (Notification.permission === 'granted') notify('Notifications are on', 'You will get reminders here.');
});

/* ---------- Calendar (.ics) export ---------- */

function icsDate(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function icsText(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function exportIcs(id) {
  const t = taskById(id);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Workload Tracker//EN', 'BEGIN:VEVENT',
    `UID:${t.id}@workload-tracker`, `DTSTAMP:${icsDate(new Date())}`, `SUMMARY:${icsText(t.title)}`];
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

  const slug = t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'task';
  download(`${slug}.ics`, lines.join('\r\n'), 'text/calendar');
}

/* ---------- Date & time pickers ---------- */

// Open the browser's picker when clicking anywhere in the field, not only on the small icon.
document.addEventListener('click', e => {
  const el = e.target;
  if (el.matches?.('input[type=date], input[type=time], input[type=datetime-local]')) {
    try { el.showPicker?.(); } catch { /* not allowed in some browsers; the field still works */ }
  }
});

function localDateTime(d) {
  return `${dateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextWeekday(target) { // 0 = Sunday … 6 = Saturday; today counts if it matches
  const d = parseDate(dateStr());
  d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7));
  return dateStr(d);
}

$$('.quick').forEach(group => group.addEventListener('click', e => {
  const v = e.target.dataset.v;
  if (!v) return;
  const f = form.elements;

  if (group.dataset.quick === 'due') {
    const map = {
      today: dateStr(),
      tomorrow: addDays(dateStr(), 1),
      friday: nextWeekday(5),
      nextweek: addDays(nextWeekday(1), nextWeekday(1) === dateStr() ? 7 : 0),
      clear: '',
    };
    f.due.value = map[v];
    if (v === 'clear') f.dueTime.value = '';
    return;
  }

  const d = new Date();
  if (v === 'clear') { f.remindAt.value = ''; return; }
  if (v === '1h') d.setTime(d.getTime() + 3600000);
  if (v === 'evening') d.setHours(18, 0, 0, 0);
  if (v === 'tomorrow9') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  if (v === 'beforedue') {
    if (!f.due.value) { toast('Pick a due date first'); return; }
    const due = new Date(`${f.due.value}T${f.dueTime.value || '09:00'}`);
    d.setTime(due.getTime() - 3600000);
  }
  f.remindAt.value = localDateTime(d);
}));

/* ---------- Time log ---------- */

const entryForm = $('#entry-form');

entryForm.addEventListener('submit', e => {
  e.preventDefault();
  const f = entryForm.elements;
  let start, end, manual = false;
  if (f.from.value && f.to.value) {
    start = new Date(`${f.date.value}T${f.from.value}`).getTime();
    end = new Date(`${f.date.value}T${f.to.value}`).getTime();
    if (end <= start) end += 86400000; // e.g. 23:00 → 01:00 goes past midnight
  } else if (Number(f.minutes.value) > 0) {
    const d = parseDate(f.date.value);
    d.setHours(9, 0, 0, 0);
    start = d.getTime();
    end = start + Number(f.minutes.value) * 60000;
    manual = true;
  } else {
    toast('Enter a From and To time, or the number of minutes');
    return;
  }
  state.entries.push({ id: uid(), taskId: f.taskId.value, start, end, note: f.note.value.trim(), manual });
  save();
  f.from.value = '';
  f.to.value = '';
  f.minutes.value = '';
  f.note.value = '';
  renderTime();
  toast('Time added');
});

function weekStart() {
  const d = parseDate(dateStr());
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

function renderTime() {
  const f = entryForm.elements;
  const prevTask = f.taskId.value;
  const sorted = [...state.tasks].sort((a, b) => (a.status === 'done') - (b.status === 'done') || a.title.localeCompare(b.title));
  f.taskId.innerHTML = sorted.map(t => `<option value="${t.id}">${esc(t.title)}${t.client ? ` (${esc(t.client)})` : ''}</option>`).join('');
  if (prevTask) f.taskId.value = prevTask;
  if (!f.date.value) f.date.value = dateStr();

  const todayStart = parseDate(dateStr()).getTime();
  const ws = weekStart();
  const sum = list => list.reduce((a, e) => a + (e.end - e.start), 0);
  const unbilled = state.entries.filter(e => !e.invoiceNo && taskById(e.taskId)?.billable);
  const unbilledHours = sum(unbilled) / 3600000;

  $('#time-stats').innerHTML = [
    ['Today', fmtDuration(sum(state.entries.filter(e => e.start >= todayStart)))],
    ['This week', fmtDuration(sum(state.entries.filter(e => e.start >= ws)))],
    ['Unbilled (billable)', fmtDuration(sum(unbilled))],
    ['Unbilled value', money(unbilledHours * Number(state.settings.rate || 0))],
  ].map(([k, v]) => `<div class="stat"><div class="v">${esc(v)}</div><div class="k">${esc(k)}</div></div>`).join('');

  const byDay = {};
  for (const e of [...state.entries].sort((a, b) => b.start - a.start)) {
    (byDay[dateStr(new Date(e.start))] ??= []).push(e);
  }
  const days = Object.keys(byDay);
  $('#time-log').innerHTML = days.length ? days.map(day => `
    <div class="day card">
      <h3><span>${esc(fmtDay(day))}</span><span>${fmtDuration(sum(byDay[day]))}</span></h3>
      <table>
        ${byDay[day].map(e => {
          const t = taskById(e.taskId);
          return `<tr>
            <td>${esc(t?.title ?? '(deleted task)')}${t?.client ? ` <span class="badge">${esc(t.client)}</span>` : ''}${e.note ? `<div class="notes">${esc(e.note)}</div>` : ''}</td>
            <td>${e.manual ? 'manual' : `${fmtTime(e.start)}–${fmtTime(e.end)}`}</td>
            <td class="num">${fmtDuration(e.end - e.start)}</td>
            <td>${e.invoiceNo ? `<span class="badge">Invoice #${esc(e.invoiceNo)}</span>` : ''}</td>
            <td class="num"><button class="icon-btn" data-del-entry="${e.id}">Delete</button></td>
          </tr>`;
        }).join('')}
      </table>
    </div>`).join('') : '<p class="empty">No time logged yet. Press ▶ Start on a task, or add time manually above.</p>';
}

$('#time-log').addEventListener('click', e => {
  const id = e.target.dataset.delEntry;
  if (!id || !confirm('Delete this time entry?')) return;
  state.entries = state.entries.filter(x => x.id !== id);
  save();
  renderTime();
  renderTasks();
});

/* ---------- Invoice ---------- */

const invForm = $('#invoice-form');
let currentInvoice = null;

function prepareInvoiceForm() {
  const f = invForm.elements;
  const prev = f.client.value;
  f.client.innerHTML = '<option value="">All clients</option>' + clients().map(c => `<option>${esc(c)}</option>`).join('');
  f.client.value = clients().includes(prev) ? prev : '';
  if (!f.from.value) f.from.value = dateStr().slice(0, 8) + '01';
  if (!f.to.value) f.to.value = dateStr();
  if (!f.rate.value) f.rate.value = state.settings.rate;
  if (!f.tax.value) f.tax.value = state.settings.tax;
}

invForm.addEventListener('submit', e => {
  e.preventDefault();
  const f = invForm.elements;
  const from = parseDate(f.from.value).getTime();
  const to = parseDate(addDays(f.to.value, 1)).getTime();
  const rate = Number(f.rate.value);
  const taxPct = Number(f.tax.value || 0);

  const entries = state.entries.filter(en => {
    const t = taskById(en.taskId);
    if (!t) return false;
    if (en.start < from || en.start >= to) return false;
    if (f.client.value && t.client !== f.client.value) return false;
    if (f.unbilledOnly.checked && en.invoiceNo) return false;
    if (f.billableOnly.checked && !t.billable) return false;
    return true;
  });

  if (!entries.length) {
    currentInvoice = null;
    $('#invoice-out').innerHTML = '<p class="empty">No matching time entries. Check the dates or filters, or mark the tasks as billable.</p>';
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
  const s = state.settings;
  const number = String(s.nextInvoiceNo).padStart(4, '0');

  currentInvoice = { number, entryIds: entries.map(en => en.id) };

  $('#invoice-out').innerHTML = `
    <div class="invoice-actions">
      <button class="btn" id="inv-print">🖨 Print / Save as PDF</button>
      <button class="btn primary" id="inv-mark">Mark this time as invoiced</button>
    </div>
    <div class="invoice">
      <div class="head">
        <div>
          <h2>Invoice</h2>
          <div class="muted">#${esc(number)}<br>Issued ${esc(fmtDay(dateStr()))}<br>Period ${esc(fmtDay(f.from.value))} – ${esc(fmtDay(f.to.value))}</div>
        </div>
        <div>
          <strong>${esc(s.name || 'Your name')}</strong>
          <div class="muted">${esc(s.email)}${s.email && s.address ? '\n' : ''}${esc(s.address)}</div>
        </div>
      </div>
      <p><strong>Bill to:</strong> ${esc(f.client.value || '__________________')}</p>
      <table>
        <thead><tr><th>Description</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${items.map(i => `<tr><td>${esc(i.description)}</td><td class="num">${i.hours.toFixed(2)}</td><td class="num">${esc(money(rate))}</td><td class="num">${esc(money(i.amount))}</td></tr>`).join('')}
        </tbody>
      </table>
      <table class="totals">
        <tr><td>Subtotal</td><td class="num">${esc(money(subtotal))}</td></tr>
        ${taxPct ? `<tr><td>Tax (${taxPct}%)</td><td class="num">${esc(money(tax))}</td></tr>` : ''}
        <tr class="grand"><td>Total due</td><td class="num">${esc(money(subtotal + tax))}</td></tr>
      </table>
      ${s.payment ? `<p class="muted" style="margin-top:28px">${esc(s.payment)}</p>` : ''}
    </div>`;

  $('#inv-print').onclick = () => window.print();
  $('#inv-mark').onclick = markInvoiced;
});

function markInvoiced() {
  if (!currentInvoice) return;
  const ids = new Set(currentInvoice.entryIds);
  state.entries.forEach(en => { if (ids.has(en.id)) en.invoiceNo = currentInvoice.number; });
  state.settings.nextInvoiceNo = Number(state.settings.nextInvoiceNo) + 1;
  save();
  toast(`Marked ${ids.size} entries as invoice #${currentInvoice.number}`);
  currentInvoice = null;
  $('#inv-mark').disabled = true;
}

/* ---------- Settings & backup ---------- */

const setForm = $('#settings-form');

function renderSettings() {
  for (const [k, v] of Object.entries(state.settings)) {
    if (setForm.elements[k]) setForm.elements[k].value = v;
  }
  renderNotifStatus();
}

setForm.addEventListener('submit', e => {
  e.preventDefault();
  const f = setForm.elements;
  Object.assign(state.settings, {
    name: f.name.value.trim(),
    email: f.email.value.trim(),
    address: f.address.value.trim(),
    payment: f.payment.value.trim(),
    rate: Number(f.rate.value || 0),
    currency: (f.currency.value || 'USD').toUpperCase(),
    tax: Number(f.tax.value || 0),
    nextInvoiceNo: Number(f.nextInvoiceNo.value || 1),
  });
  save();
  invForm.elements.rate.value = state.settings.rate;
  invForm.elements.tax.value = state.settings.tax;
  toast('Settings saved');
});

$('#export').addEventListener('click', () => {
  download(`workload-backup-${dateStr()}.json`, JSON.stringify(state, null, 2), 'application/json');
});

$('#import').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.tasks) || !Array.isArray(data.entries)) throw new Error('bad file');
    if (!confirm('Replace all current data with this backup?')) return;
    state = { ...structuredClone(DEFAULT_STATE), ...data, settings: { ...DEFAULT_STATE.settings, ...data.settings } };
    save();
    renderAll();
    renderSettings();
    toast('Backup restored');
  } catch {
    toast('That file does not look like a Workload Tracker backup.');
  } finally {
    e.target.value = '';
  }
});

/* ---------- Boot ---------- */

function renderAll() {
  renderTasks();
  tickTimer();
  if (!$('#tab-time').hidden) renderTime();
}

// Keep tabs in sync if the app is open in more than one window.
window.addEventListener('storage', e => {
  if (e.key === STORAGE_KEY) { state = load(); renderAll(); }
});

renderAll();
renderNotifStatus();
setInterval(tickTimer, 1000);
setInterval(checkReminders, 15000);
checkReminders();
dailyBriefing();
