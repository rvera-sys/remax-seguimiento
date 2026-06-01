// ══════════════════════════════════════════════════════════════════
//  plan-estrategico.js  —  Módulo Plan Estratégico RE/MAX CREA
//  Carga, guarda y renderiza el plan anual del agente.
//  Depende de: firebase-config.js, db.js, utils.js
// ══════════════════════════════════════════════════════════════════

'use strict';

// ── Constantes ────────────────────────────────────────────────────

const PE_MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Distribución RE/MAX de facturación por mes (porcentajes)
const PE_DIST_MENSUAL = [4.4, 5.2, 6.0, 6.6, 7.2, 7.8, 8.4, 9.0, 9.6, 11.6, 12.0, 12.2];

// Estructura vacía del plan
function peEmptyPlan() {
  return {
    // Paso 4 — Gastos personales (en miles ARS)
    gastos: {
      vivienda:      0,
      comida:        0,
      servicios:     0,
      impuestos:     0,
      colegios:      0,
      vestimenta:    0,
      obraSocial:    0,
      extras:        0,
    },
    // Paso 4 — Gastos operativos (en miles ARS)
    operativos: {
      monotributo:   0,
      feeAdmin:      0,
      mainstreet:    0,
      transporte:    0,
      seguro:        0,
      celular:       0,
      obraSocialNeg: 0,
      inversiones:   0,
    },
    // Paso 3 — Objetivos personales
    objetivos: [
      { nombre: '', monto: 0 },
      { nombre: '', monto: 0 },
      { nombre: '', monto: 0 },
      { nombre: '', monto: 0 },
      { nombre: '', monto: 0 },
    ],
    // Paso 6 — Plan estratégico
    plan: {
      tcDolar:         1200,   // tipo de cambio ARS/USD
      txPromedio:      2600,   // comisión promedio por transacción (USD)
      ratioReservas:   1.2,    // reservas necesarias por transacción
    },
    // Tracking mensual (captaciones y reservas registradas)
    tracking: {
      captaciones: Array(12).fill(0),
      reservas:    Array(12).fill(0),
    },
    updatedAt: null,
  };
}

// ── Firestore helpers ─────────────────────────────────────────────

function peDocRef(uid) {
  return db.collection('tracking').doc(uid).collection('plan').doc('estrategico');
}

async function peLoad(uid) {
  try {
    const snap = await peDocRef(uid).get();
    if (snap.exists) {
      const data = snap.data();
      // merge con estructura vacía para garantizar todas las claves
      const base = peEmptyPlan();
      return {
        gastos:     Object.assign(base.gastos,     data.gastos     || {}),
        operativos: Object.assign(base.operativos, data.operativos || {}),
        objetivos:  data.objetivos  || base.objetivos,
        plan:       Object.assign(base.plan,       data.plan       || {}),
        tracking: {
          captaciones: data.tracking?.captaciones || base.tracking.captaciones,
          reservas:    data.tracking?.reservas    || base.tracking.reservas,
        },
        updatedAt: data.updatedAt || null,
      };
    }
    return peEmptyPlan();
  } catch(e) {
    console.error('[PE] Error cargando plan:', e);
    return peEmptyPlan();
  }
}

async function peSave(uid, plan) {
  plan.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  await peDocRef(uid).set(plan, { merge: true });
}

// ── Cálculos derivados ────────────────────────────────────────────

function peCalc(plan) {
  const tc = plan.plan.tcDolar || 1200;

  // Totales ARS mensuales
  const totalGastosMes    = Object.values(plan.gastos).reduce((a,b) => a + (Number(b)||0), 0);
  const totalOperativosMes= Object.values(plan.operativos).reduce((a,b) => a + (Number(b)||0), 0);

  // Totales USD anuales
  const vivirAnual   = (totalGastosMes     * 12) / tc;
  const negocioAnual = (totalOperativosMes * 12) / tc;

  // Objetivos
  const objetivosTotal = plan.objetivos.reduce((a,o) => a + (Number(o.monto)||0), 0);

  // Meta total de bolsillo
  const metaTotal = vivirAnual + negocioAnual + objetivosTotal;

  // Comisiones brutas (asumimos 45% neto/bruto promedio RE/MAX)
  const comisionesBrutas = metaTotal / 0.45;

  // Transacciones
  const tx      = plan.plan.txPromedio || 2600;
  const ratio   = plan.plan.ratioReservas || 1.2;
  const txNec   = tx > 0 ? Math.ceil(comisionesBrutas / tx) : 0;
  const reservas= Math.ceil(txNec * ratio);

  // KPIs semanales (basados en el plan de René)
  const captacionesMes  = 3; // RE/MAX recomienda 3/mes como base
  const aperturasMes    = captacionesMes * 3;
  const procesosSemana  = Math.ceil(aperturasMes / 4);
  const reunionesSemana = procesosSemana * 5;

  // Distribución mensual de comisiones brutas
  const distribucion = PE_DIST_MENSUAL.map(pct => (comisionesBrutas * pct / 100));

  // Trimestres
  const trim = [
    { label: '1er trim', pct: 15.6, meses: [0,1,2] },
    { label: '2do trim', pct: 21.6, meses: [3,4,5] },
    { label: '3er trim', pct: 27.0, meses: [6,7,8] },
    { label: '4to trim', pct: 35.8, meses: [9,10,11] },
  ].map(t => ({ ...t, usd: comisionesBrutas * t.pct / 100 }));

  // Progreso real (tracking)
  const captacionesReales = (plan.tracking.captaciones || []).reduce((a,b)=>a+b,0);
  const reservasReales    = (plan.tracking.reservas    || []).reduce((a,b)=>a+b,0);

  return {
    totalGastosMes, totalOperativosMes,
    vivirAnual, negocioAnual, objetivosTotal,
    metaTotal, comisionesBrutas,
    txNec, reservas,
    captacionesMes, aperturasMes, procesosSemana, reunionesSemana,
    distribucion, trim,
    captacionesReales, reservasReales, tc,
  };
}

// ── Helpers de formato ────────────────────────────────────────────

const fmt  = n => Number(n||0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtU = n => 'U$S ' + fmt(n);
const pct  = (n, total) => total > 0 ? Math.round(n / total * 100) : 0;

// ── Render principal ──────────────────────────────────────────────

let _peCurrentPlan = null;
let _peCurrentUid  = null;

function peRender(plan, calc) {
  _peCurrentPlan = plan;

  // ── Resumen header ──
  document.getElementById('pe-meta-total').textContent     = fmtU(calc.metaTotal);
  document.getElementById('pe-comisiones').textContent     = fmtU(calc.comisionesBrutas);
  document.getElementById('pe-tx-nec').textContent         = calc.txNec;
  document.getElementById('pe-reservas-nec').textContent   = calc.reservas;

  // ── Gastos mensuales ──
  Object.keys(plan.gastos).forEach(k => {
    const el = document.getElementById('pe-g-' + k);
    if (el) el.value = plan.gastos[k] || '';
  });
  document.getElementById('pe-total-gastos').textContent = fmt(calc.totalGastosMes) + ' $/mes';

  // ── Operativos ──
  Object.keys(plan.operativos).forEach(k => {
    const el = document.getElementById('pe-o-' + k);
    if (el) el.value = plan.operativos[k] || '';
  });
  document.getElementById('pe-total-operativos').textContent = fmt(calc.totalOperativosMes) + ' $/mes';

  // ── Objetivos ──
  plan.objetivos.forEach((obj, i) => {
    const nb = document.getElementById('pe-obj-nombre-' + i);
    const mb = document.getElementById('pe-obj-monto-' + i);
    if (nb) nb.value = obj.nombre || '';
    if (mb) mb.value = obj.monto  || '';
  });
  document.getElementById('pe-total-objetivos').textContent = fmtU(calc.objetivosTotal);

  // ── Plan estratégico ──
  document.getElementById('pe-tc').value           = plan.plan.tcDolar     || 1200;
  document.getElementById('pe-tx-prom').value      = plan.plan.txPromedio  || 2600;
  document.getElementById('pe-ratio-res').value    = plan.plan.ratioReservas || 1.2;

  // KPI cards
  document.getElementById('pe-kpi-reuniones').textContent = calc.reunionesSemana;
  document.getElementById('pe-kpi-procesos').textContent  = calc.procesosSemana;
  document.getElementById('pe-kpi-captaciones').textContent= calc.captacionesMes;
  document.getElementById('pe-kpi-aperturas').textContent  = calc.aperturasMes;

  // ── Totales anuales ──
  document.getElementById('pe-vivir-anual').textContent   = fmtU(calc.vivirAnual);
  document.getElementById('pe-negocio-anual').textContent = fmtU(calc.negocioAnual);
  document.getElementById('pe-obj-anual').textContent     = fmtU(calc.objetivosTotal);

  // ── Barras de progreso ──
  peRenderProgress(plan, calc);

  // ── Distribución mensual ──
  peRenderDistribucion(plan, calc);

  // ── Tracking mensual ──
  peRenderTracking(plan);
}

function peRenderProgress(plan, calc) {
  const cap = calc.captacionesReales;
  const res = calc.reservasReales;
  const tx  = plan.tracking.reservas.reduce((a,b)=>a+b,0); // reservas ≈ tx cerradas proxy

  const capPct = pct(cap, calc.captacionesMes * 12);
  const resPct = pct(res, calc.reservas);

  const bar = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.min(val, 100) + '%';
  };
  const txt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  bar('pe-bar-captaciones', capPct);
  bar('pe-bar-reservas',    resPct);

  txt('pe-prog-captaciones', cap + ' / ' + (calc.captacionesMes * 12));
  txt('pe-prog-reservas',    res + ' / ' + calc.reservas);
}

function peRenderDistribucion(plan, calc) {
  const tbody = document.getElementById('pe-dist-tbody');
  if (!tbody) return;
  const max = Math.max(...calc.distribucion);
  tbody.innerHTML = PE_MESES.map((mes, i) => {
    const usd  = calc.distribucion[i];
    const barW = max > 0 ? Math.round(usd / max * 100) : 0;
    return `<tr>
      <td class="pe-dist-mes">${mes}</td>
      <td class="pe-dist-pct">${PE_DIST_MENSUAL[i]}%</td>
      <td class="pe-dist-bar-cell"><div class="pe-dist-bar-wrap"><div class="pe-dist-bar-fill" style="width:${barW}%"></div></div></td>
      <td class="pe-dist-usd">${fmtU(Math.round(usd))}</td>
    </tr>`;
  }).join('');
}

function peRenderTracking(plan) {
  PE_MESES.forEach((mes, i) => {
    const capEl = document.getElementById('pe-track-cap-' + i);
    const resEl = document.getElementById('pe-track-res-' + i);
    if (capEl) capEl.value = plan.tracking.captaciones[i] || 0;
    if (resEl) resEl.value = plan.tracking.reservas[i]    || 0;
  });
}

// ── Leer formulario → plan object ────────────────────────────────

function peReadForm() {
  const plan = peEmptyPlan();

  Object.keys(plan.gastos).forEach(k => {
    plan.gastos[k] = Number(document.getElementById('pe-g-' + k)?.value) || 0;
  });
  Object.keys(plan.operativos).forEach(k => {
    plan.operativos[k] = Number(document.getElementById('pe-o-' + k)?.value) || 0;
  });
  plan.objetivos = plan.objetivos.map((_, i) => ({
    nombre: document.getElementById('pe-obj-nombre-' + i)?.value?.trim() || '',
    monto:  Number(document.getElementById('pe-obj-monto-' + i)?.value) || 0,
  }));
  plan.plan.tcDolar      = Number(document.getElementById('pe-tc')?.value)       || 1200;
  plan.plan.txPromedio   = Number(document.getElementById('pe-tx-prom')?.value)  || 2600;
  plan.plan.ratioReservas= Number(document.getElementById('pe-ratio-res')?.value)|| 1.2;

  plan.tracking.captaciones = PE_MESES.map((_, i) =>
    Number(document.getElementById('pe-track-cap-' + i)?.value) || 0);
  plan.tracking.reservas = PE_MESES.map((_, i) =>
    Number(document.getElementById('pe-track-res-' + i)?.value) || 0);

  return plan;
}

// ── Auto-recalcular al escribir ───────────────────────────────────

function peAttachAutoCalc() {
  document.querySelectorAll('#section-plan input[type=number], #section-plan input[type=text]')
    .forEach(el => {
      el.addEventListener('input', () => {
        const plan = peReadForm();
        const calc = peCalc(plan);
        peRender(plan, calc);
      });
    });
}

// ── Init principal (llamar desde agent-app.js o inline) ──────────

async function initPlanEstrategico(uid) {
  _peCurrentUid = uid;
  const plan = await peLoad(uid);
  const calc = peCalc(plan);
  peRender(plan, calc);
  peAttachAutoCalc();

  // Botón guardar
  document.getElementById('pe-btn-save')?.addEventListener('click', async () => {
    const btn = document.getElementById('pe-btn-save');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    try {
      const plan = peReadForm();
      await peSave(uid, plan);
      const calc = peCalc(plan);
      peRender(plan, calc);
      if (typeof showToast === 'function') showToast('Plan guardado correctamente.', 'success');
    } catch(e) {
      console.error('[PE] Error guardando:', e);
      if (typeof showToast === 'function') showToast('Error al guardar. Intentá de nuevo.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Guardar plan';
    }
  });
}

// ── Función pública para el broker (leer plan de un agente) ───────

async function peLoadForBroker(uid) {
  const plan = await peLoad(uid);
  return { plan, calc: peCalc(plan) };
}
