// ============================================
// MAP.JS - MOMENT.JS EDITION
// ============================================

// --- CONFIGURAZIONE & VARIABILI GLOBALI ---
let map;
let eventsLayer; 
let heatLayer = null; 
let isHeatmapMode = false;

// Dati Globali
window.globalEvents = [];         
window.currentFilteredEvents = []; 

const impactColors = { 'critical': '#ef4444', 'high': '#f97316', 'medium': '#eab308', 'low': '#64748b' };
const typeIcons = {
  'drone': 'fa-plane-up', 'missile': 'fa-rocket', 'artillery': 'fa-bomb',
  'energy': 'fa-bolt', 'fire': 'fa-fire', 'naval': 'fa-anchor',
  'cultural': 'fa-landmark', 'eco': 'fa-leaf', 'default': 'fa-crosshairs'
};

// --- INIZIALIZZAZIONE MAPPA ---
let initMap = function() {
    map = L.map('map', {
        zoomControl: false, preferCanvas: true, wheelPxPerZoomLevel: 120
    }).setView([48.5, 32.0], 6);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, attribution: '&copy; CARTO'
    }).addTo(map);
    eventsLayer = L.markerClusterGroup({
        chunkedLoading: true, maxClusterRadius: 45, spiderfyOnMaxZoom: true,
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
};

// --- CARICAMENTO DATI ---
async function loadEventsData() {
  try {
    const res = await fetch('assets/data/events.geojson');
    if(!res.ok) throw new Error("Errore fetch GeoJSON");
    const data = await res.json();
    
    // MAPPING CON MOMENT.JS
    window.globalEvents = data.features.map(f => {
      // Moment.js prova a leggere qualsiasi formato. 
      // Se fallisce, restituisce data odierna per non rompere la mappa.
      let m = moment(f.properties.date);
      if(!m.isValid()) {
           // Prova formati italiani comuni forzando il parsing
           m = moment(f.properties.date, ["DD/MM/YYYY", "DD-MM-YYYY", "DD.MM.YYYY"]);
      }
      
      const ts = m.isValid() ? m.valueOf() : moment().valueOf(); // Fallback a oggi se proprio non va

      return {
          ...f.properties,
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          timestamp: ts
      };
    }).sort((a,b) => a.timestamp - b.timestamp);

    console.log("Totale eventi pronti:", window.globalEvents.length);

    window.currentFilteredEvents = [...window.globalEvents];

    setupTimeSlider(window.globalEvents);
    window.updateMap(window.globalEvents);
    
    if(document.getElementById('eventCount')) {
        document.getElementById('eventCount').innerText = window.globalEvents.length;
        document.getElementById('lastUpdate').innerText = new Date().toLocaleDateString();
    }

    if (typeof window.initCharts === 'function') window.initCharts(window.globalEvents);

  } catch (e) { console.error("Errore sistema:", e); }
}

// --- LOGICA RENDERING ---
window.updateMap = function(events) {
  window.currentFilteredEvents = events;
  resetSliderToMax();
  renderInternal(window.currentFilteredEvents);
};

function renderInternal(eventsToDraw) {
    eventsLayer.clearLayers();
    if(heatLayer) map.removeLayer(heatLayer);

    if(isHeatmapMode) {
        if (typeof L.heatLayer === 'undefined') return;
        const heatPoints = eventsToDraw.map(e => [e.lat, e.lon, (e.intensity || 0.5) * 2]);
        heatLayer = L.heatLayer(heatPoints, {
            radius: 25, blur: 15, maxZoom: 10,
            gradient: {0.4: 'blue', 0.6: '#00ff00', 0.8: 'yellow', 1.0: 'red'}
        }).addTo(map);
    } else {
        const markers = eventsToDraw.map(e => createMarker(e));
        eventsLayer.addLayers(markers);
        map.addLayer(eventsLayer);
    }
    
    if(document.getElementById('eventCount')) document.getElementById('eventCount').innerText = eventsToDraw.length;
}

// --- SLIDER ---
function setupTimeSlider(allData) {
    const slider = document.getElementById('timeSlider');
    const startLabel = document.getElementById('sliderStartDate');
    const display = document.getElementById('sliderCurrentDate');

    if(!allData.length || !slider) return;

    const timestamps = allData.map(d => d.timestamp).filter(t => t > 0);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    slider.min = minTime;
    slider.max = maxTime;
    slider.value = maxTime;
    slider.disabled = false;
    
    startLabel.innerText = moment(minTime).format('DD/MM/YYYY');
    display.innerText = "LIVE";

    slider.addEventListener('input', (e) => {
        const selectedVal = parseInt(e.target.value);
        if (selectedVal >= maxTime) display.innerText = "LIVE";
        else display.innerText = moment(selectedVal).format('DD/MM/YYYY');

        const timeFiltered = window.currentFilteredEvents.filter(ev => ev.timestamp <= selectedVal);
        renderInternal(timeFiltered);
    });
}

function resetSliderToMax() {
    const slider = document.getElementById('timeSlider');
    if(slider && window.currentFilteredEvents.length > 0) {
        slider.value = slider.max; 
        document.getElementById('sliderCurrentDate').innerText = "LIVE";
    }
}

window.toggleVisualMode = function() {
    isHeatmapMode = !isHeatmapMode;
    const btn = document.getElementById('heatmapToggle');
    const slider = document.getElementById('timeSlider');
    if(isHeatmapMode) { btn.classList.add('active'); btn.innerHTML = '<i class="fa-solid fa-circle-nodes"></i> Cluster'; } 
    else { btn.classList.remove('active'); btn.innerHTML = '<i class="fa-solid fa-layer-group"></i> Heatmap'; }
    
    const currentSliderVal = parseInt(slider.value);
    const timeFiltered = window.currentFilteredEvents.filter(ev => ev.timestamp <= currentSliderVal);
    renderInternal(timeFiltered);
};

// --- HELPERS ---
function getColor(val) { const v = val || 0.2; if (v >= 0.8) return impactColors.critical; if (v >= 0.6) return impactColors.high; if (v >= 0.4) return impactColors.medium; return impactColors.low; }
function getIconClass(type) { if (!type) return typeIcons.default; const t = type.toLowerCase(); for (const [key, icon] of Object.entries(typeIcons)) { if (t.includes(key)) return icon; } return typeIcons.default; }

function createMarker(e) {
    const color = getColor(e.intensity);
    const iconClass = getIconClass(e.type);
    const size = (e.intensity || 0.2) >= 0.8 ? 34 : 26;
    const iconSize = Math.floor(size / 1.8);
    const marker = L.marker([e.lat, e.lon], {
      icon: L.divIcon({
        className: 'custom-icon-marker',
        html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid #1e293b; box-shadow: 0 0 10px ${color}66; display: flex; align-items: center; justify-content: center; color: #1e293b;"><i class="fa-solid ${iconClass}" style="font-size:${iconSize}px;"></i></div>`,
        iconSize: [size, size]
      })
    });
    marker.bindPopup(createPopupContent(e));
    return marker;
}

function createPopupContent(e) {
  const eventData = encodeURIComponent(JSON.stringify(e));
  const color = getColor(e.intensity);
  return `<div class="acled-popup" style="color:#334155;"><div style="border-left: 4px solid ${color}; padding-left: 10px; margin-bottom: 8px;"><h5 style="margin:0; font-weight:700; font-size:0.95rem;">${e.title}</h5><small style="color:#64748b;">${e.date} | ${e.type}</small></div><button onclick="openModal('${eventData}')" class="btn-primary" style="padding:6px; font-size:0.8rem; margin-top:5px;"><i class="fa-solid fa-expand"></i> Apri Dossier</button></div>`;
}

// ... Le funzioni openModal, updateSlider, renderConfidenceChart rimangono uguali al codice precedente ...
// (Per brevità non le ricopio, assicurati di averle in fondo al file come prima)
window.openModal = function(eventJson) {
  const e = JSON.parse(decodeURIComponent(eventJson));
  document.getElementById('modalTitle').innerText = e.title;
  document.getElementById('modalDesc').innerText = e.description || "Nessun dettaglio.";
  document.getElementById('modalType').innerText = e.type;
  document.getElementById('modalDate').innerText = e.date;
  const vidCont = document.getElementById('modalVideoContainer');
  vidCont.innerHTML = '';
  if (e.video && e.video !== 'null') {
    if(e.video.includes('youtu')) { const embed = e.video.replace('watch?v=', 'embed/').split('&')[0]; vidCont.innerHTML = `<iframe src="${embed}" frameborder="0" allowfullscreen style="width:100%; height:400px; border-radius:8px;"></iframe>`; } else { vidCont.innerHTML = `<a href="${e.video}" target="_blank" class="btn-primary">Media Esterno</a>`; }
  }
  const sliderCont = document.getElementById('modalJuxtapose');
  sliderCont.innerHTML = '';
  if (e.before_img && e.after_img) { 
     sliderCont.innerHTML = `<h4 style="color:white; margin:20px 0 10px;">Battle Damage Assessment</h4><div class="juxtapose-wrapper" onmousemove="updateSlider(event, this)"><div class="juxtapose-img" style="background-image:url('${e.before_img}')"></div><div class="juxtapose-img after" style="background-image:url('${e.after_img}'); width:50%;"></div><div class="juxtapose-handle" style="left:50%"><div class="juxtapose-button"><i class="fa-solid fa-arrows-left-right"></i></div></div></div>`;
  }
  const conf = e.confidence || 85; renderConfidenceChart(conf);
  document.getElementById('videoModal').style.display = 'flex';
};
window.updateSlider = function(e, wrapper) { const rect = wrapper.getBoundingClientRect(); let pos = ((e.clientX - rect.left) / rect.width) * 100; pos = Math.max(0, Math.min(100, pos)); wrapper.querySelector('.after').style.width = `${pos}%`; wrapper.querySelector('.juxtapose-handle').style.left = `${pos}%`; };
let confChart = null;
function renderConfidenceChart(score) { const ctxEl = document.getElementById('confidenceChart'); if(!ctxEl) return; const ctx = ctxEl.getContext('2d'); if(confChart) confChart.destroy(); confChart = new Chart(ctx, { type: 'doughnut', data: { datasets: [{ data: [score, 100-score], backgroundColor: ['#f59e0b', '#334155'], borderWidth: 0 }] }, options: { responsive: true, cutout: '75%', animation: false, plugins: { tooltip: { enabled: false } } }, plugins: [{ id: 'text', beforeDraw: function(chart) { var width = chart.width, height = chart.height, ctx = chart.ctx; ctx.restore(); var fontSize = (height / 100).toFixed(2); ctx.font = "bold " + fontSize + "em Inter"; ctx.textBaseline = "middle"; ctx.fillStyle = "#f59e0b"; var text = score + "%", textX = Math.round((width - ctx.measureText(text).width) / 2), textY = height / 2; ctx.fillText(text, textX, textY); ctx.save(); } }] }); }

initMap();
loadEventsData();
