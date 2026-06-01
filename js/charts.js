// ─── GRÁFICOS — CHART.JS ─────────────────────────────────────────────────────

const CHART_COLORS = {
  blue:      '#003DA5',
  blueLight: '#4d80cc',
  red:       '#CC0000',
  redLight:  '#e66060',
  green:     '#27ae60',
  yellow:    '#f39c12',
  purple:    '#6b21a8',
  gray:      '#6C757D',
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { font: { family: 'Inter, system-ui, sans-serif', size: 12 }, boxWidth: 12 }
    },
    tooltip: { bodyFont: { family: 'Inter, system-ui, sans-serif' } }
  },
  scales: {
    x: { ticks: { font: { family: 'Inter, system-ui, sans-serif', size: 11 } } },
    y: { ticks: { font: { family: 'Inter, system-ui, sans-serif', size: 11 } }, beginAtZero: true }
  }
};

// Destroys existing chart instance if canvas already has one
function destroyChart(canvasId) {
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();
}

// Gráfico de barras mensuales para el dashboard del agente
function renderMonthlyBarsChart(canvasId, monthlyTotals, metricKeys) {
  destroyChart(canvasId);
  const labels = MESES_ES.map(m => m.substring(0, 3));
  const datasets = metricKeys.map(key => {
    const cfg = METRICS.find(m => m.key === key);
    return {
      label: cfg ? cfg.short : key,
      data:  Array.from({ length: 12 }, (_, i) => monthlyTotals[i] ? (monthlyTotals[i][key] || 0) : 0),
      backgroundColor: cfg ? cfg.color + 'cc' : '#003DA5cc',
      borderColor:     cfg ? cfg.color : '#003DA5',
      borderWidth: 1,
      borderRadius: 4,
    };
  });

  new Chart(canvasId, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, legend: { ...CHART_DEFAULTS.plugins.legend, position: 'top' } }
    }
  });
}

// Gráfico de líneas — evolución de una métrica mes a mes
function renderMonthlyLineChart(canvasId, monthlyTotals, metricKey) {
  destroyChart(canvasId);
  const cfg = METRICS.find(m => m.key === metricKey);
  const data = Array.from({ length: 12 }, (_, i) => monthlyTotals[i] ? (monthlyTotals[i][metricKey] || 0) : 0);

  new Chart(canvasId, {
    type: 'line',
    data: {
      labels: MESES_ES.map(m => m.substring(0, 3)),
      datasets: [{
        label:           cfg ? cfg.label : metricKey,
        data,
        borderColor:     cfg ? cfg.color : CHART_COLORS.blue,
        backgroundColor: cfg ? cfg.color + '22' : CHART_COLORS.blue + '22',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: cfg ? cfg.color : CHART_COLORS.blue,
        pointRadius: 4,
      }]
    },
    options: CHART_DEFAULTS
  });
}

// Embudo de conversión (doughnut o horizontal bar)
function renderFunnelChart(canvasId, totals) {
  destroyChart(canvasId);
  const labels = FUNNEL.map(f => f.label);
  const data   = FUNNEL.map(f => totals[f.key] || 0);
  const colors = [CHART_COLORS.green, CHART_COLORS.blue, CHART_COLORS.blueLight,
                  CHART_COLORS.yellow, CHART_COLORS.red, CHART_COLORS.redLight];

  new Chart(canvasId, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Actividades acumuladas',
        data,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor:     colors,
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } }
    }
  });
}

// Radar del equipo: comparar múltiples agentes en métricas clave
function renderTeamRadarChart(canvasId, agentProfiles, teamTotals, keys) {
  destroyChart(canvasId);
  const palette = ['#003DA5','#CC0000','#27ae60','#f39c12','#6b21a8','#0055b3','#e67e22'];

  const datasets = agentProfiles.map((agent, i) => {
    const totals = teamTotals[agent.uid] || {};
    return {
      label: escapeHtml(agent.nombre),
      data:  keys.map(k => totals[k] || 0),
      backgroundColor: palette[i % palette.length] + '33',
      borderColor:     palette[i % palette.length],
      borderWidth: 2,
      pointBackgroundColor: palette[i % palette.length],
    };
  });

  new Chart(canvasId, {
    type: 'radar',
    data: {
      labels: keys.map(k => { const m = METRICS.find(x => x.key === k); return m ? m.short : k; }),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          ticks: { font: { size: 10 } },
          pointLabels: { font: { size: 11, family: 'Inter, system-ui, sans-serif' } }
        }
      },
      plugins: { legend: { labels: { font: { family: 'Inter, system-ui, sans-serif', size: 12 }, boxWidth: 12 } } }
    }
  });
}

// Barras comparativas del equipo para una métrica
function renderTeamBarsChart(canvasId, agentProfiles, totalsMap, metricKey) {
  destroyChart(canvasId);
  const cfg = METRICS.find(m => m.key === metricKey);
  const labels = agentProfiles.map(a => escapeHtml(a.nombre.split(' ')[0]));
  const data   = agentProfiles.map(a => (totalsMap[a.uid] || {})[metricKey] || 0);

  new Chart(canvasId, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: cfg ? cfg.label : metricKey,
        data,
        backgroundColor: CHART_COLORS.blue + 'cc',
        borderColor:     CHART_COLORS.blue,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } }
    }
  });
}
