// ============================================
// CHARTS.JS - SEARCH ENGINE V3 (Synonyms & Smart Tags)
// ============================================

let charts = {
  timeline: null, type: null, radar: null
};

let ORIGINAL_DATA = []; 

const THEME = {
  primary: '#f59e0b', secondary: '#0f172a', text: '#94a3b8', grid: '#334155',
  palette: ['#f59e0b', '#ef4444', '#f97316', '#eab308', '#64748b', '#3b82f6']
};

Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = THEME.text;
Chart.defaults.scale.grid.color = THEME.grid;

// --- DIZIONARIO SINONIMI (Per risolvere Kiev/Kyiv) ---
const CITY_SYNONYMS = {
  'kiev': 'kyiv', 'kiew': 'kyiv',
  'kharkov': 'kharkiv',
  'odessa': 'odesa',
  'lvov': 'lviv',
  'nikolaev': 'mykolaiv',
  'artemivsk': 'bakhmut',
  'dnepropetrovsk': 'dnipro'
};

// --- INIZIALIZZAZIONE ---
window.initCharts = function(events) {
  if (!events || events.length === 0) return;

  // DEBUG: Stampa il primo evento per capire come si chiamano i campi nel tuo JSON
  console.log("🔍 ESEMPIO DATO GREZZO:", events[0]);

  // PRE-PROCESSAMENTO AVANZATO
  ORIGINAL_DATA = events.map(e => {
    
    // 1. Uniamo tutti i testi possibili per la ricerca testuale
    // Controlliamo campi comuni nei GeoJSON (properties.actor1, properties.location, etc.)
    const fullText = [
      e.title, 
      e.description, 
      e.notes, 
      e.location, 
      e.city, 
      e.actor1, 
      e.actor2, 
      e.assoc_actor_1
    ].join(' ').toLowerCase();

    // 2. Assegnazione Fazione (Smart Tagging)
    // Analizziamo il testo per capire chi è coinvolto, indipendentemente da come è scritto
    let detectedSide = 'other';
    const textForSide = (e.actor1 + ' ' + e.assoc_actor_1 + ' ' + e.actor).toLowerCase();

    // Keywords Russia
    if (textForSide.includes('russia') || textForSide.includes('wagner') || textForSide.includes('donetsk people') || textForSide.includes('luhansk people')) {
      detectedSide = 'russia';
    } 
    // Keywords Ucraina
    else if (textForSide.includes('ukrain') || textForSide.includes('kyiv') || textForSide.includes('zsu') || textForSide.includes('azov')) {
      detectedSide = 'ukraine';
    }

    return {
      ...e,
      _searchStr: fullText,      // Testo completo per ricerca
      _side: detectedSide,       // 'russia', 'ukraine', o 'other'
      _intensityNorm: parseFloat(e.intensity || e.fatality_count || 0) > 0 ? 0.8 : 0.2 // Fallback se manca intensity
    };
  });

  console.log(`🚀 Indicizzati ${ORIGINAL_DATA.length} eventi.`);

  updateDashboard(ORIGINAL_DATA);
  populateFilters(ORIGINAL_DATA);
  setupChartFilters();
};

// --- MOTORE DI FILTRAGGIO ---
function setupChartFilters() {
  const btn = document.getElementById('applyFilters');
  if (!btn) return;
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  // Listener Click
  newBtn.addEventListener('click', executeFilter);

  // Listener Enter
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
  console.log("🔍 Avvio Filtro Intelligente...");

  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;
  const type = document.getElementById('chartTypeFilter').value;
  const actorValue = document.getElementById('actorFilter').value; // 'russia', 'ukraine'
  
  // Normalizzazione Ricerca Testuale (Gestione Sinonimi)
  let rawSearch = document.getElementById('textSearch').value.trim().toLowerCase();
  // Se l'utente scrive "Kiev", noi cerchiamo anche "Kyiv"
  // Controlliamo se la parola cercata è nel dizionario sinonimi
  let searchTerms = [rawSearch];
  if (CITY_SYNONYMS[rawSearch]) {
    searchTerms.push(CITY_SYNONYMS[rawSearch]); // Aggiungiamo il sinonimo alla ricerca
  }

  // Checkbox Minaccia
  const checkedSeverities = Array.from(document.querySelectorAll('.toggle-container input:checked'))
                                 .map(cb => cb.value);

  const filtered = ORIGINAL_DATA.filter(e => {
    
    // A. DATE
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;

    // B. TIPO
    if (type && e.type !== type) return false;

    // C. ATTORE (Usa il nostro _side calcolato)
    if (actorValue && e._side !== actorValue) return false;

    // D. RICERCA TESTUALE (Con Sinonimi)
    if (rawSearch) {
      // Deve contenere ALMENO UNO dei termini (es. o "Kiev" o "Kyiv")
      const match = searchTerms.some(term => e._searchStr.includes(term));
      if (!match) return false;
    }

    // E. MINACCIA
    let cat = 'low';
    if (e._intensityNorm >= 0.8) cat = 'critical';
    else if (e._intensityNorm >= 0.6) cat = 'high';
    else if (e._intensityNorm >= 0.4) cat = 'medium';
    
    if (checkedSeverities.length > 0 && !checkedSeverities.includes(cat)) return false;

    return true;
  });

  console.log(`✅ Risultati: ${filtered.length}`);
  updateDashboard(filtered);
  if(window.updateMap) window.updateMap(filtered);
}

// --- RENDERING GRAFICI ---
function updateDashboard(data) {
  renderTimelineChart(data);
  renderTypeChart(data);
  renderRadarChart(data);
  const countEl = document.getElementById('eventCount');
  if(countEl) countEl.innerText = data.length;
}

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
    data: { labels: labels, datasets: [{ label: 'Eventi', data: Object.values(aggregated), backgroundColor: THEME.primary, borderRadius: 4 }] },
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
  // Fallback radar vuoto se non ci sono dati
  if(data.length === 0 && charts.radar) { charts.radar.data.datasets[0].data = []; charts.radar.update(); return; }
  
  const stats = {};
  data.forEach(e => {
    const t = e.type || 'N/A';
    if (!stats[t]) stats[t] = { sum: 0, count: 0 };
    stats[t].sum += (e._intensityNorm); stats[t].count++;
  });
  const labels = Object.keys(stats);
  if (charts.radar) charts.radar.destroy();
  charts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{ label: 'Intensità', data: labels.map(k => (stats[k].sum/stats[k].count).toFixed(2)), backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: THEME.primary, pointBackgroundColor: THEME.primary }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { r: { grid: { color: THEME.grid }, pointLabels: { color: THEME.text, font: { size: 10 } }, ticks: { display: false } } }, plugins: { legend: { display: false } } }
  });
}

function populateFilters(data) {
  const select = document.getElementById('chartTypeFilter');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">Tutte le categorie</option>';
  const types = [...new Set(data.map(e => e.type))].sort();
  types.forEach(t => { if(t) select.innerHTML += `<option value="${t}">${t}</option>`; });
  select.value = currentVal;
}
