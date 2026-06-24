// soy — monthly productivity log
// Depends on: todayString(), getTodayEntries(), getEntriesByDate() [storage.js]
//             firstSentence() [metrics.js]
//             getTodayTasks(), getTasksByDate() [tasks.js]

const MONTHLY_LOG_KEY = 'soy_monthly_log';
const LAST_SEEN_KEY   = 'soy_last_date';

// ── Keyword lists ───────────────────────────────────────────────

const EMOTIONS_POS = [
  'feliz', 'contenta', 'motivada', 'alegre', 'satisfecha', 'orgullosa',
  'agradecida', 'tranquila', 'esperanza', 'euforia', 'paz', 'ilusión',
  'emocionada', 'entusiasmada', 'optimista'
];
const EMOTIONS_NEG = [
  'triste', 'ansiosa', 'frustrada', 'enojada', 'cansada', 'agotada',
  'preocupada', 'deprimida', 'miedo', 'angustia', 'culpa', 'melancolía',
  'irritada', 'decepción', 'desesperación', 'estresada', 'ansiedad'
];
const HEALTH_WORDS = [
  'enferma', 'me duele', 'dolor de', 'dolor en', 'gripa', 'resfriado',
  'fiebre', 'náuseas', 'nauseas', 'vómito', 'diarrea', 'farmacia',
  'medicina', 'pastilla', 'médico', 'doctor', 'cita médica',
  'me siento mal', 'no me siento bien', 'me enfermé', 'malestar'
];

// ── Storage ────────────────────────────────────────────────────

function getMonthlyLog() {
  try { return JSON.parse(localStorage.getItem(MONTHLY_LOG_KEY) || '[]'); }
  catch { return []; }
}

function setMonthlyLog(log) {
  localStorage.setItem(MONTHLY_LOG_KEY, JSON.stringify(log));
}

function hasSnapshotForDate(dateStr) {
  return getMonthlyLog().some(s => s.date === dateStr);
}

function getSnapshotForDate(dateStr) {
  return getMonthlyLog().find(s => s.date === dateStr) || null;
}

// ── Extractors ──────────────────────────────────────────────────

function extractEmotions(entries) {
  const emoEntries = entries.filter(e => e.category === 'emocion');
  const found = new Set();
  emoEntries.forEach(e => {
    const lower = e.text.toLowerCase();
    [...EMOTIONS_POS, ...EMOTIONS_NEG].forEach(kw => {
      if (lower.includes(kw)) found.add(kw);
    });
  });
  const keywords = [...found];
  return {
    count:    emoEntries.length,
    keywords,
    positive: keywords.filter(k => EMOTIONS_POS.includes(k)),
    negative: keywords.filter(k => EMOTIONS_NEG.includes(k))
  };
}

function extractHealth(entries) {
  const notes = [];
  entries.forEach(e => {
    const lower = e.text.toLowerCase();
    if (HEALTH_WORDS.some(w => lower.includes(w))) {
      notes.push(firstSentence(e.text, 90));
    }
  });
  return { events: notes.length, notes };
}

// ── Snapshot builder ────────────────────────────────────────────

function buildSnapshot(dateStr, entries, tasks) {
  const byCategory = {};
  entries.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + 1; });

  const tasksDone = tasks.filter(t => t.completed).length;
  const tasksByType = {};
  ['recurring', 'auto', 'manual'].forEach(type => {
    const g = tasks.filter(t => t.type === type);
    tasksByType[type] = { total: g.length, done: g.filter(t => t.completed).length };
  });

  return {
    date:        dateStr,
    month:       dateStr.slice(0, 7),
    tasks:       {
      total: tasks.length,
      done:  tasksDone,
      pct:   tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0
    },
    tasksByType,
    entries:     { total: entries.length, byCategory },
    emotions:    extractEmotions(entries),
    health:      extractHealth(entries),
    savedAt:     new Date().toISOString()
  };
}

function persistSnapshot(snap) {
  const log = getMonthlyLog().filter(s => s.date !== snap.date);
  log.push(snap);
  log.sort((a, b) => a.date.localeCompare(b.date));
  setMonthlyLog(log);
}

function snapshotToday() {
  const snap = buildSnapshot(todayString(), getTodayEntries(), getTodayTasks());
  persistSnapshot(snap);
  return snap;
}

function autoSnapshotDate(dateStr) {
  const entries = getEntriesByDate(dateStr);
  const tasks   = getTasksByDate(dateStr);
  if (!entries.length && !tasks.length) return null;
  const snap = buildSnapshot(dateStr, entries, tasks);
  persistSnapshot(snap);
  return snap;
}

// ── Day-change auto-save ────────────────────────────────────────

function checkDayChange() {
  const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
  const today    = todayString();
  localStorage.setItem(LAST_SEEN_KEY, today);
  if (lastSeen && lastSeen !== today && !hasSnapshotForDate(lastSeen)) {
    autoSnapshotDate(lastSeen);
  }
}

// ── Stats aggregation ──────────────────────────────────────────

function getMonthData(yearMonth) {
  const snapshots     = getMonthlyLog().filter(s => s.month === yearMonth);
  const snapshotDates = new Set(snapshots.map(s => s.date));

  // For dates that have entries but no saved snapshot, derive on the fly
  const derived = getAllDates()
    .filter(d => d.startsWith(yearMonth) && !snapshotDates.has(d))
    .map(dateStr => {
      const entries = getEntriesByDate(dateStr);
      const tasks   = getTasksByDate(dateStr);
      if (!entries.length && !tasks.length) return null;
      return buildSnapshot(dateStr, entries, tasks);
    })
    .filter(Boolean);

  return [...snapshots, ...derived].sort((a, b) => a.date.localeCompare(b.date));
}

function getMonthStats(yearMonth) {
  const days = getMonthData(yearMonth);
  if (!days.length) return null;

  // Tasks
  const withTasks  = days.filter(d => d.tasks.total > 0);
  const avgTaskPct = withTasks.length
    ? Math.round(withTasks.reduce((s, d) => s + d.tasks.pct, 0) / withTasks.length)
    : 0;
  const bestDay  = withTasks.reduce((b, d) => !b || d.tasks.pct > b.tasks.pct ? d : b, null);
  const worstDay = withTasks.reduce((b, d) => !b || d.tasks.pct < b.tasks.pct ? d : b, null);

  // Entries by area
  const totalEntries  = days.reduce((s, d) => s + d.entries.total, 0);
  const totalWork     = days.reduce((s, d) =>
    s + (d.entries.byCategory.trabajo || 0) + (d.entries.byCategory.reunion || 0), 0);
  const totalPersonal = days.reduce((s, d) => s + (d.entries.byCategory.personal || 0), 0);

  // Emotions
  const emotionFreq = {};
  days.forEach(d =>
    (d.emotions?.keywords || []).forEach(kw => { emotionFreq[kw] = (emotionFreq[kw] || 0) + 1; })
  );
  const topEmotions    = Object.entries(emotionFreq).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const positiveTotal  = days.reduce((s, d) => s + (d.emotions?.positive?.length || 0), 0);
  const negativeTotal  = days.reduce((s, d) => s + (d.emotions?.negative?.length || 0), 0);
  const emotionDays    = days.filter(d => (d.emotions?.count || 0) > 0).length;

  // Health
  const healthDays  = days.filter(d => (d.health?.events || 0) > 0);
  const healthNotes = days
    .flatMap(d => (d.health?.notes || []).map(n => ({ date: d.date, note: n })))
    .slice(0, 6);

  return {
    daysLogged: days.length,
    tasks:      { avgPct: avgTaskPct, bestDay, worstDay },
    work:       { entries: totalWork, personal: totalPersonal, totalEntries },
    emotions:   { days: emotionDays, topEmotions, positiveTotal, negativeTotal },
    health:     { sickDays: healthDays.length, notes: healthNotes }
  };
}

function getAvailableMonths() {
  const fromLog     = getMonthlyLog().map(s => s.month);
  const fromEntries = getAllDates().map(d => d.slice(0, 7));
  const all         = [...new Set([...fromLog, ...fromEntries])];
  const curr        = todayString().slice(0, 7);
  if (!all.includes(curr)) all.push(curr);
  return all.sort().reverse();
}
