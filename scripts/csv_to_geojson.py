import csv
import requests
import sys

# URL CSV Google Sheet (se vuoi aggiornamento automatico da Sheets)
sheet_url = https://docs.google.com/spreadsheets/d/1NEyNXzCSprGOw6gCmVVbtwvFmz8160Oag-WqG93ouoQ/edit?usp=sharing [1]  # es: URL CSV Google Sheet
geojson_output = events.geojson[2]  # es: events.geojson
timeline_csv_output = events_timeline.csv [3]  # nuovo: events_timeline.csv

# Scarica dati
r = requests.get(sheet_url)
r.raise_for_status()
lines = r.text.splitlines()
reader = csv.DictReader(lines)

# Per GeoJSON
geojson = {
    "type": "FeatureCollection",
    "features": []
}

# Per TimelineCSV
timeline_fields = ['Year','Month','Day','Headline','Text','Media','Media Credit','Media Caption']
timeline_rows = []

for row in reader:
    # GeoJSON
    try:
        lon = float(row['Longitude'])
        lat = float(row['Latitude'])
    except:
        continue  # ignora righe senza coordinate

    feature = {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": row
    }
    geojson['features'].append(feature)

    # TimelineCSV
    timeline_row = {field: row.get(field, '') for field in timeline_fields}
    timeline_rows.append(timeline_row)

# Scrivi GeoJSON
import json
with open(geojson_output, 'w', encoding='utf-8') as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)

# Scrivi CSV per Timeline
with open(timeline_csv_output, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=timeline_fields)
    writer.writeheader()
    writer.writerows(timeline_rows)
