// assets/js/map.js

// Inizializza la mappa
let map = L.map('map').setView([54.5, 37.6], 5);

// Tiles OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Layer di marker cluster
let markersLayer = L.markerClusterGroup().addTo(map);

// Variabile globale per dati
let geoData;

// Carica GeoJSON
fetch('events.geojson')
  .then(res => res.json())
  .then(data => {
    geoData = data.features;
    showData(geoData);
  })
  .catch(err => console.error("Errore caricamento GeoJSON:", err));

// Funzione per mostrare i dati
function showData(data) {
  markersLayer.clearLayers(); // Pulisce marker precedenti
  data.forEach(f => {
    let p = f.properties;
    let coords = f.geometry.coordinates;
    let marker = L.marker([coords[1], coords[0]]);
    marker.bindPopup(`
      <strong>${p.title}</strong><br>
      <em>${p.date}</em><br>
      <strong>Tipo:</strong> ${p.type}<br>
      <a href="${p.archived}" target="_blank">Fonte</a><br>
      <small>Verifica: ${p.verification}</small><br>
      <p>${p.notes}</p>
    `);
    markersLayer.addLayer(marker);
  });
}

// Filtri
document.getElementById('applyFilter').addEventListener('click', () => {
  let start = document.getElementById('startDate').value;
  let end = document.getElementById('endDate').value;
  let type = document.getElementById('attackType').value;

  let filtered = geoData.filter(f => {
    let dateOk = true, typeOk = true;
    if(start) dateOk = f.properties.date >= start;
    if(end) dateOk = dateOk && f.properties.date <= end;
    if(type) typeOk = f.properties.type === type;
    return dateOk && typeOk;
  });

  showData(filtered);
});


