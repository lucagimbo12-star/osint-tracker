// ============================================
// MAP.JS - IMPACT ATLAS (Con Time-Lapse & Heatmap)
// ============================================

// --- CONFIGURAZIONE & VARIABILI GLOBALI ---
let map;
let eventsLayer; // Riferimento al Cluster Group
let heatLayer = null; // Riferimento al livello Heatmap
let isHeatmapMode = false; // Stato attuale visualizzazione

// Gestione Dati
window.globalEvents = [];          // Copia master di tutti i dati
window.currentFilteredEvents = [];  // Sottoinsieme attualmente filtrato (dalla sidebar)

// Colori & Icone (MANTENUTI DAL CODICE ORIGINALE)
const impactColors = {
  'critical': '#ef4444', 'high': '#f97316', 'medium': '#eab308', 'low': '#64748b'
};

const typeIcons = {
  'drone': 'fa-plane-up', 'missile': 'fa-rocket', 'artillery': 'fa-bomb',
  'energy': 'fa-bolt', 'fire': 'fa-fire', 'naval': 'fa-anchor',
  'cultural': 'fa-landmark', 'eco': 'fa-leaf', 'default': 'fa-crosshairs'
};

// --- HELPER: PARSING DATA ROBUSTO (AGGIUNTO PER FIX) ---
function parseDateToTimestamp(dateStr) {
    if (!dateStr) return new Date().getTime();

    // 1. GESTIONE FORMATO ITALIANO (DD/MM/YYYY)
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        // Se abbiamo giorno/mese/anno
        if (parts.length === 3) {
            // Nota: in JS i mesi vanno da 0 (Gennaio) a 11 (Dicembre)
            // parts[2] = anno, parts[1] = mese, parts[0] = giorno
            return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
        }
    }
    
    // 2. GESTIONE FORMATO TRATTINO (DD-MM-YYYY o YYYY-MM-DD)
    if (dateStr.includes('-')) {
        // Se inizia con l'anno (202X-...) è standard ISO
        if (dateStr.trim().startsWith('202')) {
            return new Date(dateStr).getTime();
        } else {
            // Altrimenti presumiamo sia DD-MM-YYYY
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
            }
        }
    }

    // 3. Fallback standard
    return new Date(dateStr).getTime();
}

// 1. INIZIALIZZAZIONE MAPPA
// (Rendering GPU preferito come nel codice originale)
let initMap = function() {
    map = L.map('map', {
        zoomControl: false,
        preferCanvas: true, 
        wheelPxPerZoomLevel: 120
    }).setView([48.5, 32.0], 6);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Mappa Scura
    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, attribution: '&copy; CARTO'
    });
    darkLayer.addTo(map);

    // Configurazione Cluster (MANTENUTA)
    eventsLayer = L.markerClusterGroup({
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
    // Si aggiunge subito alla mappa
    map.addLayer(eventsLayer);
};

// 2. CARICAMENTO DATI UNIFICATO
async function loadEventsData() {
  try {
    const res = await fetch('assets/data/events.geojson');
    if(!res.ok) throw new Error("Errore fetch GeoJSON");
    const data = await res.json();
    
    // Appiattisce le proprietà per facilità d'uso e aggiunge timestamp numerico
    window.globalEvents = data.features.map(f => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      // MODIFICATO: Usa la funzione robusta parseDateToTimestamp
      timestamp: parseDateToTimestamp(f.properties.date)
    })).sort((a,b) => a.timestamp - b.timestamp); // Ordina per data (fondamentale per lo slider)

    // Al caricamento iniziale, i dati filtrati coincidono con i globali
    window.currentFilteredEvents = [...window.globalEvents];

    // Setup iniziale dello Slider
    setupTimeSlider(window.globalEvents);

    // Renderizza Mappa
    window.updateMap(window.globalEvents);
    
    // Aggiorna KPI Testuali (MANTENUTO)
    if(document.getElementById('eventCount')) {
        document.getElementById('eventCount').innerText = window.globalEvents.length;
        document.getElementById('lastUpdate').innerText = new Date().toLocaleDateString();
    }

    // PASSA I DATI AI GRAFICI (MANTENUTO - Chiama charts.js)
    if (typeof window.initCharts === 'function') {
        window.initCharts(window.globalEvents);
    } else {
        console.warn("Charts.js non caricato o funzione initCharts mancante");
    }

  } catch (e) { console.error("Errore caricamento dati:", e); }
}

// 3. LOGICA RENDERING MAPPA (AGGIORNATA PER NUOVE FUNZIONALITÀ)
// Questa funzione viene chiamata sia all'avvio, sia dai filtri della Sidebar (charts.js)
window.updateMap = function(events) {
  // Aggiorna il set di dati corrente su cui lavorerà lo slider
  window.currentFilteredEvents = events;
  
  // Resetta lo slider alla posizione "LIVE" (fine) quando cambiano i filtri
  resetSliderToMax();

  // Esegue il rendering effettivo
  renderInternal(events);
};

// Funzione interna che decide se disegnare Cluster o Heatmap
function renderInternal(eventsToDraw) {
    // 1. Pulisce tutto
    eventsLayer.clearLayers();
    if(heatLayer) map.removeLayer(heatLayer);

    if(isHeatmapMode) {
        // --- RENDERING HEATMAP ---
        // Verifica di sicurezza per Heatmap
        if (typeof L.heatLayer === 'undefined') return;

        const heatPoints = eventsToDraw.map(e => [
            e.lat, 
            e.lon, 
            (e.intensity || 0.5) * 2 // Moltiplicatore intensità visiva
        ]);
        
        heatLayer = L.heatLayer(heatPoints, {
            radius: 25,
            blur: 15,
            maxZoom: 10,
            gradient: {0.4: 'blue', 0.6: '#00ff00', 0.8: 'yellow', 1.0: 'red'}
        }).addTo(map);

    } else {
        // --- RENDERING CLUSTER (MANTENUTO LOGICA ORIGINALE) ---
        const markers = [];
        eventsToDraw.forEach(e => {
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
        map.addLayer(eventsLayer); // Assicura che il layer sia visibile
    }
    
    // Aggiorna contatore KPI in tempo reale in base a cosa è mostrato sulla mappa
    if(document.getElementById('eventCount')) {
        document.getElementById('eventCount').innerText = eventsToDraw.length;
    }
}

// 4. FUNZIONI NUOVE: SLIDER & TOGGLE
function setupTimeSlider(allData) {
    const slider = document.getElementById('timeSlider');
    const startLabel = document.getElementById('sliderStartDate');
    const display = document.getElementById('sliderCurrentDate');

    if(!allData.length || !slider) return;

    // Trova range date filtrando i NaN
    const timestamps = allData.map(d => d.timestamp).filter(t => !isNaN(t) && t > 0);
    
    if (timestamps.length === 0) return;

    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    slider.min = minTime;
    slider.max = maxTime;
    slider.value = maxTime;
    slider.step = 86400000; // Step di 1 giorno
    slider.disabled = false;
    
    startLabel.innerText = new Date(minTime).toLocaleDateString();

    // Listener Slider
    slider.addEventListener('input', (e) => {
        const selectedVal = parseInt(e.target.value);
        
        // Aggiorna Display Data
        const d = new Date(selectedVal);
        display.innerText = d.toLocaleDateString();

        // Filtra sui dati correntemente attivi (window.currentFilteredEvents)
        // Logica: Mostra tutto ciò che è accaduto PRIMA o DURANTE la data slider
        const timeFiltered = window.currentFilteredEvents.filter(ev => ev.timestamp <= selectedVal);
        
        // Ridisegna senza resettare lo slider
        renderInternal(timeFiltered);
    });
}

function resetSliderToMax() {
    const slider = document.getElementById('timeSlider');
    if(slider && window.currentFilteredEvents.length > 0) {
        // Trova il max timestamp tra gli eventi filtrati
        const timestamps = window.currentFilteredEvents.map(e => e.timestamp).filter(t => !isNaN(t));
        if (timestamps.length > 0) {
             const maxT = Math.max(...timestamps);
             slider.value = slider.max; 
             document.getElementById('sliderCurrentDate').innerText = "LIVE";
        }
    }
}

window.toggleVisualMode = function() {
    isHeatmapMode = !isHeatmapMode;
    const btn = document.getElementById('heatmapToggle');
    const slider = document.getElementById('timeSlider');

    // UI Update
    if(isHeatmapMode) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-circle-nodes"></i> Cluster';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-solid fa-layer-group"></i> Heatmap';
    }

    // Ricalcola cosa mostrare basandosi sullo slider attuale
    const currentSliderVal = parseInt(slider.value);
    const timeFiltered = window.currentFilteredEvents.filter(ev => ev.timestamp <= currentSliderVal);
    renderInternal(timeFiltered);
};

// 5. HELPER COLORS & ICONS (MANTENUTI)
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

// 6. POPUP & MODALE (MANTENUTI ESATTAMENTE UGUALI)
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

// START
initMap();
loadEventsData();
