// assets/js/map.js

// Inizializza la mappa
let map = L.map('map').setView([54.5, 37.6], 5);

// Tiles OpenStreetMap con stile migliore
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Layer di marker cluster
let markersLayer = L.markerClusterGroup({
  maxClusterRadius: 50,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: true,
  zoomToBoundsOnClick: true
}).addTo(map);

// Variabile globale per dati
let geoData;

// Carica GeoJSON dalla root della repo
fetch('events.geojson')
  .then(res => res.json())
  .then(data => {
    geoData = data.features;
    showData(geoData);
    updateStats(geoData);
  })
  .catch(err => {
    console.error("Errore caricamento GeoJSON:", err);
    alert("Impossibile caricare i dati. Verifica che events.geojson sia presente.");
  });

// Funzione per normalizzare le date (supporta vari formati)
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Prova diversi formati comuni
  // Formato ISO: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  
  // Formato IT: 15/01/2024
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  }
  
  // Formato US: 01/15/2024
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  
  // Prova parsing generico
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

// Funzione per mostrare i dati sulla mappa
function showData(data) {
  markersLayer.clearLayers();
  
  if (!data || data.length === 0) {
    console.warn("Nessun dato da visualizzare");
    updateStats([]);
    return;
  }
  
  data.forEach(f => {
    let p = f.properties;
    let coords = f.geometry.coordinates;
    
    // Crea marker con icona personalizzata in base al tipo
    let iconColor = getIconColor(p.type);
    let marker = L.marker([coords[1], coords[0]], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${iconColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16]
      })
    });
    
    marker.bindPopup(`
      <div style="min-width: 200px;">
        <strong style="font-size: 1.1em; color: #0b0c10;">${p.title || 'Evento'}</strong><br>
        <hr style="margin: 8px 0; border: none; border-top: 1px solid #dee2e6;">
        <em style="color: #45a29e;">📅 ${p.date || 'Data non disponibile'}</em><br>
        <strong>Tipo:</strong> <span style="color: ${iconColor}; font-weight: 600;">${p.type || 'N/A'}</span><br>
        ${p.archived ? `<a href="${p.archived}" target="_blank" style="color: #45a29e; text-decoration: none;">🔗 Fonte</a><br>` : ''}
        ${p.verification ? `<small style="color: #6c757d;">✓ Verifica: ${p.verification}</small><br>` : ''}
        ${p.notes ? `<p style="margin-top: 8px; color: #495057; font-size: 0.9em;">${p.notes}</p>` : ''}
      </div>
    `);
    
    markersLayer.addLayer(marker);
  });
  
  updateStats(data);
}

// Funzione per ottenere colore icona in base al tipo
function getIconColor(type) {
  const colors = {
    'Missile': '#dc3545',
    'Droni': '#ffc107',
    'Sabotaggio': '#6f42c1',
    'default': '#45a29e'
  };
  return colors[type] || colors.default;
}

// Aggiorna statistiche
function updateStats(data) {
  const countEl = document.getElementById('eventCount');
  const updateEl = document.getElementById('lastUpdate');
  
  if (countEl) {
    countEl.textContent = data.length;
  }
  
  if (updateEl && data.length > 0) {
    // Trova la data più recente
    const dates = data
      .map(f => parseDate(f.properties.date))
      .filter(d => d !== null)
      .sort((a, b) => b - a);
    
    if (dates.length > 0) {
      updateEl.textContent = dates[0].toLocaleDateString('it-IT');
    }
  }
}

// Applica filtri
document.getElementById('applyFilter').addEventListener('click', () => {
  if (!geoData) {
    alert("Dati non ancora caricati");
    return;
  }
  
  let start = document.getElementById('startDate').value;
  let end = document.getElementById('endDate').value;
  let type = document.getElementById('attackType').value;

  let filtered = geoData.filter(f => {
    let dateOk = true;
    let typeOk = true;
    
    // Filtra per data
    if (start || end) {
      const eventDate = parseDate(f.properties.date);
      if (!eventDate) return false; // Salta eventi senza data valida
      
      const startDate = start ? new Date(start) : null;
      const endDate = end ? new Date(end) : null;
      
      if (startDate && eventDate < startDate) dateOk = false;
      if (endDate) {
        // Aggiungi un giorno alla data di fine per includere tutto il giorno
        const endDateInclusive = new Date(endDate);
        endDateInclusive.setDate(endDateInclusive.getDate() + 1);
        if (eventDate >= endDateInclusive) dateOk = false;
      }
    }
    
    // Filtra per tipo
    if (type && f.properties.type !== type) {
      typeOk = false;
    }
    
    return dateOk && typeOk;
  });

  showData(filtered);
  
  // Feedback visivo
  const btn = document.getElementById('applyFilter');
  btn.textContent = `✓ Filtrati: ${filtered.length}`;
  setTimeout(() => {
    btn.textContent = 'Applica filtri';
  }, 2000);
});

// Reset filtri
document.getElementById('resetFilter').addEventListener('click', () => {
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  document.getElementById('attackType').value = '';
  
  if (geoData) {
    showData(geoData);
  }
});

// Gestione responsive della mappa
window.addEventListener('resize', () => {
  map.invalidateSize();
});
