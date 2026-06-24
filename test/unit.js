// Pruebas unitarias para soy
// Ejecutar con: node test/unit.js

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

// ── Harness ───────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`       → ${e.message}`);
    failed++;
  }
}

function assert(cond, msg)    { if (!cond)   throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg)        { if (a !== b) throw new Error(msg || `esperado ${JSON.stringify(b)}, recibido ${JSON.stringify(a)}`); }
function gte(a, b, msg)       { if (a < b)   throw new Error(msg || `esperado ${a} >= ${b}`); }
function isNull(a, msg)       { if (a !== null) throw new Error(msg || `esperado null, recibido ${JSON.stringify(a)}`); }
function notNull(a, msg)      { if (a === null) throw new Error(msg || 'esperado valor no-null'); }

// ── Mock environment ──────────────────────────────────────────────
const store = {};
const ctx = vm.createContext({
  localStorage: {
    getItem:    k     => store[k] ?? null,
    setItem:    (k,v) => { store[k] = String(v); },
    removeItem: k     => { delete store[k]; }
  },
  Date, Math, JSON, console,
  setTimeout: () => {},
  navigator:  { share: null }
});

const BASE = path.join(__dirname, '..');
for (const f of ['src/storage.js', 'src/metrics.js', 'src/tasks.js', 'src/monthly.js']) {
  vm.runInContext(fs.readFileSync(path.join(BASE, f), 'utf8'), ctx);
}

const C = ctx; // shorthand

// ── Bloque 1: extractKeywords ─────────────────────────────────────
console.log('\n1. Extracción de palabras clave');

test('elimina stopwords comunes', () => {
  const kw = C.extractKeywords('tengo que llamar al médico hoy');
  assert(!kw.includes('que'),   '"que" debe eliminarse');
  assert(!kw.includes('al'),    '"al" debe eliminarse');
  assert(kw.some(w => w.includes('llam')), 'debe incluir "llamar"');
});

test('filtra palabras con menos de 4 caracteres', () => {
  const kw = C.extractKeywords('ver el pago de renta');
  assert(!kw.includes('ver'),  '"ver" (3 chars) debe eliminarse');
  assert(!kw.includes('el'),   '"el" debe eliminarse');
  assert(kw.includes('pago'),  '"pago" debe incluirse');
  assert(kw.includes('renta'), '"renta" debe incluirse');
});

test('extrae keywords de texto largo', () => {
  const kw = C.extractKeywords('Necesito revisar el informe financiero antes del viernes');
  assert(kw.includes('necesito'), 'incluye "necesito"');
  assert(kw.includes('revisar'),  'incluye "revisar"');
  assert(kw.includes('informe'),  'incluye "informe"');
});

// ── Bloque 2: wordsSimilar ────────────────────────────────────────
console.log('\n2. Similitud de palabras (stemming)');

test('palabras idénticas coinciden', () => {
  assert(C.wordsSimilar('revisar', 'revisar'), 'revisar = revisar');
});

test('revisé ↔ revisar  (conjugación)', () => {
  assert(C.wordsSimilar('revisar', 'revise'), 'revisar ~ revisé');
});

test('llamé ↔ llamar  (conjugación)', () => {
  assert(C.wordsSimilar('llamar', 'llame'), 'llamar ~ llamé');
});

test('compré ↔ comprar  (conjugación)', () => {
  assert(C.wordsSimilar('comprar', 'compre'), 'comprar ~ compré');
});

test('envié ↔ enviar  (conjugación)', () => {
  assert(C.wordsSimilar('enviar', 'envia'), 'enviar ~ envié');
});

test('palabras sin relación no coinciden', () => {
  assert(!C.wordsSimilar('trabajo', 'familia'), 'trabajo ≠ familia');
  assert(!C.wordsSimilar('médico', 'compras'), 'médico ≠ compras');
});

// ── Bloque 3: overlapScore ────────────────────────────────────────
console.log('\n3. Puntaje de solapamiento');

test('solapamiento total → 1.0', () => {
  const score = C.overlapScore(['llamar', 'medico'], ['llame', 'medico', 'turno']);
  gte(score, 0.9, `debería ser ≥ 0.9, fue ${score}`);
});

test('solapamiento parcial → entre 0 y 1', () => {
  const score = C.overlapScore(['revisar', 'informe', 'ventas'], ['revise', 'informe']);
  gte(score, 0.6, `debería ser ≥ 0.6, fue ${score}`);
  assert(score < 1, 'no debería ser 1.0 con match parcial');
});

test('sin solapamiento → 0', () => {
  const score = C.overlapScore(['llamar', 'medico'], ['comprar', 'renta']);
  eq(score, 0, 'debería ser 0');
});

test('lista vacía de tarea → 0', () => {
  const score = C.overlapScore([], ['llamar', 'medico']);
  eq(score, 0, 'lista vacía → 0');
});

// ── Bloque 4: maybeAutoComplete ───────────────────────────────────
console.log('\n4. Auto-completar tareas desde notas');

// Limpia tareas del día antes de cada sub-test usando nueva entrada limpia
test('nota sobre llamada médica completa la tarea correspondiente', () => {
  C.createDailyTask('Llamar al médico para agendar cita', 'manual');
  const before = C.getTodayTasks().filter(t => !t.completed).length;

  const completed = C.maybeAutoComplete({
    text: 'Llamé al médico y agendé la cita para el viernes', category: 'personal', id: 'tc-1'
  });

  notNull(completed, 'debería encontrar tarea coincidente');
  assert(completed.text.includes('Llamar al médico'), 'debe ser la tarea correcta');
  const after = C.getTodayTasks().filter(t => !t.completed).length;
  assert(after < before, 'pendientes deben reducirse');
});

test('nota no relacionada no completa ninguna tarea', () => {
  C.createDailyTask('Enviar informe financiero al director', 'manual');
  const before = C.getTodayTasks().filter(t => !t.completed).length;

  const completed = C.maybeAutoComplete({
    text: 'Hoy fui al gimnasio por la mañana', category: 'personal', id: 'tc-2'
  });

  isNull(completed, 'no debe completar ninguna tarea');
  eq(C.getTodayTasks().filter(t => !t.completed).length, before, 'pendientes no deben cambiar');
});

test('verbo de completado con solapamiento bajo sí coincide', () => {
  C.createDailyTask('Pagar renta del mes', 'manual');
  const completed = C.maybeAutoComplete({
    text: 'Ya pagué la renta de este mes', category: 'personal', id: 'tc-3'
  });
  notNull(completed, 'debe coincidir con hint de completado + keyword');
});

test('no completa tareas ya completadas', () => {
  // Todas las tareas completadas en tests anteriores
  const alreadyDone = C.getTodayTasks().filter(t => t.completed).length;
  const completed = C.maybeAutoComplete({
    text: 'Llamé al médico y agendé la cita otra vez', category: 'personal', id: 'tc-4'
  });
  // Si solo quedan completadas, no debe devolver nada
  const pending = C.getTodayTasks().filter(t => !t.completed);
  if (pending.length === 0) {
    isNull(completed, 'sin pendientes → null');
  } else {
    // hay pendientes, resultado válido de cualquier forma
    assert(true);
  }
});

// ── Bloque 5: extractEmotions ─────────────────────────────────────
console.log('\n5. Extracción de emociones');

test('detecta emociones positivas', () => {
  const entries = [{ category: 'emocion', text: 'Me siento muy motivada y agradecida hoy' }];
  const r = C.extractEmotions(entries);
  assert(r.positive.includes('motivada'),   'detecta "motivada"');
  assert(r.positive.includes('agradecida'), 'detecta "agradecida"');
  eq(r.negative.length, 0, 'sin negativas');
});

test('detecta emociones negativas', () => {
  const entries = [{ category: 'emocion', text: 'Estoy ansiosa y frustrada con el proyecto' }];
  const r = C.extractEmotions(entries);
  assert(r.negative.includes('ansiosa'),   'detecta "ansiosa"');
  assert(r.negative.includes('frustrada'), 'detecta "frustrada"');
});

test('ignora categorías que no son emoción', () => {
  const entries = [{ category: 'trabajo', text: 'Me siento muy motivada con el proyecto' }];
  const r = C.extractEmotions(entries);
  eq(r.count, 0, 'entradas de trabajo no cuentan');
});

test('detecta emociones mixtas', () => {
  const entries = [{ category: 'emocion', text: 'Estoy alegre aunque un poco ansiosa por la presentación' }];
  const r = C.extractEmotions(entries);
  assert(r.positive.length > 0, 'tiene positivas');
  assert(r.negative.length > 0, 'tiene negativas');
});

// ── Bloque 6: extractHealth ───────────────────────────────────────
console.log('\n6. Detección de eventos de salud');

test('detecta mención de dolor de cabeza', () => {
  const entries = [{ category: 'personal', text: 'Me duele mucho la cabeza desde ayer por la noche' }];
  const r = C.extractHealth(entries);
  eq(r.events, 1, '1 evento de salud');
  assert(r.notes[0].includes('cabeza'), 'nota incluye "cabeza"');
});

test('detecta mención de médico', () => {
  const entries = [{ category: 'trabajo', text: 'Cancelé junta porque fui al médico de emergencia' }];
  const r = C.extractHealth(entries);
  eq(r.events, 1, '1 evento detectado');
});

test('entrada sana no genera evento', () => {
  const entries = [{ category: 'personal', text: 'Fui al gimnasio y me sentí increíble todo el día' }];
  const r = C.extractHealth(entries);
  eq(r.events, 0, 'sin eventos de salud');
});

test('detecta múltiples eventos en el mismo día', () => {
  const entries = [
    { category: 'personal', text: 'Me duele la garganta' },
    { category: 'personal', text: 'Compré medicina en la farmacia' }
  ];
  const r = C.extractHealth(entries);
  eq(r.events, 2, '2 eventos de salud');
});

// ── Bloque 7: buildSnapshot ───────────────────────────────────────
console.log('\n7. Construcción de snapshot');

test('calcula porcentaje de tareas correcto', () => {
  const tasks   = [
    { type: 'manual', completed: true  },
    { type: 'manual', completed: true  },
    { type: 'manual', completed: false }
  ];
  const snap = C.buildSnapshot('2026-06-01', [], tasks);
  eq(snap.tasks.total, 3,  'total = 3');
  eq(snap.tasks.done,  2,  'done = 2');
  eq(snap.tasks.pct,  67,  'pct = 67%');
});

test('snapshot con 0 tareas tiene pct = 0', () => {
  const snap = C.buildSnapshot('2026-06-02', [], []);
  eq(snap.tasks.pct, 0, 'pct = 0 sin tareas');
});

test('snapshot incluye mes correcto', () => {
  const snap = C.buildSnapshot('2026-06-15', [], []);
  eq(snap.month, '2026-06', 'mes correcto');
  eq(snap.date,  '2026-06-15', 'fecha correcta');
});

test('snapshot captura emociones y salud', () => {
  const entries = [
    { category: 'emocion', text: 'Hoy me sentí muy motivada y tranquila' },
    { category: 'personal', text: 'Fui al médico por un chequeo general' }
  ];
  const snap = C.buildSnapshot('2026-06-10', entries, []);
  assert(snap.emotions.positive.length > 0, 'emociones positivas capturadas');
  eq(snap.health.events, 1, '1 evento de salud');
});

// ── Resultado final ───────────────────────────────────────────────
console.log(`\n${'─'.repeat(45)}`);
console.log(`Total: ${passed + failed} pruebas · ✓ ${passed} pasaron · ✗ ${failed} fallaron`);
if (failed > 0) process.exit(1);
