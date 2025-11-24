// ============================================
// CHARTS.JS - MOTORE DI RICERCA POTENZIATO
// ============================================

let charts = {
  timeline: null,
  type: null,
  radar: null
};

// DATA STORE GLOBALE
// ORIGINAL_DATA conterrà i dati grezzi dal GeoJSON
let ORIGINAL_DATA = []; 

const THEME = {
  primary: '#f59e0b',
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

  console.log(`🚀 Sistema Pronto: ${events.length} eventi caricati.`);

  // PRE-PROCESSAMENTO DATI (Fondamentale per la ricerca)
  // Creiamo campi ottimizzati per la ricerca per non doverli calcolare ogni volta
  ORIGINAL_DATA = events.map(e => ({
    ...e,
    // Campo di ricerca unificato (tutto minuscolo per facilitare i confronti)
    _searchStr: `${e.title || ''} ${e.description || ''} ${e.actor || ''}`.toLowerCase(),
    // Normalizziamo l'attore per sicurezza
    _actorNorm: (e.actor || '').toLowerCase(),
    // Normalizziamo l'intensità
    _intensityNorm: parseFloat(e.intensity) || 0.2
  }));

  // Avvio Dashboard
  updateDashboard(ORIGINAL_DATA);
  populateFilters(ORIGINAL_DATA);
  setupChartFilters();
};

// --- 2. LOGICA FILTRI (Il Nuovo Cervello) ---
function setupChartFilters() {
  const btn = document.getElementById('applyFilters');
  if (!btn) return;

  // Hack per rimuovere vecchi listener
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  // --- LISTENER CLICK ---
  newBtn.addEventListener('click', executeFilter);

  // --- LISTENER INVIO SU TEXT SEARCH ---
  const searchInput = document.getElementById('textSearch');
  if(searchInput) {
    const newSearch = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearch, searchInput);
    newSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') executeFilter();
    });
  }
}

function executeFilter() {
  console.log("🔍 Avvio Scansione Filtri...");

  // 1. Lettura Input Utente
  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;
  const type = document.getElementById('chartTypeFilter').value;
  const actorKeyword = document.getElementById('actorFilter').value.toLowerCase(); // es: "ukrain" o "russi"
  const searchText = document.getElementById('textSearch').value.trim().toLowerCase();
  
  // Lettura Checkbox Minaccia
  const checkedSeverities = Array.from(document.querySelectorAll('.toggle-container input:checked'))
                                 .map(cb => cb.value);

  // 2. Filtraggio
  const filtered = ORIGINAL_DATA.filter(e => {
    
    // A. DATE
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;

    // B. TIPO
    if (type && e.type !== type) return false;

    // C. ATTORE (Logica Fuzzy)
    // Se l'utente ha selezionato "Russi", controlliamo se "_actorNorm" contiene "russi"
    if (actorKeyword) {
      if (!e._actorNorm.includes(actorKeyword)) return false;
    }

    // D. RICERCA TESTUALE
    if (searchText) {
      // Cerca la parola ovunque (titolo, desc, attore)
      if (!e._searchStr.includes(searchText)) return false;
    }

    // E. MINACCIA
    let cat = 'low';
    if (e._intensityNorm >= 0.8) cat = 'critical';
    else if (e._intensityNorm >= 0.6) cat = 'high';
    else if (e._intensityNorm >= 0.4) cat = 'medium';

    if (checkedSeverities.length > 0 && !checkedSeverities.includes(cat)) return false;

    return true; // Passato
  });

  console.log(`✅ Trovati: ${filtered.length} eventi.`);

  // 3. Aggiornamento UI
  updateDashboard(filtered);
  
  if(window.updateMap) {
    window.updateMap(filtered);
  } else {
    console.error("ERRORE: Funzione updateMap non trovata in map.js");
  }
}

// --- 3. RENDERING GRAFICI ---
function updateDashboard(data) {
  renderTimelineChart(data);
  renderTypeChart(data);
  renderRadarChart(data);
  
  const countEl = document.getElementById('eventCount');
  if(countEl) countEl.innerText = data.length;
}

// --- 4. GRAFICI (Standard) ---
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
  if (charts.timeline) charts.timeline.destroy();
  charts.timeline = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label: 'Eventi', data: labels.map(k => aggregated[k]), backgroundColor: THEME.primary, borderRadius: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: THEME.grid } } } }
  });
}

function renderTypeChart(data) {
  const ctx = document.getElementById('typeDistributionChart');
  if (!ctx) return;
  const counts = {};
  data.forEach(e => { counts[e.type || 'N/A'] = (counts[e.type || 'N/A'] || 0) + 1; });
  if (charts.type) charts.type.destroy();
  charts.type = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: THEME.palette, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: THEME.text, boxWidth: 12 } } }, cutout: '70%' }
  });
}

function renderRadarChart(data) {
  const ctx = document.getElementById('intensityRadarChart');
  if (!ctx) return;
  const stats = {};
  data.forEach(e => {
    const t = e.type || 'N/A';
    if (!stats[t]) stats[t] = { sum: 0, count: 0 };
    stats[t].sum += (parseFloat(e.intensity)||0.2); stats[t].count++;
  });
  const labels = Object.keys(stats);
  if (charts.radar) charts.radar.destroy();
  charts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{ label: 'Intensità', data: labels.map(k => (stats[k].sum/stats[k].count).toFixed(2)), backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: THEME.primary, pointBackgroundColor: THEME.primary }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { r: { grid: { color: THEME.grid }, pointLabels: { color: THEME.text, font: { size: 10 } }, ticks: { display: false, backdropColor: 'transparent' } } }, plugins: { legend: { display: false } } }
  });
}

// --- UTILS ---
function populateFilters(data) {
  const select = document.getElementById('chartTypeFilter');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">Tutte le categorie</option>';
  const types = [...new Set(data.map(e => e.type))].sort();
  types.forEach(t => { if(t) select.innerHTML += `<option value="${t}">${t}</option>`; });
  select.value = currentVal;
}
