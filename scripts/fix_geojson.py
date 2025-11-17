#!/usr/bin/env python3
"""
Script per correggere il file events.geojson
Sostituisce i valori NaN con null per renderlo JSON valido
"""

import re
import sys

def fix_geojson(input_file, output_file):
    """Corregge il file GeoJSON sostituendo NaN con null"""
    
    try:
        # Leggi il file
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Sostituisci NaN con null
        # Pattern per trovare: "key": NaN
        content = re.sub(r':\s*NaN\s*([,\}])', r': null\1', content)
        
        # Scrivi il file corretto
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✅ File corretto salvato in: {output_file}")
        print(f"   Sostituiti tutti i valori NaN con null")
        
        # Verifica che sia JSON valido
        import json
        with open(output_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"✅ JSON valido! Features: {len(data.get('features', []))}")
        
    except Exception as e:
        print(f"❌ Errore: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    input_file = 'assets/data/events.geojson'
    output_file = 'assets/data/events.geojson'
    
    print("🔧 Correzione events.geojson...")
    fix_geojson(input_file, output_file)
