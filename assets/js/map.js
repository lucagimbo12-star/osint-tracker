// ============================================
// MAP.JS - PRO VERSION (PERFORMANCE + ICONS)
// ============================================

// Inizializza la mappa con opzioni di performance
let map = L.map('map', {
  zoomControl: false,
  preferCanvas: true, // Usa Canvas invece di DOM (molto più veloce per tanti punti)
  wheelPxPerZoomLevel: 120
}).setView([49.0, 32.0], 6);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// --- TILES (CartoDB Light per velocità e pulizia) ---
const osmLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap &copy; CARTO'
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: '&copy; Esri'
});

osmLayer.addTo(map);

// --- CLUSTER OTTIMIZZATO ---
// Qui sta il segreto della velocità: chunkedLoading
let eventsLayer = L.markerClusterGroup({
  chunkedLoading: true,        // Carica i marker a blocchi per non freezare il browser
  chunkInterval: 200,          // Intervallo tra i blocchi (ms)
  maxClusterRadius: 50,        // Raggio più ampio = meno cluster da disegnare
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  removeOutsideVisibleBounds: true, // Non disegna ciò che è fuori schermo
  iconCreateFunction: function(cluster) {
    var count = cluster.getChildCount();
    var size = count < 10 ? 'small' : (count < 100 ? 'medium' : 'large');
    return new L.DivIcon({
      html: `<div><span>${count}</span></div>`,
      className: `marker-cluster marker-cluster-${size}`,
      iconSize: new L.Point(40, 40)
    });
  }
});

map.addLayer(eventsLayer);
let heatmapLayer = null;

// --- CONFIGURAZIONE GRAFICA ---
const impactColors = {
  'critical': '#b71c1c',  // Rosso Scuro
  'high':     '#f57c00',  // Arancio
  'medium':   '#fbc02d',  // Giallo
  'low':      '#546e7a'   // Blu Grigio
};

// Mappa: Keyword -> Icona FontAwesome
const typeIcons = {
  'drone':       'fa-plane-up',
  'missile':     'fa-rocket',
  'rocket':      'fa-rocket',
  'artillery':   'fa-bomb',
  'shelling':    'fa-bomb',
  'airstrike':   'fa-jet-fighter',
  'air':         'fa-jet-fighter',
  'sabotage':    'fa-user-secret',
  'partisan':    'fa-user-secret',
  'naval':       'fa-anchor',
  'ship':        'fa-anchor',
  'sea':         'fa-anchor',
  'energy':      'fa-bolt',
  'infrastructure':'fa-industry',
  'refinery':    'fa-industry',
  'plant':       'fa-industry',
  'fire':        'fa-fire',
  'explosion':   'fa-fire',
  'cyber':       'fa-network-wired',
  'default':     'fa-crosshairs'
};

function getColor(val) {
  const v = val || 0.2;
  if (v >= 0.8) return impactColors.critical;
  if (v >= 0.6) return impactColors.high;
  if (v >= 0.4) return impactColors.medium;
  return impactColors.low;
}

function getIconClass(type) {
  if (!type) return typeIcons.default;
  const t = type.toLowerCase();
  
  // Cerca la prima chiave che corrisponde a una parte del tipo
  for (const [key, icon] of Object.entries(typeIcons)) {
    if (t.includes(key)) return icon;
  }
  return typeIcons.default;
}

// --- UPDATE MAP ---
async function loadEventsData() {
  try {
    const res = await fetch('assets/data/events.geojson');
    if (!res.ok) throw new Error('GeoJSON non trovato');
    const data = await res.json();
    
    // Ottimizzazione: Map leggero dei dati
    const events = [];
    // Usa for loop classico che è più veloce di map per grandi array
    for (let i = 0; i < data.features.length; i++) {
      const f = data.features[i];
      if (f.geometry && f.geometry.coordinates) {
        // Aggiungiamo lat/lon direttamente alle properties per comodità
        f.properties.lat = f.geometry.coordinates[1];
        f.properties.lon = f.geometry.coordinates[0];
        events.push(f.properties);
      }
    }

    updateMap(events);
    initHeatmap(events);
    
    // Aggiorna i KPI se la funzione esiste (in charts.js o qui)
    if (window.updateKPIs) window.updateKPIs(events);
    else updateLocalKPIs(events);

  } catch (e) { console.error("Errore Mappa:", e); }
}

function updateMap(events) {
  eventsLayer.clearLayers();
  
  const markers = [];

  events.forEach(e => {
    const color = getColor(e.intensity);
    const iconClass = getIconClass(e.type);
    
    // Dimensioni ottimizzate
    const size = (e.intensity || 0.2) >= 0.8 ? 30 : 24;
    const iconSize = Math.floor(size / 1.8);

    const marker = L.marker([e.lat, e.lon], {
      icon: L.divIcon({
        className: 'custom-icon-marker',
        html: `<div style="
          background-color: ${color};
          width: ${size}px; height: ${size}px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          color: white;
        "><i class="fa-solid ${iconClass}" style="font-size:${iconSize}px;"></i></div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      })
    });

    // Popup leggero
    marker.bindPopup(createPopupContent(e), { maxWidth: 300, closeButton: false });
    markers.push(marker);
  });

  // Aggiunge tutti i marker in un colpo solo (più veloce)
  eventsLayer.addLayers(markers);
}

function createPopupContent(e) {
  // Semplice e sicuro
  const safeTitle = (e.title || 'Evento').replace(/'/g, "&apos;");
  const safeDesc = (e.description || '').replace(/'/g, "&apos;");
  const safeVideo = (e.video || '').replace(/'/g, "&apos;");
  const safeSource = (e.link || '').replace(/'/g, "&apos;");
  const hasVideo = (e.video && e.video !== 'null');
  
  const color = getColor(e.intensity);

  return `
    <div class="acled-popup">
      <div style="border-left: 4px solid ${color}; padding-left: 10px; margin-bottom: 8px;">
        <h5 style="margin:0; color:#002060; font-size:0.95rem;">${e.title}</h5>
        <small style="color:#666;">${e.date} | ${e.type}</small>
      </div>
      <p style="font-size:0.85rem; margin:0 0 10px 0; color:#333;">
        ${e.description ? e.description.substring(0, 80)+'...' : 'Nessun dettaglio.'}
      </p>
      <button onclick="openModal('${encodeURIComponent(safeTitle)}','${encodeURIComponent(safeDesc)}','${encodeURIComponent(safeVideo)}','${encodeURIComponent(safeSource)}')" 
        class="btn-acled-primary" style="width:100%; padding:5px; font-size:0.8rem;">
        ${hasVideo ? '<i class="fa-solid fa-play"></i> Video' : '<i class="fa-solid fa-plus"></i> Info'}
      </button>
    </div>
  `;
}

// --- HEATMAP (Leggera) ---
function initHeatmap(events) {
  if(heatmapLayer) map.removeLayer(heatmapLayer);
  
  // Usa solo un sottoinsieme di punti se sono troppi (>1000) per non bloccare la CPU
  const heatData = events.length > 2000 
    ? events.filter((_, i) => i % 2 === 0).map(e => [e.lat, e.lon, (e.intensity||0.2)*1.5]) 
    : events.map(e => [e.lat, e.lon, (e.intensity||0.2)*1.5]);

  heatmapLayer = L.heatLayer(heatData, { 
    radius: 20, 
    blur: 15, 
    maxZoom: 10, 
    minOpacity: 0.4,
    gradient:{0.4:'blue', 0.65:'lime', 1:'red'} 
  });
}

// Gestione KPI locale (fallback)
function updateLocalKPIs(events) {
  const countEl = document.getElementById('eventCount');
  if(countEl) countEl.innerText = events.length;
}

// Globals
window.toggleHeatmapLayer = (show) => show ? map.addLayer(heatmapLayer) : map.removeLayer(heatmapLayer);
window.toggleSatelliteLayer = (show) => {
  if(show) { map.addLayer(satelliteLayer); map.removeLayer(osmLayer); }
  else { map.addLayer(osmLayer); map.removeLayer(satelliteLayer); }
};

// Init
loadEventsData();
