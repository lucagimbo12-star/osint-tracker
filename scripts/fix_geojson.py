import json

# Carica GeoJSON
with open('events.geojson', 'r') as f:
    data = json.load(f)

# Converti ogni feature
for feature in data['features']:
    props = feature['properties']
    
    # Rinomina campi
    if 'source' in props:
        props['link'] = props.pop('source')
    if 'notes' in props:
        props['description'] = props.pop('notes')
    
    # Aggiungi intensity se mancante
    if 'intensity' not in props:
        # Calcola in base a verification
        if props.get('verification') == 'verified':
            props['intensity'] = 0.7 or 0.8 or 0.9 or 1.0 or 0.6
        else:
            props['intensity'] = 0.2
    
    # Pulisci NaN
    for key in props:
        if props[key] == 'NaN' or str(props[key]) == 'nan':
            props[key] = None if key == 'link' else ''

# Salva
with open('events_fixed.geojson', 'w') as f:
    json.dump(data, f, indent=2)
