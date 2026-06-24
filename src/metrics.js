// Daily metrics and plan generation

const WORK_SLOTS  = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
const PERSONAL_SLOTS = ['07:30', '19:00', '20:00', '21:00'];
const MEETING_SLOTS  = ['09:00', '11:00', '15:00'];

function generateDailyMetrics(entries) {
  const byCategory = {};
  for (const e of entries) {
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  }

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  return {
    total: entries.length,
    byCategory,
    categoriesCount: sorted.length,
    topCategory: sorted[0]?.[0] || null
  };
}

function firstSentence(text, max = 90) {
  const end = text.search(/[.!?…\n]/);
  const snippet = end > 0 && end < max ? text.slice(0, end + 1) : text.slice(0, max);
  return snippet.length < text.length ? snippet + '…' : snippet;
}

function generateDailyPlan(entries) {
  const reuniones = entries.filter(e => e.category === 'reunion');
  const trabajo   = entries.filter(e => e.category === 'trabajo');
  const personal  = entries.filter(e => e.category === 'personal');

  const plan = [];

  reuniones.forEach((e, i) => {
    plan.push({
      time: MEETING_SLOTS[i % MEETING_SLOTS.length],
      text: firstSentence(e.text),
      type: 'Reunión',
      icon: '📋',
      priority: 1
    });
  });

  trabajo.forEach((e, i) => {
    const offset = reuniones.length;
    plan.push({
      time: WORK_SLOTS[(i + offset) % WORK_SLOTS.length],
      text: firstSentence(e.text),
      type: 'Trabajo',
      icon: '💼',
      priority: 2
    });
  });

  personal.forEach((e, i) => {
    plan.push({
      time: PERSONAL_SLOTS[i % PERSONAL_SLOTS.length],
      text: firstSentence(e.text),
      type: 'Personal',
      icon: '🌸',
      priority: 3
    });
  });

  // Sort by time string (HH:MM lexicographic works fine)
  plan.sort((a, b) => a.time.localeCompare(b.time));
  return plan;
}
