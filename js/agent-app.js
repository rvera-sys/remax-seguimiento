// ─── DASHBOARD DEL AGENTE ─────────────────────────────────────────────────────

let currentUser = null;
let currentProfile = null;
let currentWeekNum = getCurrentWeekNum();
let currentWeekData = {};
let pendingChanges = {};
let monthlyTotals = {};
let yearTotals = {};
let activeSection = 'semana';
let activeMetricTab = 'auto';
let monthlyChartInstance = null;
let activeMonthlyMetric = 'reunionesVerdes';

// ── Punto de entrada llamado por requireAuth() ────────────────────────────────

async function initApp(user, profile) {
  currentUser    = user;
  currentProfile = profile;

  document.getElementById('user-name').textContent = profile.nombre;
  document.getElementById('user-initials').textContent = getInitials(profile.nombre);

  bindNav();
  bindWeekNav();
  bindMetricTabs();
  bindSaveButton();

  showLoading(true);
  await loadWeekView(currentWeekNum);
  showLoading(false);

  initVoice();
  initMobileMenu();

  // Botón guardar mobile
  document.getElementById('btn-save-mobile')?.addEventListener('click', async () => {
    await saveWeek();
    renderMobileView();
  });

  // Re-render al rotar pantalla
  window.addEventListener('resize', () => {
    if (isMobile()) renderMobileView(); else renderWeekTable();
  });

  loadBackgroundData();
}

function getInitials(nombre) {
  return nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ── Navegación lateral ────────────────────────────────────────────────────────

function bindNav() {
  document.querySelectorAll('.nav-item[data-section]').forEach(el => {
    el.addEventListener('click', () => showSection(el.dataset.section));
  });
  document.getElementById('btn-logout').addEventListener('click', logoutUser);
}

function showSection(section) {
  activeSection = section;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === section));
  document.querySelectorAll('.main-section').forEach(el => el.classList.toggle('active', el.id === 'section-' + section));

  if (section === 'mensual' && Object.keys(monthlyTotals).length === 0) {
    loadMonthlyView();
  }
  if (section === 'tablero' && yearTotals.reunionesVerdes === undefined) {
    loadTableroView();
  }
}

// ── Vista semanal ─────────────────────────────────────────────────────────────

function bindWeekNav() {
  document.getElementById('btn-prev-week').addEventListener('click', () => changeWeek(-1));
  document.getElementById('btn-next-week').addEventListener('click', () => changeWeek(1));
}

function bindMetricTabs() {
  document.querySelectorAll('.metric-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeMetricTab = btn.dataset.tab;
      document.querySelectorAll('.metric-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeMetricTab));
      renderWeekTable();
    });
  });
}

function bindSaveButton() {
  document.getElementById('btn-save-week').addEventListener('click', saveWeek);
}

async function changeWeek(delta) {
  if (Object.keys(pendingChanges).length > 0) {
    if (!confirm('Tenés cambios sin guardar. ¿Querés descartarlos?')) return;
  }
  currentWeekNum = Math.max(1, Math.min(53, currentWeekNum + delta));
  pendingChanges = {};
  showLoading(true);
  await loadWeekView(currentWeekNum);
  showLoading(false);
}

async function loadWeekView(weekNum) {
  document.getElementById('week-label').textContent = `Semana ${weekNum}`;
  document.getElementById('week-range').textContent  = formatWeekRange(weekNum);

  const isCurrentWeek = weekNum === getCurrentWeekNum();
  document.getElementById('week-badge').textContent    = isCurrentWeek ? 'Semana actual' : '';
  document.getElementById('week-badge').style.display  = isCurrentWeek ? 'inline-flex' : 'none';

  currentWeekData = await getWeekData(currentUser.uid, weekNum);
  pendingChanges  = {};
  if (isMobile()) {
    renderMobileView();
  } else {
    renderWeekTable();
  }
  renderWeekTotals();
}

function renderWeekTable() {
  const metrics = activeMetricTab === 'auto' ? METRICS_AUTO : METRICS_MANUAL;
  const days    = getWeekDays(currentWeekNum);
  const today   = dateToKey(new Date());

  // Header
  const headRow = document.getElementById('week-thead-row');
  headRow.innerHTML = `<th class="col-day">Día</th><th class="col-date">Fecha</th>` +
    metrics.map(m => `<th style="color:${m.color}" title="${m.label}">${m.short}</th>`).join('') +
    `<th class="col-total">Total</th>`;

  // Body
  const tbody = document.getElementById('week-tbody');
  tbody.innerHTML = '';

  days.forEach((date, i) => {
    const key  = dateToKey(date);
    const data = { ...(currentWeekData[key] || emptyDay()), ...(pendingChanges[key] || {}) };
    const rowTotal = metrics.reduce((sum, m) => sum + (parseInt(data[m.key]) || 0), 0);
    const isToday  = key === today;

    const tr = document.createElement('tr');
    if (isToday) tr.classList.add('row-today');

    tr.innerHTML = `
      <td class="col-day"><span class="day-name">${DIAS_ES[i]}</span></td>
      <td class="col-date">${formatDate(date, true)}</td>
      ${metrics.map(m => `
        <td>
          <input type="number" min="0" max="99" class="metric-input"
            data-date="${key}" data-key="${m.key}"
            value="${parseInt(data[m.key]) || 0}"
            style="--metric-color:${m.color}">
        </td>
      `).join('')}
      <td class="col-total"><span class="row-total" id="rt-${key}">${rowTotal}</span></td>
    `;
    tbody.appendChild(tr);
  });

  // Total row
  const totalsRow = document.createElement('tr');
  totalsRow.classList.add('totals-row');
  totalsRow.innerHTML = `
    <td colspan="2"><strong>TOTAL SEMANA</strong></td>
    ${metrics.map(m => {
      const col_total = days.reduce((sum, d) => {
        const key = dateToKey(d);
        const data = { ...(currentWeekData[key] || emptyDay()), ...(pendingChanges[key] || {}) };
        return sum + (parseInt(data[m.key]) || 0);
      }, 0);
      return `<td class="col-total-metric" id="ct-${m.key}" style="color:${m.color}"><strong>${col_total}</strong></td>`;
    }).join('')}
    <td class="col-total" id="week-grand-total"><strong>${calcWeekGrandTotal(metrics)}</strong></td>
  `;
  tbody.appendChild(totalsRow);

  // Bind inputs
  tbody.querySelectorAll('.metric-input').forEach(input => {
    input.addEventListener('input', handleMetricInput);
    input.addEventListener('focus', function() { this.select(); });
  });
}

function handleMetricInput(e) {
  const dateKey = e.target.dataset.date;
  const metKey  = e.target.dataset.key;
  const val     = Math.max(0, parseInt(e.target.value) || 0);
  e.target.value = val;

  if (!pendingChanges[dateKey]) pendingChanges[dateKey] = {};
  pendingChanges[dateKey][metKey] = val;

  // Actualizar total de fila
  updateRowTotal(dateKey);
  updateColumnTotal(metKey);
  updateGrandTotal();
  updateSaveButton();
}

function updateRowTotal(dateKey) {
  const data = { ...(currentWeekData[dateKey] || emptyDay()), ...(pendingChanges[dateKey] || {}) };
  const metrics = activeMetricTab === 'auto' ? METRICS_AUTO : METRICS_MANUAL;
  const total = metrics.reduce((sum, m) => sum + (parseInt(data[m.key]) || 0), 0);
  const el = document.getElementById('rt-' + dateKey);
  if (el) el.textContent = total;
}

function updateColumnTotal(metKey) {
  const days = getWeekDays(currentWeekNum);
  const total = days.reduce((sum, d) => {
    const key = dateToKey(d);
    const data = { ...(currentWeekData[key] || emptyDay()), ...(pendingChanges[key] || {}) };
    return sum + (parseInt(data[metKey]) || 0);
  }, 0);
  const el = document.getElementById('ct-' + metKey);
  if (el) el.querySelector('strong').textContent = total;
}

function updateGrandTotal() {
  const metrics = activeMetricTab === 'auto' ? METRICS_AUTO : METRICS_MANUAL;
  const el = document.getElementById('week-grand-total');
  if (el) el.querySelector('strong').textContent = calcWeekGrandTotal(metrics);
}

function calcWeekGrandTotal(metrics) {
  const days = getWeekDays(currentWeekNum);
  return days.reduce((sum, d) => {
    const key = dateToKey(d);
    const data = { ...(currentWeekData[key] || emptyDay()), ...(pendingChanges[key] || {}) };
    return sum + metrics.reduce((s2, m) => s2 + (parseInt(data[m.key]) || 0), 0);
  }, 0);
}

function renderWeekTotals() {
  const days = getWeekDays(currentWeekNum);
  const combined = {};
  days.forEach(d => {
    const key = dateToKey(d);
    const data = currentWeekData[key] || emptyDay();
    METRICS_KEYS.forEach(k => combined[k] = (combined[k] || 0) + (parseInt(data[k]) || 0));
  });

  FUNNEL.forEach(f => {
    const el = document.getElementById('kpi-' + f.key);
    if (el) el.textContent = combined[f.key] || 0;
  });
}

function updateSaveButton() {
  const btn = document.getElementById('btn-save-week');
  const hasPending = Object.keys(pendingChanges).length > 0;
  btn.classList.toggle('has-changes', hasPending);
  btn.textContent = hasPending ? `Guardar semana ${currentWeekNum} ●` : `Guardar semana ${currentWeekNum}`;
}

async function saveWeek() {
  if (Object.keys(pendingChanges).length === 0) {
    showToast('No hay cambios para guardar.', 'info');
    return;
  }
  const btn = document.getElementById('btn-save-week');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const saves = Object.entries(pendingChanges).map(([dateKey, data]) => {
      const existing = currentWeekData[dateKey] || emptyDay();
      const merged   = { ...existing, ...data };
      return saveDay(currentUser.uid, dateKey, merged);
    });
    await Promise.all(saves);

    // Actualizar cache local
    Object.entries(pendingChanges).forEach(([dateKey, data]) => {
      currentWeekData[dateKey] = { ...(currentWeekData[dateKey] || emptyDay()), ...data };
    });
    pendingChanges = {};

    showToast('Semana guardada correctamente.');
    renderWeekTotals();
  } catch (err) {
    console.error(err);
    showToast('Error al guardar. Intentá de nuevo.', 'error');
  } finally {
    btn.disabled = false;
    updateSaveButton();
  }
}

// ── Vista mensual ─────────────────────────────────────────────────────────────

async function loadMonthlyView() {
  showLoading(true);
  try {
    monthlyTotals = await getMonthlyTotals(currentUser.uid, 2026);
    renderMonthlySummaryTable();
    renderMonthlyChart(activeMonthlyMetric);

    // Bind selector de métrica para el gráfico
    const sel = document.getElementById('monthly-metric-select');
    if (sel) {
      sel.innerHTML = METRICS_AUTO.map(m =>
        `<option value="${m.key}" ${m.key === activeMonthlyMetric ? 'selected' : ''}>${m.label}</option>`
      ).join('');
      sel.addEventListener('change', () => {
        activeMonthlyMetric = sel.value;
        renderMonthlyChart(activeMonthlyMetric);
      });
    }
  } finally {
    showLoading(false);
  }
}

function renderMonthlySummaryTable() {
  const thead = document.getElementById('monthly-thead');
  const tbody = document.getElementById('monthly-tbody');
  if (!thead || !tbody) return;

  thead.innerHTML = `<tr>
    <th>Métrica</th>
    ${MESES_ES.map(m => `<th>${m.substring(0,3)}</th>`).join('')}
    <th>Total</th>
  </tr>`;

  tbody.innerHTML = METRICS.map(metric => {
    const rowTotal = Object.values(monthlyTotals).reduce((s, m) => s + (m[metric.key] || 0), 0);
    const cells = Array.from({ length: 12 }, (_, i) => `<td>${monthlyTotals[i] ? (monthlyTotals[i][metric.key] || 0) : 0}</td>`).join('');
    return `<tr>
      <td><span class="metric-dot" style="background:${metric.color}"></span>${metric.label}</td>
      ${cells}
      <td class="col-total"><strong>${rowTotal}</strong></td>
    </tr>`;
  }).join('');
}

function renderMonthlyChart(metricKey) {
  if (Object.keys(monthlyTotals).length === 0) return;
  renderMonthlyLineChart('chart-monthly', monthlyTotals, metricKey);
}

// ── Vista tablero / KPIs ──────────────────────────────────────────────────────

async function loadTableroView() {
  showLoading(true);
  try {
    yearTotals = await getYearTotals(currentUser.uid, 2026);
    renderKpiCards(yearTotals);
    renderFunnelChart('chart-funnel', yearTotals);
    renderMonthlyBarsChart('chart-top5', monthlyTotals.length > 0 ? monthlyTotals : await getMonthlyTotals(currentUser.uid, 2026),
      ['reunionesVerdes', 'preListing', 'preBuying', 'reservas', 'cierresVenta']);
  } finally {
    showLoading(false);
  }
}

function renderKpiCards(totals) {
  const kpis = [
    { id: 'kpi-reuniones-total', label: 'Reuniones Verdes', key: 'reunionesVerdes', color: '#27ae60' },
    { id: 'kpi-prelisting-total', label: 'Pre-Listing', key: 'preListing', color: '#003DA5' },
    { id: 'kpi-reservas-total', label: 'Reservas', key: 'reservas', color: '#b7791f' },
    { id: 'kpi-cierres-total', label: 'Cierres Totales', keyFn: t => (t.cierresVenta||0)+(t.cierresCompra||0), color: '#CC0000' },
  ];

  const container = document.getElementById('kpi-cards');
  if (!container) return;

  container.innerHTML = kpis.map(k => {
    const val = k.keyFn ? k.keyFn(totals) : (totals[k.key] || 0);
    return `
      <div class="kpi-card" style="border-top: 3px solid ${k.color}">
        <div class="kpi-value" style="color:${k.color}">${val}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub">Acumulado 2026</div>
      </div>
    `;
  }).join('');

  // Tasas de conversión
  const convContainer = document.getElementById('conversion-rates');
  if (!convContainer) return;

  const rows = [
    { from: 'reunionesVerdes', to: 'preListing', label: 'Reuniones → Pre-Listing' },
    { from: 'preListing', to: 'preBuying', label: 'Pre-Listing → Pre-Buying' },
    { from: 'preBuying', to: 'reservas', label: 'Pre-Buying → Reservas' },
    { from: 'reservas', to: 'cierresVenta', label: 'Reservas → Cierre Venta' },
    { from: 'reunionesVerdes', to: 'cierresVenta', label: 'Reuniones → Cierre (global)' },
  ];

  convContainer.innerHTML = `
    <table class="conversion-table">
      <thead><tr><th>Tasa de conversión</th><th>Desde</th><th>Hasta</th><th>Tasa</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.label}</td>
            <td class="num-cell">${totals[r.from] || 0}</td>
            <td class="num-cell">${totals[r.to] || 0}</td>
            <td class="num-cell rate-cell">${calcConversion(totals[r.from], totals[r.to])}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ── Vista móvil: pills + steppers ────────────────────────────────────────────

let mobileDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 0=Lunes

function isMobile() { return window.innerWidth <= 768; }

function renderMobileView() {
  if (!isMobile()) return;
  renderDayPills();
  renderMobileDayCard(mobileDayIndex);
}

function renderDayPills() {
  const pills   = document.getElementById('day-pills');
  if (!pills) return;
  const days    = getWeekDays(currentWeekNum);
  const todayKey = dateToKey(new Date());

  pills.innerHTML = days.map((date, i) => {
    const key      = dateToKey(date);
    const dayData  = { ...(currentWeekData[key] || emptyDay()), ...(pendingChanges[key] || {}) };
    const hasData  = METRICS_KEYS.some(k => (dayData[k] || 0) > 0);
    const isToday  = key === todayKey;
    const isActive = i === mobileDayIndex;

    return `<div class="day-pill ${isActive ? 'active' : ''} ${isToday ? 'today' : ''} ${hasData ? 'has-data' : ''}"
      onclick="selectMobileDay(${i})">
      <span class="day-pill-name">${DIAS_ES[i].substring(0, 3)}</span>
      <span class="day-pill-num">${date.getDate()}</span>
    </div>`;
  }).join('');
}

function selectMobileDay(idx) {
  mobileDayIndex = idx;
  renderDayPills();
  renderMobileDayCard(idx);
}

function renderMobileDayCard(dayIdx) {
  const card  = document.getElementById('mobile-day-card');
  if (!card) return;
  const days  = getWeekDays(currentWeekNum);
  const date  = days[dayIdx];
  const key   = dateToKey(date);
  const data  = { ...(currentWeekData[key] || emptyDay()), ...(pendingChanges[key] || {}) };
  const todayKey = dateToKey(new Date());
  const isToday  = key === todayKey;
  const total    = METRICS_KEYS.reduce((s, k) => s + (parseInt(data[k]) || 0), 0);

  card.innerHTML = `
    <div class="mobile-day-card">
      <div class="mobile-day-card-header">
        <div>
          <div class="mobile-day-title">${DIAS_ES[dayIdx]} ${isToday ? '· Hoy' : ''}</div>
          <div class="mobile-day-date">${formatDate(date)}</div>
        </div>
        <div class="mobile-day-total-badge">${total} actividades</div>
      </div>

      <div class="metric-group-title">⚡ Actividades comerciales</div>
      ${METRICS_AUTO.map(m => renderMetricRow(m, data[m.key] || 0, key)).join('')}

      <div class="metric-group-title">✍️ Marketing y captación</div>
      ${METRICS_MANUAL.map(m => renderMetricRow(m, data[m.key] || 0, key)).join('')}
    </div>
  `;

  // Bind steppers
  card.querySelectorAll('.stepper-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const metKey  = this.dataset.key;
      const dateKey = this.dataset.date;
      const delta   = this.dataset.delta === '1' ? 1 : -1;
      const valEl   = document.getElementById(`sv-${dateKey}-${metKey}`);
      const current = parseInt(valEl?.textContent) || 0;
      const newVal  = Math.max(0, current + delta);

      if (valEl) {
        valEl.textContent = newVal;
        valEl.classList.toggle('has-value', newVal > 0);
      }

      if (!pendingChanges[dateKey]) pendingChanges[dateKey] = {};
      pendingChanges[dateKey][metKey] = newVal;

      updateMobileSaveSummary(dateKey);
      renderDayPills();
    });
  });
}

function renderMetricRow(metric, value, dateKey) {
  return `
    <div class="metric-row">
      <span class="metric-row-dot" style="background:${metric.color}"></span>
      <span class="metric-row-label">${metric.label}</span>
      <div class="stepper">
        <button class="stepper-btn minus" data-key="${metric.key}" data-date="${dateKey}" data-delta="-1">−</button>
        <span class="stepper-val ${value > 0 ? 'has-value' : ''}" id="sv-${dateKey}-${metric.key}">${value}</span>
        <button class="stepper-btn plus"  data-key="${metric.key}" data-date="${dateKey}" data-delta="1">+</button>
      </div>
    </div>`;
}

function updateMobileSaveSummary(dateKey) {
  const el = document.getElementById('mobile-save-summary');
  if (!el) return;
  const changes = pendingChanges[dateKey] || {};
  const count   = Object.values(changes).filter(v => v > 0).length;
  el.textContent = count > 0
    ? `${count} métrica${count > 1 ? 's' : ''} modificada${count > 1 ? 's' : ''} — sin guardar`
    : 'Sin cambios';
}

function setBottomNav(el) {
  document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

// ── Módulo de voz ────────────────────────────────────────────────────────────

function initVoice() {
  const micBtn = document.getElementById('mic-btn');
  if (!micBtn) return;

  micBtn.addEventListener('click', function() {
    if (isListening) {
      detenerVoz();
      return;
    }

    // Limpiar transcript y resultado anterior
    const transcriptBox = document.getElementById('voice-transcript');
    if (transcriptBox) { transcriptBox.textContent = ''; transcriptBox.classList.add('show'); }
    ocultarResultadoVoz();

    const ok = iniciarVoz(
      // onResult: se llama cuando el usuario para de hablar
      function(texto) {
        document.getElementById('voice-transcript').classList.remove('show');
        mostrarResultadoVoz(texto);
      },
      // onError
      function(msg) {
        showToast(msg, 'error');
        document.getElementById('voice-transcript').classList.remove('show');
      }
    );

    if (!ok) showToast('Reconocimiento de voz no disponible. Usá Chrome o Edge.', 'error');
  });

  document.getElementById('btn-apply-voice')?.addEventListener('click', aplicarVozAlDia);
  document.getElementById('btn-discard-voice')?.addEventListener('click', ocultarResultadoVoz);
}

function mostrarResultadoVoz(texto) {
  const resultado  = parsearTexto(texto);
  const resumen    = generarResumenParseo(resultado);
  const panel      = document.getElementById('voice-result-panel');
  const textEl     = document.getElementById('voice-result-text');
  const chipsEl    = document.getElementById('detected-metrics');

  if (!panel) return;

  textEl.textContent = '"' + texto + '"';

  if (resumen.length === 0) {
    chipsEl.innerHTML = '<span class="voice-nothing">No detecté métricas. Intentá ser más específico, ej: "hice 2 llamados y tuve 1 reunión verde".</span>';
    panel.classList.add('show');
    document.getElementById('btn-apply-voice').style.display = 'none';
    return;
  }

  chipsEl.innerHTML = resumen.map(item => `
    <div class="detected-chip">
      <span class="detected-chip-dot" style="background:${item.color}"></span>
      <span class="detected-chip-val" style="color:${item.color}">${item.val}</span>
      <span>${escapeHtml(item.label)}</span>
    </div>
  `).join('');

  document.getElementById('btn-apply-voice').style.display = 'inline-flex';
  panel.classList.add('show');

  // Guardar resultado para aplicar
  panel.dataset.resultado = JSON.stringify(resultado);
}

function aplicarVozAlDia() {
  const panel = document.getElementById('voice-result-panel');
  if (!panel || !panel.dataset.resultado) return;

  const resultado = JSON.parse(panel.dataset.resultado);
  const hoyKey    = dateToKey(new Date());

  // Aplicar al día de hoy en pendingChanges
  if (!pendingChanges[hoyKey]) pendingChanges[hoyKey] = {};
  METRICS_KEYS.forEach(k => {
    if (resultado[k] && resultado[k] > 0) {
      pendingChanges[hoyKey][k] = resultado[k];
    }
  });

  // Refrescar tabla y guardar automáticamente
  renderWeekTable();
  renderWeekTotals();
  updateSaveButton();
  ocultarResultadoVoz();

  // Auto-guardar
  saveWeek().then(() => {
    showToast('¡Métricas del día cargadas y guardadas! 🎉');
  });
}

function ocultarResultadoVoz() {
  const panel = document.getElementById('voice-result-panel');
  if (panel) panel.classList.remove('show');
}

// ── Carga de datos de fondo ───────────────────────────────────────────────────

async function loadBackgroundData() {
  try {
    monthlyTotals = await getMonthlyTotals(currentUser.uid, 2026);
    yearTotals    = await getYearTotals(currentUser.uid, 2026);
    if (activeSection === 'mensual')  { renderMonthlySummaryTable(); renderMonthlyChart(activeMonthlyMetric); }
    if (activeSection === 'tablero') { renderKpiCards(yearTotals); }
    renderWeekTotals();
  } catch(e) { console.warn('Error cargando datos de fondo:', e); }
}
