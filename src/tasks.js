// soy — task management (storage + logic)
// Depends on: generateId(), todayString() from storage.js

const RECURRING_KEY = 'soy_recurring_tasks';
const DAILY_KEY     = 'soy_daily_tasks';

// ── Raw storage ─────────────────────────────────────────────────

function getRecurring() {
  try { return JSON.parse(localStorage.getItem(RECURRING_KEY) || '[]'); }
  catch { return []; }
}

function setRecurring(list) {
  localStorage.setItem(RECURRING_KEY, JSON.stringify(list));
}

function getDaily() {
  try { return JSON.parse(localStorage.getItem(DAILY_KEY) || '[]'); }
  catch { return []; }
}

function setDaily(list) {
  localStorage.setItem(DAILY_KEY, JSON.stringify(list));
}

// ── Recurring task definitions ──────────────────────────────────

function addRecurringTask(text, days) {
  const list = getRecurring();
  const task = {
    id: generateId(),
    text: text.trim(),
    days, // [0..6] where 0=Sun, 1=Mon … 6=Sat
    createdAt: new Date().toISOString()
  };
  list.push(task);
  setRecurring(list);
  return task;
}

function deleteRecurringTask(id) {
  setRecurring(getRecurring().filter(t => t.id !== id));
  // Remove today's un-completed instance spawned from this definition
  setDaily(getDaily().filter(
    t => !(t.recurringId === id && t.date === todayString() && !t.completed)
  ));
}

function getAllRecurringTasks() { return getRecurring(); }

// ── Daily task instances ────────────────────────────────────────

function getTodayTasks() {
  return getDaily().filter(t => t.date === todayString());
}

function getTasksByDate(dateStr) {
  return getDaily().filter(t => t.date === dateStr);
}

function createDailyTask(text, type, recurringId = null, sourceEntryId = null) {
  const list = getDaily();
  const task = {
    id: generateId(),
    text: text.trim(),
    date: todayString(),
    completed: false,
    completedAt: null,
    type,           // 'recurring' | 'auto' | 'manual'
    recurringId,
    sourceEntryId,
    createdAt: new Date().toISOString()
  };
  list.push(task);
  setDaily(list);
  return task;
}

function toggleDailyTask(id) {
  const list = getDaily();
  const t = list.find(t => t.id === id);
  if (!t) return;
  t.completed = !t.completed;
  t.completedAt = t.completed ? new Date().toISOString() : null;
  setDaily(list);
}

function deleteDailyTask(id) {
  setDaily(getDaily().filter(t => t.id !== id));
}

// ── Seed today from recurring definitions ───────────────────────

function seedTodayRecurring() {
  const dow    = new Date().getDay();
  const seeded = new Set(
    getTodayTasks().filter(t => t.recurringId).map(t => t.recurringId)
  );
  getRecurring().forEach(rt => {
    if (rt.days.includes(dow) && !seeded.has(rt.id)) {
      createDailyTask(rt.text, 'recurring', rt.id);
    }
  });
}

// ── Auto-complete tasks from notes ─────────────────────────────

const COMPLETION_HINTS = [
  'hice', 'termine', 'complete', 'envie', 'mande', 'llame', 'revise',
  'pague', 'compre', 'entregue', 'prepare', 'agende', 'ya lo hice',
  'ya termine', 'lo hice', 'listo', 'done', 'completado', 'acabe', 'fui a'
];

const STOPWORDS_ES = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'que', 'en', 'con', 'por',
  'para', 'un', 'una', 'y', 'o', 'a', 'mi', 'me', 'se', 'es', 'al',
  'le', 'lo', 'ya', 'no', 'si', 'su', 'nos', 'fue', 'son', 'hay',
  'ser', 'muy', 'mas', 'pero', 'como', 'todo', 'esta', 'este', 'esto'
]);

function normalizeW(w) {
  return w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function extractKeywords(text) {
  return text.toLowerCase()
    .replace(/[^\w\sáéíóúüñ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS_ES.has(w));
}

function wordsSimilar(a, b) {
  const na = normalizeW(a), nb = normalizeW(b);
  if (na === nb) return true;
  if (na.length < 4 || nb.length < 4) return false;
  return na.slice(0, 4) === nb.slice(0, 4);
}

function overlapScore(taskWords, entryWords) {
  if (!taskWords.length) return 0;
  let hits = 0;
  for (const tw of taskWords) {
    if (entryWords.some(ew => wordsSimilar(tw, ew))) hits++;
  }
  return hits / taskWords.length;
}

function maybeAutoComplete(entry) {
  const pending = getTodayTasks().filter(t => !t.completed);
  if (!pending.length) return null;

  const entryNorm  = normalizeW(entry.text);
  const entryWords = extractKeywords(entry.text);
  const hasHint    = COMPLETION_HINTS.some(h => entryNorm.includes(normalizeW(h)));
  const threshold  = hasHint ? 0.3 : 0.5;

  let bestTask = null, bestScore = 0;
  for (const task of pending) {
    const taskWords = extractKeywords(task.text);
    const score     = overlapScore(taskWords, entryWords);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestTask  = task;
    }
  }

  if (!bestTask) return null;
  toggleDailyTask(bestTask.id);
  return bestTask;
}

// ── Auto-capture from saved entries ────────────────────────────

const AUTO_CATS  = ['trabajo', 'personal', 'reunion'];
const TASK_WORDS = [
  'tengo que', 'debo ', 'hay que', 'necesito ', 'pendiente', 'recordar',
  'no olvidar', 'completar', 'terminar', 'enviar', 'llamar', 'revisar',
  'preparar', 'agendar', 'mandar', 'entregar', 'pagar', 'comprar',
  'seguimiento', 'follow up', 'comprometidos', 'acordamos', 'action item'
];

function maybeAutoCapture(entry) {
  if (!AUTO_CATS.includes(entry.category)) return null;
  const lower = entry.text.toLowerCase();
  if (!TASK_WORDS.some(w => lower.includes(w))) return null;
  if (getDaily().some(t => t.sourceEntryId === entry.id)) return null;
  return createDailyTask(entry.text, 'auto', null, entry.id);
}

// ── Productivity summary ────────────────────────────────────────

function getDayProductivity() {
  const tasks   = getTodayTasks();
  const total   = tasks.length;
  const done    = tasks.filter(t => t.completed).length;
  const pending = tasks.filter(t => !t.completed);
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, pending, pct };
}
