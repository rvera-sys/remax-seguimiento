const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const http = require('http');
const fs = require('fs');
const path = require('path');

const sa = require('./service-account.json');
admin.initializeApp({ credential: admin.cert(sa) });
const db = getFirestore();

const OAUTH = require('./client_secret.json').web;
const TOKENS_FILE = path.join(__dirname, 'tokens.json');
const PORT = 3457;

var tokens = {};

function loadTokens() {
  try { tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')); }
  catch (e) { tokens = {}; }
  var n = Object.keys(tokens).length;
  console.log('  Token file loaded: ' + n + ' user(s)');
}

function persistTokens() {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

function parseBody(req) {
  return new Promise(function(resolve) {
    var chunks = [];
    req.on('data', function(c) { chunks.push(c); });
    req.on('end', function() { resolve(Buffer.concat(chunks).toString()); });
  });
}

async function exchangeCode(code) {
  var resp = await fetch(OAUTH.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code,
      client_id: OAUTH.client_id,
      client_secret: OAUTH.client_secret,
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code'
    })
  });
  var data = await resp.json();
  if (!resp.ok) {
    var err = data.error_description || data.error || 'Error exchanging code';
    throw new Error(err);
  }
  return data;
}

async function refreshToken(rt) {
  var resp = await fetch(OAUTH.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: rt,
      client_id: OAUTH.client_id,
      client_secret: OAUTH.client_secret,
      grant_type: 'refresh_token'
    })
  });
  var data = await resp.json();
  if (!resp.ok) {
    var err = data.error_description || data.error || 'Error refreshing token';
    throw new Error(err);
  }
  return data.access_token;
}

// ── KEYWORDS & METRICS (mismas que calendar.js) ─────────────────────────────

var KEYWORDS = {
  reunionesVerdes:  ['reunion verde','reunión verde','reunion comercial','reunión comercial','cita','entrevista'],
  visitas:          ['visita','mostrar','exhibicion','exhibición','recorrido','open house'],
  prelistings:      ['pre-listing','prelisting','pre listing','presupuesto','presupuestar','tasacion','tasación','presentacion','presentación'],
  listings:         ['listing','listado','toma de propiedad','mandato'],
  buyings:          ['buying','compra','adquisicion','adquisición'],
  ventas:           ['venta','cerrado','cerramos','vendido','vendida','se vende'],
  desarrollo:       ['desarrollo','nuevo proyecto','terreno','loteo'],
  llamados:         ['llamado','llamada','llamo','llamé','telefono','teléfono','contacto telefonico','contacto telefónico'],
  contactos:        ['contacto','whatsapp','wp','mensaje','consulta','mail','email','correo'],
  prospeccion:      ['prospeccion','prospección','captacion','captación','busqueda','búsqueda','cartera','bd','base','prospecto'],
  posventa:         ['post-venta','postventa','posventa','pos-venta','seguimiento posterior','satisfaccion','satisfacción'],
  publicidad:       ['publicidad','publicacion','publicación','anuncio','redes','instagram','facebook','google ads','ml','mercadolibre'],
  capacitacion:     ['capacitacion','capacitación','formacion','formación','curso','entrenamiento','training','seminario','webinar','taller'],
  tramites:         ['tramite','trámite','tramites','trámites','papeles','documentacion','documentación','escritura','registro','informe']
};

var METRICS = [
  { key:'reunionesVerdes', label:'Reuniones verdes', color:'#059669' },
  { key:'visitas',         label:'Visitas',          color:'#0891b2' },
  { key:'prelistings',     label:'Pre-listings',     color:'#7c3aed' },
  { key:'listings',        label:'Listings',         color:'#dc2626' },
  { key:'buyings',         label:'Buyings',          color:'#ea580c' },
  { key:'ventas',          label:'Ventas',           color:'#16a34a' },
  { key:'desarrollo',      label:'Desarrollo',       color:'#9333ea' },
  { key:'llamados',        label:'Llamados',         color:'#2563eb' },
  { key:'contactos',       label:'Contactos',        color:'#0d9488' },
  { key:'prospeccion',     label:'Prospección',      color:'#4f46e5' },
  { key:'posventa',        label:'Post-venta',       color:'#be185d' },
  { key:'publicidad',      label:'Publicidad',       color:'#d97706' },
  { key:'capacitacion',    label:'Capacitación',     color:'#65a30d' },
  { key:'tramites',        label:'Trámites',         color:'#78716c' }
];

function dateToKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

async function fetchEvents(token, date) {
  var s = new Date(date); s.setHours(0,0,0,0);
  var e = new Date(date); e.setHours(23,59,59,999);
  var p = new URLSearchParams({
    timeMin: s.toISOString(), timeMax: e.toISOString(),
    singleEvents: 'true', orderBy: 'startTime'
  });
  var resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?' + p, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!resp.ok) throw new Error('Calendar API: ' + resp.status);
  var data = await resp.json();
  return data.items || [];
}

function detectMetrics(events) {
  var result = {};
  METRICS.forEach(function(m) { result[m.key] = 0; });
  events.forEach(function(ev) {
    var title = (ev.summary || '').toLowerCase();
    METRICS.forEach(function(m) {
      var words = KEYWORDS[m.key] || [];
      if (words.some(function(w) { return title.includes(w); })) {
        result[m.key]++;
      }
    });
  });
  return result;
}

async function applyMetricsToFirestore(uid, detected, todayKey) {
  var dayRef = db.collection('tracking').doc(uid).collection('days').doc(todayKey);
  await db.runTransaction(async function(t) {
    var doc = await t.get(dayRef);
    var existing = doc.exists ? doc.data() : {};
    var updates = {};
    METRICS.forEach(function(m) {
      if (detected[m.key] > 0) {
        updates[m.key] = (parseInt(existing[m.key]) || 0) + detected[m.key];
      }
    });
    if (Object.keys(updates).length === 0) return;
    updates.updatedAt = FieldValue.serverTimestamp();
    t.set(dayRef, updates, { merge: true });
  });
}

async function syncUser(uid) {
  var rt = tokens[uid];
  if (!rt) return;
  try {
    var token = await refreshToken(rt);
    var events = await fetchEvents(token, new Date());
    if (events.length === 0) return;
    var detected = detectMetrics(events);
    var total = Object.values(detected).reduce(function(a,b) { return a+b; }, 0);
    if (total === 0) return;
    var todayKey = dateToKey(new Date());
    await applyMetricsToFirestore(uid, detected, todayKey);
    console.log('  ✅ ' + uid + ' → ' + total + ' metricas');
  } catch (e) {
    if (e.message && e.message.includes('invalid_grant')) {
      console.log('  ⚠️  Refresh token expirado para ' + uid + ', eliminando...');
      delete tokens[uid];
      persistTokens();
    } else {
      console.log('  ⚠️  ' + uid + ': ' + e.message);
    }
  }
}

async function syncAll() {
  var uids = Object.keys(tokens);
  if (uids.length === 0) { return; }
  console.log('[' + new Date().toISOString() + '] Sync ' + uids.length + ' user(s)...');
  for (var i = 0; i < uids.length; i++) {
    await syncUser(uids[i]);
  }
}

// ── HTTP Server ────────────────────────────────────────────────────────────────

var server = http.createServer(async function(req, res) {
  var cors = function() {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  };

  if (req.method === 'OPTIONS') {
    cors(); res.writeHead(204); res.end(); return;
  }

  cors();

  if (req.method === 'POST' && req.url === '/api/calendar/exchange-code') {
    try {
      var body = JSON.parse(await parseBody(req));
      if (!body.code) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing code' })); return; }
      var data = await exchangeCode(body.code);
      var uid = body.uid;
      if (data.refresh_token && uid) {
        tokens[uid] = data.refresh_token;
        persistTokens();
      }
      res.writeHead(200);
      res.end(JSON.stringify({
        access_token: data.access_token,
        expires_in: data.expires_in || 3600
      }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', users: Object.keys(tokens).length }));
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/calendar/token')) {
    var url = new URL(req.url, 'http://localhost');
    var uid = url.searchParams.get('uid');
    if (!uid || !tokens[uid]) {
      res.writeHead(404); res.end(JSON.stringify({ error: 'No refresh token for user' })); return;
    }
    try {
      var accessToken = await refreshToken(tokens[uid]);
      res.writeHead(200); res.end(JSON.stringify({ access_token: accessToken, expires_in: 3600 }));
    } catch (e) {
      if (e.message && e.message.includes('invalid_grant')) {
        delete tokens[uid]; persistTokens();
      }
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, function() {
  console.log('Sync server on :' + PORT);
  loadTokens();
  syncAll();
  setInterval(syncAll, 3600000);
});
