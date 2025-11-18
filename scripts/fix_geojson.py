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
    
  import json
import os
import math

def fix_nan_in_value(value):
    """Converte NaN in null, ricorsivamente"""
    if isinstance(value, float) and math.isnan(value):
        return None
    elif isinstance(value, str) and value.lower() in ['nan', 'NaN']:
        return None
    elif isinstance(value, dict):
        return {k: fix_nan_in_value(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [fix_nan_in_value(item) for item in value]
    return value

def process_json_file(filepath):
    """Processa un singolo file JSON"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Pulisci tutti i NaN ricorsivamente
        cleaned_data = fix_nan_in_value(data)
        
        # Sovrascrivi il file originale
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Processato: {filepath}")
        return True
    except json.JSONDecodeError:
        print(f"✗ Errore JSON in: {filepath}")
        return False
    except Exception as e:
        print(f"✗ Errore in {filepath}: {e}")
        return False

def find_and_fix_all_json(root_dir='.'):
    """Trova e corregge tutti i file JSON nel repository"""
    json_files = []
    
    # Trova tutti i file .json e .geojson
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Salta cartelle comuni da ignorare
        dirnames[:] = [d for d in dirnames if d not in ['.git', 'node_modules', '__pycache__', 'venv']]
        
        for filename in filenames:
            if filename.endswith(('.json', '.geojson')):
                json_files.append(os.path.join(dirpath, filename))
    
    print(f"\nTrovati {len(json_files)} file JSON\n")
    
    # Processa tutti i file
    success = 0
    for filepath in json_files:
        if process_json_file(filepath):
            success += 1
    
    print(f"\n{'='*50}")
    print(f"Completato: {success}/{len(json_files)} file processati con successo")

if __name__ == '__main__':
    # Esegui dalla root del repository
    find_and_fix_all_json()
