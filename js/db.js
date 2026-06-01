// ─── CAPA DE DATOS — FIRESTORE ────────────────────────────────────────────────

// ── Perfiles de usuario ──────────────────────────────────────────────────────

async function getUserProfile(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? { uid, ...snap.data() } : null;
}

async function createUserProfile(uid, data) {
  await db.collection('users').doc(uid).set(data);
}

async function updateUserStatus(targetUid, active, brokerUid) {
  await db.collection('users').doc(targetUid).update({ active });
  await logAudit(brokerUid, targetUid, active ? 'enable_agent' : 'disable_agent');
}

async function updateUserRole(targetUid, role, brokerUid) {
  await db.collection('users').doc(targetUid).update({ role });
  await logAudit(brokerUid, targetUid, role === 'broker' ? 'promote_to_broker' : 'demote_to_agent');
}

// Obtener todos los usuarios (solo para brokers, las Security Rules lo protegen)
async function getAllUsers() {
  // Sin orderBy para evitar requerir índice compuesto en Firestore
  const snap = await db.collection('users').get();
  const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  // Ordenar localmente por nombre
  return users.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
}

async function getPendingUsers() {
  const snap = await db.collection('users')
    .where('active', '==', false)
    .where('role', '==', 'agent')
    .get();
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ── Métricas de seguimiento ──────────────────────────────────────────────────
// Una ruta por día: tracking/{uid}/days/{YYYY-MM-DD}

async function saveDay(uid, dateKey, data) {
  const clean = {};
  METRICS_KEYS.forEach(k => clean[k] = parseInt(data[k]) || 0);
  clean.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  await db.collection('tracking').doc(uid).collection('days').doc(dateKey).set(clean, { merge: true });
}

async function getDay(uid, dateKey) {
  const snap = await db.collection('tracking').doc(uid).collection('days').doc(dateKey).get();
  return snap.exists ? snap.data() : emptyDay();
}

async function getWeekData(uid, weekNum) {
  const days = getWeekDays(weekNum);
  const promises = days.map(d => getDay(uid, dateToKey(d)));
  const results  = await Promise.all(promises);
  const weekData = {};
  days.forEach((d, i) => { weekData[dateToKey(d)] = results[i]; });
  return weekData;
}

// Cargar todos los días de un rango (para resumen mensual / anual)
async function getRangeData(uid, startDate, endDate) {
  const snap = await db.collection('tracking').doc(uid).collection('days')
    .where(firebase.firestore.FieldPath.documentId(), '>=', dateToKey(startDate))
    .where(firebase.firestore.FieldPath.documentId(), '<=', dateToKey(endDate))
    .get();
  const data = {};
  snap.docs.forEach(d => { data[d.id] = d.data(); });
  return data;
}

// Totales mensuales de un agente para el año actual
async function getMonthlyTotals(uid, year) {
  const start = new Date(year, 0, 1);
  const end   = new Date(year, 11, 31);
  const raw   = await getRangeData(uid, start, end);

  const monthly = {};
  for (let m = 0; m < 12; m++) monthly[m] = emptyDay();

  Object.entries(raw).forEach(([key, day]) => {
    const month = parseInt(key.split('-')[1]) - 1;
    METRICS_KEYS.forEach(k => {
      monthly[month][k] = (monthly[month][k] || 0) + (parseInt(day[k]) || 0);
    });
  });

  return monthly;
}

// Totales anuales de un agente
async function getYearTotals(uid, year) {
  const monthly = await getMonthlyTotals(uid, year);
  return sumDays(Object.values(monthly));
}

// ── Vista broker: todos los agentes, semana o mes ────────────────────────────

async function getTeamWeekData(agentUids, weekNum) {
  const results = {};
  await Promise.all(agentUids.map(async uid => {
    results[uid] = await getWeekData(uid, weekNum);
  }));
  return results;
}

async function getTeamMonthlyTotals(agentUids, year) {
  const results = {};
  await Promise.all(agentUids.map(async uid => {
    results[uid] = await getMonthlyTotals(uid, year);
  }));
  return results;
}

// ── Audit log ────────────────────────────────────────────────────────────────

async function logAudit(brokerUid, targetUid, action) {
  await db.collection('auditLog').add({
    action,
    performedBy: brokerUid,
    targetUser:  targetUid,
    timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function getAuditLog(limit = 50) {
  const snap = await db.collection('auditLog')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
