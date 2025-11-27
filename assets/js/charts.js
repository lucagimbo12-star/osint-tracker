// ============================================
// CHARTS.JS - FINAL SIDEBAR FIX
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

const SYNONYMS = { 'kiev': 'kyiv', 'kiew': 'kyiv', 'kharkov': 'kharkiv', 'odessa': 'odesa', 'nikolaev': 'mykolaiv', 'artemivsk': 'bakhmut', 'dnepropetrovsk': 'dnipro', 'lvov': 'lviv' };

// --- INIT ---
window.initCharts = function(events) {
  if (!events || events.length === 0) return;
  console.log(`📊 InitCharts: Caricati ${events.length} eventi.`);

  ORIGINAL_DATA = events.map(e => {
    // Stringa di ricerca onnivora
    let searchParts = [];
    Object.values(e).forEach(val => { if (val) searchParts.push(String(val).toLowerCase()); });
    
    // Sinonimi
    const titleLower = (e.title || '').toLowerCase();
    for (const [key, val] of Object.entries(SYNONYMS)) { 
        if (titleLower.includes(val)) searchParts.push(key); 
    }
    
    // Parsing Data con Moment (Identico a Map.js per coerenza)
    // Se la data è già un numero (timestamp), moment lo accetta direttamente
    let m = moment(e.date);
    if(!m.isValid()) m = moment(e.date, ["DD/MM/YYYY", "DD-MM-YYYY", "DD.MM.YYYY"]);
    const ts = m.isValid() ? m.valueOf() : moment().valueOf();

    return {
      ...e,
      _searchStr: searchParts.join(' '),
      _actorCode: (e.actor_code || 'UNK').toString().toUpperCase(),
      _intensityNorm: parseFloat(e.intensity || 0.2),
      timestamp: ts // Timestamp numerico per filtri
    };
  });

  // Ordina per data
  ORIGINAL_DATA.sort((a,b) => a.timestamp - b.timestamp);
  
  updateDashboard(ORIGINAL_DATA);
  populateFilters(ORIGINAL_DATA);
  setupChartFilters();
};

// --- LOGICA FILTRI ---
function setupChartFilters() {
  const btn = document.getElementById('applyFilters');
  if (!btn) return;
  
  // Clona bottone per pulire eventi precedenti
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', executeFilter);

  const searchInput = document.getElementById('textSearch');
  if(searchInput) {
    const newSearch = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearch, searchInput);
    
    // Ricerca mentre scrivi (Input)
    newSearch.addEventListener('input', executeFilter); 
    // Ricerca su Invio
    newSearch.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeFilter(); });
  }
}

function executeFilter() {
  // Input Utente
  const startVal = document.getElementById('startDate').value; // Restituisce stringa YYYY-MM-DD
  const endVal = document.getElementById('endDate').value;     // Restituisce stringa YYYY-MM-DD
  const type = document.getElementById('chartTypeFilter').value;
  const actorCode = document.getElementById('actorFilter').value; 
  const rawSearch = document.getElementById('textSearch').value.trim().toLowerCase();
  
  const checkedSeverities = Array.from(document.querySelectorAll('.toggle-container input:checked')).map(cb => cb.value);

  // --- LOGICA TEMPORALE MOMENT.JS ---
  // startOf('day') -> imposta 00:00:00 del giorno scelto -> Tutto ciò che succede DOPO l'inizio di quel giorno
  // endOf('day') -> imposta 23:59:59 del giorno scelto -> Tutto ciò che succede PRIMA della fine di quel giorno
  
  const startTs = startVal ? moment(startVal).startOf('day').valueOf() : null;
  const endTs = endVal ? moment(endVal).endOf('day').valueOf() : null;

  // Debug: controlla in console cosa stiamo cercando
  if(startVal || endVal) {
      console.log(`📅 Filtro attivo: Dal ${startVal} (${startTs}) al ${endVal} (${endTs})`);
  }

  let searchTerms = [rawSearch];
  if(rawSearch) {
      if (SYNONYMS[rawSearch]) searchTerms.push(SYNONYMS[rawSearch]);
      for (let key in SYNONYMS) { if (SYNONYMS[key] === rawSearch) searchTerms.push(key); }
  }

  const filtered = ORIGINAL_DATA.filter(e => {
    // A. Filtro Data (Logica DOPO / PRIMA)
    // Se c'è una data di inizio, l'evento deve essere >= startTs
    if (startTs && e.timestamp < startTs) return false;
    // Se c'è una data di fine, l'evento deve essere <= endTs
    if (endTs && e.timestamp > endTs) return false;
    
    // B. Filtri Categoria/Attore
    if (type && e.type !== type) return false;
    if (actorCode && e._actorCode !== actorCode) return false;
    
    // C. Filtro Ricerca
    if (rawSearch && !searchTerms.some(term => e._searchStr.includes(term))) return false;
    
    // D. Filtro Intensità
    let cat = 'low';
    if (e._intensityNorm >= 0.8) cat = 'critical';
    else if (e._intensityNorm >= 0.6) cat = 'high';
    else if (e._intensityNorm >= 0.4) cat = 'medium';
    
    if (checkedSeverities.length > 0 && !checkedSeverities.includes(cat)) return false;

    return true;
  });

  console.log(`✅ Risultati filtrati: ${filtered.length}`);

  updateDashboard(filtered);
  
  // Sincronizza Mappa
  if(window.updateMap) window.updateMap(filtered);
}

// --- RENDER GRAFICI ---

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
      if(!e.timestamp) return; 
      // Aggrega per Mese
      const key = moment(e.timestamp).format('YYYY-MM'); 
      aggregated[key] = (aggregated[key] || 0) + 1; 
  });
  
  const labels = Object.keys(aggregated).sort();
  
  if (charts.timeline) charts.timeline.destroy();
  charts.timeline = new Chart(ctx, {
    type: 'bar',
    data: { 
        labels: labels, 
        datasets: [{ 
            label: 'Eventi', 
            data: Object.values(aggregated), 
            backgroundColor: THEME.primary, 
            borderRadius: 4 
        }] 
    },
    options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { legend: { display: false } }, 
        scales: { 
            x: { grid: { display: false } }, 
            y: { beginAtZero: true, grid: { color: THEME.grid } } 
        } 
    }
  });
}

function renderTypeChart(data) {
  const ctx = document.getElementById('typeDistributionChart');
  if (!ctx) return;
  
  const counts = {};
  data.forEach(e => { 
      counts[e.type || 'N/A'] = (counts[e.type || 'N/A'] || 0) + 1; 
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
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { 
            legend: { 
                position: 'right', 
                labels: { color: THEME.text, boxWidth: 12 } 
            } 
        }, 
        cutout: '70%' 
    }
  });
}

function renderRadarChart(data) {
  const ctx = document.getElementById('intensityRadarChart');
  if (!ctx) return;
  
  if(data.length === 0) { 
      if(charts.radar) charts.radar.destroy(); 
      return; 
  }

  const stats = {};
  data.forEach(e => {
    const t = e.type || 'N/A';
    if (!stats[t]) stats[t] = { sum: 0, count: 0 };
    stats[t].sum += e._intensityNorm; 
    stats[t].count++;
  });
  
  const labels = Object.keys(stats);
  
  if (charts.radar) charts.radar.destroy();
  charts.radar = new Chart(ctx, {
    type: 'radar',
    data: { 
        labels: labels, 
        datasets: [{ 
            label: 'Intensità', 
            data: labels.map(k => (stats[k].sum/stats[k].count).toFixed(2)), 
            backgroundColor: 'rgba(245, 158, 11, 0.2)', 
            borderColor: THEME.primary, 
            pointBackgroundColor: THEME.primary 
        }] 
    },
    options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        scales: { 
            r: { 
                grid: { color: THEME.grid }, 
                pointLabels: { color: THEME.text, font: { size: 10 } }, 
                ticks: { display: false } 
            } 
        }, 
        plugins: { legend: { display: false } } 
    }
  });
}

function populateFilters(data) {
  const select = document.getElementById('chartTypeFilter');
  if (!select) return;
  
  const currentVal = select.value;
  select.innerHTML = '<option value="">Tutte le categorie</option>';
  
  const types = [...new Set(data.map(e => e.type))].filter(t=>t).sort();
  types.forEach(t => { 
      select.innerHTML += `<option value="${t}">${t}</option>`; 
  });
  
  select.value = currentVal;
}
