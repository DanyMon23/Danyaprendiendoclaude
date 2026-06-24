// soy — main UI orchestrator

// ── Date display ──────────────────────────────────────────────────
function initDate() {
  const now = new Date();
  const day = now.toLocaleDateString('es-MX', { weekday: 'long' });
  const full = now.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  document.getElementById('date-day').textContent =
    day.charAt(0).toUpperCase() + day.slice(1);
  document.getElementById('date-full').textContent = full;
}

// ── Toast notification ────────────────────────────────────────────
let toastTimer = null;

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Category select ───────────────────────────────────────────────
function initCategorySelect() {
  const sel = document.getElementById('category-select');
  sel.innerHTML = '<option value="">Detectando…</option>';

  for (const [key, cat] of Object.entries(getAllCategories())) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${cat.icon} ${cat.label}`;
    sel.appendChild(opt);
  }
}

function applyCategory(key) {
  const sel = document.getElementById('category-select');
  const info = getCategoryInfo(key);
  sel.value = key;
  sel.style.color = info.color;
  sel.style.borderColor = info.color + '55';
}

function resetCategorySelect() {
  const sel = document.getElementById('category-select');
  sel.value = '';
  sel.style.color = '';
  sel.style.borderColor = '';
}

// ── Entry card ────────────────────────────────────────────────────
function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function renderEntryCard(entry) {
  const info = getCategoryInfo(entry.category);
  const time = new Date(entry.createdAt).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit'
  });

  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.category = entry.category;
  card.dataset.id = entry.id;
  card.style.setProperty('--cat-color', info.color);

  card.innerHTML = `
    <div class="entry-header">
      <span class="entry-category" style="color:${info.color}">
        <span aria-hidden="true">${info.icon}</span>
        <span>${info.label}</span>
      </span>
      <span class="entry-time">${time}</span>
    </div>
    <p class="entry-text">${escapeHtml(entry.text)}</p>
    <button class="entry-delete" aria-label="Eliminar entrada">✕</button>
  `;

  card.querySelector('.entry-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteEntry(entry.id);
    card.style.animation = 'fadeOut 0.2s ease forwards';
    setTimeout(() => { card.remove(); refreshAll(); }, 200);
  });

  return card;
}

// ── Timeline ──────────────────────────────────────────────────────
let currentFilter = 'all';

function renderTimeline() {
  const timeline   = document.getElementById('timeline');
  const emptyState = document.getElementById('empty-state');
  const entries    = getTodayEntries();

  const filtered = currentFilter === 'all'
    ? entries
    : entries.filter(e => e.category === currentFilter);

  // Remove only entry cards; preserve the #empty-state element in the DOM
  timeline.querySelectorAll('.entry-card').forEach(el => el.remove());

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  filtered.forEach(e => timeline.appendChild(renderEntryCard(e)));
}

// ── Filter chips ──────────────────────────────────────────────────
function renderFilterChips() {
  const container = document.getElementById('filter-chips');
  const usedCats  = [...new Set(getTodayEntries().map(e => e.category))];

  container.innerHTML = '';

  const addChip = (filter, label) => {
    const btn = document.createElement('button');
    btn.className = `chip${currentFilter === filter ? ' active' : ''}`;
    btn.dataset.filter = filter;
    btn.textContent = label;
    btn.addEventListener('click', () => { currentFilter = filter; refreshAll(); });
    container.appendChild(btn);
  };

  addChip('all', 'Todo');
  usedCats.forEach(cat => {
    const info = getCategoryInfo(cat);
    addChip(cat, `${info.icon} ${info.label}`);
  });
}

// ── Metrics ───────────────────────────────────────────────────────
function renderMetrics() {
  const entries = getTodayEntries();
  const m = generateDailyMetrics(entries);

  document.getElementById('total-entries').textContent  = m.total;
  document.getElementById('categories-count').textContent = m.categoriesCount;

  const bars = document.getElementById('category-bars');

  if (m.total === 0) {
    bars.innerHTML = '<p class="no-data">Aún no hay datos del día</p>';
    return;
  }

  bars.innerHTML = '';
  Object.entries(m.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => {
      const info = getCategoryInfo(key);
      const pct  = Math.round((count / m.total) * 100);

      const item = document.createElement('div');
      item.className = 'bar-item';
      item.innerHTML = `
        <div class="bar-header">
          <span class="bar-label">${info.icon} ${info.label}</span>
          <span class="bar-count">${count}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:0%; background:${info.color}"></div>
        </div>
      `;
      bars.appendChild(item);

      // Animate bar after paint
      requestAnimationFrame(() => requestAnimationFrame(() => {
        item.querySelector('.bar-fill').style.width = `${pct}%`;
      }));
    });
}

// ── Daily plan ────────────────────────────────────────────────────
function renderDailyPlan() {
  const plan     = generateDailyPlan(getTodayEntries());
  const planList = document.getElementById('plan-list');

  if (plan.length === 0) {
    planList.innerHTML =
      '<p class="no-data">Agrega pendientes de trabajo o personales para generar tu plan</p>';
    return;
  }

  planList.innerHTML = '';
  plan.forEach(item => {
    const div = document.createElement('div');
    div.className = 'plan-item';
    div.innerHTML = `
      <span class="plan-time">${item.time}</span>
      <div class="plan-body">
        <p class="plan-text">${escapeHtml(item.text)}</p>
        <p class="plan-type">${item.icon} ${item.type}</p>
      </div>
    `;
    planList.appendChild(div);
  });
}

// ── Export to iPad Notes ──────────────────────────────────────────
function formatDayNote(entries, dateLabel, dateStr) {
  let note = `📔 soy — ${dateLabel}\n`;
  note += '─'.repeat(35) + '\n\n';

  const sorted = [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  sorted.forEach(e => {
    const info = getCategoryInfo(e.category);
    const time = new Date(e.createdAt).toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit'
    });
    note += `${time}  ${info.icon} ${e.text}\n`;
  });
  note += '\n';

  note += `─────\n✦ ${entries.length} entrada${entries.length !== 1 ? 's' : ''}`;

  // Append productivity snapshot if available for this date
  const snap = dateStr ? getSnapshotForDate(dateStr) : getSnapshotForDate(todayString());
  if (snap) {
    note += '\n\n📊 Productividad del día\n';
    note += `─────\n`;
    note += `✓ ${snap.tasks.done} de ${snap.tasks.total} tareas completadas`;
    if (snap.tasks.total > 0) note += ` (${snap.tasks.pct}%)`;
    note += '\n';
    if (snap.emotions?.keywords?.length > 0) {
      note += `💜 Emociones: ${snap.emotions.keywords.join(', ')}\n`;
    }
    if (snap.health?.events > 0) {
      note += `🌿 Salud: ${snap.health.notes.slice(0, 2).join(' · ')}\n`;
    }
  }

  return note;
}

async function exportToNotes(dateStr) {
  const entries   = dateStr ? getEntriesByDate(dateStr) : getTodayEntries();
  const snap      = dateStr ? getSnapshotForDate(dateStr) : getSnapshotForDate(todayString());

  if (!entries.length && !snap) {
    showToast('No hay entradas para exportar');
    return;
  }

  const date = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const dateLabel = date.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const noteText = formatDayNote(entries, dateLabel, dateStr || todayString());

  if (navigator.share) {
    try {
      await navigator.share({ title: `soy — ${dateLabel}`, text: noteText });
    } catch (err) {
      if (err.name !== 'AbortError') {
        await copyNoteToClipboard(noteText);
      }
    }
  } else {
    await copyNoteToClipboard(noteText);
  }
}

async function copyNoteToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 Nota copiada al portapapeles');
  } catch {
    showToast('No se pudo copiar la nota');
  }
}

// ── Date lookup ───────────────────────────────────────────────────
function renderLookupResults(dateStr) {
  const results = document.getElementById('lookup-results');

  if (!dateStr) {
    results.innerHTML = '<p class="no-data">Elige una fecha para ver sus notas</p>';
    return;
  }

  const entries   = getEntriesByDate(dateStr);
  const snap      = getSnapshotForDate(dateStr);
  const date      = new Date(dateStr + 'T12:00:00');
  const dateLabel = date.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  results.innerHTML = '';

  if (!entries.length && !snap) {
    results.innerHTML = `<p class="no-data">Sin notas ni resumen para el ${dateLabel}</p>`;
    return;
  }

  // Header
  const header = document.createElement('div');
  header.className = 'lookup-header';
  const label = document.createElement('span');
  label.className = 'lookup-date-label';
  label.textContent = dateLabel;
  const expBtn = document.createElement('button');
  expBtn.className = 'lookup-export-btn';
  expBtn.textContent = 'Exportar 📱';
  expBtn.addEventListener('click', () => exportToNotes(dateStr));
  header.appendChild(label);
  header.appendChild(expBtn);
  results.appendChild(header);

  // Productivity snapshot card (if exists)
  if (snap) {
    const card = document.createElement('div');
    card.className = 'lookup-snap-card';
    const taskBar = snap.tasks.total > 0
      ? `<div class="snap-bar-track"><div class="snap-bar-fill" style="width:0%" data-target="${snap.tasks.pct}"></div></div>` : '';
    const emotions = snap.emotions?.keywords?.length > 0
      ? `<span class="snap-pill">💜 ${snap.emotions.keywords.slice(0, 3).join(', ')}</span>` : '';
    const health = snap.health?.events > 0
      ? `<span class="snap-pill snap-pill--health">🌿 ${snap.health.events} evento${snap.health.events !== 1 ? 's' : ''} de salud</span>` : '';
    card.innerHTML = `
      <div class="snap-header">
        <span class="snap-title">📊 Resumen de productividad</span>
        <span class="snap-pct">${snap.tasks.pct}%</span>
      </div>
      <div class="snap-tasks">${snap.tasks.done} de ${snap.tasks.total} tareas completadas</div>
      ${taskBar}
      <div class="snap-pills">${emotions}${health}</div>
    `;
    results.appendChild(card);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fill = card.querySelector('.snap-bar-fill[data-target]');
      if (fill) fill.style.width = fill.dataset.target + '%';
    }));
  }

  // Journal entries
  if (entries.length > 0) {
    const list = document.createElement('div');
    list.className = 'lookup-list';
    [...entries].reverse().forEach(e => list.appendChild(renderEntryCard(e)));
    results.appendChild(list);
  } else {
    const p = document.createElement('p');
    p.className = 'no-data';
    p.textContent = 'Sin notas escritas este día';
    results.appendChild(p);
  }
}

function initDateLookup() {
  const input = document.getElementById('lookup-date');
  const btn   = document.getElementById('lookup-btn');

  input.max = todayString();

  btn.addEventListener('click', () => renderLookupResults(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') renderLookupResults(input.value);
  });
}

function initExportButton() {
  document.getElementById('export-btn').addEventListener('click', () => exportToNotes(null));
}

function updateExportButton() {
  const btn  = document.getElementById('export-btn');
  const desc = document.getElementById('export-desc');
  const count = getTodayEntries().length;

  btn.disabled = count === 0;
  if (desc) {
    desc.textContent = count > 0
      ? `${count} entrada${count !== 1 ? 's' : ''} listas para guardar en tu iPad`
      : 'Agrega entradas para guardar tu nota del día en iPad';
  }
}

// ── Tasks UI ─────────────────────────────────────────────────────

const DAY_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
let selectedRoutineDays = new Set();

function taskSnippet(text, max = 100) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function renderTaskItem(task) {
  const typeIcon  = { recurring: '🔄', auto: '⚡', manual: '✍️' }[task.type] || '';
  const typeTitle = {
    recurring: 'Rutina semanal',
    auto:      'Capturado de notas',
    manual:    'Agregada manualmente'
  }[task.type] || '';

  const div = document.createElement('div');
  div.className = `task-item${task.completed ? ' completed' : ''}`;
  div.dataset.id = task.id;
  div.innerHTML = `
    <label class="task-toggle" title="Marcar completada">
      <input type="checkbox" class="task-cb" ${task.completed ? 'checked' : ''} />
      <span class="task-mark"></span>
    </label>
    <span class="task-text">${escapeHtml(taskSnippet(task.text))}</span>
    <span class="task-src" title="${typeTitle}">${typeIcon}</span>
    <button class="task-del" aria-label="Eliminar tarea">✕</button>
  `;

  div.querySelector('.task-cb').addEventListener('change', () => {
    toggleDailyTask(task.id);
    renderTasksPanel();
  });

  div.querySelector('.task-del').addEventListener('click', () => {
    deleteDailyTask(task.id);
    renderTasksPanel();
  });

  return div;
}

function renderTasksPanel() {
  renderTodayTasks();
  renderTasksSummary();
}

function renderTodayTasks() {
  const el    = document.getElementById('tasks-list');
  const tasks = getTodayTasks();

  if (tasks.length === 0) {
    el.innerHTML = '<p class="no-data">Sin tareas · Agrega una arriba o configura tus rutinas semanales</p>';
    return;
  }

  el.innerHTML = '';
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
  sorted.forEach(t => el.appendChild(renderTaskItem(t)));
}

function renderTasksSummary() {
  const el = document.getElementById('tasks-summary');
  const { total, done, pending, pct } = getDayProductivity();

  if (total === 0) {
    el.classList.add('hidden');
    return;
  }

  el.classList.remove('hidden');

  const msgs = [
    [100, '¡Día completo! 🎉'],
    [75,  '¡Casi lista! ✨'],
    [50,  'A la mitad, vas bien 💪'],
    [25,  'Buen inicio 🌤'],
    [1,   'Calentando motores ☕'],
    [0,   'Empezando el día 🌱']
  ];
  const msg = msgs.find(([t]) => pct >= t)?.[1] || '';

  const pendingHtml = pending.length > 0
    ? `<div class="summary-pending">
         <span class="summary-pending-lbl">Pendiente${pending.length !== 1 ? 's' : ''}:</span>
         ${pending.map(t => `<span class="summary-pending-item">${escapeHtml(taskSnippet(t.text, 55))}</span>`).join('')}
       </div>`
    : '';

  el.innerHTML = `
    <div class="summary-bar">
      <div class="summary-fill" style="width:0%" data-target="${pct}"></div>
    </div>
    <div class="summary-row">
      <span class="summary-msg">${msg}</span>
      <span class="summary-nums">${done} de ${total}</span>
    </div>
    ${pendingHtml}
  `;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const fill = el.querySelector('.summary-fill');
    if (fill) fill.style.width = fill.dataset.target + '%';
  }));
}

function renderRoutinesPanel() {
  const el       = document.getElementById('routines-list');
  const routines = getAllRecurringTasks();

  if (routines.length === 0) {
    el.innerHTML = '<p class="no-data">Sin rutinas · Agrega tareas que se repiten cada semana</p>';
    return;
  }

  el.innerHTML = '';
  routines.forEach(rt => {
    const div  = document.createElement('div');
    div.className = 'routine-item';
    const days = [...rt.days].sort().map(d => DAY_LABELS[d]).join(' · ');
    div.innerHTML = `
      <div class="routine-body">
        <span class="routine-text">${escapeHtml(rt.text)}</span>
        <span class="routine-days">${days}</span>
      </div>
      <button class="routine-del" aria-label="Eliminar rutina">✕</button>
    `;
    div.querySelector('.routine-del').addEventListener('click', () => {
      deleteRecurringTask(rt.id);
      seedTodayRecurring();
      renderRoutinesPanel();
      renderTasksPanel();
      showToast('Rutina eliminada');
    });
    el.appendChild(div);
  });
}

function initTasksUI() {
  seedTodayRecurring();

  // Tab switching
  document.querySelectorAll('.tasks-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tasks-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('tasks-today-panel').classList.toggle('hidden', tab !== 'today');
      document.getElementById('tasks-routines-panel').classList.toggle('hidden', tab !== 'routines');
    });
  });

  // Add manual task
  const taskInp = document.getElementById('task-input');
  const taskBtn = document.getElementById('task-add-btn');

  taskInp.addEventListener('input', () => { taskBtn.disabled = !taskInp.value.trim(); });
  taskInp.addEventListener('keydown', e => { if (e.key === 'Enter') doAddTask(); });
  taskBtn.addEventListener('click', doAddTask);

  function doAddTask() {
    const text = taskInp.value.trim();
    if (!text) return;
    createDailyTask(text, 'manual');
    taskInp.value = '';
    taskBtn.disabled = true;
    renderTasksPanel();
    showToast('✍️ Tarea agregada');
  }

  // Day-of-week buttons for routines
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = parseInt(btn.dataset.day);
      selectedRoutineDays.has(d) ? selectedRoutineDays.delete(d) : selectedRoutineDays.add(d);
      btn.classList.toggle('active', selectedRoutineDays.has(d));
      updateRoutineBtn();
    });
  });

  const rtInp = document.getElementById('routine-text');
  const rtBtn = document.getElementById('routine-add-btn');

  function updateRoutineBtn() {
    rtBtn.disabled = !rtInp.value.trim() || selectedRoutineDays.size === 0;
  }

  rtInp.addEventListener('input', updateRoutineBtn);

  rtBtn.addEventListener('click', () => {
    const text = rtInp.value.trim();
    if (!text || selectedRoutineDays.size === 0) return;
    addRecurringTask(text, [...selectedRoutineDays]);
    seedTodayRecurring();
    rtInp.value = '';
    selectedRoutineDays.clear();
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    rtBtn.disabled = true;
    renderRoutinesPanel();
    renderTasksPanel();
    showToast('🔄 Rutina creada');
  });

  renderTasksPanel();
  renderRoutinesPanel();
}

// ── Full refresh ──────────────────────────────────────────────────
function refreshAll() {
  renderFilterChips();
  renderTimeline();
  renderMetrics();
  renderDailyPlan();
  updateExportButton();
  renderTasksPanel();
}

// ── Input handling ────────────────────────────────────────────────
function initInput() {
  const textarea = document.getElementById('entry-input');
  const saveBtn  = document.getElementById('save-btn');
  const selEl    = document.getElementById('category-select');
  let classifyTimer = null;

  textarea.addEventListener('input', () => {
    const text = textarea.value.trim();
    saveBtn.disabled = text.length === 0;

    clearTimeout(classifyTimer);
    if (text.length > 6) {
      classifyTimer = setTimeout(() => {
        const cat = classify(text);
        if (cat) applyCategory(cat);
      }, 380);
    }
  });

  selEl.addEventListener('change', () => {
    if (selEl.value) {
      const info = getCategoryInfo(selEl.value);
      selEl.style.color = info.color;
      selEl.style.borderColor = info.color + '55';
    }
  });

  function doSave() {
    const text = textarea.value.trim();
    if (!text) return;

    const category = selEl.value || classify(text) || 'pensamiento';
    const entry = saveEntry(text, category);
    const captured      = maybeAutoCapture(entry);
    const autoCompleted = maybeAutoComplete(entry);

    textarea.value = '';
    saveBtn.disabled = true;
    resetCategorySelect();

    if (currentFilter !== 'all' && currentFilter !== category) {
      currentFilter = 'all';
    }

    refreshAll();
    textarea.focus();

    const info = getCategoryInfo(category);
    let toastMsg = `${info.icon} Guardado como ${info.label}`;
    if (autoCompleted && captured) {
      toastMsg = `${info.icon} Guardado · ✅ tarea completada + ⚡ nueva capturada`;
    } else if (autoCompleted) {
      const snippet = autoCompleted.text.length > 40
        ? autoCompleted.text.slice(0, 40) + '…' : autoCompleted.text;
      toastMsg = `✅ "${snippet}" marcada como completada`;
    } else if (captured) {
      toastMsg = `${info.icon} Guardado · ⚡ pendiente capturado en tareas`;
    }
    showToast(toastMsg);
  }

  saveBtn.addEventListener('click', doSave);

  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      doSave();
    }
  });
}

// ── Monthly UI ────────────────────────────────────────────────────

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

function shortDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

function renderMonthlyView(yearMonth) {
  const ym      = yearMonth || todayString().slice(0, 7);
  const sel     = document.getElementById('monthly-select');
  const content = document.getElementById('monthly-content');

  const months = getAvailableMonths();
  sel.innerHTML = months
    .map(m => `<option value="${m}" ${m === ym ? 'selected' : ''}>${monthLabel(m)}</option>`)
    .join('');

  const stats = getMonthStats(ym);

  if (!stats) {
    content.innerHTML = '<p class="no-data">Guarda tu primer resumen del día para ver las tendencias</p>';
    return;
  }

  function scoreBar(pct, color) {
    return `<div class="monthly-bar-track"><div class="monthly-bar-fill" style="width:0%;background:${color || 'var(--primary)'}" data-target="${pct}"></div></div>`;
  }

  const workPct = stats.work.totalEntries > 0
    ? Math.round((stats.work.entries / stats.work.totalEntries) * 100) : 0;

  const posTotal = stats.emotions.positiveTotal + stats.emotions.negativeTotal;
  const posWidth = posTotal > 0
    ? Math.round((stats.emotions.positiveTotal / posTotal) * 100) : 50;

  content.innerHTML = `
    <div class="monthly-grid">

      <div class="monthly-lens">
        <div class="lens-header"><span class="lens-icon">📋</span><span class="lens-title">Productividad general</span></div>
        <div class="lens-stat-big">${stats.tasks.avgPct}<span class="lens-pct-label">%</span></div>
        <div class="lens-label">promedio de tareas completadas · ${stats.daysLogged} día${stats.daysLogged !== 1 ? 's' : ''} registrado${stats.daysLogged !== 1 ? 's' : ''}</div>
        ${scoreBar(stats.tasks.avgPct)}
        ${stats.tasks.bestDay ? `<div class="lens-sub">Mejor día: <strong>${shortDate(stats.tasks.bestDay.date)}</strong> — ${stats.tasks.bestDay.tasks.pct}%</div>` : ''}
        ${stats.tasks.worstDay && stats.tasks.bestDay && stats.tasks.worstDay.date !== stats.tasks.bestDay.date
          ? `<div class="lens-sub">Día más difícil: <strong>${shortDate(stats.tasks.worstDay.date)}</strong> — ${stats.tasks.worstDay.tasks.pct}%</div>`
          : ''}
      </div>

      <div class="monthly-lens">
        <div class="lens-header"><span class="lens-icon">💼</span><span class="lens-title">Enfoque laboral</span></div>
        ${stats.work.totalEntries > 0 ? `
          <div class="lens-stat-big">${workPct}<span class="lens-pct-label">%</span></div>
          <div class="lens-label">de tus notas son de trabajo o reuniones</div>
          ${scoreBar(workPct, '#3B82F6')}
          <div class="lens-sub">${stats.work.entries} entradas de trabajo · ${stats.work.personal} personales</div>
        ` : '<p class="lens-empty">Sin notas de trabajo este mes</p>'}
      </div>

      <div class="monthly-lens">
        <div class="lens-header"><span class="lens-icon">💜</span><span class="lens-title">Gestión emocional</span></div>
        ${stats.emotions.days > 0 ? `
          <div class="lens-stat-big">${stats.emotions.days}<span class="lens-pct-label"> días</span></div>
          <div class="lens-label">con registro emocional este mes</div>
          <div class="lens-emotions-bar"><span class="emo-pos" style="width:${posWidth}%"></span></div>
          <div class="lens-emo-legend">
            <span class="emo-pos-label">✓ ${stats.emotions.positiveTotal} positivas</span>
            <span class="emo-neg-label">✗ ${stats.emotions.negativeTotal} difíciles</span>
          </div>
          ${stats.emotions.topEmotions.length > 0 ? `
            <div class="lens-tags">
              ${stats.emotions.topEmotions.map(([kw, n]) => `<span class="lens-tag">${kw} <strong>${n}</strong></span>`).join('')}
            </div>` : ''}
        ` : '<p class="lens-empty">Sin registros emocionales este mes</p>'}
      </div>

      <div class="monthly-lens">
        <div class="lens-header"><span class="lens-icon">🌿</span><span class="lens-title">Salud</span></div>
        ${stats.health.sickDays > 0 ? `
          <div class="lens-stat-big">${stats.health.sickDays}<span class="lens-pct-label"> días</span></div>
          <div class="lens-label">con menciones de salud este mes</div>
          ${stats.health.notes.length > 0 ? `
            <div class="lens-health-notes">
              ${stats.health.notes.map(n => `
                <div class="health-note">
                  <span class="health-note-date">${shortDate(n.date)}</span>
                  <span class="health-note-text">${escapeHtml(n.note)}</span>
                </div>`).join('')}
            </div>` : ''}
        ` : '<p class="lens-empty">Sin menciones de salud este mes 🎉</p>'}
      </div>

    </div>
  `;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    content.querySelectorAll('.monthly-bar-fill[data-target]').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  }));
}

function initMonthlyUI() {
  checkDayChange();

  document.getElementById('save-day-btn').addEventListener('click', () => {
    if (!getTodayEntries().length && !getTodayTasks().length) {
      showToast('Sin datos del día para guardar');
      return;
    }
    snapshotToday();
    showToast('📊 Resumen del día guardado');
    renderMonthlyView();
  });

  document.getElementById('monthly-select').addEventListener('change', e => {
    renderMonthlyView(e.target.value);
  });

  renderMonthlyView();
}

// ── Boot ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDate();
  initCategorySelect();
  initInput();
  initDateLookup();
  initExportButton();
  initTasksUI();
  initMonthlyUI();
  refreshAll();
});
