import csv
import requests
import json

# URL corretto del foglio in formato CSV
sheet_url = "https://docs.google.com/spreadsheets/d/1NEyNXzCSprGOw6gCmVVbtwvFmz8160Oag-WqG93ouoQ/export?format=csv"

# Output
geojson_output = "events.geojson"
timeline_csv_output = "events_timeline.csv"

# Scarica il CSV
r = requests.get(sheet_url)
r.raise_for_status()
lines = r.text.splitlines()
reader = csv.DictReader(lines)

# Colonne note del foglio
valid_fields = [
    "title",
    "date",
    "type",
    "location",
    "latitude",
    "longitude",
    "source",
    "archived",
    "verification"
]

# GeoJSON
geojson = {
    "type": "FeatureCollection",
    "features": []
}

# Timeline
timeline_rows = []

for row in reader:

    # Converti lat/lon a numeri
    try:
        lat = float(row["latitude"])
        lon = float(row["longitude"])
    except Exception:
        # se non è convertibile la saltiamo
        continue

    # Aggiungi feature GeoJSON
    feature = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat]
        },
        "properties": {field: row.get(field, "") for field in valid_fields}
    }

    geojson["features"].append(feature)

    # Costruisci riga timeline (solo colonne note)
    timeline_rows.append({field: row.get(field, "") for field in valid_fields})

# Scrivi GeoJSON
with open(geojson_output, "w", encoding="utf-8") as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)

# Scrivi CSV timeline
with open(timeline_csv_output, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=valid_fields)
    writer.writeheader()
    writer.writerows(timeline_rows)
