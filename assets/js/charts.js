// ============================================
// CHARTS.JS - ULTIMATE EDITION (Graphs + Smart Search)
// ============================================

// Oggetto per gestire le istanze dei grafici Chart.js
let charts = {
  timeline: null,
  type: null,
  radar: null
};

// DATA STORE GLOBALE PROTETTO
// Qui salviamo i dati grezzi normalizzati. Non viene mai modificato dai filtri.
let ORIGINAL_DATA = []; 

// CONFIGURAZIONE TEMA GRAFICO (Slate & Amber)
const THEME = {
  primary: '#f59e0b',       // Amber 500
  secondary: '#0f172a',     // Slate 900
  text: '#94a3b8',          // Slate 400
  grid: '#334155',          // Slate 700
  palette: [
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#64748b', // Slate
    '#3b82f6'  // Blue
  ]
};

// Configurazione Default Chart.js
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = THEME.text;
Chart.defaults.scale.grid.color = THEME.grid;

// --- DIZIONARIO SINONIMI (Per normalizzare città e fazioni) ---
const SYNONYMS = {
  // Città: Variante cercata -> Variante standard nel DB
  'kiev': 'kyiv', 'kiew': 'kyiv',
  'kharkov': 'kharkiv',
  'odessa': 'odesa',
  'nikolaev': 'mykolaiv',
  'dnepropetrovsk': 'dnipro',
  'artemivsk': 'bakhmut',
  'lvov': 'lviv',
  // Fazioni comuni
  'russian federation': 'russia',
  'moscow': 'russia',
  'rf': 'russia',
  'wagner': 'russia',
  'uaf': 'ukraine',
  'zsu': 'ukraine',
  'kiev forces': 'ukraine'
};

// ============================================
// 1. INIZIALIZZAZIONE & NORMALIZZAZIONE
// ============================================
window.initCharts = function(events) {
  if (!events || events.length === 0) return;

  console.log(`📊 InitCharts: Avvio indicizzazione di ${events.length} eventi...`);

  // PROCESSO "OMNIVORE": Normalizziamo i dati appena arrivano
  ORIGINAL_DATA = events.map(e => {
    
    // A. COSTRUZIONE "MEGA-STRINGA" DI RICERCA
    // Uniamo tutti i valori testuali dell'evento in una sola stringa per la ricerca full-text
    let allValues = [];
    for (const key in e) {
      if (e.hasOwnProperty(key)) {
        const val = e[key];
        if (typeof val === 'string') allValues.push(val.toLowerCase());
        else if (typeof val === 'number') allValues.push(val.toString());
      }
    }
    const megaString = allValues.join(' '); // Es: "2024 kyiv explosion drone russia..."

    // B. RILEVAMENTO INTELLIGENTE FAZIONE (Smart Tagging)
    // Assegniamo 'russia' o 'ukraine' basandoci sulle keyword trovate nel mega-testo
    let detectedSide = 'other';
    // Priorità alla Russia/Aggressore per attribuzione filtro
    if (megaString.includes('russia') || megaString.includes('wagner') || megaString.includes(' dpr ') || megaString.includes(' lpr ')) {
      detectedSide = 'russia';
    } 
    else if (megaString.includes('ukrain') || megaString.includes(' zsu ') || megaString.includes(' uaf ') || megaString.includes(' azov ')) {
      detectedSide = 'ukraine';
    }

    // C. NORMALIZZAZIONE INTENSITÀ
    // Cerca intensity, o fatality_count, o mette default 0.2
    const rawInt = parseFloat(e.intensity || e.fatality_count || 0.2);

    return {
      ...e, // Mantiene lat, lon, title, etc. originali
      _searchStr: megaString,   // Campo ottimizzato ricerca testo
      _side: detectedSide,      // Campo ottimizzato filtro attori
      _intensityNorm: rawInt    // Campo ottimizzato grafici/filtro
    };
  });

  console.log("✅ Dati normalizzati. Pronto.");

  // Primo rendering (tutti i dati)
  updateDashboard(ORIGINAL_DATA);
  populateFilters(ORIGINAL_DATA);
  setupChartFilters();
};

// ============================================
// 2. MOTORE DI FILTRAGGIO (LOGICA FUZZY)
// ============================================
function setupChartFilters() {
  const btn = document.getElementById('applyFilters');
  if (!btn) return;

  // Hack per pulire vecchi listener
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  // Listener Click
  newBtn.addEventListener('click', executeFilter);

  // Listener Tasto Invio nella barra di ricerca
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
  console.log("🔍 Esecuzione Filtri...");

  // 1. LETTURA INPUT UTENTE
  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;
  const type = document.getElementById('chartTypeFilter').value;
  const actorValue = document.getElementById('actorFilter').value; // 'russia', 'ukraine'
  const rawSearch = document.getElementById('textSearch').value.trim().toLowerCase();

  // Recupero Checkbox (Toggle Cards)
  const checkedSeverities = Array.from(document.querySelectorAll('.toggle-container input:checked'))
                                 .map(cb => cb.value);

  // 2. PREPARAZIONE SINONIMI
  // Se l'utente cerca "Kiev", aggiungiamo "Kyiv" alla lista di parole da cercare
  let searchTerms = [rawSearch];
  if (SYNONYMS[rawSearch]) {
    searchTerms.push(SYNONYMS[rawSearch]);
  }
  // Ricerca inversa nei sinonimi (se cerco la parola chiave standard)
  for (let key in SYNONYMS) {
    if (SYNONYMS[key] === rawSearch) searchTerms.push(key);
  }

  // 3. CICLO DI FILTRAGGIO
  const filtered = ORIGINAL_DATA.filter(e => {
    
    // A. DATA
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;

    // B. CATEGORIA
    if (type && e.type !== type) return false;

    // C. ATTORE (Smart Tag)
    if (actorValue && e._side !== actorValue) return false;

    // D. RICERCA TESTUALE (Full-Text su Mega-Stringa)
    if (rawSearch) {
      // Controlla se ALMENO UNO dei termini (es. kiev O kyiv) è presente
      const match = searchTerms.some(term => e._searchStr.includes(term));
      if (!match) return false;
    }

    // E. LIVELLO MINACCIA (Mapping da 0.0-1.0 a Categorie)
    let cat = 'low';
    const val = e._intensityNorm;
    if (val >= 0.8) cat = 'critical';
    else if (val >= 0.6) cat = 'high';
    else if (val >= 0.4) cat = 'medium';

    // Se l'utente ha selezionato delle checkbox, e questa categoria non è tra quelle -> scarta
    if (checkedSeverities.length > 0 && !checkedSeverities.includes(cat)) return false;

    return true; // Evento valido
  });

  console.log(`✅ Risultati trovati: ${filtered.length}`);

  // 4. AGGIORNAMENTO UI
  updateDashboard(filtered);
  
  // Chiama la mappa (se esiste)
  if(window.updateMap) {
    window.updateMap(filtered);
  } else {
    console.warn("Funzione updateMap non trovata in map.js");
  }
}

// ============================================
// 3. GESTIONE GRAFICI (RENDERING)
// ============================================

function updateDashboard(data) {
  renderTimelineChart(data);
  renderTypeChart(data);
  renderRadarChart(data);
  
  // Aggiorna contatore Sidebar (se esiste)
  const countEl = document.getElementById('eventCount');
  if(countEl) countEl.innerText = data.length;
}

// --- GRAFICO A BARRE (Timeline) ---
function renderTimelineChart(data) {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  const aggregated = {};
  data.forEach(e => {
    if(!e.date) return;
    const key = e.date.substring(0, 7); // YYYY-MM
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

// --- GRAFICO A CIAMBELLA (Tipologie) ---
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
        legend: { position: 'right', labels: { color: THEME.text, boxWidth: 12, font: { size: 11 } } }
      },
      cutout: '70%'
    }
  });
}

// --- GRAFICO RADAR (Intensità) ---
function renderRadarChart(data) {
  const ctx = document.getElementById('intensityRadarChart');
  if (!ctx) return;

  // Gestione caso dati vuoti
  if(data.length === 0) {
    if(charts.radar) {
       charts.radar.data.datasets[0].data = [];
       charts.radar.update();
    }
    return;
  }

  const stats = {};
  data.forEach(e => {
    const t = e.type || 'Sconosciuto';
    if (!stats[t]) stats[t] = { sum: 0, count: 0 };
    // Usa il valore normalizzato _intensityNorm
    stats[t].sum += e._intensityNorm;
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

// --- UTILS: POPOLAMENTO SELECT ---
function populateFilters(data) {
  const select = document.getElementById('chartTypeFilter');
  if (!select) return;
  
  const currentVal = select.value;
  select.innerHTML = '<option value="">Tutte le categorie</option>';
  
  const types = [...new Set(data.map(e => e.type))].sort();
  types.forEach(t => {
    if(t) select.innerHTML += `<option value="${t}">${t}</option>`;
  });
  
  select.value = currentVal;
}
