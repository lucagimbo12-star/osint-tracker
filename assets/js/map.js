// ============================================
// MAP.JS - ACLED PRO (PERFORMANCE + ICONS)
// ============================================

// 1. Inizializzazione Mappa Ottimizzata
let map = L.map('map', {
  zoomControl: false,
  preferCanvas: true,       // USA GPU per disegnare cerchi/linee (Velocità x10)
  wheelPxPerZoomLevel: 120  // Zoom più fluido
}).setView([49.0, 32.0], 6);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// 2. Layer Base (CartoDB Light per pulizia professionale)
const osmLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: '&copy; Esri'
});

osmLayer.addTo(map);

// 3. Cluster Group ad Alte Prestazioni
let eventsLayer = L.markerClusterGroup({
  chunkedLoading: true,        // <--- IL SEGRETO DELLA VELOCITÀ (Carica a blocchi)
  chunkInterval: 200,          // Tempo tra i blocchi
  chunkDelay: 50,              // Pausa per non freezare la UI
  maxClusterRadius: 45,        // Raggio ottimizzato
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  removeOutsideVisibleBounds: true, // Non disegna ciò che non vedi
  iconCreateFunction: function(cluster) {
    // Cluster stile ACLED (Cerchi semplici con numero)
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

// --- CONFIGURAZIONE COLORI & ICONE ---
const impactColors = {
  'critical': '#b71c1c',  // Rosso Scuro
  'high':     '#f57c00',  // Arancio
  'medium':   '#fbc02d',  // Giallo
  'low':      '#546e7a'   // Grigio Blu
};

// Mappatura Keyword -> Icona FontAwesome
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
  'default':     'fa-crosshairs' // Mirino generico
};

// --- HELPER FUNCTIONS ---
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
  
  // Cerca corrispondenza parziale (es. "Russian Drone Attack" -> trova "drone")
  for (const [key, icon] of Object.entries(typeIcons)) {
    if (t.includes(key)) return icon;
  }
  return typeIcons.default;
}

// --- CARICAMENTO DATI ---
async function loadEventsData() {
  try {
    const res = await fetch('assets/data/events.geojson');
    if (!res.ok) throw new Error('GeoJSON non trovato');
    const data = await res.json();
    
    // Estrazione rapida proprietà
    const events = data.features.map(f => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    })).filter(e => e.lat && e.lon); // Filtra errori

    updateMap(events);
    initHeatmap(events);
    
    // Aggiorna contatori (se presenti nella pagina)
    if(document.getElementById('eventCount')) {
        document.getElementById('eventCount').innerText = events.length;
    }

  } catch (e) { console.error("Errore Mappa:", e); }
}

function updateMap(events) {
  eventsLayer.clearLayers();
  
  const markers = []; // Array temporaneo per inserimento bulk (più veloce)

  events.forEach(e => {
    const color = getColor(e.intensity);
    const iconClass = getIconClass(e.type);
    
    // Dimensione marker base
    const size = (e.intensity || 0.2) >= 0.8 ? 30 : 24;
    const iconSize = Math.floor(size / 1.8);

    // Creazione Marker con Icona
    const marker = L.marker([e.lat, e.lon], {
      icon: L.divIcon({
        className: 'custom-icon-marker',
        // HTML ottimizzato per centratura perfetta
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

    marker.bindPopup(createPopupContent(e), { maxWidth: 300 });
    markers.push(marker);
  });

  // Aggiunta massiva al cluster (Molto più veloce di addLayer singolo)
  eventsLayer.addLayers(markers);
}

// --- POPUP STILE ACLED ---
function createPopupContent(e) {
  const safeTitle = encodeURIComponent(e.title || 'Evento');
  const safeDesc = encodeURIComponent(e.description || '');
  const safeVideo = encodeURIComponent(e.video || '');
  const safeSource = encodeURIComponent(e.link || '');
  
  const hasVideo = (e.video && e.video !== 'null' && e.video !== '');
  const color = getColor(e.intensity);

  return `
    <div class="acled-popup">
      <div style="border-left: 4px solid ${color}; padding-left: 10px; margin-bottom: 8px;">
        <h5 style="margin:0; color:#002060; font-size:0.95rem;">${e.title}</h5>
        <small style="color:#666; display:block; margin-top:2px;">
          ${e.date} <br> 
          <span style="color:${color}; font-weight:700;">${e.type}</span>
        </small>
      </div>
      <p style="font-size:0.85rem; margin:0 0 10px 0; color:#333; line-height:1.4;">
        ${e.description ? e.description.substring(0, 80)+'...' : 'Nessun dettaglio.'}
      </p>
      <button onclick="openModal('${safeTitle}','${safeDesc}','${safeVideo}','${safeSource}')" 
        class="btn-acled-primary" style="width:100%; padding:6px; font-size:0.8rem;">
        ${hasVideo ? '<i class="fa-solid fa-play"></i> Video' : '<i class="fa-solid fa-plus"></i> Dettagli'}
      </button>
    </div>
  `;
}

// --- HEATMAP ---
function initHeatmap(events) {
  if(heatmapLayer) map.removeLayer(heatmapLayer);
  // Campionamento per performance se > 3000 punti
  const dataset = events.length > 3000 ? events.filter((_,i)=>i%2===0) : events;
  
  const points = dataset.map(e => [e.lat, e.lon, (e.intensity||0.2)*1.5]);
  
  heatmapLayer = L.heatLayer(points, { 
    radius: 25, blur: 15, maxZoom: 10, minOpacity: 0.4,
    gradient: { 0.4: 'blue', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red' } 
  });
}

// --- LEGENDA MOBILE ---
L.Control.FloatingLegend = L.Control.extend({
  onAdd: function() {
    const container = L.DomUtil.create('div', 'floating-legend');
    
    // Toggle Button
    const toggle = L.DomUtil.create('div', 'legend-toggle', container);
    toggle.innerHTML = '<i class="fa-solid fa-info"></i>';
    
    // Content
    const content = L.DomUtil.create('div', 'legend-content', container);
    
    // 1. Livelli
    let html = '<div class="legend-section"><h4>Livello Impatto</h4><div class="legend-grid">';
    Object.entries(impactColors).forEach(([key, color]) => {
      html += `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${key}</div>`;
    });
    html += '</div></div>';

    // 2. Icone (Prime 6 più comuni)
    html += '<div class="legend-section"><h4>Simboli</h4><div class="legend-grid">';
    const common = ['missile','drone','artillery','energy','fire','naval'];
    common.forEach(k => {
      html += `<div class="legend-item"><i class="fa-solid ${typeIcons[k]}" style="color:#546e7a; width:15px;"></i> ${k}</div>`;
    });
    html += '</div></div>';
    
    content.innerHTML = html;

    // Click Logic
    toggle.onclick = (e) => {
      L.DomEvent.stopPropagation(e);
      container.classList.toggle('expanded');
      toggle.innerHTML = container.classList.contains('expanded') ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-info"></i>';
    };
    L.DomEvent.disableClickPropagation(container);
    
    return container;
  }
});
map.addControl(new L.Control.FloatingLegend({ position: 'bottomleft' }));

// --- MODAL LOGIC (Global) ---
window.openModal = function(t, d, v, s) {
  document.getElementById('modalTitle').textContent = decodeURIComponent(t);
  document.getElementById('modalDesc').textContent = decodeURIComponent(d);
  const src = decodeURIComponent(s);
  const vid = decodeURIComponent(v);
  
  const linkBtn = document.getElementById('modalSourceLink');
  if(src && src !== 'null') { linkBtn.href = src; linkBtn.style.display = 'inline-block'; }
  else linkBtn.style.display = 'none';

  const vidCont = document.getElementById('modalVideoContainer');
  vidCont.innerHTML = '';
  
  if(vid && vid !== 'null') {
    if(vid.includes('youtu')) {
      let embed = vid.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/').split('&')[0];
      vidCont.innerHTML = `<iframe src="${embed}" frameborder="0" allowfullscreen></iframe>`;
    } else {
      vidCont.innerHTML = `<div style="padding:20px; text-align:center;"><a href="${vid}" target="_blank" class="btn-acled-primary">Apri Video Esterno</a></div>`;
    }
  }
  document.getElementById('videoModal').style.display = 'flex';
};

window.closeModal = (e) => {
  if(!e || e.target.id === 'videoModal' || e.target.classList.contains('close-modal')) {
    document.getElementById('videoModal').style.display = 'none';
    document.getElementById('modalVideoContainer').innerHTML = '';
  }
};

// Globals for Toggles
window.toggleHeatmapLayer = (show) => show ? map.addLayer(heatmapLayer) : map.removeLayer(heatmapLayer);
window.toggleSatelliteLayer = (show) => {
  if(show) { map.addLayer(satelliteLayer); map.removeLayer(osmLayer); }
  else { map.addLayer(osmLayer); map.removeLayer(satelliteLayer); }
};

// Init
loadEventsData();
