// ─── DASHBOARD DEL BROKER ────────────────────────────────────────────────────

let brokerUser    = null;
let brokerProfile = null;
let allUsers      = [];
let agentUsers    = [];
let teamTotals    = {};      // { uid: yearTotals }
let selectedAgent = null;
let viewWeekNum   = getCurrentWeekNum();

// ── Punto de entrada ──────────────────────────────────────────────────────────

async function initApp(user, profile) {
  brokerUser    = user;
  brokerProfile = profile;

  document.getElementById('broker-name').textContent     = profile.nombre;
  document.getElementById('broker-initials').textContent = getInitials(profile.nombre);

  bindBrokerNav();
  document.getElementById('btn-logout').addEventListener('click', logoutUser);

  showLoading(true);
  await loadAllUsers();
  showLoading(false);

  showBrokerSection('panel');
}

function getInitials(n) { return n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(); }

// ── Navegación ────────────────────────────────────────────────────────────────

function bindBrokerNav() {
  document.querySelectorAll('.nav-item[data-section]').forEach(el => {
    el.addEventListener('click', () => showBrokerSection(el.dataset.section));
  });
}

function showBrokerSection(section) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === section));
  document.querySelectorAll('.main-section').forEach(el => el.classList.toggle('active', el.id === 'section-' + section));

  if (section === 'panel')      renderPanelGeneral();
  if (section === 'equipo')     renderEquipoSection();
  if (section === 'comparativa') renderComparativaSection();
  if (section === 'gestion')    renderGestionSection();
  if (section === 'auditoria')  loadAndRenderAuditoria();
}

// ── Carga de datos ────────────────────────────────────────────────────────────

async function loadAllUsers() {
  allUsers   = await getAllUsers();
  agentUsers = allUsers.filter(u => u.role === 'agent');

  const year = 2026;
  await Promise.all(agentUsers.map(async agent => {
    try {
      teamTotals[agent.uid] = await getYearTotals(agent.uid, year);
    } catch(e) {
      teamTotals[agent.uid] = emptyDay();
    }
  }));

  updatePendingBadge();
}

function updatePendingBadge() {
  const pending = allUsers.filter(u => u.role === 'agent' && u.active === false).length;
  const badge   = document.getElementById('pending-badge');
  if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline-flex' : 'none'; }
}

// ── Panel General ─────────────────────────────────────────────────────────────

function renderPanelGeneral() {
  const activeAgents = agentUsers.filter(u => u.active !== false);
  const combined     = sumDays(activeAgents.map(a => teamTotals[a.uid] || emptyDay()));

  // Tarjetas de KPIs del equipo
  const cards = [
    { label: 'Agentes activos',      val: activeAgents.length,                      color: '#27ae60', icon: '👥' },
    { label: 'Reuniones Verdes',      val: combined.reunionesVerdes || 0,            color: '#27ae60', icon: '📅' },
    { label: 'Pre-Listing',           val: combined.preListing || 0,                 color: '#003DA5', icon: '📋' },
    { label: 'Cierres Totales 2026',  val: (combined.cierresVenta||0)+(combined.cierresCompra||0), color: '#CC0000', icon: '🏆' },
  ];

  const container = document.getElementById('team-kpi-cards');
  if (container) {
    container.innerHTML = cards.map(c => `
      <div class="kpi-card" style="border-top:3px solid ${c.color}">
        <div class="kpi-icon">${c.icon}</div>
        <div class="kpi-value" style="color:${c.color}">${c.val}</div>
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-sub">Acumulado 2026</div>
      </div>
    `).join('');
  }

  // Tabla de ranking
  const tbody = document.getElementById('ranking-tbody');
  if (!tbody) return;

  const ranked = activeAgents
    .map(a => ({ ...a, total: sumMetricsTotal(teamTotals[a.uid] || emptyDay()) }))
    .sort((a, b) => b.total - a.total);

  tbody.innerHTML = ranked.map((agent, i) => `
    <tr>
      <td><span class="rank-num rank-${i+1}">${i+1}</span></td>
      <td>
        <div class="agent-name-cell">
          <span class="avatar-xs">${getInitials(agent.nombre)}</span>
          <span>${escapeHtml(agent.nombre)}</span>
        </div>
      </td>
      <td>${teamTotals[agent.uid]?.reunionesVerdes || 0}</td>
      <td>${teamTotals[agent.uid]?.preListing || 0}</td>
      <td>${teamTotals[agent.uid]?.reservas || 0}</td>
      <td>${(teamTotals[agent.uid]?.cierresVenta||0)+(teamTotals[agent.uid]?.cierresCompra||0)}</td>
      <td><strong>${agent.total}</strong></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="openAgentDetail('${agent.uid}')">Ver detalle</button>
      </td>
    </tr>
  `).join('');

  renderTeamBarsChart('chart-team-cierres', activeAgents, teamTotals, 'cierresVenta');
}

function sumMetricsTotal(totals) {
  return ['reunionesVerdes','preListing','preBuying','reservas','cierresVenta','cierresCompra','llamados']
    .reduce((s, k) => s + (totals[k] || 0), 0);
}

// ── Sección Equipo ────────────────────────────────────────────────────────────

function renderEquipoSection() {
  const container = document.getElementById('equipo-cards');
  if (!container) return;

  container.innerHTML = agentUsers.map(agent => {
    const t = teamTotals[agent.uid] || emptyDay();
    const cierres = (t.cierresVenta||0) + (t.cierresCompra||0);
    const statusClass = agent.active === false ? 'status-inactive' : 'status-active';
    const statusLabel = agent.active === false ? 'Inactivo' : 'Activo';

    return `
      <div class="agent-card">
        <div class="agent-card-header">
          <div class="avatar">${getInitials(agent.nombre)}</div>
          <div class="agent-info">
            <div class="agent-card-name">${escapeHtml(agent.nombre)}</div>
            <div class="agent-card-email">${escapeHtml(agent.email)}</div>
          </div>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>
        <div class="agent-metrics-mini">
          ${['reunionesVerdes','preListing','reservas'].map(k => {
            const m = METRICS.find(x => x.key === k);
            return `<div class="mini-metric">
              <div class="mini-val" style="color:${m.color}">${t[k]||0}</div>
              <div class="mini-lbl">${m.short}</div>
            </div>`;
          }).join('')}
          <div class="mini-metric">
            <div class="mini-val" style="color:#CC0000">${cierres}</div>
            <div class="mini-lbl">Cierres</div>
          </div>
        </div>
        <div class="agent-card-actions">
          <button class="btn btn-sm btn-primary" onclick="openAgentDetail('${agent.uid}')">Ver seguimiento</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Detalle de agente ─────────────────────────────────────────────────────────

async function openAgentDetail(uid) {
  selectedAgent = allUsers.find(u => u.uid === uid);
  if (!selectedAgent) return;

  document.getElementById('detail-agent-name').textContent = selectedAgent.nombre;
  document.getElementById('agent-detail-modal').style.display = 'flex';

  document.getElementById('detail-week-label').textContent = `Semana ${viewWeekNum}`;
  document.getElementById('detail-week-range').textContent  = formatWeekRange(viewWeekNum);

  document.getElementById('detail-prev-week').onclick = () => changeDetailWeek(-1);
  document.getElementById('detail-next-week').onclick = () => changeDetailWeek(1);
  document.getElementById('detail-close').onclick      = closeAgentDetail;

  await loadDetailWeek(uid, viewWeekNum);
}

function closeAgentDetail() {
  document.getElementById('agent-detail-modal').style.display = 'none';
  selectedAgent = null;
}

async function changeDetailWeek(delta) {
  viewWeekNum = Math.max(1, Math.min(53, viewWeekNum + delta));
  document.getElementById('detail-week-label').textContent = `Semana ${viewWeekNum}`;
  document.getElementById('detail-week-range').textContent  = formatWeekRange(viewWeekNum);
  await loadDetailWeek(selectedAgent.uid, viewWeekNum);
}

async function loadDetailWeek(uid, weekNum) {
  const weekData = await getWeekData(uid, weekNum);
  const days     = getWeekDays(weekNum);

  const table = document.getElementById('detail-week-table');
  if (!table) return;

  const thead = table.querySelector('thead tr');
  const tbody = table.querySelector('tbody');

  thead.innerHTML = `<th>Día</th><th>Fecha</th>` +
    METRICS_AUTO.map(m => `<th style="color:${m.color}">${m.short}</th>`).join('') +
    `<th>Total</th>`;

  tbody.innerHTML = '';
  let weekTotals = emptyDay();

  days.forEach((date, i) => {
    const key  = dateToKey(date);
    const data = weekData[key] || emptyDay();
    METRICS_KEYS.forEach(k => weekTotals[k] = (weekTotals[k]||0) + (parseInt(data[k])||0));

    const rowTotal = METRICS_AUTO.reduce((s,m) => s + (parseInt(data[m.key])||0), 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${DIAS_ES[i]}</td>
      <td>${formatDate(date, true)}</td>
      ${METRICS_AUTO.map(m => `<td>${parseInt(data[m.key])||0}</td>`).join('')}
      <td><strong>${rowTotal}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  const totRow = document.createElement('tr');
  totRow.className = 'totals-row';
  totRow.innerHTML = `<td colspan="2"><strong>TOTAL</strong></td>` +
    METRICS_AUTO.map(m => `<td style="color:${m.color}"><strong>${weekTotals[m.key]||0}</strong></td>`).join('') +
    `<td><strong>${METRICS_AUTO.reduce((s,m) => s+(weekTotals[m.key]||0), 0)}</strong></td>`;
  tbody.appendChild(totRow);
}

// ── Comparativa ───────────────────────────────────────────────────────────────

function renderComparativaSection() {
  const activeAgents = agentUsers.filter(u => u.active !== false);
  const topAgents    = activeAgents.slice(0, 8); // Radar se ve bien con hasta 8

  renderTeamRadarChart('chart-radar', topAgents, teamTotals,
    ['reunionesVerdes','preListing','preBuying','reservas','cierresVenta','llamados']);

  const sel = document.getElementById('comparativa-metric-sel');
  if (sel) {
    sel.innerHTML = METRICS_AUTO.map(m =>
      `<option value="${m.key}">${m.label}</option>`
    ).join('');
    sel.addEventListener('change', () => {
      renderTeamBarsChart('chart-comparativa-bars', activeAgents, teamTotals, sel.value);
    });
    renderTeamBarsChart('chart-comparativa-bars', activeAgents, teamTotals, sel.value || 'reunionesVerdes');
  }
}

// ── Gestión de usuarios ───────────────────────────────────────────────────────

function renderGestionSection() {
  renderPendingUsers();
  renderUserTable();
}

function renderPendingUsers() {
  const pending = allUsers.filter(u => u.role === 'agent' && u.active === false);
  const box = document.getElementById('pending-box');
  if (!box) return;

  box.style.display = pending.length > 0 ? 'block' : 'none';
  const list = document.getElementById('pending-list');
  if (!list) return;

  list.innerHTML = pending.map(u => `
    <div class="pending-item">
      <div>
        <strong>${escapeHtml(u.nombre)}</strong>
        <span class="text-muted">${escapeHtml(u.email)}</span>
      </div>
      <div class="pending-actions">
        <button class="btn btn-sm btn-success" onclick="activateUser('${u.uid}')">Activar</button>
        <button class="btn btn-sm btn-danger"  onclick="rejectUser('${u.uid}')">Rechazar</button>
      </div>
    </div>
  `).join('');
}

function renderUserTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  tbody.innerHTML = allUsers.filter(u => u.role !== 'broker' || u.uid !== brokerUser.uid).map(u => `
    <tr>
      <td>
        <div class="agent-name-cell">
          <span class="avatar-xs">${getInitials(u.nombre)}</span>
          ${escapeHtml(u.nombre)}
        </div>
      </td>
      <td>${escapeHtml(u.email)}</td>
      <td>
        <span class="role-badge role-${u.role}">${u.role === 'broker' ? 'Broker' : 'Agente'}</span>
      </td>
      <td>
        <span class="status-badge ${u.active === false ? 'status-inactive' : 'status-active'}">
          ${u.active === false ? 'Inactivo' : 'Activo'}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          ${u.active !== false
            ? `<button class="btn btn-sm btn-warning" onclick="toggleUserActive('${u.uid}', false)">Suspender</button>`
            : `<button class="btn btn-sm btn-success" onclick="toggleUserActive('${u.uid}', true)">Activar</button>`
          }
          ${u.role === 'agent'
            ? `<button class="btn btn-sm btn-outline" onclick="toggleUserRole('${u.uid}', 'broker')">↑ Promover</button>`
            : u.uid !== brokerUser.uid
              ? `<button class="btn btn-sm btn-outline" onclick="toggleUserRole('${u.uid}', 'agent')">↓ Bajar</button>`
              : ''
          }
        </div>
      </td>
    </tr>
  `).join('');
}

async function activateUser(uid) {
  if (!confirm('¿Activar este agente?')) return;
  await updateUserStatus(uid, true, brokerUser.uid);
  const u = allUsers.find(x => x.uid === uid);
  if (u) u.active = true;
  renderGestionSection();
  updatePendingBadge();
  showToast('Agente activado.');
}

async function rejectUser(uid) {
  if (!confirm('¿Rechazar y mantener inactivo este usuario?')) return;
  showToast('Usuario mantenido como inactivo.', 'info');
}

async function toggleUserActive(uid, active) {
  const label = active ? 'activar' : 'suspender';
  if (!confirm(`¿Querés ${label} este usuario?`)) return;
  await updateUserStatus(uid, active, brokerUser.uid);
  const u = allUsers.find(x => x.uid === uid);
  if (u) u.active = active;
  renderGestionSection();
  updatePendingBadge();
  showToast(`Usuario ${active ? 'activado' : 'suspendido'}.`);
}

async function toggleUserRole(uid, newRole) {
  const label = newRole === 'broker' ? 'promover a Broker' : 'bajar a Agente';
  if (!confirm(`¿Querés ${label} a este usuario?`)) return;
  await updateUserRole(uid, newRole, brokerUser.uid);
  const u = allUsers.find(x => x.uid === uid);
  if (u) u.role = newRole;
  agentUsers = allUsers.filter(u => u.role === 'agent');
  renderGestionSection();
  showToast(`Rol actualizado.`);
}

// ── Auditoría ─────────────────────────────────────────────────────────────────

async function loadAndRenderAuditoria() {
  const logs = await getAuditLog(100);
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;

  const actionLabels = {
    enable_agent:      '✅ Agente activado',
    disable_agent:     '🔴 Agente suspendido',
    promote_to_broker: '⬆️ Promovido a Broker',
    demote_to_agent:   '⬇️ Bajado a Agente',
  };

  tbody.innerHTML = logs.map(log => {
    const broker = allUsers.find(u => u.uid === log.performedBy);
    const target = allUsers.find(u => u.uid === log.targetUser);
    const ts     = log.timestamp ? log.timestamp.toDate().toLocaleString('es-AR') : '--';
    return `
      <tr>
        <td>${ts}</td>
        <td>${actionLabels[log.action] || log.action}</td>
        <td>${target ? escapeHtml(target.nombre) : log.targetUser}</td>
        <td>${broker ? escapeHtml(broker.nombre) : log.performedBy}</td>
      </tr>
    `;
  }).join('');
}
