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

def setup_clients():
    scope = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    creds_dict = json.loads(os.environ['GCP_CREDENTIALS_JSON'])
    creds = Credentials.from_service_account_info(creds_dict, scopes=scope)
    gc = gspread.authorize(creds)
    tavily = TavilyClient(api_key=os.environ['TAVILY_API_KEY'])
    openai = OpenAI(api_key=os.environ['OPENAI_API_KEY'])
    return gc, tavily, openai

def analyze_event_v2(openai, event, news_context):
    """
    Versione Potenziata: Chiede descrizione, video e intensità.
    """
    prompt = f"""
    Sei un analista di intelligence e giornalista OSINT. 
    Analizza le notizie fornite relative a questo evento bellico.

    DATI EVENTO:
    - Titolo: {event.get('Title', '')}
    - Luogo: {event.get('Location', '')}
    - Data: {event.get('Date', '')}

    NOTIZIE DAL WEB:
    {news_context}

    COMPITI:
    1. Verifica se l'evento è confermato (data/luogo devono coincidere).
    2. Scrivi una descrizione dettagliata in ITALIANO (max 250 caratteri) stile agenzia stampa.
    3. Cerca nel testo URL di video o foto (Twitter, Telegram, YouTube). Se non ne trovi, lascia null.
    4. Calcola l'INTENSITÀ (da 0.1 a 1.0) basandoti sui danni:
       - 0.2: Droni abbattuti, nessun danno.
       - 0.5: Incendio lieve o danni minori.
       - 0.8: Incendio grave, infrastruttura danneggiata.
       - 1.0: Distruzione totale o vittime multiple.

    RISPONDI SOLO IN JSON:
    {{
        "match": true/false,
        "confidence": 0-100,
        "description_it": "Testo descrizione...",
        "video_url": "URL trovato o null",
        "intensity": 0.5,
        "best_link": "URL fonte principale"
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
    print("🤖 Avvio Super-Agente OSINT...")
    try:
        gc, tavily, openai = setup_clients()
        sh = gc.open_by_url(SHEET_URL)
        worksheet = sh.get_worksheet(0)
        
        data = worksheet.get_all_records()
        headers = worksheet.row_values(1)
        
        # Mappa colonne (trova l'indice della colonna basandosi sul nome)
        try:
            col_ver = headers.index('Verification') + 1
            col_src = headers.index('Source') + 1
            col_desc = headers.index('Description') + 1
            col_video = headers.index('Video') + 1
            col_int = headers.index('Intensity') + 1
        except ValueError as e:
            print(f"❌ ERRORE: Manca una colonna nel foglio Google! {e}")
            print("Assicurati di avere: Verification, Source, Description, Video, Intensity")
            return

        rows_to_process = []
        for i, row in enumerate(data):
            ver = str(row.get('Verification', '')).lower()
            src = str(row.get('Source', ''))
            # Processa se non verificato O se manca la descrizione (così arricchisce anche i vecchi verificati)
            if (ver != 'verified') or (not row.get('Description')):
                rows_to_process.append((i + 2, row))

        print(f"📋 Righe da arricchire: {len(rows_to_process)}")

        for row_idx, event in rows_to_process[:5]: # Max 5 per volta
            print(f"\n🔍 Elaborazione: {event.get('Title')}...")
            
            query = f"{event.get('Title')} {event.get('Location')} {event.get('Date')} footage video confirmed damage report"
            try:
                # Cerca anche video specificamente
                search = tavily.search(query, search_depth="advanced", include_images=False, max_results=6)
                context = "\n".join([f"- {r['content']} (Link: {r['url']})" for r in search['results']])
            except Exception as e:
                print(f"❌ Errore ricerca: {e}")
                continue

            res = analyze_event_v2(openai, event, context)
            
            if res.get('match') and res.get('confidence') >= CONFIDENCE_THRESHOLD:
                print(f"   ✅ Dati generati! Intensity: {res.get('intensity')}")
                
                # Aggiorna TUTTI i campi
                worksheet.update_cell(row_idx, col_ver, "verified")
                
                if res.get('best_link') and not event.get('Source'):
                    worksheet.update_cell(row_idx, col_src, res['best_link'])
                
                # Scrive descrizione, video e intensità
                worksheet.update_cell(row_idx, col_desc, res.get('description_it', ''))
                worksheet.update_cell(row_idx, col_int, res.get('intensity', 0.2))
                
                if res.get('video_url'):
                    worksheet.update_cell(row_idx, col_video, res.get('video_url'))
                    print(f"   🎥 Video trovato: {res.get('video_url')}")
                
                time.sleep(1.5) # Rispetto limiti API
            else:
                print(f"   ⚠️ Dati insufficienti (Confidence: {res.get('confidence')}%)")

    except Exception as e:
        print(f"❌ ERRORE CRITICO: {e}")
        raise e

if __name__ == "__main__":
    main()
