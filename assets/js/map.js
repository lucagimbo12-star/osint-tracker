// assets/js/map.js

// Inizializza la mappa centrata sulla zona di interesse
let map = L.map('map').setView([54.5, 37.6], 5);

// Aggiunge le tiles di OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Layer per i marker
let markersLayer = L.layerGroup().addTo(map);

// Variabile globale per i dati
let geoData;

// Carica il file GeoJSON
fetch('assets/events.geojson') // Modifica il path se events.geojson non è in root
  .then(res => res.json())
  .then(data => {
    geoData = data.features;
    showData(geoData);
  })
  .catch(err => console.error("Errore caricamento GeoJSON:", err));

// Funzione per mostrare i dati sulla mappa
function showData(data) {
  markersLayer.clearLayers(); // Pulisce i marker precedenti
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

// Gestione filtri
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

