// ============================================
// CHARTS.JS - ANALISI E STATISTICHE AVANZATE
// ============================================

let timelineChart = null;
let typeChart = null;
let radarChart = null;
let allData = [];

// Caricamento Dati per Grafici
async function loadTimelineData() {
  try {
    const res = await fetch('assets/data/events_timeline.json');
    if(!res.ok) throw new Error("File timeline non trovato");
    
    const json = await res.json();
    allData = json.events.map(e => ({
      date: e.date, // Formato YYYY-MM-DD
      dateObj: new Date(e.date),
      type: e.type || 'Unknown',
      intensity: parseFloat(e.intensity) || 0.2, // Importante per il Radar
      verification: e.verification || 'not verified'
    }));

    console.log(`📊 Grafici: ${allData.length} eventi caricati.`);
    updateAllCharts(allData);
    populateFilters(allData);

  } catch (e) {
    console.error("Errore Charts:", e);
  }
}

// Funzione Principale di Aggiornamento
function updateAllCharts(data) {
  renderTimelineChart(data);
  renderTypeChart(data);
  renderRadarChart(data);
}

// 1. GRAFICO TIMELINE (Barre)
function renderTimelineChart(data) {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  // Aggregazione per data
  const counts = {};
  data.forEach(e => {
    counts[e.date] = (counts[e.date] || 0) + 1;
  });
  
  const sortedDates = Object.keys(counts).sort();
  const values = sortedDates.map(d => counts[d]);

  if (timelineChart) timelineChart.destroy();

  timelineChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedDates.map(d => new Date(d).toLocaleDateString('it-IT', {day:'2-digit', month:'short'})),
      datasets: [{
        label: 'Frequenza Attacchi',
        data: values,
        backgroundColor: 'rgba(69, 162, 158, 0.7)',
        borderColor: '#45a29e',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// 2. GRAFICO A TORTA (Distribuzione Tipi)
function renderTypeChart(data) {
  const ctx = document.getElementById('typeDistributionChart');
  if (!ctx) return;

  const counts = {};
  data.forEach(e => {
    let t = e.type.trim();
    if(t === '') t = 'Sconosciuto';
    counts[t] = (counts[t] || 0) + 1;
  });

  if (typeChart) typeChart.destroy();

  typeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: [
          '#45a29e', '#66fcf1', '#1f2833', '#c5c6c7', '#dc3545', '#ffc107'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12 } },
        title: { display: true, text: 'Tipologia Attacchi' }
      }
    }
  });
}

// 3. GRAFICO RADAR (Intensità Media per Tipo)
function renderRadarChart(data) {
  const ctx = document.getElementById('intensityRadarChart');
  if (!ctx) return;

  const stats = {};
  data.forEach(e => {
    let t = e.type.trim() || 'Sconosciuto';
    if (!stats[t]) stats[t] = { sum: 0, count: 0 };
    stats[t].sum += (e.intensity || 0.2);
    stats[t].count++;
  });

  const labels = Object.keys(stats);
  const values = labels.map(k => (stats[k].sum / stats[k].count).toFixed(2));

  if (radarChart) radarChart.destroy();

  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Intensità Media (Danni)',
        data: values,
        backgroundColor: 'rgba(220, 53, 69, 0.2)',
        borderColor: '#dc3545',
        pointBackgroundColor: '#dc3545',
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: '#eee' },
          grid: { color: '#eee' },
          suggestedMin: 0,
          suggestedMax: 1
        }
      },
      plugins: { title: { display: true, text: 'Danno Medio per Arma' } }
    }
  });
}

// --- FILTRI ---
function populateFilters(data) {
  const typeSelect = document.getElementById('chartTypeFilter');
  if(!typeSelect) return;
  
  const types = [...new Set(data.map(e => e.type))].sort();
  typeSelect.innerHTML = '<option value="">Tutti i tipi</option>';
  types.forEach(t => {
    if(t) typeSelect.innerHTML += `<option value="${t}">${t}</option>`;
  });
}

// Listener Filtri
function applyFilters() {
  const start = document.getElementById('chartStartDate').value;
  const end = document.getElementById('chartEndDate').value;
  const type = document.getElementById('chartTypeFilter').value;

  const filtered = allData.filter(e => {
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;
    if (type && e.type !== type) return false;
    return true;
  });

  updateAllCharts(filtered);
}

// Avvio
document.addEventListener('DOMContentLoaded', () => {
  loadTimelineData();
  
  // Bind eventi filtri
  ['chartStartDate', 'chartEndDate', 'chartTypeFilter'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', applyFilters);
  });
  
  const reset = document.getElementById('resetChartFilters');
  if(reset) reset.addEventListener('click', () => {
    document.getElementById('chartStartDate').value = '';
    document.getElementById('chartEndDate').value = '';
    document.getElementById('chartTypeFilter').value = '';
    updateAllCharts(allData);
  });
});
