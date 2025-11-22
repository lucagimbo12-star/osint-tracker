// ============================================
// MAP.JS - DASHBOARD INTELLIGENCE VERSION
// ============================================

let map = L.map('map', {
  zoomControl: false // Spostiamo lo zoom se necessario o lo lasciamo default
}).setView([49.0, 32.0], 6); // Focus Ucraina

// Posiziona lo zoom in basso a destra per non coprire i controlli custom
L.control.zoom({ position: 'bottomright' }).addTo(map);

// --- LAYER SETUP ---
const osmLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
}); // Uso CARTO Light per un look più pulito e professionale

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// Layer di default
osmLayer.addTo(map);

// Gruppi
let eventsLayer = L.markerClusterGroup({ 
  maxClusterRadius: 40, 
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  iconCreateFunction: function(cluster) {
    // Cluster personalizzato stile ACLED (Blu Navy)
    var childCount = cluster.getChildCount();
    var c = ' marker-cluster-';
    if (childCount < 10) { c += 'small'; }
    else if (childCount < 100) { c += 'medium'; }
    else { c += 'large'; }

    return new L.DivIcon({ 
      html: '<div><span>' + childCount + '</span></div>', 
      className: 'marker-cluster' + c, 
      iconSize: new L.Point(40, 40) 
    });
  }
});

let heatmapLayer = null;
let allEvents = [];

eventsLayer.addTo(map);

// --- CONFIGURAZIONE COLORI (Stile Istituzionale) ---
const impactColors = { 
  'critical': '#b71c1c',  // Rosso Scuro (Deep Red)
  'high': '#f57c00',      // Arancione
  'medium': '#fbc02d',    // Giallo
  'low': '#546e7a'        // Grigio Bluastro
};

// Helper per etichette
function getImpactInfo(val) {
  // Se l'intensità non c'è, default a 0.2
  const v = val || 0.2;
  if (v >= 0.8) return { label: 'CRITICO', color: impactColors.critical };
  if (v >= 0.6) return { label: 'ALTO', color: impactColors.high };
  if (v >= 0.4) return { label: 'MEDIO', color: impactColors.medium };
  return { label: 'BASSO', color: impactColors.low };
}

// --- GESTIONE MODALE VIDEO (Lightbox) ---
window.openModal = function(titleEncoded, descEncoded, videoEncoded, sourceEncoded) {
  // Decodifica i dati sicuri
  const title = decodeURIComponent(titleEncoded);
  const desc = decodeURIComponent(descEncoded);
  const videoUrl = decodeURIComponent(videoEncoded);
  const sourceUrl = decodeURIComponent(sourceEncoded);

  // Popola la modale
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalDesc').textContent = desc || "Nessuna descrizione dettagliata disponibile.";
  
  const sourceBtn = document.getElementById('modalSourceLink');
  if (sourceUrl && sourceUrl !== 'null' && sourceUrl !== '') {
    sourceBtn.href = sourceUrl;
    sourceBtn.style.display = 'inline-flex';
  } else {
    sourceBtn.style.display = 'none';
  }
  
  const container = document.getElementById('modalVideoContainer');
  container.innerHTML = ''; // Reset

  // Logica Embed Video
  if (videoUrl && videoUrl !== 'null' && videoUrl !== '') {
    if (videoUrl.includes('youtube') || videoUrl.includes('youtu.be')) {
      // YouTube Embed
      let embed = videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/');
      // Rimuovi eventuali parametri extra url sporchi
      if(embed.includes('&')) embed = embed.split('&')[0];
      container.innerHTML = `<iframe src="${embed}" frameborder="0" allowfullscreen></iframe>`;
    } else if (videoUrl.match(/\.(mp4|webm|ogg)$/i)) {
      // Video nativo
      container.innerHTML = `<video controls src="${videoUrl}" autoplay muted></video>`;
    } else {
      // Fallback link esterno (Twitter/X, Telegram, etc)
      container.innerHTML = `
        <div style="padding:40px; text-align:center; background:#f8f9fa; border:1px solid #dee2e6; border-radius:8px;">
          <i class="fa-solid fa-video" style="font-size:30px; color:#546e7a; margin-bottom:10px;"></i>
          <p style="color:#333; margin-bottom:15px;">Il video è ospitato su una piattaforma esterna.</p>
          <a href="${videoUrl}" target="_blank" class="btn-acled-primary" style="text-decoration:none; display:inline-block;">
            <i class="fa-solid fa-play"></i> Guarda Video
          </a>
        </div>`;
    }
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }

  document.getElementById('videoModal').style.display = 'flex';
};

window.closeModal = function(e) {
  // Chiudi se clicchi fuori o sulla X
  if (!e || e.target.id === 'videoModal' || e.target.classList.contains('close-modal')) {
    document.getElementById('videoModal').style.display = 'none';
    document.getElementById('modalVideoContainer').innerHTML = ''; // Stoppa video
  }
};

// --- CREAZIONE POPUP ---
function createPopupContent(e) {
  const info = getImpactInfo(e.intensity);
  
  // Encoding per passare stringhe complesse (con virgolette) alle funzioni onclick
  const safeTitle = encodeURIComponent(e.title || 'Evento');
  const safeDesc = encodeURIComponent(e.description || '');
  const safeVideo = encodeURIComponent(e.video || '');
  const safeSource = encodeURIComponent(e.link || '');

  const hasVideo = (e.video && e.video !== 'null' && e.video !== '');

  return `
    <div class="acled-popup">
      <div class="popup-header" style="border-left: 4px solid ${info.color};">
        <h5>${e.title}</h5>
        <span class="popup-meta">${e.date} | <span style="color:${info.color}; font-weight:700;">${info.label}</span></span>
      </div>
      
      <div class="popup-body">
        ${e.description ? e.description.substring(0, 120) + '...' : 'Nessuna descrizione.'}
      </div>

      <div class="popup-footer">
        <button onclick="openModal('${safeTitle}', '${safeDesc}', '${safeVideo}', '${safeSource}')" 
          class="btn-popup-action" style="background:${hasVideo ? '#002060' : '#546e7a'}">
          ${hasVideo ? '<i class="fa-solid fa-film"></i> Guarda Video' : '<i class="fa-solid fa-file-lines"></i> Dettagli'}
        </button>
      </div>
    </div>
  `;
}

// --- CARICAMENTO DATI ---
async function loadEventsData() {
  try {
    console.log('🔄 Caricamento dati mappa...');
    const res = await fetch('assets/data/events.geojson');
    if (!res.ok) throw new Error('File GeoJSON non trovato');
    const data = await res.json();
    
    // Mappatura dati pulita
    allEvents = data.features.map(f => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    }));

    updateMap(allEvents);
    updateKPIs(allEvents);
    initHeatmap(allEvents);
    
    console.log(`✅ Mappa pronta: ${allEvents.length} eventi.`);
  } catch (err) {
    console.error("Errore critico mappa:", err);
    // Fallback opzionale qui
  }
}

function updateMap(events) {
  eventsLayer.clearLayers();
  
  events.forEach(e => {
    const info = getImpactInfo(e.intensity);
    
    // Marker circolare semplice e pulito
    const marker = L.marker([e.lat, e.lon], {
      icon: L.divIcon({
        className: 'custom-dot-marker',
        html: `<div style="
          background-color: ${info.color};
          width: 12px; height: 12px;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    });
    
    marker.bindPopup(createPopupContent(e), { maxWidth: 320 });
    eventsLayer.addLayer(marker);
  });
}

// --- HEATMAP ---
function initHeatmap(events) {
  if (heatmapLayer) map.removeLayer(heatmapLayer);
  
  // Pesiamo la heatmap in base all'intensità
  const points = events.map(e => [e.lat, e.lon, (e.intensity || 0.2) * 2.0]); 
  
  heatmapLayer = L.heatLayer(points, {
    radius: 25,
    blur: 15,
    maxZoom: 10,
    gradient: { 
      0.2: '#90caf9', // Azzurro
      0.4: '#ffeb3b', // Giallo
      0.6: '#f57c00', // Arancio
      0.9: '#b71c1c'  // Rosso sangue
    }
  });
}

// --- KPI & STATISTICHE ---
function updateKPIs(events) {
  // 1. Aggiorna conteggio totale
  document.getElementById('eventCount').innerText = events.length;
  
  // 2. Aggiorna ultima data
  if (events.length > 0) {
    // Trova la data più recente (assumendo formato YYYY-MM-DD o compatibile)
    const dates = events.map(e => new Date(e.date)).filter(d => !isNaN(d));
    if (dates.length > 0) {
      const maxDate = new Date(Math.max.apply(null, dates));
      document.getElementById('lastUpdate').innerText = maxDate.toLocaleDateString('it-IT');
    }
  }

  // 3. Aggiorna mini-tabella categorie (nella KPI bar o sidebar)
  const catEl = document.getElementById('categoryStats');
  if (catEl) {
    const counts = { 'Critici': 0, 'Alti': 0, 'Medi': 0 };
    events.forEach(e => {
      const v = e.intensity || 0.2;
      if (v >= 0.8) counts['Critici']++;
      else if (v >= 0.6) counts['Alti']++;
      else counts['Medi']++;
    });

    // Genera HTML compatto
    catEl.innerHTML = Object.entries(counts).map(([k, v]) => `
      <div style="font-size:0.8rem; color:#555; display:flex; justify-content:space-between;">
        <span>${k}</span> <strong style="color:#002060">${v}</strong>
      </div>
    `).join('');
  }
}

// --- CONTROLLI ESTERNI (Toggle Layer) ---
window.toggleHeatmapLayer = (show) => {
  if(show) { map.addLayer(heatmapLayer); map.removeLayer(eventsLayer); }
  else { map.addLayer(eventsLayer); map.removeLayer(heatmapLayer); }
};

window.toggleSatelliteLayer = (show) => {
  if(show) { map.addLayer(satelliteLayer); map.removeLayer(osmLayer); }
  else { map.addLayer(osmLayer); map.removeLayer(satelliteLayer); }
};

// Avvio
loadEventsData();
