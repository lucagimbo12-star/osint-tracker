// ============================================
// TIMELINE-MANAGER.JS - GESTIONE PRO
// ============================================

let tlInstance = null;
let rawTimelineData = null;

// Configurazione Iniziale
const timelineOptions = {
  language: 'it',
  start_at_end: true,
  default_bg_color: { r: 248, g: 249, b: 250 },
  timenav_height_percentage: 25,
  marker_height_min: 30,
  scale_factor: 2 // Zoom iniziale più ampio
};

async function initTimeline() {
  try {
    const res = await fetch('assets/data/events_timeline.json');
    if(!res.ok) throw new Error("File timeline non trovato");
    
    rawTimelineData = await res.json();
    
    // Popola i filtri
    populateTimelineFilters(rawTimelineData.events);
    
    // Renderizza la timeline completa
    renderTimeline(rawTimelineData);
    
  } catch (e) {
    console.error("Errore Timeline:", e);
    document.getElementById('timeline-embed').innerHTML = `<div class="error-msg">⚠️ Impossibile caricare la timeline: ${e.message}</div>`;
  }
}

function renderTimeline(dataJson) {
  // Se non ci sono eventi, mostra messaggio
  if (!dataJson.events || dataJson.events.length === 0) {
    document.getElementById('timeline-embed').innerHTML = '<div class="no-data">Nessun evento trovato con i filtri attuali.</div>';
    return;
  }

  // Pulisci container (necessario per TimelineJS)
  document.getElementById('timeline-embed').innerHTML = '';
  
  // Istanzia TimelineJS
  tlInstance = new TL.Timeline('timeline-embed', dataJson, timelineOptions);
}

// --- FILTRI E RICERCA ---

function populateTimelineFilters(events) {
  const types = [...new Set(events.map(e => e.group))].sort();
  const select = document.getElementById('tlCategoryFilter');
  
  select.innerHTML = '<option value="">Tutte le categorie</option>';
  types.forEach(t => {
    if(t) select.innerHTML += `<option value="${t}">${t}</option>`;
  });
}

function applyTimelineFilters() {
  const searchTerm = document.getElementById('tlSearch').value.toLowerCase();
  const category = document.getElementById('tlCategoryFilter').value;
  
  if (!rawTimelineData) return;

  // Filtra gli eventi
  const filteredEvents = rawTimelineData.events.filter(e => {
    const textMatch = (e.text.headline + e.text.text).toLowerCase().includes(searchTerm);
    const catMatch = category === "" || e.group === category;
    return textMatch && catMatch;
  });

  // Ricrea oggetto JSON compatibile
  const filteredData = {
    ...rawTimelineData,
    events: filteredEvents
  };

  renderTimeline(filteredData);
  
  // Aggiorna contatore
  document.getElementById('tl-count').innerText = `${filteredEvents.length} eventi visualizzati`;
}

// Reset
function resetTimeline() {
  document.getElementById('tlSearch').value = '';
  document.getElementById('tlCategoryFilter').value = '';
  renderTimeline(rawTimelineData);
  document.getElementById('tl-count').innerText = `${rawTimelineData.events.length} eventi totali`;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initTimeline();
  
  document.getElementById('tlSearch').addEventListener('input', applyTimelineFilters);
  document.getElementById('tlCategoryFilter').addEventListener('change', applyTimelineFilters);
  document.getElementById('tlReset').addEventListener('click', resetTimeline);
});
