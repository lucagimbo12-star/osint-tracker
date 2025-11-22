// ============================================
// MAP.JS - PRO VERSION (ICONS + FLOATING LEGEND)
// ============================================

let map = L.map('map', { zoomControl: false }).setView([49.0, 32.0], 6);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// --- TILES ---
const osmLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19, attribution: '&copy; CARTO'
});
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: '&copy; Esri'
});
osmLayer.addTo(map);

// --- CLUSTER ---
let eventsLayer = L.markerClusterGroup({ 
  maxClusterRadius: 45, 
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
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

// --- COLORI & ICONE ---
const impactConfig = {
  'critical': { color: '#b71c1c', label: 'Critico' }, // Rosso scuro
  'high':     { color: '#f57c00', label: 'Alto' },    // Arancio
  'medium':   { color: '#fbc02d', label: 'Medio' },   // Giallo
  'low':      { color: '#546e7a', label: 'Basso' }    // Blu Grigio
};

const typeIcons = {
  'drone':       { icon: 'fa-plane-up', label: 'Droni' },
  'missile':     { icon: 'fa-rocket', label: 'Missili' },
  'artillery':   { icon: 'fa-bomb', label: 'Artiglieria' }, // Cambiato in Bomb per chiarezza
  'airstrike':   { icon: 'fa-jet-fighter', label: 'Aereo' },
  'sabotage':    { icon: 'fa-user-secret', label: 'Sabotaggio' },
  'naval':       { icon: 'fa-anchor', label: 'Navale' },
  'energy':      { icon: 'fa-bolt', label: 'Energia' },
  'infrastructure': { icon: 'fa-industry', label: 'Infrastruttura' },
  'fire':        { icon: 'fa-fire', label: 'Incendio' },
  'cyber':       { icon: 'fa-network-wired', label: 'Cyber' },
  'default':     { icon: 'fa-crosshairs', label: 'Altro' }
};

// Helper: Determina colore in base all'intensità
function getColor(val) {
  const v = val || 0.2;
  if (v >= 0.8) return impactConfig.critical.color;
  if (v >= 0.6) return impactConfig.high.color;
  if (v >= 0.4) return impactConfig.medium.color;
  return impactConfig.low.color;
}

// Helper: Determina icona in base al tipo
function getIconData(type) {
  if (!type) return typeIcons.default;
  const t = type.toLowerCase();
  
  if (t.includes('drone')) return typeIcons.drone;
  if (t.includes('missile') || t.includes('rocket')) return typeIcons.missile;
  if (t.includes('artiller') || t.includes('shelling')) return typeIcons.artillery;
  if (t.includes('air') || t.includes('bombing')) return typeIcons.airstrike;
  if (t.includes('sabotage') || t.includes('partisan')) return typeIcons.sabotage;
  if (t.includes('naval') || t.includes('ship')) return typeIcons.naval;
  if (t.includes('energy') || t.includes('electric')) return typeIcons.energy;
  if (t.includes('plant') || t.includes('refinery')) return typeIcons.infrastructure;
  if (t.includes('fire') || t.includes('explosion')) return typeIcons.fire;
  if (t.includes('cyber')) return typeIcons.cyber;
  
  return typeIcons.default;
}

// --- LEGENDA MOBILE ---
// Creiamo un controllo custom di Leaflet
L.Control.FloatingLegend = L.Control.extend({
  onAdd: function(map) {
    const container = L.DomUtil.create('div', 'floating-legend');
    
    // Bottone Toggle
    const toggle = L.DomUtil.create('div', 'legend-toggle', container);
    toggle.innerHTML = '<i class="fa-solid fa-info"></i>';
    toggle.title = "Apri Legenda";
    
    // Contenuto Legenda
    const content = L.DomUtil.create('div', 'legend-content', container);
    
    // Sezione Intensità
    let html = '<div class="legend-section"><h4>Livello Impatto</h4><div class="legend-grid">';
    Object.values(impactConfig).forEach(c => {
      html += `
        <div class="legend-item">
          <span class="legend-marker" style="background:${c.color}; border:none;"></span>
          ${c.label}
        </div>`;
    });
    html += '</div></div>';

    // Sezione Tipologia
    html += '<div class="legend-section"><h4>Tipologia</h4><div class="legend-grid">';
    Object.values(typeIcons).forEach(t => {
      html += `
        <div class="legend-item">
          <span class="legend-marker" style="background:#546e7a;">
            <i class="fa-solid ${t.icon}" style="font-size:10px;"></i>
          </span>
          ${t.label}
        </div>`;
    });
    html += '</div></div>';
    
    content.innerHTML = html;

    // Interazione Click
    toggle.onclick = function(e) {
      L.DomEvent.stopPropagation(e); // Evita click sulla mappa
      if (container.classList.contains('expanded')) {
        container.classList.remove('expanded');
        toggle.innerHTML = '<i class="fa-solid fa-info"></i>';
      } else {
        container.classList.add('expanded');
        toggle.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      }
    };

    // Disabilita propagazione eventi mappa quando si clicca sulla legenda
    L.DomEvent.disableClickPropagation(container);

    return container;
  }
});

// Aggiungi legenda in basso a sinistra
map.addControl(new L.Control.FloatingLegend({ position: 'bottomleft' }));


// --- AGGIORNAMENTO MAPPA ---
async function loadEventsData() {
  try {
    const res = await fetch('assets/data/events.geojson');
    if (!res.ok) throw new Error('GeoJSON non trovato');
    const data = await res.json();
    
    const events = data.features.map(f => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    }));

    updateMap(events);
    // updateKPIs(events); // Funzione in charts.js o qui se vuoi
    initHeatmap(events);
    
  } catch (e) { console.error(e); }
}

function updateMap(events) {
  eventsLayer.clearLayers();
  
  events.forEach(e => {
    const color = getColor(e.intensity);
    const iconData = getIconData(e.type);
    
    // Dimensione dinamica
    const size = (e.intensity || 0.2) >= 0.8 ? 32 : 26;
    const iconSize = size / 2;

    const marker = L.marker([e.lat, e.lon], {
      icon: L.divIcon({
        className: 'custom-icon-marker',
        // Usiamo style inline per il background dinamico
        html: `<i class="fa-solid ${iconData.icon}" style="font-size:${iconSize}px;"></i>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      })
    });
    
    // Applica il colore di sfondo via JS perché divIcon ha limiti
    // (Trucco: iniettiamo il colore direttamente nell'elemento creato)
    marker.options.icon.options.html = `
      <div style="
        background-color: ${color};
        width: ${size}px; height: ${size}px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 3px 6px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        color: white;
      ">
        <i class="fa-solid ${iconData.icon}" style="font-size:${iconSize}px;"></i>
      </div>
    `;

    marker.bindPopup(createPopupContent(e), { maxWidth: 300 });
    eventsLayer.addLayer(marker);
  });
}

function createPopupContent(e) {
  const iconData = getIconData(e.type);
  const color = getColor(e.intensity);
  const safeTitle = encodeURIComponent(e.title || 'Evento');
  const safeDesc = encodeURIComponent(e.description || '');
  const safeVideo = encodeURIComponent(e.video || '');
  const safeSource = encodeURIComponent(e.link || '');
  const hasVideo = (e.video && e.video !== 'null');

  return `
    <div class="acled-popup">
      <div style="border-left: 4px solid ${color}; padding-left: 10px; margin-bottom: 10px;">
        <h5 style="margin:0; color:#002060; font-size:1rem;">${e.title}</h5>
        <div style="font-size:0.75rem; color:#555; margin-top:4px;">
          <i class="fa-solid ${iconData.icon}"></i> ${e.type} | ${e.date}
        </div>
      </div>
      <div style="font-size:0.85rem; color:#333; margin-bottom:10px;">
        ${e.description ? e.description.substring(0, 100)+'...' : 'Nessun dettaglio.'}
      </div>
      <button onclick="openModal('${safeTitle}','${safeDesc}','${safeVideo}','${safeSource}')" 
        class="btn-acled-primary" style="padding:6px; font-size:0.8rem;">
        ${hasVideo ? '<i class="fa-solid fa-play"></i> Video' : '<i class="fa-solid fa-plus"></i> Info'}
      </button>
    </div>
  `;
}

function initHeatmap(events) {
  if(heatmapLayer) map.removeLayer(heatmapLayer);
  const points = events.map(e => [e.lat, e.lon, (e.intensity||0.2)*2.5]);
  heatmapLayer = L.heatLayer(points, { radius: 25, blur: 15, maxZoom: 10, gradient:{0.4:'blue', 0.65:'yellow', 1:'red'} });
}

// Globals for HTML toggles
window.toggleHeatmapLayer = (show) => show ? map.addLayer(heatmapLayer) : map.removeLayer(heatmapLayer);
window.toggleSatelliteLayer = (show) => {
  if(show) { map.addLayer(satelliteLayer); map.removeLayer(osmLayer); }
  else { map.addLayer(osmLayer); map.removeLayer(satelliteLayer); }
};

// Init
loadEventsData();
