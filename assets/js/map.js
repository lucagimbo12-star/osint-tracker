// ============================================
// MAP.JS - VERSIONE AVANZATA CON LAYER MULTIPLI
// ============================================

// Inizializza mappa
let map = L.map('map').setView([54.5, 37.6], 5);

// ============================================
// SISTEMA DI LAYER MULTIPLI
// ============================================

// Layer base tiles
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 18,
  attribution: '&copy; Esri'
});

// Aggiungi layer OSM di default
osmLayer.addTo(map);

// Layer overlay
let eventsLayer = L.markerClusterGroup({ 
  maxClusterRadius: 50,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false
});

let heatmapLayer = NaN;
let bordersLayer = L.layerGroup();

// Aggiungi layer eventi di default
eventsLayer.addTo(map);

// Variabili globali per controllo layer
window.mapLayers = {
  events: eventsLayer,
  heatmap: heatmapLayer,
  borders: bordersLayer,
  osm: osmLayer,
  satellite: satelliteLayer
};

// Funzioni globali per controllo layer
window.toggleEventsLayer = function(show) {
  if (show) {
    if (!map.hasLayer(eventsLayer)) {
      map.addLayer(eventsLayer);
    }
  } else {
    if (map.hasLayer(eventsLayer)) {
      map.removeLayer(eventsLayer);
    }
  }
};

window.toggleHeatmapLayer = function(show) {
  if (heatmapLayer) {
    if (show) {
      if (!map.hasLayer(heatmapLayer)) {
        map.addLayer(heatmapLayer);
      }
    } else {
      if (map.hasLayer(heatmapLayer)) {
        map.removeLayer(heatmapLayer);
      }
    }
  }
};

window.toggleBordersLayer = function(show) {
  if (show) {
    if (!map.hasLayer(bordersLayer)) {
      map.addLayer(bordersLayer);
    }
  } else {
    if (map.hasLayer(bordersLayer)) {
      map.removeLayer(bordersLayer);
    }
  }
};

window.toggleSatelliteLayer = function(show) {
  if (show) {
    if (map.hasLayer(osmLayer)) {
      map.removeLayer(osmLayer);
    }
    if (!map.hasLayer(satelliteLayer)) {
      map.addLayer(satelliteLayer);
    }
  } else {
    if (map.hasLayer(satelliteLayer)) {
      map.removeLayer(satelliteLayer);
    }
    if (!map.hasLayer(osmLayer)) {
      map.addLayer(osmLayer);
    }
  }
};

// Aggiungi legenda come Leaflet Control
L.Control.Legend = L.Control.extend({
  onAdd: function(map) {
    const div = L.DomUtil.create('div', 'legend-control');
    div.innerHTML = `
      <div style="background: white; padding: 15px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
        <h4 style="margin: 0 0 10px 0; font-size: 0.9rem; color: #0b0c10; font-weight: 600;">Legenda Impatto</h4>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 0.85rem; color: #495057;">
          <span style="width: 16px; height: 16px; background: #dc3545; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>
          Critico
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 0.85rem; color: #495057;">
          <span style="width: 14px; height: 14px; background: #fd7e14; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>
          Alto
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 0.85rem; color: #495057;">
          <span style="width: 12px; height: 12px; background: #ffc107; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>
          Medio
        </div>
        <div style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; color: #495057;">
          <span style="width: 12px; height: 12px; background: #6c757d; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>
          Basso
        </div>
      </div>
    `;
    return div;
  },
  onRemove: function(map) {}
});

L.control.legend = function(opts) {
  return new L.Control.Legend(opts);
}

L.control.legend({ position: 'bottomright' }).addTo(map);

// Layer groups per categorie (compatibilità)
let layerGroups = {
  'ukraine-strike-energy': eventsLayer,
  'verified': L.markerClusterGroup({ maxClusterRadius: 50 }),
  'not-verified': L.markerClusterGroup({ maxClusterRadius: 50 })
};

// Variabili globali
let allEvents = [];
let geoData;
let currentFilter = {};

// Colori per impatto
const impactColors = {
  'critical': '#dc3545',
  'high': '#fd7e14', 
  'medium': '#ffc107',
  'low': '#6c757d'
};

// Mappa intensità per heatmap
const intensityMap = {
  'critical': 1.0,
  'high': 0.7,
  'medium': 0.4,
  'low': 0.2
};

// Determina impatto in base a headline e verifica
function determineImpact(headline, verifica, tipo) {
  const h = headline.toLowerCase();
  
  // CRITICAL - Target strategici TOP
  if (h.includes('novorossiysk') || h.includes('tuapse') || 
      h.includes('volgograd') && verifica === 'verified' ||
      h.includes('lukoil') && h.includes('kstovo') ||
      tipo === 'Neptune missiles') {
    return 'critical';
  }
  
  // HIGH - Raffinerie grandi o attacchi ripetuti
  if (h.includes('novokuibyshevsk') || h.includes('rjazan') || h.includes('ryazan') ||
      h.includes('kirishi') || h.includes('kiriši') ||
      h.includes('bashneft') || h.includes('ufa') ||
      h.includes('orenburg') && verifica === 'verified' ||
      h.includes('saratov') || h.includes('syzran') ||
      h.includes('afipsky') && verifica === 'verified' ||
      h.includes('kuibyshev')) {
    return 'high';
  }
  
  // MEDIUM - Verificati standard
  if (verifica === 'verified') {
    return 'medium';
  }
  
  // LOW - Non verificati
  return 'low';
}

// Icone personalizzate
function getMarkerIcon(impactLevel, verifica) {
  const color = impactColors[impactLevel] || '#45a29e';
  const size = impactLevel === 'critical' ? 16 : impactLevel === 'high' ? 14 : 12;
  
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color}; 
      width: ${size}px; 
      height: ${size}px; 
      border-radius: 50%; 
      border: 2px solid white; 
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      ${impactLevel === 'critical' ? 'animation: pulse 2s infinite;' : ''}
    "></div>`,
    iconSize: [size + 4, size + 4]
  });
}

// ============================================
// CARICAMENTO ASINCRONO DATI DA EVENTS.GEOJSON
// ============================================

async function loadEventsData() {
  try {
    console.log('Caricamento events.geojson...');
    
    const response = await fetch('assets/data/events.geojson');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const geojsonData = await response.json();
    console.log('GeoJSON caricato:', geojsonData.features.length, 'eventi');
    
    // Converti GeoJSON in formato compatibile
    allEvents = geojsonData.features.map((feature, idx) => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;
      
      // Determina impatto
      const impactLevel = determineImpact(
        props.title || '', 
        props.verification || 'not verified',
        props.type || 'Drones'
      );
      
      // Calcola intensity per heatmap (usa campo intensity se presente, altrimenti calcola)
      const intensity = props.intensity || intensityMap[impactLevel] || 0.2;
      
      return {
        id: `GEO-2025-${String(idx + 1).padStart(3, '0')}`,
        date: props.date || 'N/A',
        actor: 'Ukraine',
        target_actor: 'Russia',
        category: 'ukraine-strike-energy',
        type: props.type || 'Drones',
        location: {
          lat: coords[1],
          lon: coords[0]
        },
        location_text: props.title || 'Evento',
        target_detail: props.location || '',
        impact: {
          damage_level: impactLevel,
          intensity: intensity
        },
        sources: props.source && props.source !== 'NaN' ? [{
          url: props.source,
          outlet: 'Fonte'
        }] : [],
        reliability: props.verification || 'not verified',
        context: props.title || 'Evento',
        description: props.notes && props.notes !== 'NaN' ? props.notes : ''
      };
    });
    
    console.log('Eventi convertiti:', allEvents.length);
    
    // Prova a caricare anche timeline (fallback/integrazione)
    try {
      await loadTimelineData();
    } catch (e) {
      console.log('Timeline non disponibile, continuo solo con GeoJSON');
    }
    
    displayEvents(allEvents);
    updateStatistics(allEvents);
    populateFilters(allEvents);
    createHeatmap(allEvents);
    
  } catch (error) {
    console.error('Errore caricamento events.geojson:', error);
    
    // Fallback: prova a caricare timeline
    try {
      console.log('Tentativo fallback con events_timeline.json...');
      await loadTimelineData();
    } catch (fallbackError) {
      console.error('Errore anche nel fallback:', fallbackError);
      alert('Errore nel caricamento dei dati. Verifica che i file events.geojson o events_timeline.json siano disponibili.');
    }
  }
}

// Carica dati timeline (fallback o integrazione)
async function loadTimelineData() {
  const response = await fetch('assets/data/events_timeline.json');
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('Timeline caricata:', data.events.length, 'eventi');
  
  // Converti in formato compatibile
  const timelineEvents = data.events.map((event, idx) => {
    const text = event.text.text || '';
    const headline = event.text.headline || 'Evento';
    
    // Estrai info
    const tipoMatch = text.match(/Tipo:\s*(.+?)(?:<br>|$)/i);
    const tipo = tipoMatch ? tipoMatch[1].trim() : 'Drones';
    
    const luogoMatch = text.match(/Luogo:\s*(.+?)(?:<br>|$)/i);
    const luogo = luogoMatch ? luogoMatch[1].trim() : '';
    
    const fonteMatch = text.match(/href='([^']+)'/);
    const fonte = fonteMatch ? fonteMatch[1] : NaN;
    
    const outletMatch = text.match(/target='_blank'>([^<]+)<\/a>/);
    const outlet = outletMatch ? outletMatch[1].trim() : NaN;
    
    const verificaMatch = text.match(/Verifica:\s*(.+?)$/i);
    const verifica = verificaMatch ? verificaMatch[1].trim() : 'not verified';
    
    // Determina impatto
    const impactLevel = determineImpact(headline, verifica, tipo);
    const intensity = intensityMap[impactLevel] || 0.2;
    
    // Data
    const date = `${event.start_date.year}-${String(event.start_date.month).padStart(2, '0')}-${String(event.start_date.day).padStart(2, '0')}`;
    
    return {
      id: `TL-2025-${String(idx + 1).padStart(3, '0')}`,
      date: date,
      actor: 'Ukraine',
      target_actor: 'Russia',
      category: 'ukraine-strike-energy',
      type: tipo,
      location: {
        lat: event.location.lat,
        lon: event.location.lon
      },
      location_text: headline,
      target_detail: luogo,
      impact: {
        damage_level: impactLevel,
        intensity: intensity
      },
      sources: fonte ? [{
        url: fonte,
        outlet: outlet || 'Fonte'
      }] : [],
      reliability: verifica,
      context: headline,
      description: ''
    };
  });
  
  // Merge con eventi esistenti (evita duplicati)
  if (allEvents.length === 0) {
    allEvents = timelineEvents;
    displayEvents(allEvents);
    updateStatistics(allEvents);
    populateFilters(allEvents);
    createHeatmap(allEvents);
  }
}

// ============================================
// CREAZIONE HEATMAP
// ============================================

function createHeatmap(events) {
  // Rimuovi heatmap esistente se presente
  if (heatmapLayer && map.hasLayer(heatmapLayer)) {
    map.removeLayer(heatmapLayer);
  }
  
  // Prepara dati per heatmap
  const heatData = events.map(event => {
    return [
      event.location.lat,
      event.location.lon,
      event.impact.intensity || 0.5
    ];
  });
  
  // Crea heatmap layer
  heatmapLayer = L.heatLayer(heatData, {
    radius: 25,
    blur: 15,
    maxZoom: 10,
    max: 1.0,
    gradient: {
      0.0: '#6c757d',
      0.3: '#ffc107',
      0.6: '#fd7e14',
      1.0: '#dc3545'
    }
  });
  
  // Aggiorna riferimento globale
  window.mapLayers.heatmap = heatmapLayer;
  
  console.log('Heatmap creata con', heatData.length, 'punti');
}

// ============================================
// POPUP AVANZATI
// ============================================

function createPopupContent(event) {
  const impactColor = impactColors[event.impact.damage_level] || '#6c757d';
  const impactLabel = {
    'critical': 'CRITICO',
    'high': 'ALTO',
    'medium': 'MEDIO',
    'low': 'BASSO'
  }[event.impact.damage_level] || 'N/A';
  
  return `
    <div style="min-width: 300px; max-width: 380px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Header con titolo -->
      <div style="background: linear-gradient(135deg, ${impactColor}30 0%, ${impactColor}15 100%); padding: 14px; margin: -10px -10px 12px -10px; border-radius: 8px 8px 0 0; border-bottom: 3px solid ${impactColor};">
        <strong style="font-size: 1.2em; color: #0b0c10; display: block; line-height: 1.3;">
          ${event.location_text}
        </strong>
      </div>
      
      <!-- Badge categoria e impatto -->
      <div style="margin-bottom: 12px; display: flex; gap: 6px; flex-wrap: wrap;">
        <span style="background: #ffc107; color: white; padding: 4px 10px; border-radius: 5px; font-size: 0.8em; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
          🇺🇦 Attacco UA → RU
        </span>
        <span style="background: ${impactColor}; color: white; padding: 4px 10px; border-radius: 5px; font-size: 0.8em; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
          ⚠️ ${impactLabel}
        </span>
        <span style="background: ${event.reliability === 'verified' ? '#28a745' : '#6c757d'}; color: white; padding: 4px 10px; border-radius: 5px; font-size: 0.8em; font-weight: 600;">
          ${event.reliability === 'verified' ? '✓ Verificato' : '⚠️ Non verificato'}
        </span>
      </div>
      
      <hr style="margin: 12px 0; border: none; border-top: 1px solid #dee2e6;">
      
      <!-- Dettagli evento -->
      <div style="font-size: 0.92em; line-height: 1.7; color: #333;">
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; margin-bottom: 10px;">
          <strong style="color: #666;">📅 Data:</strong>
          <span>${formatDate(event.date)}</span>
          
          <strong style="color: #666;">🎯 Tipo:</strong>
          <span>${event.type}</span>
          
          ${event.target_detail ? `
            <strong style="color: #666;">📍 Località:</strong>
            <span>${event.target_detail}</span>
          ` : ''}
          
          <strong style="color: #666;">🔥 Intensità:</strong>
          <span>${(event.impact.intensity * 100).toFixed(0)}%</span>
        </div>
        
        ${event.description ? `
          <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-left: 3px solid ${impactColor}; border-radius: 4px;">
            <strong style="font-size: 0.85em; color: #666; display: block; margin-bottom: 4px;">📝 Descrizione:</strong>
            <span style="font-size: 0.9em; color: #495057;">${event.description}</span>
          </div>
        ` : ''}
      </div>
      
      <!-- Fonti -->
      ${event.sources && event.sources.length > 0 ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e9ecef;">
          <strong style="font-size: 0.9em; color: #666; display: block; margin-bottom: 6px;">🔗 Link:</strong>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${event.sources.map(s => `
              <a href="${s.url}" target="_blank" rel="noopener noreferrer" style="
                color: #0066cc; 
                font-size: 0.88em; 
                text-decoration: none; 
                padding: 4px 8px;
                background: #e7f3ff;
                border-radius: 4px;
                display: inline-block;
                transition: background 0.2s;
              " onmouseover="this.style.background='#cce5ff'" onmouseout="this.style.background='#e7f3ff'">
                🌐 ${s.outlet || 'Link esterno'} →
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Footer -->
      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e9ecef; font-size: 0.75em; color: #999; text-align: right;">
        ID: ${event.id}
      </div>
    </div>
  `;
}

// Mostra eventi sulla mappa
function displayEvents(events) {
  // Pulisci layer
  eventsLayer.clearLayers();
  Object.values(layerGroups).forEach(layer => {
    if (layer !== eventsLayer) layer.clearLayers();
  });
  
  console.log('Visualizzo:', events.length, 'eventi');
  
  events.forEach(event => {
    const marker = L.marker(
      [event.location.lat, event.location.lon],
      { icon: getMarkerIcon(event.impact.damage_level, event.reliability) }
    );
    
    marker.bindPopup(createPopupContent(event), {
      maxWidth: 400,
      className: 'custom-popup'
    });
    
    // Aggiungi al layer eventi
    eventsLayer.addLayer(marker);
  });
}

// Formatta data
function formatDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  
  // Gestisci formato DD/MM/YY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      
      // Converti anno a 2 cifre in 4 cifre
      if (year.length === 2) {
        year = '20' + year;
      }
      
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }
  }
  
  // Formato ISO standard
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  
  return dateStr;
}

// Aggiorna statistiche
function updateStatistics(events) {
  const countEl = document.getElementById('eventCount');
  if (countEl) countEl.textContent = events.length;
  
  const dates = events.map(e => {
    const dateStr = e.date;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        return new Date(`${year}-${month}-${day}`);
      }
    }
    return new Date(dateStr);
  }).filter(d => !isNaN(d));
  
  if (dates.length > 0) {
    const lastDate = new Date(Math.max(...dates));
    const updateEl = document.getElementById('lastUpdate');
    if (updateEl) updateEl.textContent = lastDate.toLocaleDateString('it-IT');
  }
  
  // Statistiche impatto
  const byImpact = {};
  events.forEach(e => {
    const level = e.impact.damage_level;
    byImpact[level] = (byImpact[level] || 0) + 1;
  });
  
  const statsContainer = document.getElementById('categoryStats');
  if (statsContainer) {
    const impactLabels = {
      'critical': '🔴 Critici',
      'high': '🟠 Alto impatto',
      'medium': '🟡 Medio impatto',
      'low': '⚪ Basso impatto'
    };
    
    statsContainer.innerHTML = Object.entries(byImpact)
      .sort((a, b) => {
        const order = ['critical', 'high', 'medium', 'low'];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      })
      .map(([level, count]) => `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9ecef;">
          <span style="font-size: 0.85em;">${impactLabels[level]}</span>
          <strong style="color: ${impactColors[level]};">${count}</strong>
        </div>
      `).join('');
  }
}

// Popola filtri
function populateFilters(events) {
  const dates = events.map(e => {
    const dateStr = e.date;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        return new Date(`${year}-${month}-${day}`);
      }
    }
    return new Date(dateStr);
  }).filter(d => !isNaN(d));
  
  if (dates.length > 0) {
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const startEl = document.getElementById('startDate');
    const endEl = document.getElementById('endDate');
    if (startEl) startEl.min = minDate.toISOString().split('T')[0];
    if (endEl) endEl.max = maxDate.toISOString().split('T')[0];
  }
}

// Applica filtri
const applyBtn = document.getElementById('applyFilter');
if (applyBtn) {
  applyBtn.addEventListener('click', () => {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    const attackType = document.getElementById('attackType')?.value;
    const impactLevel = document.getElementById('impactFilter')?.value;
    
    const filtered = allEvents.filter(event => {
      // Converti data evento in formato ISO per confronto
      let eventDateISO = event.date;
      if (event.date.includes('/')) {
        const parts = event.date.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          let year = parts[2];
          if (year.length === 2) year = '20' + year;
          eventDateISO = `${year}-${month}-${day}`;
        }
      }
      
      if (startDate && eventDateISO < startDate) return false;
      if (endDate && eventDateISO > endDate) return false;
      if (attackType && event.type !== attackType) return false;
      if (impactLevel && event.impact.damage_level !== impactLevel) return false;
      return true;
    });
    
    displayEvents(filtered);
    updateStatistics(filtered);
    createHeatmap(filtered);
    
    applyBtn.textContent = `✓ Filtrati: ${filtered.length}`;
    setTimeout(() => applyBtn.textContent = 'Applica filtri', 2000);
  });
}

// Reset filtri
const resetBtn = document.getElementById('resetFilter');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const attackType = document.getElementById('attackType');
    const impactFilter = document.getElementById('impactFilter');
    
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';
    if (attackType) attackType.value = '';
    if (impactFilter) impactFilter.value = '';
    
    displayEvents(allEvents);
    updateStatistics(allEvents);
    createHeatmap(allEvents);
  });
}

// Export CSV
const exportBtn = document.getElementById('exportData');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const csv = convertToCSV(allEvents);
    downloadCSV(csv, 'eventi_ukraine_strikes.csv');
  });
}

function convertToCSV(events) {
  const headers = ['ID', 'Data', 'Target', 'Tipo', 'Località', 'Lat', 'Lon', 'Impatto', 'Verifica'];
  const rows = events.map(e => [
    e.id,
    e.date,
    e.location_text,
    e.type,
    e.target_detail,
    e.location.lat,
    e.location.lon,
    e.impact.damage_level,
    e.reliability
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

// Responsive
window.addEventListener('resize', () => map.invalidateSize());

// CSS animazione pulse
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.8; }
  }
  
  .custom-popup .leaflet-popup-content-wrapper {
    border-radius: 10px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
  }
  
  .custom-popup .leaflet-popup-tip {
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
`;
document.head.appendChild(style);

// ============================================
// INIZIALIZZAZIONE
// ============================================

// Carica i dati all'avvio
loadEventsData();
