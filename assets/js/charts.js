// ============================================
// CHARTS.JS - ANALYTICS SUITE (OPTIMIZED)
// ============================================

let charts = {
  timeline: null,
  type: null,
  radar: null
};

let allChartData = []; // Rinominato per chiarezza

// Configurazione Colori Theme
const THEME = {
  primary: '#f59e0b',      // Amber 500
  primaryAlpha: 'rgba(245, 158, 11, 0.7)',
  secondary: '#0f172a',    // Slate 900
  text: '#94a3b8',         // Slate 400
  grid: '#334155',         // Slate 700
  palette: [
    '#f59e0b', '#ef4444', '#f97316', '#eab308', '#64748b', '#3b82f6'
  ]
};

Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = THEME.text;
Chart.defaults.scale.grid.color = THEME.grid;

// --- 1. INIZIALIZZAZIONE (Chiamata da map.js) ---
// Non scarichiamo più i dati qui. Li riceviamo dalla mappa.
window.initCharts = function(events) {
  if (!events || events.length === 0) return;

  console.log(`📊 Charts: ricezione di ${events.length} eventi.`);

  // Normalizzazione Dati (Se necessario, ma map.js passa già oggetti puliti)
  allChartData = events.map(e => ({
    date: e.date, 
    type: e.type || 'Sconosciuto',
    intensity: e.intensity ? parseFloat(e.intensity) : 0.2
  }));

  updateDashboard(allChartData);
  populateFilters(allChartData);
  setupChartFilters(); // Attiva i listener
};

// --- 2. AGGIORNAMENTO DASHBOARD ---
function updateDashboard(data) {
  renderTimelineChart(data);
  renderTypeChart(data);
  renderRadarChart(data);
}

// --- 3. GRAFICO TEMPORALE ---
function renderTimelineChart(data) {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  // Aggregazione Mensile (Data: YYYY-MM-DD)
  const aggregated = {};
  data.forEach(e => {
    if(!e.date) return;
    const key = e.date.substring(0, 7); // Prende "YYYY-MM"
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
        backgroundColor: THEME.primary,
        borderRadius: 4,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: THEME.grid } }
      }
    }
  });
}

// --- 4. GRAFICO A TORTA ---
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
      responsive: true, maintainAspectRatio: false,
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

// --- 5. GRAFICO RADAR ---
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
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: THEME.primary,
        pointBackgroundColor: THEME.primary,
        pointBorderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: THEME.grid },
          grid: { color: THEME.grid },
          pointLabels: { color: THEME.text, font: { size: 11 } },
          suggestedMin: 0, suggestedMax: 1,
          ticks: { display: false, backdropColor: 'transparent' } 
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// --- UTILS FILTRI ---
function populateFilters(data) {
  const select = document.getElementById('chartTypeFilter');
  if (!select) return;
  
  // Salva la selezione corrente se c'è
  const current = select.value;
  select.innerHTML = '<option value="">Tutti gli eventi</option>';
  
  const types = [...new Set(data.map(e => e.type))].sort();
  types.forEach(t => {
    if(t) select.innerHTML += `<option value="${t}">${t}</option>`;
  });
  
  if(current) select.value = current;
}

function setupChartFilters() {
  const btn = document.getElementById('applyFilters');
  if (!btn) return;

  // Rimuoviamo vecchi listener clonando l'elemento (hack veloce per evitare duplicati)
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener('click', () => {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    const type = document.getElementById('chartTypeFilter').value;

    const filtered = allChartData.filter(e => {
      if (start && e.date < start) return false;
      if (end && e.date > end) return false;
      if (type && e.type !== type) return false;
      return true;
    });

    console.log(`Filtro applicato: ${filtered.length} eventi.`);
    
    // Aggiorna sia i grafici CHE la mappa (globale se accessibile, o solo grafici qui)
    updateDashboard(filtered);
    
    // Se vogliamo aggiornare anche la mappa da qui, possiamo chiamare una funzione di map.js
    if(window.updateMap) window.updateMap(filtered);
  });
  
  // Reset Listener
  const resetBtn = document.getElementById('resetFilters');
  if(resetBtn) {
     const newReset = resetBtn.cloneNode(true);
     resetBtn.parentNode.replaceChild(newReset, resetBtn);
     
     newReset.addEventListener('click', () => {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('chartTypeFilter').value = '';
        
        updateDashboard(allChartData);
        if(window.updateMap) window.updateMap(allChartData);
     });
  }
}
