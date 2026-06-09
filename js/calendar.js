const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
let calTokenClient = null;
let calAccessToken = null;

function initCalendarLib(clientId) {
  if (!clientId) return false;
  if (typeof google === 'undefined' || !google.accounts) return false;
  calTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: CAL_SCOPE,
    callback: function() {},
  });
  return true;
}

function requestCalendarAuth() {
  return new Promise(function(resolve, reject) {
    if (!calTokenClient) { reject('Calendar not initialized'); return; }
    calTokenClient.callback = function(resp) {
      if (resp.error) { reject(resp); return; }
      calAccessToken = resp.access_token;
      resolve(resp.access_token);
    };
    calTokenClient.requestAccessToken({ prompt: '' });
  });
}

async function fetchCalendarEvents(token, date) {
  var start = new Date(date);
  start.setHours(0, 0, 0, 0);
  var end = new Date(date);
  end.setHours(23, 59, 59, 999);
  var params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  var resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?' + params.toString(), {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!resp.ok) throw new Error('Error al conectar con Calendar');
  var data = await resp.json();
  return data.items || [];
}

function detectMetricsFromEvents(events) {
  var result = {};
  METRICS.forEach(function(m) { result[m.key] = { count: 0, events: [] }; });
  events.forEach(function(event) {
    var title = (event.summary || '').toLowerCase();
    METRICS.forEach(function(m) {
      var keywords = KEYWORDS[m.key] || [];
      if (keywords.some(function(kw) { return title.includes(kw); })) {
        result[m.key].count++;
        result[m.key].events.push(event);
      }
    });
  });
  return result;
}

function renderCalendarPanel() {
  var panel = document.getElementById('calendar-panel');
  if (!panel) return;
  var connected = !!calAccessToken;
  panel.innerHTML = '';
  if (!connected) {
    panel.innerHTML =
      '<div class="card" style="max-width:600px;margin:0 auto">' +
        '<div class="card-body" style="text-align:center;padding:32px 24px">' +
          '<div style="font-size:2.5rem;margin-bottom:12px">📅</div>' +
          '<h3 style="margin-bottom:8px">Conectá tu Google Calendar</h3>' +
          '<p style="color:var(--gray-500);margin-bottom:20px;font-size:0.9rem">' +
            'Vinculá tu calendario para que las actividades se carguen automáticamente.</p>' +
          '<button class="btn btn-primary btn-lg" onclick="handleCalendarConnect()">' +
            '🔗 Conectar Google Calendar</button>' +
          (!window.GOOGLE_CALENDAR_CLIENT_ID ? '<p style="margin-top:16px;font-size:0.8rem;color:var(--gray-400)">' +
            '⚠️ El administrador debe configurar el Client ID de Google en firebase-config.js</p>' : '') +
        '</div>' +
      '</div>';
    return;
  }
  panel.innerHTML =
    '<div class="card">' +
      '<div class="card-header">' +
        '<div class="card-title">✅ Google Calendar sincronizado</div>' +
        '<div><button class="btn btn-outline btn-sm" onclick="handleCalendarSync()">🔄 Sincronizar ahora</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="handleCalendarDisconnect()" style="margin-left:6px">Desconectar</button></div>' +
      '</div>' +
      '<div class="card-body" id="calendar-sync-result">' +
        '<p style="color:var(--gray-500)">Presioná "Sincronizar ahora" para detectar actividades del día de hoy.</p>' +
      '</div>' +
    '</div>';
}

async function handleCalendarConnect() {
  try {
    var token = await requestCalendarAuth();
    localStorage.setItem('cal_token', token);
    localStorage.setItem('cal_expires', String(Date.now() + 3500000));
    showToast('Google Calendar conectado', 'success');
    renderCalendarPanel();
  } catch (e) {
    showToast('Error al conectar: ' + (e.error || e), 'error');
  }
}

async function handleCalendarSync() {
  var token = calAccessToken;
  if (!token) {
    showToast('Conectá Google Calendar primero', 'error');
    return;
  }
  var resultDiv = document.getElementById('calendar-sync-result');
  if (!resultDiv) return;
  resultDiv.innerHTML = '<div class="spinner" style="margin:20px auto"></div><p style="text-align:center;color:var(--gray-500)">Analizando eventos...</p>';
  try {
    var today = new Date();
    var events = await fetchCalendarEvents(token, today);
    if (events.length === 0) {
      resultDiv.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:20px 0">📭 No hay eventos en tu calendario para hoy.</p>';
      return;
    }
    var detected = detectMetricsFromEvents(events);
    var hasMatches = false;
    var html = '<div style="margin-bottom:12px"><strong>📅 Eventos de hoy (' + events.length + ')</strong></div><div class="detected-metrics">';
    METRICS.forEach(function(m) {
      var calData = detected[m.key];
      if (calData && calData.count > 0) {
        hasMatches = true;
        html += '<div class="detected-chip" style="border-color:' + m.color + '">' +
          '<span class="detected-chip-dot" style="background:' + m.color + '"></span>' +
          '<span class="detected-chip-val" style="color:' + m.color + '">+' + calData.count + '</span>' +
          '<span>' + m.label + '</span></div>';
      }
    });
    html += '</div>';
    if (!hasMatches) {
      resultDiv.innerHTML = '<p style="color:var(--gray-500)">📭 No se detectaron actividades comerciales en los eventos de hoy. Revisá que los títulos de tus eventos contengan las palabras clave (ej: "Reunión verde", "Pre-listing", etc).</p>' +
        '<details style="margin-top:12px;font-size:0.82rem;color:var(--gray-400)"><summary>Ver todos los eventos</summary><div style="margin-top:8px">' +
        events.map(function(e) { return '<div style="padding:4px 0;border-bottom:1px solid var(--gray-100)">• ' + (e.summary || 'Sin título') + ' — ' + (e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'}) : 'todo el día') + '</div>'; }).join('') +
        '</div></details>';
      return;
    }
    html += '<div class="voice-result-actions" style="margin-top:16px">' +
      '<button class="btn btn-primary" onclick="applyCalendarMetrics()">✅ Cargar en el día de hoy</button>' +
      '<button class="btn btn-ghost" onclick="renderCalendarPanel()">Descartar</button></div>';
    html += '<details style="margin-top:12px;font-size:0.82rem;color:var(--gray-400)"><summary>Ver eventos detectados</summary><div style="margin-top:8px">' +
      events.map(function(e) {
        var title = e.summary || 'Sin título';
        var matched = METRICS.filter(function(m) {
          return (KEYWORDS[m.key] || []).some(function(kw) { return title.toLowerCase().includes(kw); });
        });
        return '<div style="padding:4px 0;border-bottom:1px solid var(--gray-100)">• ' + title +
          (matched.length ? ' → <strong>' + matched.map(function(m) { return m.label; }).join(', ') + '</strong>' : '') +
          ' — ' + (e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'}) : 'todo el día') +
          '</div>';
      }).join('') +
      '</div></details>';
    resultDiv.innerHTML = html;
    window._lastCalendarDetected = detected;
  } catch (e) {
    resultDiv.innerHTML = '<p style="color:var(--red)">Error al sincronizar: ' + e.message + '</p>';
  }
}

async function applyCalendarMetrics() {
  var detected = window._lastCalendarDetected;
  if (!detected) return;
  var todayKey = dateToKey(new Date());
  var updates = {};
  METRICS.forEach(function(m) {
    if (detected[m.key] && detected[m.key].count > 0) {
      updates[m.key] = detected[m.key].count;
    }
  });
  if (Object.keys(updates).length === 0) return;
  if (!pendingChanges[todayKey]) pendingChanges[todayKey] = {};
  Object.keys(updates).forEach(function(k) {
    pendingChanges[todayKey][k] = (pendingChanges[todayKey][k] || 0) + updates[k];
  });
  var total = Object.values(updates).reduce(function(a, b) { return a + b; }, 0);
  renderWeekTable();
  renderWeekTotals();
  updateSaveButton();
  renderCalendarPanel();
  showToast(total + ' actividad(es) cargada(s) desde Calendar', 'success');
}

function handleCalendarDisconnect() {
  calAccessToken = null;
  localStorage.removeItem('cal_token');
  localStorage.removeItem('cal_expires');
  renderCalendarPanel();
  showToast('Google Calendar desconectado', 'info');
}

function restoreCalendarSession() {
  var token = localStorage.getItem('cal_token');
  var expires = parseInt(localStorage.getItem('cal_expires') || '0');
  if (token && expires > Date.now()) {
    calAccessToken = token;
    return true;
  }
  return false;
}
