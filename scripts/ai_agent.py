import os
import json
import gspread
from google.oauth2.service_account import Credentials
from tavily import TavilyClient
from openai import OpenAI
import pandas as pd
import time

# --- CONFIGURAZIONE ---
SHEET_URL = "https://docs.google.com/spreadsheets/d/1NEyNXzCSprGOw6gCmVVbtwvFmz8160Oag-WqG93ouoQ/edit"
CONFIDENCE_THRESHOLD = 85
BATCH_SIZE = 10  # Aumenta (es. 50) per smaltire l'arretrato, poi riporta a 10

def setup_clients():
    scope = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    creds_dict = json.loads(os.environ['GCP_CREDENTIALS_JSON'])
    creds = Credentials.from_service_account_info(creds_dict, scopes=scope)
    gc = gspread.authorize(creds)
    tavily = TavilyClient(api_key=os.environ['TAVILY_API_KEY'])
    openai = OpenAI(api_key=os.environ['OPENAI_API_KEY'])
    return gc, tavily, openai

def analyze_event_pro(openai, event, news_context):
    """
    Super-Agente: Verifica, Rinomina e Classifica con le nuove categorie Impact Atlas 2.0.
    """
    prompt = f"""
    Sei un analista di intelligence militare senior.
    Il tuo compito è pulire, strutturare e classificare un evento bellico basandoti sulle news trovate.

    DATI ORIGINALI:
    - Titolo Attuale: {event.get('Title', '')}
    - Luogo: {event.get('Location', '')}
    - Data: {event.get('Date', '')}

    NEWS TROVATE:
    {news_context}

    COMPITI:
    1. VERIFICA: L'evento è confermato? (Data e Luogo coincidono?)
    2. NUOVO TITOLO: Riscrivi il titolo in ITALIANO. Format: "TIPO ATTACCO + BERSAGLIO + CITTÀ".
       Esempio: "Attacco droni contro raffineria Rosneft a Tuapse". Max 10 parole.
    3. CLASSIFICAZIONE (Cruciale): Scegli la categoria esatta SOLO da questa lista:
       [
         "Drone Strike", "Missile Strike", "Artillery", "Airstrike", "Sabotage", "Naval Strike",
         "Energy Infrastructure", "Cultural Heritage", "Eco-Impact", "Cyber Attack", "Unknown"
       ]
       - Se colpiscono musei/chiese -> "Cultural Heritage"
       - Se bruciano foreste/dighe -> "Eco-Impact"
       - Se colpiscono sottostazioni/raffinerie -> "Energy Infrastructure"
    4. INTENSITÀ: Stima danni da 0.1 (nulli) a 1.0 (catastrofici/vittime multiple).
    5. DESCRIZIONE: Riassunto tecnico in italiano (max 300 caratteri).
    6. MEDIA: Cerca link a video/foto se presenti nel testo.

    RISPONDI SOLO IN JSON:
    {{
        "match": true/false,
        "confidence": 0-100,
        "new_title": "Titolo riscritto...",
        "new_type": "Categoria dalla lista...",
        "description_it": "Riassunto...",
        "video_url": "URL video o null",
        "intensity": 0.5,
        "best_link": "URL fonte"
    }}
    """
    try:
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Errore AI: {e}")
        return {"match": False, "confidence": 0}

def main():
    print("🤖 Avvio Agente OSINT Editor...")
    try:
        gc, tavily, openai = setup_clients()
        sh = gc.open_by_url(SHEET_URL)
        worksheet = sh.get_worksheet(0)
        
        # Legge intestazioni e dati
        headers = worksheet.row_values(1)
        data = worksheet.get_all_records()
        
        # Mappa dinamica delle colonne
        try:
            col_title = headers.index('Title') + 1
            col_type = headers.index('Type') + 1
            col_ver = headers.index('Verification') + 1
            col_src = headers.index('Source') + 1
            col_desc = headers.index('Description') + 1
            col_video = headers.index('Video') + 1
            col_int = headers.index('Intensity') + 1
        except ValueError as e:
            print(f"❌ ERRORE COLONNE MANCANTI: {e}")
            print("Aggiungi al foglio: Title, Type, Verification, Source, Description, Video, Intensity")
            return

        # Cerca righe da processare
        rows_to_process = []
        for i, row in enumerate(data):
            ver = str(row.get('Verification', '')).lower()
            # Processa se non verificato OPPURE se manca la descrizione (aggiornamento retroattivo)
            if (ver != 'verified') or (not row.get('Description')):
                rows_to_process.append((i + 2, row))

        print(f"📋 Righe in coda: {len(rows_to_process)}. Elaborazione di {BATCH_SIZE} eventi...")

        for row_idx, event in rows_to_process[:BATCH_SIZE]:
            title_orig = event.get('Title', 'Evento')
            print(f"\n🔍 Analisi: {title_orig} ({event.get('Date')})")
            
            query = f"{title_orig} {event.get('Location')} {event.get('Date')} war conflict ukraine russia confirmed footage"
            try:
                search = tavily.search(query, search_depth="advanced", include_images=False, max_results=5)
                context = "\n".join([f"- {r['content']} (Link: {r['url']})" for r in search['results']])
            except Exception as e:
                print(f"❌ Errore ricerca Tavily: {e}")
                continue

            res = analyze_event_pro(openai, event, context)
            
            if res.get('match') and res.get('confidence') >= CONFIDENCE_THRESHOLD:
                print(f"   ✅ VERIFICATO! Tipo: {res.get('new_type')} | Int: {res.get('intensity')}")
                
                # Aggiorna Metadati Base
                worksheet.update_cell(row_idx, col_ver, "verified")
                if res.get('best_link') and not event.get('Source'):
                    worksheet.update_cell(row_idx, col_src, res['best_link'])
                
                # SOVRASCRIVE TITOLO E TIPO (Cleaning)
                if res.get('new_title') and len(res['new_title']) > 5:
                    worksheet.update_cell(row_idx, col_title, res['new_title'])
                
                if res.get('new_type') and res['new_type'] != "Unknown":
                    worksheet.update_cell(row_idx, col_type, res['new_type'])

                # Scrive Arricchimenti
                worksheet.update_cell(row_idx, col_desc, res.get('description_it', ''))
                worksheet.update_cell(row_idx, col_int, res.get('intensity', 0.2))
                
                if res.get('video_url'):
                    worksheet.update_cell(row_idx, col_video, res.get('video_url'))
                    print(f"   🎥 Video aggiunto.")
                
                time.sleep(2.5) # Rispetto limiti API
            else:
                print(f"   ⚠️ Non verificato (Confidence: {res.get('confidence')}%)")
                time.sleep(1)

    except Exception as e:
        print(f"❌ ERRORE CRITICO: {e}")
        raise e

if __name__ == "__main__":
    main()
