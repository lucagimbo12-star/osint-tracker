// ============================================
// CHARTS.JS - SYNCED & SEARCH FIX EDITION
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

// --- HELPER: PARSING DATA (Identico a map.js per sincronia) ---
function parseDateToTimestamp(dateStr) {
    if (!dateStr) return new Date().getTime();
    // Formato DD/MM/YYYY
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
    }
    // Formato ISO o DD-MM-YYYY
    if (dateStr.includes('-')) {
        if (dateStr.trim().startsWith('202')) return new Date(dateStr).getTime();
        const parts = dateStr.split('-');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
    }
    return new Date(dateStr).getTime();
}

// ============================================
// 1. INIZIALIZZAZIONE & LETTURA DATI
// ============================================
window.initCharts = function(events) {
  if (!events || events.length === 0) return;

  console.log(`📊 InitCharts: Caricati ${events.length} eventi.`);

  ORIGINAL_DATA = events.map(e => {
    
    // A. PREPARAZIONE RICERCA TESTUALE (FIXED)
    // Unisce tutti i valori in modo sicuro per la ricerca
    let searchParts = [];
    
    // Scorre tutte le proprietà dell'evento
    Object.values(e).forEach(val => {
        if (val === null || val === undefined) return;
        searchParts.push(String(val).toLowerCase());
    });
    
    // Aggiunge anche versioni "pulite" dei sinonimi se presenti nel titolo
    const titleLower = (e.title || '').toLowerCase();
    for (const [key, val] of Object.entries(SYNONYMS)) {
        if (titleLower.includes(val)) searchParts.push(key); // Se c'è 'kyiv', rendi trovabile 'kiev'
    }

    const megaString = searchParts.join(' '); 

    // B. LETTURA CODICE ATTORE (HARD DATA)
    let code = e.actor_code || e.Actor_Code || e.actorcode || 'UNK';
    code = code.toString().toUpperCase();

    // C. CALCOLO TIMESTAMP (Per filtri data coerenti con la mappa)
    const ts = parseDateToTimestamp(e.date);

    // D. NORMALIZZAZIONE INTENSITÀ
    const rawInt = parseFloat(e.intensity || e.fatality_count || 0.2);

    return {
      ...e,
      _searchStr: megaString,   // Stringa di ricerca ottimizzata
      _actorCode: code,         // Codice attore normalizzato
      _intensityNorm: rawInt,   // Intensità
      timestamp: ts             // Timestamp numerico per filtri
    };
  });

  // Ordina per data (utile per i grafici)
  ORIGINAL_DATA.sort((a,b) => a.timestamp - b.timestamp);

  updateDashboard(ORIGINAL_DATA);
  populateFilters(ORIGINAL_DATA);
  setupChartFilters();
};

// ============================================
// 2. MOTORE DI FILTRAGGIO (FIXED)
// ============================================
function setupChartFilters() {
  const btn = document.getElementById('applyFilters');
  if (!btn) return;

  // Clona per rimuovere vecchi listener ed evitare duplicazioni
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener('click', executeFilter);

  // Listener anche sulla casella di testo (Invio)
  const searchInput = document.getElementById('textSearch');
  if(searchInput) {
    const newSearch = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearch, searchInput);
    
    // Ricerca istantanea (opzionale: togliere 'input' se rallenta troppo)
    newSearch.addEventListener('input', executeFilter); 
    
    newSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') executeFilter();
    });
  }
}

function executeFilter() {
  // 1. INPUT UTENTE
  const startVal = document.getElementById('startDate').value;
  const endVal = document.getElementById('endDate').value;
  const type = document.getElementById('chartTypeFilter').value;
  const actorCode = document.getElementById('actorFilter').value; 
  const rawSearch = document.getElementById('textSearch').value.trim().toLowerCase();
  
  // Checkbox Livelli
  const checkedSeverities = Array.from(document.querySelectorAll('.toggle-container input:checked')).map(cb => cb.value);

  // Parsing date input sidebar a Timestamp per confronto corretto
  const startTs = startVal ? new Date(startVal).getTime() : null;
  const endTs = endVal ? new Date(endVal).getTime() : null;

  // Preparazione termini ricerca (con sinonimi)
  let searchTerms = [rawSearch];
  if(rawSearch.length > 0) {
      if (SYNONYMS[rawSearch]) searchTerms.push(SYNONYMS[rawSearch]);
      // Cerca anche il contrario (se scrivo kyiv cerca kiev)
      for (let key in SYNONYMS) { if (SYNONYMS[key] === rawSearch) searchTerms.push(key); }
  }

  // 2. FILTRAGGIO DATI
  const filtered = ORIGINAL_DATA.filter(e => {
    
    // A. DATA (Confronto Numerico = Sicuro)
    if (startTs && e.timestamp < startTs) return false;
    if (endTs && e.timestamp > endTs) return false;

    // B. CATEGORIA
    if (type && e.type !== type) return false;

    // C. ATTORE
    if (actorCode && e._actorCode !== actorCode) return false;

    // D. RICERCA TESTUALE (Improved)
    if (rawSearch.length > 0) {
      // Deve contenere ALMENO UNO dei termini (es. kiev O kyiv)
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

  console.log(`✅ Filtro applicato. Input: "${rawSearch}". Trovati: ${filtered.length}`);

  // 3. UI UPDATE
  updateDashboard(filtered);
  
  // Aggiorna la mappa passando i dati corretti (che ora hanno il timestamp!)
  if(window.updateMap) {
      window.updateMap(filtered);
  }
}

// ============================================
// 3. GRAFICI (Standard)
// ============================================
function updateDashboard(data) {
  renderTimelineChart(data);
  renderTypeChart(data);
  renderRadarChart(data);
  
  // Aggiorna il contatore totale nella sidebar/header
  const countEl = document.getElementById('eventCount');
  if(countEl) countEl.innerText = data.length;
}

function renderTimelineChart(data) {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;
  
  const aggregated = {};
  data.forEach(e => { 
      if(!e.timestamp) return; 
      // Aggrega per Mese-Anno (es. 2023-05)
      const d = new Date(e.timestamp);
      // Formatta YYYY-MM
      const key = d.toISOString().slice(0, 7); 
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
  // Gestione caso vuoto per evitare errori Chart.js
  if(data.length === 0) { 
      if(charts.radar) charts.radar.destroy(); 
      return; 
  }

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
    data: { labels: labels, datasets: [{ label: 'Intensità Media', data: labels.map(k => (stats[k].sum/stats[k].count).toFixed(2)), backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: THEME.primary, pointBackgroundColor: THEME.primary }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { r: { grid: { color: THEME.grid }, pointLabels: { color: THEME.text, font: { size: 10 } }, ticks: { display: false, backdropColor: 'transparent' } } }, plugins: { legend: { display: false } } }
  });
}

function populateFilters(data) {
  const select = document.getElementById('chartTypeFilter');
  if (!select) return;
  
  // Salva selezione corrente se c'è un refresh
  const currentVal = select.value;
  select.innerHTML = '<option value="">Tutte le categorie</option>';
  
  const types = [...new Set(data.map(e => e.type))].filter(t => t).sort();
  types.forEach(t => { select.innerHTML += `<option value="${t}">${t}</option>`; });
  
  select.value = currentVal;
}
