// Keyword-based entry classifier (Spanish/English bilingual)

const CATEGORIES = {
  reflexion: {
    label: 'Reflexión',
    icon: '🪞',
    color: '#8B5CF6',
    keywords: [
      'me pregunto', 'pienso que', 'reflexiono', 'reflexión', 'me doy cuenta',
      'aprendí', 'entiendo que', 'comprendo', 'me hace pensar', 'si pudiera',
      'ojalá', 'hubiera sido', 'creo que', 'me parece', 'en retrospectiva',
      'he aprendido', 'me enseñó', 'significado', 'propósito', 'valores',
      'me ayudó a ver', 'lo que descubrí', 'caí en cuenta', 'tomé conciencia',
      'me doy cuenta de', 'analizando', 'revisando mi vida', 'lección aprendida'
    ]
  },
  emocion: {
    label: 'Emoción',
    icon: '💜',
    color: '#A855F7',
    keywords: [
      'me siento', 'siento que', 'estoy feliz', 'estoy triste', 'ansiosa',
      'ansiedad', 'preocupada', 'preocupación', 'emocionada', 'frustrada',
      'enojada', 'alegre', 'motivada', 'cansada', 'agotada', 'contenta',
      'deprimida', 'con nervios', 'miedo', 'amor', 'gratitud', 'agradecida',
      'angustia', 'desesperación', 'esperanza', 'ilusión', 'decepción',
      'satisfecha', 'orgullosa', 'avergonzada', 'culpa', 'paz interior',
      'tranquila', 'irritada', 'melancolía', 'nostalgia', 'euforia',
      'emoción', 'sentimiento', 'me duele', 'me alegra', 'me pesa'
    ]
  },
  idea: {
    label: 'Idea',
    icon: '✨',
    color: '#F59E0B',
    keywords: [
      'tengo una idea', 'se me ocurrió', 'qué tal si', 'y si pudiéramos',
      'podría ser', 'por qué no', 'podríamos', 'propongo que', 'sería genial',
      'nueva idea', 'nuevo proyecto', 'innovar', 'crear algo', 'inventar',
      'diseñar', 'construir', 'emprendimiento', 'negocio idea', 'solución',
      'oportunidad de', 'concepto nuevo', 'visión de', 'propuesta de',
      'imagina que', 'brainstorm', 'lluvia de ideas'
    ]
  },
  reunion: {
    label: 'Reunión',
    icon: '📋',
    color: '#0EA5E9',
    keywords: [
      'en la reunión', 'acordamos', 'nos reunimos', 'meeting', 'discutimos',
      'se acordó', 'minuta', 'puntos de la reunión', 'asistieron', 'próxima reunión',
      'seguimiento de', 'action items', 'comprometidos a', 'video call',
      'videoconferencia', 'junta de', 'asamblea', 'sesión de trabajo',
      'presentamos', 'revisamos en', 'notas de reunión', 'acuerdos', 'compromisos'
    ]
  },
  trabajo: {
    label: 'Trabajo',
    icon: '💼',
    color: '#3B82F6',
    keywords: [
      'pendiente del trabajo', 'tarea de trabajo', 'deadline', 'fecha límite',
      'entrega del proyecto', 'cliente', 'mi jefe', 'en el trabajo', 'enviar informe',
      'mandar reporte', 'presentación de trabajo', 'mi equipo', 'sprint',
      'backlog', 'debo entregar', 'tengo que enviar', 'oficina', 'empresa',
      'colega', 'proveedor', 'propuesta de negocio', 'contrato', 'factura',
      'presupuesto del proyecto', 'kpi', 'objetivo laboral', 'tarea pendiente trabajo'
    ]
  },
  personal: {
    label: 'Personal',
    icon: '🌸',
    color: '#EC4899',
    keywords: [
      'tengo que comprar', 'debo comprar', 'ir al médico', 'pagar la', 'renovar mi',
      'cita con el dentista', 'hacer ejercicio', 'ir al gym', 'supermercado',
      'arreglar la casa', 'pendiente personal', 'llamar a mamá', 'llamar a papá',
      'visitar a', 'cita médica', 'farmacia', 'ropa nueva', 'cumpleaños de',
      'celebración', 'vacaciones', 'viaje pendiente', 'mis mascotas', 'el hogar',
      'tarea personal', 'asunto personal', 'trámite'
    ]
  },
  pensamiento: {
    label: 'Pensamiento',
    icon: '💭',
    color: '#6366F1',
    keywords: [
      'estaba pensando', 'se me viene', 'me viene a la mente', 'qué curioso',
      'me llama la atención', 'observé que', 'noté que', 'resulta que',
      'descubrí que', 'me sorprende', 'me pregunto si', 'tengo una duda',
      'no entiendo por qué', 'me parece curioso', 'de repente pensé',
      'mientras manejaba', 'mientras caminaba', 'antes de dormir'
    ]
  }
};

function classify(text) {
  if (!text || text.trim().length < 3) return null;

  const lower = text.toLowerCase();
  const scores = {};

  for (const [key, cat] of Object.entries(CATEGORIES)) {
    scores[key] = cat.keywords.reduce((sum, kw) => {
      if (lower.includes(kw)) {
        return sum + kw.split(' ').length; // multi-word phrases score higher
      }
      return sum;
    }, 0);
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'pensamiento';

  return Object.entries(scores).reduce(
    (best, [key, score]) => (score > best[1] ? [key, score] : best),
    ['pensamiento', -1]
  )[0];
}

function getCategoryInfo(key) {
  return CATEGORIES[key] || CATEGORIES.pensamiento;
}

function getAllCategories() {
  return CATEGORIES;
}
