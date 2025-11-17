// ============================================
// MAP.JS - VERSIONE CON EVENTS_TIMELINE.JSON
// ============================================

// Inizializza mappa
let map = L.map('map').setView([54.5, 37.6], 5);

// Tiles OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Layer groups per categorie
let layerGroups = {
  'ukraine-strike-energy': L.markerClusterGroup({ maxClusterRadius: 50 }),
  'verified': L.markerClusterGroup({ maxClusterRadius: 50 }),
  'not-verified': L.markerClusterGroup({ maxClusterRadius: 50 })
};

// Aggiungi tutti i layer alla mappa
Object.values(layerGroups).forEach(layer => layer.addTo(map));

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

// Carica dati timeline
fetch('assets/data/events_timeline.json')
  .then(res => res.json())
  .then(data => {
    console.log('Timeline caricata:', data.events.length, 'eventi');
    
    // Converti in formato compatibile
    allEvents = data.events.map((event, idx) => {
      const text = event.text.text || '';
      const headline = event.text.headline || 'Evento';
      
      // Estrai info
      const tipoMatch = text.match(/Tipo:\s*(.+?)(?:<br>|$)/i);
      const tipo = tipoMatch ? tipoMatch[1].trim() : 'Drones';
      
      const luogoMatch = text.match(/Luogo:\s*(.+?)(?:<br>|$)/i);
      const luogo = luogoMatch ? luogoMatch[1].trim() : '';
      
      const fonteMatch = text.match(/href='([^']+)'/);
      const fonte = fonteMatch ? fonteMatch[1] : null;
      
      const outletMatch = text.match(/target='_blank'>([^<]+)<\/a>/);
      const outlet = outletMatch ? outletMatch[1].trim() : null;
      
      const verificaMatch = text.match(/Verifica:\s*(.+?)$/i);
      const verifica = verificaMatch ? verificaMatch[1].trim() : 'not verified';
      
      // Determina impatto
      const impactLevel = determineImpact(headline, verifica, tipo);
      
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
          damage_level: impactLevel
        },
        sources: fonte ? [{
          url: fonte,
          outlet: outlet || 'Fonte'
        }] : [],
        reliability: verifica,
        context: headline
      };
    });
    
    console.log('Eventi convertiti:', allEvents.length);
    displayEvents(allEvents);
    updateStatistics(allEvents);
    populateFilters(allEvents);
  })
  .catch(err => {
    console.error("Errore caricamento timeline:", err);
    alert('Errore nel caricamento di events_timeline.json');
  });

// Mostra eventi sulla mappa
function displayEvents(events) {
  // Pulisci layer
  Object.values(layerGroups).forEach(layer => layer.clearLayers());
  
  console.log('Visualizzo:', events.length, 'eventi');
  
  events.forEach(event => {
    const marker = L.marker(
      [event.location.lat, event.location.lon],
      { icon: getMarkerIcon(event.impact.damage_level, event.reliability) }
    );
    
    marker.bindPopup(createPopupContent(event));
    
    // Aggiungi al layer corretto
    const layer = layerGroups['ukraine-strike-energy'];
    if (layer) layer.addLayer(marker);
  });
}

// Crea popup
function createPopupContent(event) {
  const impactColor = impactColors[event.impact.damage_level] || '#6c757d';
  
  return `
    <div style="min-width: 280px; max-width: 350px;">
      <div style="background: linear-gradient(135deg, #ffc10720 0%, #ffc10710 100%); padding: 12px; margin: -10px -10px 10px -10px; border-radius: 8px 8px 0 0;">
        <strong style="font-size: 1.15em; color: #0b0c10;">${event.location_text}</strong>
      </div>
      
      <div style="margin-bottom: 8px;">
        <span style="background: #ffc107; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 600;">
          🇺🇦 Attacco UA → Energia RU
        </span>
        <span style="background: ${impactColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 600; margin-left: 4px;">
          ${event.impact.damage_level.toUpperCase()}
        </span>
      </div>
      
      <hr style="margin: 10px 0; border: none; border-top: 1px solid #dee2e6;">
      
      <div style="font-size: 0.9em; line-height: 1.6;">
        <p><strong>📅 Data:</strong> ${formatDate(event.date)}</p>
        <p><strong>🎯 Attore:</strong> ${event.actor}</p>
        <p><strong>🔸 Tipo:</strong> ${event.type}</p>
        ${event.target_detail ? `<p><strong>📍 Località:</strong> ${event.target_detail}</p>` : ''}
      </div>
      
      ${event.sources && event.sources.length > 0 ? `
        <div style="margin-top: 10px;">
          <strong style="font-size: 0.9em;">📌 Fonte:</strong><br>
          ${event.sources.map(s => `<a href="${s.url}" target="_blank" style="color: #45a29e; font-size: 0.85em; text-decoration: none;">🔗 ${s.outlet}</a>`).join('<br>')}
        </div>
      ` : ''}
      
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e9ecef; font-size: 0.75em; color: #6c757d;">
        ${event.reliability === 'verified' ? '✓ Verificato' : '⚠️ Non verificato'}
      </div>
    </div>
  `;
}

// Formatta data
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Aggiorna statistiche
function updateStatistics(events) {
  const countEl = document.getElementById('eventCount');
  if (countEl) countEl.textContent = events.length;
  
  const dates = events.map(e => new Date(e.date)).filter(d => !isNaN(d));
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
  const dates = events.map(e => new Date(e.date)).filter(d => !isNaN(d));
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
      if (startDate && event.date < startDate) return false;
      if (endDate && event.date > endDate) return false;
      if (attackType && event.type !== attackType) return false;
      if (impactLevel && event.impact.damage_level !== impactLevel) return false;
      return true;
    });
    
    displayEvents(filtered);
    updateStatistics(filtered);
    
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
`;
document.head.appendChild(style);
