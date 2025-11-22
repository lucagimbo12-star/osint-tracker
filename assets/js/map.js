// ============================================
// MAP.JS - PRO VERSION (VIDEO & AI DATA)
// ============================================

let map = L.map('map').setView([49.0, 32.0], 6); // Centrato sull'Ucraina

// --- LAYER SETUP ---
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© OpenStreetMap'
});
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: '© Esri'
});

osmLayer.addTo(map);

let eventsLayer = L.markerClusterGroup({ 
  maxClusterRadius: 45, 
  spiderfyOnMaxZoom: true 
});
let heatmapLayer = null;
let bordersLayer = L.layerGroup();

eventsLayer.addTo(map);

// --- GESTIONE DATI ---
let allEvents = [];

const impactColors = { 'critical': '#dc3545', 'high': '#fd7e14', 'medium': '#ffc107', 'low': '#6c757d' };
const intensityMap = { 'critical': 1.0, 'high': 0.7, 'medium': 0.4, 'low': 0.2 };

// Helper: Determina impatto e intensità se mancanti
function determineImpact(props) {
  if (props.intensity) return props.intensity; // Se l'AI l'ha calcolato, usa quello
  
  const t = (props.title || '').toLowerCase();
  const v = props.verification;
  
  if (t.includes('raffineria') || t.includes('refinery') || t.includes('deposito')) return 0.8;
  if (v === 'verified') return 0.6;
  return 0.2;
}

function getImpactLabel(val) {
  if (val >= 0.8) return { label: 'CRITICO', color: impactColors.critical };
  if (val >= 0.6) return { label: 'ALTO', color: impactColors.high };
  if (val >= 0.4) return { label: 'MEDIO', color: impactColors.medium };
  return { label: 'BASSO', color: impactColors.low };
}

// --- POPUP & MODALE ---
window.openModal = function(title, desc, videoUrl, sourceUrl) {
  document.getElementById('modalTitle').textContent = decodeURIComponent(title);
  document.getElementById('modalDesc').textContent = decodeURIComponent(desc) || "Nessuna descrizione dettagliata disponibile.";
  
  const sourceLink = document.getElementById('modalSourceLink');
  sourceLink.href = decodeURIComponent(sourceUrl);
  sourceLink.style.display = sourceUrl && sourceUrl !== 'null' ? 'inline-block' : 'none';
  
  const container = document.getElementById('modalVideoContainer');
  container.innerHTML = '';

  if (videoUrl && videoUrl !== 'null' && videoUrl !== '') {
    const vid = decodeURIComponent(videoUrl);
    if (vid.includes('youtube') || vid.includes('youtu.be')) {
      let embed = vid.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/');
      container.innerHTML = `<iframe src="${embed}" frameborder="0" allowfullscreen></iframe>`;
    } else if (vid.match(/\.(mp4|webm)$/i)) {
      container.innerHTML = `<video controls src="${vid}" style="max-width:100%"></video>`;
    } else {
      container.innerHTML = `<div style="padding:30px; text-align:center; color:white;">
        <p>Video su piattaforma esterna</p>
        <a href="${vid}" target="_blank" class="btn-primary">▶️ Guarda Video</a>
      </div>`;
    }
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }

  document.getElementById('videoModal').style.display = 'flex';
};

window.closeModal = function(e) {
  if (!e || e.target.id === 'videoModal' || e.target.classList.contains('close-modal')) {
    document.getElementById('videoModal').style.display = 'none';
    document.getElementById('modalVideoContainer').innerHTML = '';
  }
};

function createPopupContent(e) {
  const info = getImpactLabel(e.intensity);
  
  // Escape per sicurezza stringhe JS
  const safeTitle = encodeURIComponent(e.title);
  const safeDesc = encodeURIComponent(e.description || '');
  const safeVideo = encodeURIComponent(e.video || '');
  const safeSource = encodeURIComponent(e.link || '');

  return `
    <div class="custom-popup-content" style="min-width: 280px;">
      <div style="border-bottom: 3px solid ${info.color}; padding-bottom: 8px; margin-bottom: 10px;">
        <strong style="font-size: 1.1em; display:block; color:#222;">${e.title}</strong>
        <span style="background:${info.color}; color:white; font-size:0.7em; padding:2px 6px; border-radius:4px; text-transform:uppercase;">
          ${info.label}
        </span>
        <span style="font-size:0.75em; color:#666; float:right;">${e.date}</span>
      </div>
      
      <div style="font-size:0.9em; color:#444; margin-bottom:10px;">
        ${e.description ? e.description.substring(0, 90) + '...' : 'Nessuna descrizione breve.'}
      </div>

      <button onclick="openModal('${safeTitle}', '${safeDesc}', '${safeVideo}', '${safeSource}')" 
        style="width:100%; background:#45a29e; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:600;">
        ${e.video ? '🎥 Guarda Video & Dettagli' : '📄 Leggi Dettagli'}
      </button>
    </div>
  `;
}

// --- CARICAMENTO DATI ---
async function loadEventsData() {
  try {
    // Prova a caricare prima il GeoJSON pulito
    const res = await fetch('assets/data/events.geojson');
    if (!res.ok) throw new Error('GeoJSON non trovato');
    const data = await res.json();
    
    allEvents = data.features.map(f => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    }));

    updateMap(allEvents);
    updateStats(allEvents);
    initHeatmap(allEvents);
    
    console.log(`✅ Caricati ${allEvents.length} eventi.`);
  } catch (err) {
    console.error("Errore caricamento mappa:", err);
    // Fallback su timeline se geojson fallisce
    try {
        await window.loadTimelineData(); // Funzione di charts.js come fallback
    } catch(e) { console.log("Fallback fallito"); }
  }
}

function updateMap(events) {
  eventsLayer.clearLayers();
  events.forEach(e => {
    const info = getImpactLabel(e.intensity || 0.2);
    const marker = L.marker([e.lat, e.lon], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:${info.color}; width:14px; height:14px; border-radius:50%; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [18, 18]
      })
    });
    marker.bindPopup(createPopupContent(e));
    eventsLayer.addLayer(marker);
  });
}

function initHeatmap(events) {
  if (heatmapLayer) map.removeLayer(heatmapLayer);
  
  const points = events.map(e => [e.lat, e.lon, (e.intensity || 0.2) * 1.5]); // Moltiplicatore per visibilità
  
  heatmapLayer = L.heatLayer(points, {
    radius: 30, blur: 20, maxZoom: 10,
    gradient: { 0.2: 'blue', 0.4: 'lime', 0.6: 'yellow', 0.9: 'red' }
  });
  // Nota: Heatmap attivabile via checkbox HTML
}

// --- EXPORT E UTILS ---
function updateStats(events) {
  document.getElementById('eventCount').innerText = events.length;
  // Calcolo categorie
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  events.forEach(e => {
    const val = e.intensity || 0.2;
    if (val >= 0.8) counts.critical++;
    else if (val >= 0.6) counts.high++;
    else if (val >= 0.4) counts.medium++;
    else counts.low++;
  });
  
  const statsHTML = Object.entries(counts).map(([k, v]) => `
    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:4px 0;">
      <span style="text-transform:capitalize">${k}</span> <strong>${v}</strong>
    </div>
  `).join('');
  document.getElementById('categoryStats').innerHTML = statsHTML;
}

// Global functions per i toggle HTML
window.toggleEventsLayer = (show) => show ? map.addLayer(eventsLayer) : map.removeLayer(eventsLayer);
window.toggleHeatmapLayer = (show) => show ? map.addLayer(heatmapLayer) : map.removeLayer(heatmapLayer);
window.toggleSatelliteLayer = (show) => {
  if(show) { map.addLayer(satelliteLayer); map.removeLayer(osmLayer); } 
  else { map.addLayer(osmLayer); map.removeLayer(satelliteLayer); }
};

// Init
loadEventsData();
