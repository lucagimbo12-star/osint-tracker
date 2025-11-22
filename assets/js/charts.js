// ============================================
// CHARTS.JS - ACLED ANALYTICS SUITE
// ============================================

let charts = {
  timeline: null,
  type: null,
  radar: null
};

let allData = [];

// --- 1. CARICAMENTO DATI ---
async function loadTimelineData() {
  try {
    // Usiamo il JSON della timeline che è già formattato bene dal backend
    const res = await fetch('assets/data/events_timeline.json');
    if(!res.ok) throw new Error("Dati timeline non disponibili");
    
    const json = await res.json();
    
    // Normalizzazione per i grafici
    allData = json.events.map(e => ({
      date: e.date, // YYYY-MM-DD
      dateObj: new Date(e.date),
      type: e.type || 'Sconosciuto',
      // Se l'AI non ha messo intensity, usiamo un fallback o cerchiamo di dedurlo
      intensity: e.intensity ? parseFloat(e.intensity) : 0.2, 
      group: e.group
    }));

    console.log(`📊 Analytics: caricati ${allData.length} record.`);
    
    // Prima renderizzazione
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

  // Aggregazione per Mese (più pulito di giorno per giorno)
  const aggregated = {};
  data.forEach(e => {
    const key = e.date.substring(0, 7); // Prende "2025-10"
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
        backgroundColor: '#002060', // ACLED Navy Blue
        borderRadius: 4,
        barPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#e0e0e0' } }
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
        backgroundColor: [
          '#002060', // Navy
          '#b71c1c', // Red
          '#f57c00', // Orange
          '#fbc02d', // Yellow
          '#546e7a', // Blue Grey
          '#78909c'  // Light Blue
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } }
      },
      cutout: '65%'
    }
  });
}

// --- 5. GRAFICO RADAR (Intensità Media) ---
function renderRadarChart(data) {
  const ctx = document.getElementById('intensityRadarChart');
  if (!ctx) return;

  // Calcola intensità media per tipo
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
        backgroundColor: 'rgba(183, 28, 28, 0.2)', // Rosso trasparente
        borderColor: '#b71c1c',
        pointBackgroundColor: '#b71c1c',
        pointBorderColor: '#fff'
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
          suggestedMax: 1,
          ticks: { display: false } 
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
    updateDashboard(allData);
  });
}

// Avvio
document.addEventListener('DOMContentLoaded', () => {
  loadTimelineData();
  setupChartFilters();
});
