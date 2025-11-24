// ============================================
// MAP.JS - SLATE & AMBER EDITION (Con Features Avanzate)
// ============================================

let map = L.map('map', {
  zoomControl: false,
  preferCanvas: true,
  wheelPxPerZoomLevel: 120
}).setView([48.5, 32.0], 6);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Mappa Scura (CartoDB Dark Matter) per il tema Slate
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  attribution: '&copy; CARTO'
});
darkLayer.addTo(map);

let eventsLayer = L.markerClusterGroup({
  chunkedLoading: true,
  chunkInterval: 200,
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

// --- CONFIGURAZIONE COLORI (Slate & Amber) ---
const impactColors = {
  'critical': '#ef4444',  // Rosso
  'high':     '#f97316',  // Arancio
  'medium':   '#eab308',  // Giallo
  'low':      '#64748b'   // Slate
};

const typeIcons = {
  'drone': 'fa-plane-up', 'missile': 'fa-rocket', 'artillery': 'fa-bomb',
  'energy': 'fa-bolt', 'fire': 'fa-fire', 'naval': 'fa-anchor',
  'cultural': 'fa-landmark', 'eco': 'fa-leaf', // NUOVE CATEGORIE
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

// --- CARICAMENTO ---
async function loadEventsData() {
  try {
    const res = await fetch('assets/data/events.geojson');
    const data = await res.json();
    
    const events = data.features.map(f => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    }));

    updateMap(events);
    // initHeatmap(events); // Heatmap opzionale
    document.getElementById('eventCount').innerText = events.length;
  } catch (e) { console.error(e); }
}

function updateMap(events) {
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

    // Passiamo dati extra (confidence, images) alla funzione popup
    marker.bindPopup(createPopupContent(e));
    markers.push(marker);
  });
  eventsLayer.addLayers(markers);
}

// --- POPUP & MODALE AVANZATA ---
function createPopupContent(e) {
  const safeTitle = encodeURIComponent(e.title);
  const safeDesc = encodeURIComponent(e.description || '');
  // Passiamo tutto l'oggetto evento codificato per gestire dati complessi come immagini e score
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

// Funzione globale per aprire la modale ricca
window.openModal = function(eventJson) {
  const e = JSON.parse(decodeURIComponent(eventJson));
  
  // 1. Popola Testi
  document.getElementById('modalTitle').innerText = e.title;
  document.getElementById('modalDesc').innerText = e.description || "Nessun dettaglio disponibile.";
  document.getElementById('modalType').innerText = e.type;
  document.getElementById('modalDate').innerText = e.date;
  
  // 2. Gestione Video/Media
  const vidCont = document.getElementById('modalVideoContainer');
  vidCont.innerHTML = '';
  if (e.video && e.video !== 'null') {
    if(e.video.includes('youtu')) {
       const embed = e.video.replace('watch?v=', 'embed/').split('&')[0];
       vidCont.innerHTML = `<iframe src="${embed}" frameborder="0" allowfullscreen style="width:100%; height:400px; border-radius:8px;"></iframe>`;
    } else {
       vidCont.innerHTML = `<a href="${e.video}" target="_blank" class="btn-primary">Apri Media Esterno</a>`;
    }
  }

  // 3. FEATURE: Juxtapose Slider (Time Travel)
  // Se l'evento ha before_image e after_image (che dovrai aggiungere al CSV in futuro)
  const sliderCont = document.getElementById('modalJuxtapose');
  sliderCont.innerHTML = ''; // Reset
  
  // SIMULAZIONE PER DEMO (Rimuovi 'true ||' quando avrai i dati veri)
  if (true || (e.before_img && e.after_img)) { 
     // Usa immagini placeholder se mancano quelle reali, per mostrare la feature
     const imgBefore = e.before_img || 'https://placehold.co/800x400/334155/ffffff?text=Immagine+Pre-Attacco';
     const imgAfter = e.after_img || 'https://placehold.co/800x400/b45309/ffffff?text=Immagine+Post-Attacco';
     
     sliderCont.innerHTML = `
       <h4 style="color:white; margin:20px 0 10px;">Battle Damage Assessment (BDA)</h4>
       <div class="juxtapose-wrapper" onmousemove="updateSlider(event, this)">
         <div class="juxtapose-img" style="background-image:url('${imgBefore}')"></div>
         <div class="juxtapose-img after" style="background-image:url('${imgAfter}'); width:50%;"></div>
         <div class="juxtapose-handle" style="left:50%"><div class="juxtapose-button"><i class="fa-solid fa-arrows-left-right"></i></div></div>
       </div>
     `;
  }

  // 4. FEATURE: Confidence Score Chart
  const conf = e.confidence || 85; // Default simulato se manca
  renderConfidenceChart(conf);

  document.getElementById('videoModal').style.display = 'flex';
};

// Logica Slider JS (Inline per semplicità)
window.updateSlider = function(e, wrapper) {
  const rect = wrapper.getBoundingClientRect();
  let pos = ((e.clientX - rect.left) / rect.width) * 100;
  pos = Math.max(0, Math.min(100, pos));
  wrapper.querySelector('.after').style.width = `${pos}%`;
  wrapper.querySelector('.juxtapose-handle').style.left = `${pos}%`;
};

// Logica Chart JS
let confChart = null;
function renderConfidenceChart(score) {
  const ctx = document.getElementById('confidenceChart').getContext('2d');
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
