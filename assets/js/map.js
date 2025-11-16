// ============================================
// MAP.JS - VERSIONE AVANZATA CON LAYER E CATEGORIE
// ============================================

// Inizializza mappa
let map = L.map('map').setView([54.5, 37.6], 5);

// Tiles OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Layer groups per categorie
let layerGroups = {
  'ukraine-strike-energy': L.markerClusterGroup({ maxClusterRadius: 50 }),
  'ukraine-strike-military': L.markerClusterGroup({ maxClusterRadius: 50 }),
  'russia-strike-energy': L.markerClusterGroup({ maxClusterRadius: 50 }),
  'russia-strike-civilian': L.markerClusterGroup({ maxClusterRadius: 50 }),
  'cross-border': L.markerClusterGroup({ maxClusterRadius: 50 })
};

// Aggiungi tutti i layer alla mappa di default
Object.values(layerGroups).forEach(layer => layer.addTo(map));

// Variabili globali
let allEvents = [];
let currentFilter = {
  startDate: null,
  endDate: null,
  category: null,
  actor: null,
  impactLevel: null
};

// Colori per categorie
const categoryColors = {
  'ukraine-strike-energy': '#ffc107',
  'ukraine-strike-military': '#ff6b6b',
  'russia-strike-energy': '#dc3545',
  'russia-strike-civilian': '#e74c3c',
  'cross-border': '#6f42c1'
};

// Icone personalizzate per categoria
function getMarkerIcon(category, impactLevel) {
  const color = categoryColors[category] || '#45a29e';
  const size = impactLevel === 'critical' ? 16 : impactLevel === 'high' ? 14 : 12;
  
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color}; 
      width: ${size}px; 
      height: ${size}px; 
      border-radius: 50%; 
      border: 2px solid white; 
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      ${impactLevel === 'critical' ? 'animation: pulse 2s infinite;' : ''}
    "></div>`,
    iconSize: [size + 4, size + 4]
  });
}

// Carica dati dal nuovo database
fetch('events_database.json')
  .then(res => res.json())
  .then(data => {
    allEvents = data.events;
    displayEvents(allEvents);
    updateStatistics(allEvents);
    populateFilters(allEvents);
  })
  .catch(err => {
    console.error("Errore caricamento database:", err);
    // Fallback al vecchio geojson se esiste
    loadLegacyData();
  });

// Fallback per compatibilità con vecchi dati
function loadLegacyData() {
  fetch('events.geojson')
    .then(res => res.json())
    .then(data => {
      allEvents = convertLegacyData(data.features);
      displayEvents(allEvents);
      updateStatistics(allEvents);
    });
}

// Converti vecchi dati in nuovo formato
function convertLegacyData(features) {
  return features.map((f, idx) => ({
    id: `LEGACY-${idx}`,
    date: f.properties.date,
    actor: 'Ukraine',
    target_actor: 'Russia',
    category: 'ukraine-strike-energy',
    type: f.properties.type,
    location: {
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    },
    location_text: f.properties.title,
    impact: {
      damage_level: 'medium'
    },
    sources: f.properties.archived ? [{ url: f.properties.archived }] : [],
    reliability: f.properties.verification === 'verified' ? 'confirmed' : 'medium'
  }));
}

// Mostra eventi sulla mappa
function displayEvents(events) {
  // Pulisci tutti i layer
  Object.values(layerGroups).forEach(layer => layer.clearLayers());
  
  events.forEach(event => {
    const category = event.category;
    const layer = layerGroups[category];
    
    if (!layer) return;
    
    const marker = L.marker(
      [event.location.lat, event.location.lon],
      { icon: getMarkerIcon(category, event.impact?.damage_level) }
    );
    
    marker.bindPopup(createPopupContent(event));
    layer.addLayer(marker);
  });
}

// Crea contenuto popup
function createPopupContent(event) {
  const impactColors = {
    'critical': '#dc3545',
    'high': '#fd7e14',
    'medium': '#ffc107',
    'low': '#28a745'
  };
  
  const impactColor = impactColors[event.impact?.damage_level] || '#6c757d';
  
  return `
    <div style="min-width: 280px; max-width: 350px;">
      <div style="background: linear-gradient(135deg, ${categoryColors[event.category]}20 0%, ${categoryColors[event.category]}10 100%); padding: 12px; margin: -10px -10px 10px -10px; border-radius: 8px 8px 0 0;">
        <strong style="font-size: 1.15em; color: #0b0c10;">${event.location_text || event.target_detail}</strong>
      </div>
      
      <div style="margin-bottom: 8px;">
        <span style="background: ${categoryColors[event.category]}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 600;">
          ${getCategoryLabel(event.category)}
        </span>
        ${event.impact?.damage_level ? `
          <span style="background: ${impactColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 600; margin-left: 4px;">
            ${event.impact.damage_level.toUpperCase()}
          </span>
        ` : ''}
      </div>
      
      <hr style="margin: 10px 0; border: none; border-top: 1px solid #dee2e6;">
      
      <div style="font-size: 0.9em; line-height: 1.6;">
        <p><strong>📅 Data:</strong> ${formatDate(event.date)}</p>
        <p><strong>🎯 Attore:</strong> ${event.actor}</p>
        <p><strong>🔸 Tipo:</strong> ${event.type || event.subcategory}</p>
        ${event.impact?.casualties ? `<p><strong>💀 Vittime:</strong> ${event.impact.casualties}</p>` : ''}
        ${event.distance_from_border_km ? `<p><strong>📏 Distanza confine:</strong> ${event.distance_from_border_km}km</p>` : ''}
        ${event.impact?.economic_impact ? `<p style="color: #495057; font-size: 0.85em;"><strong>💰 Impatto:</strong> ${event.impact.economic_impact}</p>` : ''}
      </div>
      
      ${event.context ? `
        <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; margin-top: 10px; font-size: 0.85em; color: #495057;">
          <strong>ℹ️ Contesto:</strong><br>${event.context}
        </div>
      ` : ''}
      
      ${event.sources && event.sources.length > 0 ? `
        <div style="margin-top: 10px;">
          <strong style="font-size: 0.9em;">📌 Fonti:</strong><br>
          ${event.sources.map(s => `<a href="${s.url}" target="_blank" style="color: #45a29e; font-size: 0.85em; text-decoration: none;">🔗 ${s.outlet || 'Fonte'}</a>`).join('<br>')}
        </div>
      ` : ''}
      
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e9ecef; font-size: 0.75em; color: #6c757d;">
        ✓ Affidabilità: ${event.reliability}
      </div>
    </div>
  `;
}

// Label categoria
function getCategoryLabel(category) {
  const labels = {
    'ukraine-strike-energy': '🇺🇦 Attacco UA → Energia RU',
    'ukraine-strike-military': '🇺🇦 Attacco UA → Militare RU',
    'russia-strike-energy': '🇷🇺 Attacco RU → Energia UA',
    'russia-strike-civilian': '🇷🇺 Attacco RU → Civili UA',
    'cross-border': '⚡ Transfrontaliero'
  };
  return labels[category] || category;
}

// Formatta data
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Aggiorna statistiche
function updateStatistics(events) {
  document.getElementById('eventCount').textContent = events.length;
  
  // Trova ultima data
  const dates = events.map(e => new Date(e.date)).filter(d => !isNaN(d));
  if (dates.length > 0) {
    const lastDate = new Date(Math.max(...dates));
    document.getElementById('lastUpdate').textContent = lastDate.toLocaleDateString('it-IT');
  }
  
  // Statistiche per categoria
  const byCat = {};
  events.forEach(e => {
    byCat[e.category] = (byCat[e.category] || 0) + 1;
  });
  
  const statsContainer = document.getElementById('categoryStats');
  if (statsContainer) {
    statsContainer.innerHTML = Object.entries(byCat)
      .map(([cat, count]) => `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9ecef;">
          <span style="font-size: 0.85em;">${getCategoryLabel(cat)}</span>
          <strong style="color: ${categoryColors[cat]};">${count}</strong>
        </div>
      `).join('');
  }
}

// Popola filtri dinamicamente
function populateFilters(events) {
  // Trova range date
  const dates = events.map(e => new Date(e.date)).filter(d => !isNaN(d));
  if (dates.length > 0) {
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    document.getElementById('startDate').min = minDate.toISOString().split('T')[0];
    document.getElementById('endDate').max = maxDate.toISOString().split('T')[0];
  }
}

// Applica filtri
document.getElementById('applyFilter').addEventListener('click', () => {
  currentFilter.startDate = document.getElementById('startDate').value;
  currentFilter.endDate = document.getElementById('endDate').value;
  currentFilter.category = document.getElementById('categoryFilter').value;
  currentFilter.actor = document.getElementById('actorFilter').value;
  currentFilter.impactLevel = document.getElementById('impactFilter').value;
  
  const filtered = allEvents.filter(event => {
    // Filtra per data
    if (currentFilter.startDate && event.date < currentFilter.startDate) return false;
    if (currentFilter.endDate && event.date > currentFilter.endDate) return false;
    
    // Filtra per categoria
    if (currentFilter.category && event.category !== currentFilter.category) return false;
    
    // Filtra per attore
    if (currentFilter.actor && event.actor !== currentFilter.actor) return false;
    
    // Filtra per impatto
    if (currentFilter.impactLevel && event.impact?.damage_level !== currentFilter.impactLevel) return false;
    
    return true;
  });
  
  displayEvents(filtered);
  updateStatistics(filtered);
  
  // Feedback
  const btn = document.getElementById('applyFilter');
  btn.textContent = `✓ Filtrati: ${filtered.length}`;
  setTimeout(() => btn.textContent = 'Applica filtri', 2000);
});

// Reset filtri
document.getElementById('resetFilter').addEventListener('click', () => {
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  document.getElementById('categoryFilter').value = '';
  document.getElementById('actorFilter').value = '';
  document.getElementById('impactFilter').value = '';
  
  currentFilter = {};
  displayEvents(allEvents);
  updateStatistics(allEvents);
});

// Toggle layer visibility
document.querySelectorAll('.layer-toggle').forEach(toggle => {
  toggle.addEventListener('change', (e) => {
    const category = e.target.dataset.category;
    const layer = layerGroups[category];
    
    if (e.target.checked) {
      map.addLayer(layer);
    } else {
      map.removeLayer(layer);
    }
  });
});

// Heatmap (placeholder - richiede leaflet.heat plugin)
document.getElementById('toggleHeatmap')?.addEventListener('click', () => {
  alert('Funzionalità heatmap in arrivo! Richiede plugin leaflet.heat');
});

// Export dati filtrati
document.getElementById('exportData')?.addEventListener('click', () => {
  const filtered = allEvents.filter(event => {
    if (currentFilter.startDate && event.date < currentFilter.startDate) return false;
    if (currentFilter.endDate && event.date > currentFilter.endDate) return false;
    if (currentFilter.category && event.category !== currentFilter.category) return false;
    return true;
  });
  
  const csv = convertToCSV(filtered);
  downloadCSV(csv, 'eventi_filtrati.csv');
});

function convertToCSV(events) {
  const headers = ['ID', 'Data', 'Attore', 'Target', 'Categoria', 'Tipo', 'Località', 'Lat', 'Lon', 'Impatto', 'Affidabilità'];
  const rows = events.map(e => [
    e.id,
    e.date,
    e.actor,
    e.target_actor,
    e.category,
    e.type,
    e.location_text,
    e.location.lat,
    e.location.lon,
    e.impact?.damage_level || '',
    e.reliability
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

// Responsive
window.addEventListener('resize', () => map.invalidateSize());

// CSS per animazione pulse (aggiungi a head)
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.8; }
  }
`;
document.head.appendChild(style);
