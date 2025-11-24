// ============================================
// MAP.JS - SLATE & AMBER EDITION (High Performance)
// ============================================

// 1. Inizializzazione Mappa con Rendering GPU (preferCanvas)
let map = L.map('map', {
  zoomControl: false,
  preferCanvas: true, // <--- Performance Critical
  wheelPxPerZoomLevel: 120
}).setView([48.5, 32.0], 6);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Mappa Scura (CartoDB Dark Matter)
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  attribution: '&copy; CARTO'
});
darkLayer.addTo(map);

// 2. Configurazione Cluster con "Chunked Loading" (Anti-Lag)
let eventsLayer = L.markerClusterGroup({
  chunkedLoading: true, // <--- Fondamentale per evitare il blocco del browser
  chunkInterval: 200,   // Processa per 200ms
  chunkDelay: 50,       // Riposa per 50ms
  maxClusterRadius: 45,
  spiderfyOnMaxZoom: true,
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

// --- CONFIGURAZIONE COLORI ---
const impactColors = {
  'critical': '#ef4444',  // Rosso
  'high':     '#f97316',  // Arancio
  'medium':   '#eab308',  // Giallo
  'low':      '#64748b'   // Slate
};

const typeIcons = {
  'drone': 'fa-plane-up', 'missile': 'fa-rocket', 'artillery': 'fa-bomb',
  'energy': 'fa-bolt', 'fire': 'fa-fire', 'naval': 'fa-anchor',
  'cultural': 'fa-landmark', 'eco': 'fa-leaf',
  'default': 'fa-crosshairs'
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
  for (const [key, icon] of Object.entries(typeIcons)) {
    if (t.includes(key)) return icon;
  }
  return typeIcons.default;
}

// --- CARICAMENTO DATI ---
async function loadEventsData() {
  try {
    // Assicurati che questo path sia corretto nella tua repo
    const res = await fetch('assets/data/events.geojson');
    const data = await res.json();
    
    const events = data.features.map(f => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    }));

    updateMap(events);
    if(document.getElementById('eventCount')) {
        document.getElementById('eventCount').innerText = events.length;
    }
  } catch (e) { console.error("Errore caricamento dati:", e); }
}

function updateMap(events) {
  eventsLayer.clearLayers();
  const markers = [];

  events.forEach(e => {
    const color = getColor(e.intensity);
    const iconClass = getIconClass(e.type);
    const size = (e.intensity || 0.2) >= 0.8 ? 34 : 26;
    const iconSize = Math.floor(size / 1.8);

    // Creazione Marker Ottimizzata
    const marker = L.marker([e.lat, e.lon], {
      icon: L.divIcon({
        className: 'custom-icon-marker',
        html: `<div style="
          background-color: ${color};
          width: ${size}px; height: ${size}px;
          border-radius: 50%;
          border: 2px solid #1e293b;
          box-shadow: 0 0 10px ${color}66;
          display: flex; align-items: center; justify-content: center;
          color: #1e293b;
        "><i class="fa-solid ${iconClass}" style="font-size:${iconSize}px;"></i></div>`,
        iconSize: [size, size]
      })
    });

    marker.bindPopup(createPopupContent(e));
    markers.push(marker);
  });
  
  // Aggiungi tutti i marker in una volta al cluster (Chunked Loading gestirà il resto)
  eventsLayer.addLayers(markers);
}

// --- POPUP & MODALE ---
function createPopupContent(e) {
  // Encoding sicuro per passare l'oggetto JSON nell'HTML
  const eventData = encodeURIComponent(JSON.stringify(e));
  const color = getColor(e.intensity);

  return `
    <div class="acled-popup" style="color:#334155;">
      <div style="border-left: 4px solid ${color}; padding-left: 10px; margin-bottom: 8px;">
        <h5 style="margin:0; font-weight:700; font-size:0.95rem;">${e.title}</h5>
        <small style="color:#64748b;">${e.date} | ${e.type}</small>
      </div>
      <button onclick="openModal('${eventData}')" 
        class="btn-primary" style="padding:6px; font-size:0.8rem; margin-top:5px;">
        <i class="fa-solid fa-expand"></i> Apri Dossier
      </button>
    </div>
  `;
}

// Funzione Globale Modale
window.openModal = function(eventJson) {
  const e = JSON.parse(decodeURIComponent(eventJson));
  
  // Testi
  document.getElementById('modalTitle').innerText = e.title;
  document.getElementById('modalDesc').innerText = e.description || "Nessun dettaglio disponibile.";
  document.getElementById('modalType').innerText = e.type;
  document.getElementById('modalDate').innerText = e.date;
  
  // Video
  const vidCont = document.getElementById('modalVideoContainer');
  vidCont.innerHTML = '';
  if (e.video && e.video !== 'null') {
    if(e.video.includes('youtu')) {
       const embed = e.video.replace('watch?v=', 'embed/').split('&')[0];
       vidCont.innerHTML = `<iframe src="${embed}" frameborder="0" allowfullscreen style="width:100%; height:400px; border-radius:8px;"></iframe>`;
    } else {
       vidCont.innerHTML = `<a href="${e.video}" target="_blank" class="btn-primary">Apri Media Esterno</a>`;
    }
  } else {
    vidCont.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">Nessun media disponibile</div>';
  }

  // Juxtapose Slider (Before/After)
  const sliderCont = document.getElementById('modalJuxtapose');
  sliderCont.innerHTML = '';
  
  // Logica: Mostra slider solo se ci sono immagini before/after vere
  // (Ho rimosso il "true ||" per uso reale, riabilitalo se vuoi testare con placeholder)
  if (e.before_img && e.after_img) { 
     sliderCont.innerHTML = `
       <h4 style="color:white; margin:20px 0 10px;">Battle Damage Assessment (BDA)</h4>
       <div class="juxtapose-wrapper" onmousemove="updateSlider(event, this)">
         <div class="juxtapose-img" style="background-image:url('${e.before_img}')"></div>
         <div class="juxtapose-img after" style="background-image:url('${e.after_img}'); width:50%;"></div>
         <div class="juxtapose-handle" style="left:50%"><div class="juxtapose-button"><i class="fa-solid fa-arrows-left-right"></i></div></div>
       </div>
     `;
  }

  // Chart JS (Reliability Score)
  const conf = e.confidence || 85; 
  renderConfidenceChart(conf);

  document.getElementById('videoModal').style.display = 'flex';
};

// Helper Slider
window.updateSlider = function(e, wrapper) {
  const rect = wrapper.getBoundingClientRect();
  let pos = ((e.clientX - rect.left) / rect.width) * 100;
  pos = Math.max(0, Math.min(100, pos));
  wrapper.querySelector('.after').style.width = `${pos}%`;
  wrapper.querySelector('.juxtapose-handle').style.left = `${pos}%`;
};

// Helper Chart JS
let confChart = null;
function renderConfidenceChart(score) {
  // Controllo sicurezza se elemento esiste
  const ctxEl = document.getElementById('confidenceChart');
  if(!ctxEl) return;

  const ctx = ctxEl.getContext('2d');
  if(confChart) confChart.destroy();
  
  confChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Affidabilità', 'Incertezza'],
      datasets: [{
        data: [score, 100-score],
        backgroundColor: ['#f59e0b', '#334155'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, cutout: '75%',
      animation: false, // Disabilita animazione per performance modale
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    },
    plugins: [{
      id: 'text',
      beforeDraw: function(chart) {
        var width = chart.width, height = chart.height, ctx = chart.ctx;
        ctx.restore();
        var fontSize = (height / 100).toFixed(2);
        ctx.font = "bold " + fontSize + "em Inter";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#f59e0b";
        var text = score + "%", textX = Math.round((width - ctx.measureText(text).width) / 2), textY = height / 2;
        ctx.fillText(text, textX, textY);
        ctx.save();
      }
    }]
  });
}

// Init
loadEventsData();
