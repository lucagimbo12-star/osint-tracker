# scripts/csv_to_geojson.py
import csv, json, sys
from io import StringIO
import requests

CSV_URL = sys.argv[1]  # passo l'URL dal workflow
OUT_FILE = sys.argv[2] if len(sys.argv) > 2 else 'events.geojson'

def parse_number(x):
    if x is None: return None
    xs = str(x).strip()
    if xs == '': return None
    xs = xs.replace(',', '.')
    try:
        return float(xs)
    except:
        return None

r = requests.get(CSV_URL)
r.raise_for_status()
csv_text = r.text

f = StringIO(csv_text)
reader = csv.DictReader(f)

features = []
for row in reader:
    lat = parse_number(row.get('latitude') or row.get('lat'))
    lon = parse_number(row.get('longitude') or row.get('lon'))
    if lat is None or lon is None:
        continue
    props = {
        "title": row.get('title','').strip(),
        "date": row.get('date','').strip(),
        "type": row.get('type','').strip(),
        "location": row.get('location','').strip(),
        "source": row.get('source','').strip(),
        "archived": row.get('archived','').strip(),
        "verification": row.get('verification','').strip(),
        "notes": row.get('notes','').strip()
    }
    feat = {
        "type":"Feature",
        "properties": props,
        "geometry": {"type":"Point", "coordinates": [lon, lat]}
    }
    features.append(feat)

geojson = {"type":"FeatureCollection", "features": features}
with open(OUT_FILE, 'w', encoding='utf-8') as fh:
    json.dump(geojson, fh, ensure_ascii=False, indent=2)

print(f"Wrote {len(features)} features to {OUT_FILE}")
