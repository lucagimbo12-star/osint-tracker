// Inizializza la mappa
const map = L.map('map').setView([41.9, 12.5], 6);

// Tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
}).addTo(map);

// Cluster
const markers = L.markerClusterGroup();

const eventList = document.getElementById("event-list");
const search = document.getElementById("search");

// Carica GeoJSON
fetch("events.geojson")
    .then(res => res.json())
    .then(data => {
        data.features.forEach((feature) => {
            const coords = feature.geometry.coordinates;
            const props = feature.properties;

            const marker = L.marker([coords[1], coords[0]]);

            marker.bindPopup(`
                <b>${props.title || "Evento senza titolo"}</b><br>
                ${props.date || "Data sconosciuta"}<br>
                ${props.city || ""} ${props.country || ""}
            `);

            markers.addLayer(marker);

            // Aggiungi evento alla sidebar
            const li = document.createElement("li");
            li.textContent = `${props.title} — ${props.city}`;
            li.onclick = () => {
                map.setView([coords[1], coords[0]], 12);
                marker.openPopup();
            };

            eventList.appendChild(li);
        });

        map.addLayer(markers);
    });


// --- FILTRO DI RICERCA ---
search.addEventListener("input", () => {
    const term = search.value.toLowerCase();
    Array.from(eventList.children).forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(term)
            ? "block"
            : "none";
    });
});

