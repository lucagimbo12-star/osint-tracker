fetch('/events.geojson')
  .then(r => r.json())
  .then(data => {
    L.geoJSON(data).addTo(map);
  });

