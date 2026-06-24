// LocalStorage persistence for soy entries

const STORAGE_KEY = 'soy_entries';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function todayString() {
  return new Date().toISOString().split('T')[0];
}

function getAllEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntry(text, category) {
  const entries = getAllEntries();
  const entry = {
    id: generateId(),
    text: text.trim(),
    category,
    createdAt: new Date().toISOString(),
    date: todayString()
  };
  entries.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return entry;
}

function deleteEntry(id) {
  const entries = getAllEntries().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function getTodayEntries() {
  const today = todayString();
  return getAllEntries().filter(e => e.date === today);
}

function getEntriesByDate(dateStr) {
  return getAllEntries().filter(e => e.date === dateStr);
}

function getAllDates() {
  const dates = [...new Set(getAllEntries().map(e => e.date))];
  return dates.sort().reverse();
}
