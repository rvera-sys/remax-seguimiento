// ─── CONFIGURACIÓN DE MÉTRICAS ───────────────────────────────────────────────

const METRICS = [
  // Automáticas (sincronizables desde Google Calendar)
  { key: 'reunionesVerdes', label: 'Reuniones Verdes',    short: 'R.Verdes', color: '#27ae60', bg: '#eafaf1', category: 'auto'   },
  { key: 'preListing',      label: 'Pre-Listing / ACM',   short: 'Pre-List', color: '#003DA5', bg: '#e8eef7', category: 'auto'   },
  { key: 'preBuying',       label: 'Pre-Buying',          short: 'Pre-Buy',  color: '#0055b3', bg: '#e8eef7', category: 'auto'   },
  { key: 'reservas',        label: 'Reservas',            short: 'Reservas', color: '#b7791f', bg: '#fefcbf', category: 'auto'   },
  { key: 'cierresVenta',    label: 'Cierres Venta',       short: 'C.Venta',  color: '#CC0000', bg: '#fff5f5', category: 'auto'   },
  { key: 'cierresCompra',   label: 'Cierres Compra',      short: 'C.Compra', color: '#9b0000', bg: '#fff5f5', category: 'auto'   },
  { key: 'llamados',        label: 'Llamados / WhatsApp', short: 'Llamados', color: '#6b21a8', bg: '#f5f3ff', category: 'auto'   },
  // Manuales
  { key: 'notasPersonales', label: 'Notas Personales',    short: 'Notas',    color: '#374151', bg: '#f9fafb', category: 'manual' },
  { key: 'eReport',         label: 'E-Report',            short: 'E-Rep',    color: '#374151', bg: '#f9fafb', category: 'manual' },
  { key: 'popBy',           label: 'Pop By',              short: 'Pop By',   color: '#374151', bg: '#f9fafb', category: 'manual' },
  { key: 'eventos',         label: 'Eventos',             short: 'Eventos',  color: '#374151', bg: '#f9fafb', category: 'manual' },
  { key: 'redes',           label: 'Redes Sociales',      short: 'Redes',    color: '#374151', bg: '#f9fafb', category: 'manual' },
  { key: 'nuevosContactos', label: 'Nuevos Contactos',    short: 'Nuevos',   color: '#0891b2', bg: '#ecfeff', category: 'auto'   },
  { key: 'captaciones',     label: 'Captaciones',         short: 'Captac.',  color: '#1d4ed8', bg: '#eff6ff', category: 'auto'   },
];

const METRICS_AUTO   = METRICS.filter(m => m.category === 'auto');
const METRICS_MANUAL = METRICS.filter(m => m.category === 'manual');
const METRICS_KEYS   = METRICS.map(m => m.key);

// El embudo de conversión (en orden de pipeline comercial)
// Palabras clave para detectar métricas desde Google Calendar
const KEYWORDS = {
  reunionesVerdes: ['reunión verde', 'reunion verde', 'rev', 'rv'],
  preListing:      ['pre-listing', 'prelisting', 'acm', 'listing'],
  preBuying:       ['pre-buying', 'prebuying', 'pre compra', 'precompra'],
  reservas:        ['reserva', 'oferta/res'],
  cierresVenta:    ['cierre venta', 'cierra venta', 'cv'],
  cierresCompra:   ['cierre compra', 'cierra compra', 'cc'],
  llamados:        ['llamado', 'tel', 'wa', 'whatsapp', 'llamada'],
  notasPersonales: ['nota', 'nota pers'],
  eReport:         ['e-report', 'ereport', 'e report'],
  popBy:           ['pop by', 'popby'],
  eventos:         ['evento', 'event'],
  redes:           ['redes', 'social', 'instagram', 'facebook'],
  nuevosContactos: ['nuevo contacto', 'nuevo cont', 'nc'],
  captaciones:     ['captación', 'captacion', 'capta'],
};

const FUNNEL = [
  { key: 'reunionesVerdes', label: 'Reuniones' },
  { key: 'preListing',      label: 'Pre-Listing' },
  { key: 'preBuying',       label: 'Pre-Buying' },
  { key: 'reservas',        label: 'Reservas' },
  { key: 'cierresVenta',    label: 'Cierres V.' },
  { key: 'cierresCompra',   label: 'Cierres C.' },
];

const DIAS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── CÁLCULO DE SEMANAS ───────────────────────────────────────────────────────
// Semana 1 comienza el lunes 29 dic 2025 (igual que el Apps Script original)

const SEM1_LUNES = new Date(2025, 11, 29, 0, 0, 0);

function getLunes(weekNum) {
  const d = new Date(SEM1_LUNES);
  d.setDate(SEM1_LUNES.getDate() + (weekNum - 1) * 7);
  return d;
}

function getWeekDays(weekNum) {
  const lunes = getLunes(weekNum);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    days.push(d);
  }
  return days;
}

function getWeekNum(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = d - SEM1_LUNES;
  const days = Math.floor(diff / 86400000);
  return Math.max(1, Math.min(53, Math.floor(days / 7) + 1));
}

function getCurrentWeekNum() {
  return getWeekNum(new Date());
}

function dateToKey(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function formatDate(date, short = false) {
  const d = date.getDate();
  const m = MESES_ES[date.getMonth()];
  if (short) return `${d} ${m.substring(0,3)}`;
  return `${d} de ${m}`;
}

function formatWeekRange(weekNum) {
  const days = getWeekDays(weekNum);
  const ini  = days[0];
  const fin  = days[6];
  if (ini.getMonth() === fin.getMonth()) {
    return `${ini.getDate()} - ${fin.getDate()} de ${MESES_ES[fin.getMonth()]} ${fin.getFullYear()}`;
  }
  return `${ini.getDate()} ${MESES_ES[ini.getMonth()].substring(0,3)} - ${fin.getDate()} ${MESES_ES[fin.getMonth()].substring(0,3)} ${fin.getFullYear()}`;
}

function getMonthFromWeek(weekNum) {
  const days = getWeekDays(weekNum);
  return days[3].getMonth(); // jueves como día representativo
}

// ─── CÁLCULO DE MÉTRICAS ─────────────────────────────────────────────────────

function emptyDay() {
  const d = {};
  METRICS_KEYS.forEach(k => d[k] = 0);
  return d;
}

function sumDays(daysArray) {
  const totals = emptyDay();
  daysArray.forEach(day => {
    METRICS_KEYS.forEach(k => {
      totals[k] = (totals[k] || 0) + (parseInt(day[k]) || 0);
    });
  });
  return totals;
}

function calcConversion(from, to) {
  if (!from || from === 0) return '--';
  return (to / from * 100).toFixed(1) + '%';
}

function calcRatio(from, to) {
  if (!to || to === 0) return '--';
  return (from / to).toFixed(1) + ':1';
}

// ─── UTILIDADES UI ───────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showLoading(show = true) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(n) {
  return isNaN(n) ? 0 : parseInt(n) || 0;
}
