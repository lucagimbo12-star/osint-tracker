// ============================================
// MAP.JS - SLATE & AMBER EDITION (Orchestrator)
// ============================================

// 1. Inizializzazione Mappa con Rendering GPU
let map = L.map('map', {
  zoomControl: false,
  preferCanvas: true, // Performance Critical
  wheelPxPerZoomLevel: 120
}).setView([48.5, 32.0], 6);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Mappa Scura
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19, attribution: '&copy; CARTO'
});
darkLayer.addTo(map);

// 2. Cluster "Chunked"
let eventsLayer = L.markerClusterGroup({
  chunkedLoading: true,
  chunkInterval: 200,
  chunkDelay: 50,
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

// --- CONFIG COLORI ---
const impactColors = {
  'critical': '#ef4444', 'high': '#f97316', 'medium': '#eab308', 'low': '#64748b'
};

const typeIcons = {
  'drone': 'fa-plane-up', 'missile': 'fa-rocket', 'artillery': 'fa-bomb',
  'energy': 'fa-bolt', 'fire': 'fa-fire', 'naval': 'fa-anchor',
  'cultural': 'fa-landmark', 'eco': 'fa-leaf', 'default': 'fa-crosshairs'
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

// --- CORE: CARICAMENTO DATI UNIFICATO ---
async function loadEventsData() {
  try {
    // Scarica i dati UNA sola volta per tutta l'app
    const res = await fetch('assets/data/events.geojson');
    if(!res.ok) throw new Error("Errore fetch GeoJSON");
    const data = await res.json();
    
    // Appiattisce le proprietà per facilità d'uso
    const events = data.features.map(f => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    }));

    // 1. Aggiorna Mappa
    window.updateMap(events);
    
    // 2. Aggiorna KPI Testuali
    if(document.getElementById('eventCount')) {
        document.getElementById('eventCount').innerText = events.length;
        document.getElementById('lastUpdate').innerText = new Date().toLocaleDateString();
    }

    // 3. PASSA I DATI AI GRAFICI (Invece di farli scaricare di nuovo)
    if (typeof window.initCharts === 'function') {
        window.initCharts(events);
    } else {
        console.warn("Charts.js non caricato o funzione initCharts mancante");
    }

  } catch (e) { console.error("Errore caricamento dati:", e); }
}

// Esposta globalmente per essere chiamata dai filtri di charts.js
window.updateMap = function(events) {
  eventsLayer.clearLayers();
  const markers = [];

  events.forEach(e => {
    const color = getColor(e.intensity);
    const iconClass = getIconClass(e.type);
    const size = (e.intensity || 0.2) >= 0.8 ? 34 : 26;
    const iconSize = Math.floor(size / 1.8);

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
  
  eventsLayer.addLayers(markers);
};

// --- POPUP & MODALE ---
function createPopupContent(e) {
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

// Logica Modale (Invariata ma necessaria)
window.openModal = function(eventJson) {
  const e = JSON.parse(decodeURIComponent(eventJson));
  
  document.getElementById('modalTitle').innerText = e.title;
  document.getElementById('modalDesc').innerText = e.description || "Nessun dettaglio.";
  document.getElementById('modalType').innerText = e.type;
  document.getElementById('modalDate').innerText = e.date;
  
  const vidCont = document.getElementById('modalVideoContainer');
  vidCont.innerHTML = '';
  if (e.video && e.video !== 'null') {
    if(e.video.includes('youtu')) {
       const embed = e.video.replace('watch?v=', 'embed/').split('&')[0];
       vidCont.innerHTML = `<iframe src="${embed}" frameborder="0" allowfullscreen style="width:100%; height:400px; border-radius:8px;"></iframe>`;
    } else {
       vidCont.innerHTML = `<a href="${e.video}" target="_blank" class="btn-primary">Media Esterno</a>`;
    }
  }

  // Juxtapose
  const sliderCont = document.getElementById('modalJuxtapose');
  sliderCont.innerHTML = '';
  if (e.before_img && e.after_img) { 
     sliderCont.innerHTML = `
       <h4 style="color:white; margin:20px 0 10px;">Battle Damage Assessment</h4>
       <div class="juxtapose-wrapper" onmousemove="updateSlider(event, this)">
         <div class="juxtapose-img" style="background-image:url('${e.before_img}')"></div>
         <div class="juxtapose-img after" style="background-image:url('${e.after_img}'); width:50%;"></div>
         <div class="juxtapose-handle" style="left:50%"><div class="juxtapose-button"><i class="fa-solid fa-arrows-left-right"></i></div></div>
       </div>
     `;
  }

  // Chart
  const conf = e.confidence || 85; 
  renderConfidenceChart(conf);

  document.getElementById('videoModal').style.display = 'flex';
};

window.updateSlider = function(e, wrapper) {
  const rect = wrapper.getBoundingClientRect();
  let pos = ((e.clientX - rect.left) / rect.width) * 100;
  pos = Math.max(0, Math.min(100, pos));
  wrapper.querySelector('.after').style.width = `${pos}%`;
  wrapper.querySelector('.juxtapose-handle').style.left = `${pos}%`;
};

let confChart = null;
function renderConfidenceChart(score) {
  const ctxEl = document.getElementById('confidenceChart');
  if(!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  if(confChart) confChart.destroy();
  
  confChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [score, 100-score],
        backgroundColor: ['#f59e0b', '#334155'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, cutout: '75%', animation: false,
      plugins: { tooltip: { enabled: false } }
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

// Start
loadEventsData();
