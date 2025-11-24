// ============================================
// CHARTS.JS - LOGICA FILTRI & GRAFICI (FIXED)
// ============================================

let charts = {
  timeline: null,
  type: null,
  radar: null
};

// Variabile Globale che contiene SEMPRE tutti i dati originali
// Non modificarla mai dopo il caricamento iniziale!
let ORIGINAL_DATA = []; 

const THEME = {
  primary: '#f59e0b',
  primaryAlpha: 'rgba(245, 158, 11, 0.7)',
  secondary: '#0f172a',
  text: '#94a3b8',
  grid: '#334155',
  palette: ['#f59e0b', '#ef4444', '#f97316', '#eab308', '#64748b', '#3b82f6']
};

Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = THEME.text;
Chart.defaults.scale.grid.color = THEME.grid;

// --- 1. INIZIALIZZAZIONE (Chiamata da map.js) ---
window.initCharts = function(events) {
  if (!events || events.length === 0) return;

  console.log(`🚀 InitCharts: Caricati ${events.length} eventi totali.`);

  // SALVIAMO I DATI IN UNA VARIABILE PROTETTA (Copia profonda)
  ORIGINAL_DATA = [...events];

  // Prima esecuzione: mostriamo tutto
  updateDashboard(ORIGINAL_DATA);
  populateFilters(ORIGINAL_DATA);
  setupChartFilters();
};

// --- 2. LOGICA FILTRI (Il Cuore del Problema) ---
function setupChartFilters() {
  const btn = document.getElementById('applyFilters');
  const resetBtn = document.getElementById('exportData'); // Nota: Hai chiamato Export o Reset il tasto grigio? Controllo ID.
  // Nel tuo HTML il tasto grigio era Export, ma se vuoi il Reset usiamo l'ID 'resetFilters' se esiste, o lo creiamo.
  // Se non hai un tasto Reset dedicato nell'HTML nuovo, useremo la logica solo su Apply.
  
  if (!btn) return;

  // Rimuoviamo vecchi listener per evitare duplicazioni (Hack del clone)
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  // --- LISTENER APPLICA FILTRI ---
  newBtn.addEventListener('click', () => {
    console.log("🔍 Avvio Filtraggio...");

    // 1. Leggiamo gli input attuali
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    const type = document.getElementById('chartTypeFilter').value;
    const actor = document.getElementById('actorFilter').value;
    const searchText = document.getElementById('textSearch').value.trim().toLowerCase();
    
    // Leggiamo le checkbox attive
    const checkedSeverities = Array.from(document.querySelectorAll('.toggle-container input:checked'))
                                   .map(cb => cb.value);

    // 2. FILTRIAMO SEMPRE PARTENDO DA 'ORIGINAL_DATA'
    // (Mai usare la variabile 'filtered' dell'ultimo giro!)
    const filtered = ORIGINAL_DATA.filter(e => {
      
      // A. Filtro Data
      if (start && e.date < start) return false;
      if (end && e.date > end) return false;

      // B. Filtro Tipo
      if (type && e.type !== type) return false;

      // C. Filtro Attore
      if (actor && e.actor && e.actor !== actor) return false;

      // D. Filtro Testo (Cerca in Titolo e Descrizione)
      if (searchText) {
        const title = (e.title || '').toLowerCase();
        const desc = (e.description || '').toLowerCase();
        // Se non trova il testo né nel titolo né nella desc, scarta
        if (!title.includes(searchText) && !desc.includes(searchText)) return false;
      }

      // E. Filtro Intensità (Minaccia)
      // Mappiamo il numero (es. 0.9) alla stringa (es. 'critical')
      const val = parseFloat(e.intensity) || 0.2;
      let cat = 'low';
      if (val >= 0.8) cat = 'critical';
      else if (val >= 0.6) cat = 'high';
      else if (val >= 0.4) cat = 'medium';

      // Se abbiamo selezionato delle checkbox, e questa categoria NON è tra quelle, scarta
      if (checkedSeverities.length > 0 && !checkedSeverities.includes(cat)) return false;

      return true; // Tieni l'evento
    });

    console.log(`✅ Risultati filtrati: ${filtered.length} (su ${ORIGINAL_DATA.length} totali)`);

    // 3. AGGIORNA TUTTO
    updateDashboard(filtered);
    if(window.updateMap) window.updateMap(filtered);
  });

  // --- LISTENER TASTO INVIO (Sulla barra di ricerca) ---
  const searchInput = document.getElementById('textSearch');
  if(searchInput) {
      // Rimuovi vecchi listener clonando anche l'input
      const newSearch = searchInput.cloneNode(true);
      searchInput.parentNode.replaceChild(newSearch, searchInput);
      
      newSearch.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
          newBtn.click(); // Simula click su Applica
        }
      });
  }
}

// --- 3. RENDERING GRAFICI (Dashboard) ---
function updateDashboard(data) {
  renderTimelineChart(data);
  renderTypeChart(data);
  renderRadarChart(data);
  
  // Aggiorna anche il contatore nella sidebar o KPI se esiste
  const countEl = document.getElementById('eventCount');
  if(countEl) countEl.innerText = data.length;
}

// --- 4. GRAFICO BARRE (Tempo) ---
function renderTimelineChart(data) {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  const aggregated = {};
  data.forEach(e => {
    if(!e.date) return;
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
        label: 'Eventi',
        data: values,
        backgroundColor: THEME.primary,
        borderRadius: 4
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

// --- 5. GRAFICO TORTA (Tipi) ---
function renderTypeChart(data) {
  const ctx = document.getElementById('typeDistributionChart');
  if (!ctx) return;

  const counts = {};
  data.forEach(e => {
    const t = e.type || 'N/A';
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
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: THEME.text, boxWidth: 12 } } },
      cutout: '70%'
    }
  });
}

// --- 6. GRAFICO RADAR (Intensità) ---
function renderRadarChart(data) {
  const ctx = document.getElementById('intensityRadarChart');
  if (!ctx) return;

  const stats = {};
  data.forEach(e => {
    const t = e.type || 'N/A';
    if (!stats[t]) stats[t] = { sum: 0, count: 0 };
    let val = parseFloat(e.intensity);
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
        label: 'Intensità Media',
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
          pointLabels: { color: THEME.text, font: { size: 10 } },
          suggestedMin: 0, suggestedMax: 1,
          ticks: { display: false, backdropColor: 'transparent' }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// --- UTILS: POPOLA FILTRI ---
function populateFilters(data) {
  const select = document.getElementById('chartTypeFilter');
  if (!select) return;
  
  // Manteniamo la selezione attuale se esiste, altrimenti reset
  const currentVal = select.value;
  select.innerHTML = '<option value="">Tutte le categorie</option>';
  
  const types = [...new Set(data.map(e => e.type))].sort();
  types.forEach(t => {
    if(t) select.innerHTML += `<option value="${t}">${t}</option>`;
  });
  
  select.value = currentVal;
}
