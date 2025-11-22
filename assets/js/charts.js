// ============================================
// CHARTS.JS - ANALYTICS SUITE
// ============================================

let charts = {
  timeline: null,
  type: null,
  radar: null
};

let analyticsData = [];

// Caricamento Dati
async function initCharts() {
  try {
    // Usiamo il JSON della timeline perché ha i dati ben formattati
    const res = await fetch('assets/data/events_timeline.json');
    if(!res.ok) throw new Error("Dati timeline non disponibili");
    
    const json = await res.json();
    
    // Normalizzazione dati
    analyticsData = json.events.map(e => ({
      date: e.date, // YYYY-MM-DD
      dateObj: new Date(e.date),
      type: e.type || 'Generico',
      intensity: parseFloat(e.intensity || 0.2), // Fallback
      group: e.group // Per filtri
    }));

    console.log(`📊 Analytics: caricati ${analyticsData.length} record.`);
    
    // Prima renderizzazione
    updateDashboard(analyticsData);
    
    // Popola dropdown filtri (chiamiamo funzione UI se esiste)
    populateSelectFilter(analyticsData);

  } catch (e) {
    console.error("Errore Charts:", e);
  }
}

// Funzione centrale di aggiornamento
function updateDashboard(data) {
  renderTimelineChart(data);
  renderTypeChart(data);
  renderRadarChart(data);
}

// --- 1. GRAFICO TEMPORALE (Barre Verticali) ---
function renderTimelineChart(data) {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  // Aggregazione per Mese-Anno (più leggibile dei giorni singoli)
  const aggregated = {};
  data.forEach(e => {
    const key = e.date.substring(0, 7); // "2025-10"
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
        backgroundColor: '#002060', // ACLED Navy
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
        y: { beginAtZero: true, grid: { color: '#e0e0e0' } }
      }
    }
  });
}

// --- 2. GRAFICO A TORTA (Distribuzione Tipologie) ---
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
          '#78909c'  // Light Blue Grey
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

// --- 3. GRAFICO RADAR (Analisi Intensità) ---
function renderRadarChart(data) {
  const ctx = document.getElementById('intensityRadarChart');
  if (!ctx) return;

  // Calcola intensità media per tipo
  const stats = {};
  data.forEach(e => {
    const t = e.type || 'Sconosciuto';
    if (!stats[t]) stats[t] = { sum: 0, count: 0 };
    
    // Usa l'intensità se presente nel JSON (la tua AI la genera)
    // Se il JSON non ha il campo intensity esplicito nel nodo root, prova a calcolarlo o usa default
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
        label: 'Indice di Danno Medio',
        data: values,
        backgroundColor: 'rgba(183, 28, 28, 0.2)', // Red transparent
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
          ticks: { display: false } // Nascondi numeri asse per pulizia
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// --- UTILS INTERFACCIA ---
function populateSelectFilter(data) {
  const select = document.getElementById('chartTypeFilter');
  if (!select) return;
  
  // Pulisci tranne la prima option
  select.innerHTML = '<option value="">Tutti gli eventi</option>';
  
  const types = [...new Set(data.map(e => e.type))].sort();
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });
}

// Gestore Eventi Filtri Sidebar
function setupFilters() {
  const btn = document.getElementById('applyFilters');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    const type = document.getElementById('chartTypeFilter').value;
    // Nota: i checkbox di intensità possono essere aggiunti qui

    const filtered = analyticsData.filter(e => {
      if (start && e.date < start) return false;
      if (end && e.date > end) return false;
      if (type && e.type !== type) return false;
      return true;
    });

    console.log(`🔍 Filtri applicati. Rimasti: ${filtered.length}`);
    updateDashboard(filtered);
    
    // Se possibile, aggiorna anche la mappa (richiederebbe integrazione tra i due file)
    // Per ora aggiorna i grafici che è il compito di questo file
  });

  // Reset
  document.getElementById('resetFilters')?.addEventListener('click', () => {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('chartTypeFilter').value = '';
    updateDashboard(analyticsData);
  });
}

// Avvio
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  setupFilters();
});
