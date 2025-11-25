// ============================================
// CHARTS.JS - PROFESSIONAL EDITION (Hard Coded Actors)
// ============================================

let charts = { timeline: null, type: null, radar: null };
let ORIGINAL_DATA = []; 

const THEME = {
  primary: '#f59e0b', secondary: '#0f172a', text: '#94a3b8', grid: '#334155',
  palette: ['#f59e0b', '#ef4444', '#f97316', '#eab308', '#64748b', '#3b82f6']
};

Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = THEME.text;
Chart.defaults.scale.grid.color = THEME.grid;

// Dizionario Sinonimi per la ricerca testuale (Città)
const SYNONYMS = {
  'kiev': 'kyiv', 'kiew': 'kyiv',
  'kharkov': 'kharkiv', 'odessa': 'odesa',
  'nikolaev': 'mykolaiv', 'artemivsk': 'bakhmut',
  'dnepropetrovsk': 'dnipro', 'lvov': 'lviv'
};

// ============================================
// 1. INIZIALIZZAZIONE & LETTURA DATI
// ============================================
window.initCharts = function(events) {
  if (!events || events.length === 0) return;

  console.log(`📊 InitCharts: Caricati ${events.length} eventi.`);
  
  // Debug veloce: controlliamo se actor_code esiste nel primo evento
  console.log("🔍 Verifica Codice Attore (Primo Evento):", events[0].actor_code);

  ORIGINAL_DATA = events.map(e => {
    
    // A. PREPARAZIONE RICERCA TESTUALE (Omnivore)
    // Unisce tutti i testi per permettere la ricerca di città, note, ecc.
    let allValues = [];
    for (const key in e) {
      if (e.hasOwnProperty(key)) {
        const val = e[key];
        if (typeof val === 'string') allValues.push(val.toLowerCase());
        else if (typeof val === 'number') allValues.push(val.toString());
      }
    }
    const megaString = allValues.join(' '); 

    // B. LETTURA CODICE ATTORE (HARD DATA)
    // Leggiamo la colonna creata dallo script Google Sheet.
    // Nota: A volte i convertitori GeoJSON mettono tutto minuscolo o usano underscore.
    // Cerchiamo le varianti più comuni.
    let code = e.actor_code || e.Actor_Code || e.actorcode || 'UNK';
    
    // Sicurezza: forziamo maiuscolo (nel caso lo sheet abbia scritto 'rus')
    code = code.toString().toUpperCase();

    // C. NORMALIZZAZIONE INTENSITÀ
    const rawInt = parseFloat(e.intensity || e.fatality_count || 0.2);

    return {
      ...e,
      _searchStr: megaString,   // Per la barra di ricerca
      _actorCode: code,         // Per il filtro a tendina (RUS, UKR)
      _intensityNorm: rawInt
    };
  });

  updateDashboard(ORIGINAL_DATA);
  populateFilters(ORIGINAL_DATA);
  setupChartFilters();
};

// ============================================
// 2. MOTORE DI FILTRAGGIO (STRICT)
// ============================================
function setupChartFilters() {
  const btn = document.getElementById('applyFilters');
  if (!btn) return;

  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener('click', executeFilter);

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
  // 1. INPUT UTENTE
  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;
  const type = document.getElementById('chartTypeFilter').value;
  
  // QUI LA MODIFICA CHIAVE: Leggiamo il codice esatto (es. "RUS")
  const actorCode = document.getElementById('actorFilter').value; 
  
  const rawSearch = document.getElementById('textSearch').value.trim().toLowerCase();
  const checkedSeverities = Array.from(document.querySelectorAll('.toggle-container input:checked')).map(cb => cb.value);

  // Sinonimi per ricerca testuale
  let searchTerms = [rawSearch];
  if (SYNONYMS[rawSearch]) searchTerms.push(SYNONYMS[rawSearch]);
  for (let key in SYNONYMS) { if (SYNONYMS[key] === rawSearch) searchTerms.push(key); }

  // 2. FILTRAGGIO
  const filtered = ORIGINAL_DATA.filter(e => {
    
    // A. DATA
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;

    // B. CATEGORIA
    if (type && e.type !== type) return false;

    // C. ATTORE (CONFRONTO DIRETTO CODICI)
    // Se l'utente ha selezionato qualcosa (es. RUS)
    // L'evento deve avere ESATTAMENTE quel codice.
    if (actorCode && e._actorCode !== actorCode) return false;

    // D. RICERCA TESTUALE
    if (rawSearch) {
      const match = searchTerms.some(term => e._searchStr.includes(term));
      if (!match) return false;
    }

    // E. MINACCIA
    let cat = 'low';
    const val = e._intensityNorm;
    if (val >= 0.8) cat = 'critical';
    else if (val >= 0.6) cat = 'high';
    else if (val >= 0.4) cat = 'medium';

    if (checkedSeverities.length > 0 && !checkedSeverities.includes(cat)) return false;

    return true;
  });

  console.log(`✅ Risultati filtrati: ${filtered.length}`);

  // 3. UI UPDATE
  updateDashboard(filtered);
  if(window.updateMap) window.updateMap(filtered);
}

// ============================================
// 3. GRAFICI (Standard)
// ============================================
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
  data.forEach(e => { if(!e.date) return; const key = e.date.substring(0, 7); aggregated[key] = (aggregated[key] || 0) + 1; });
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
  if(data.length === 0 && charts.radar) { charts.radar.data.datasets[0].data = []; charts.radar.update(); return; }
  const stats = {};
  data.forEach(e => {
    const t = e.type || 'N/A';
    if (!stats[t]) stats[t] = { sum: 0, count: 0 };
    stats[t].sum += e._intensityNorm; stats[t].count++;
  });
  const labels = Object.keys(stats);
  if (charts.radar) charts.radar.destroy();
  charts.radar = new Chart(ctx, {
    type: 'radar',
    data: { labels: labels, datasets: [{ label: 'Intensità', data: labels.map(k => (stats[k].sum/stats[k].count).toFixed(2)), backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: THEME.primary, pointBackgroundColor: THEME.primary }] },
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
