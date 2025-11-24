// ============================================
// CHARTS.JS - ANALYTICS SUITE (SLATE & AMBER)
// ============================================

let charts = {
  timeline: null,
  type: null,
  radar: null
};

let allData = [];

// Configurazione Colori Tema Slate & Amber
const THEME = {
  primary: '#f59e0b',      // Amber 500
  primaryAlpha: 'rgba(245, 158, 11, 0.7)',
  secondary: '#0f172a',    // Slate 900
  text: '#94a3b8',         // Slate 400
  grid: '#334155',         // Slate 700
  palette: [
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#64748b', // Slate
    '#3b82f6'  // Blue (accento freddo)
  ]
};

// Default Font Settings
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = THEME.text;
Chart.defaults.scale.grid.color = THEME.grid;

// --- 1. CARICAMENTO DATI ---
async function loadTimelineData() {
  try {
    const res = await fetch('assets/data/events_timeline.json');
    if(!res.ok) throw new Error("Dati timeline non disponibili");
    
    const json = await res.json();
    
    // Normalizzazione
    allData = json.events.map(e => ({
      date: e.date, // YYYY-MM-DD
      dateObj: new Date(e.date),
      type: e.type || 'Sconosciuto',
      intensity: e.intensity ? parseFloat(e.intensity) : 0.2, 
      group: e.group
    }));

    console.log(`📊 Analytics: caricati ${allData.length} record.`);
    
    // Renderizza
    updateDashboard(allData);
    populateFilters(allData);

  } catch (e) {
    console.error("Errore Charts:", e);
  }
}

// --- 2. AGGIORNAMENTO DASHBOARD ---
function updateDashboard(data) {
  renderTimelineChart(data);
  renderTypeChart(data);
  renderRadarChart(data);
}

// --- 3. GRAFICO TEMPORALE (Barre) ---
function renderTimelineChart(data) {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  // Aggregazione Mensile
  const aggregated = {};
  data.forEach(e => {
    const key = e.date.substring(0, 7); 
    aggregated[key] = (aggregated[key] || 0) + 1;
  });

  const labels = Object.keys(aggregated).sort();
  const values = labels.map(k => aggregated[k]);

  if (charts.timeline) charts.timeline.destroy();

  charts.timeline = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Eventi Mensili',
        data: values,
        backgroundColor: THEME.primary, // Amber
        borderRadius: 4,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: THEME.grid } }
      }
    }
  });
}

// --- 4. GRAFICO A TORTA (Tipologie) ---
function renderTypeChart(data) {
  const ctx = document.getElementById('typeDistributionChart');
  if (!ctx) return;

  const counts = {};
  data.forEach(e => {
    const t = e.type || 'Sconosciuto';
    counts[t] = (counts[t] || 0) + 1;
  });

  if (charts.type) charts.type.destroy();

  charts.type = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: THEME.palette,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          position: 'right', 
          labels: { boxWidth: 12, font: { size: 11 }, color: THEME.text } 
        }
      },
      cutout: '70%'
    }
  });
}

// --- 5. GRAFICO RADAR (Intensità Media) ---
function renderRadarChart(data) {
  const ctx = document.getElementById('intensityRadarChart');
  if (!ctx) return;

  const stats = {};
  data.forEach(e => {
    const t = e.type || 'Sconosciuto';
    if (!stats[t]) stats[t] = { sum: 0, count: 0 };
    
    let val = e.intensity;
    if (isNaN(val)) val = 0.2; 
    
    stats[t].sum += val;
    stats[t].count++;
  });

  const labels = Object.keys(stats);
  const values = labels.map(k => (stats[k].sum / stats[k].count).toFixed(2));

  if (charts.radar) charts.radar.destroy();

  charts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Indice Danno Medio',
        data: values,
        backgroundColor: 'rgba(245, 158, 11, 0.2)', // Amber Transparent
        borderColor: THEME.primary,
        pointBackgroundColor: THEME.primary,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: THEME.grid },
          grid: { color: THEME.grid },
          pointLabels: { color: THEME.text, font: { size: 11 } },
          suggestedMin: 0,
          suggestedMax: 1,
          ticks: { display: false, backdropColor: 'transparent' } 
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// --- UTILS INTERFACCIA ---
function populateFilters(data) {
  const select = document.getElementById('chartTypeFilter');
  if (!select) return;
  
  select.innerHTML = '<option value="">Tutti gli eventi</option>';
  const types = [...new Set(data.map(e => e.type))].sort();
  types.forEach(t => {
    if(t) select.innerHTML += `<option value="${t}">${t}</option>`;
  });
}

// Listener Filtri (Collegati alla Sidebar)
function setupChartFilters() {
  const btn = document.getElementById('applyFilters');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    const type = document.getElementById('chartTypeFilter').value;

    const filtered = allData.filter(e => {
      if (start && e.date < start) return false;
      if (end && e.date > end) return false;
      if (type && e.type !== type) return false;
      return true;
    });

    updateDashboard(filtered);
  });

  // Reset
  document.getElementById('resetFilters')?.addEventListener('click', () => {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('chartTypeFilter').value = '';
    updateDashboard(allData);
  });
}

// Avvio
document.addEventListener('DOMContentLoaded', () => {
  loadTimelineData();
  setupChartFilters();
});
