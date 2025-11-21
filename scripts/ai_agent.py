import os
import json
import gspread
from google.oauth2.service_account import Credentials
from tavily import TavilyClient
from openai import OpenAI
import pandas as pd
from datetime import datetime

# --- CONFIGURAZIONE ---
SHEET_URL = "https://docs.google.com/spreadsheets/d/1NEyNXzCSprGOw6gCmVVbtwvFmz8160Oag-WqG93ouoQ/edit"
CONFIDENCE_THRESHOLD = 85  # Accetta come "Verified" solo se sicurezza > 85%

def setup_clients():
    # Google Sheets
    scope = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    creds_dict = json.loads(os.environ['GCP_CREDENTIALS_JSON'])
    creds = Credentials.from_service_account_info(creds_dict, scopes=scope)
    gc = gspread.authorize(creds)
    
    # Tavily & OpenAI
    tavily = TavilyClient(api_key=os.environ['TAVILY_API_KEY'])
    openai = OpenAI(api_key=os.environ['OPENAI_API_KEY'])
    
    return gc, tavily, openai

def analyze_event(openai, event, news_context):
    """Chiede all'AI di analizzare se le news confermano l'evento"""
    
    prompt = f"""
    Sei un analista OSINT esperto. Verifica se le notizie trovate confermano questo evento di guerra.
    
    EVENTO DA VERIFICARE:
    - Titolo: {event['Title']}
    - Data: {event['Date']}
    - Luogo: {event['Location']}
    - Tipo: {event['Type']}
    
    NOTIZIE TROVATE SUL WEB:
    {news_context}
    
    REGOLE DI VERIFICA:
    1. La data deve corrispondere (o essere entro 48h dal report).
    2. Il luogo e il tipo di attacco devono coincidere.
    3. Cerca conferme da fonti ufficiali o media affidabili.
    
    Rispondi SOLO in formato JSON con questi campi:
    {{
        "match": true/false (true solo se sei sicuro),
        "confidence": 0-100 (livello di sicurezza),
        "summary": "Breve spiegazione (max 1 frase)",
        "best_link": "URL della fonte migliore trovata (o null)"
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
    print("🤖 AI Agent avviato...")
    gc, tavily, openai = setup_clients()
    
    # Apre il foglio
    sh = gc.open_by_url(SHEET_URL)
    worksheet = sh.get_worksheet(0) # Primo foglio
    
    # Legge tutti i dati
    data = worksheet.get_all_records()
    df = pd.DataFrame(data)
    
    # Trova righe da processare (senza verifica o link)
    # Nota: gspread usa indici che partono da 2 (1 è header)
    rows_to_check = []
    for i, row in enumerate(data):
        # Se manca la verifica O manca la fonte
        if not row.get('Verification') or row.get('Verification') == 'not verified' or not row.get('Source'):
            rows_to_check.append((i + 2, row)) # i+2 perché gspread è 1-based + header
            
    print(f"📋 Trovate {len(rows_to_check)} righe da verificare.")
    
    for row_idx, event in rows_to_check[:5]: # Processa max 5 eventi alla volta per sicurezza/costi
        print(f"\n🔍 Analisi riga {row_idx}: {event['Title']}...")
        
        # 1. Cerca su Web
        query = f"{event['Title']} {event['Location']} {event['Date']} ukraine russia war attack"
        try:
            search_result = tavily.search(query, search_depth="advanced", max_results=5)
            context = "\n".join([f"- {r['content']} (Source: {r['url']})" for r in search_result['results']])
        except Exception as e:
            print(f"❌ Errore ricerca: {e}")
            continue
            
        # 2. Analisi AI
        result = analyze_event(openai, event, context)
        print(f"   🧠 Risultato AI: {result}")
        
        # 3. Aggiorna Foglio (Se affidabile)
        if result['match'] and result['confidence'] >= CONFIDENCE_THRESHOLD:
            print(f"   ✅ VERIFICATO! Aggiorno foglio...")
            
            # Aggiorna celle specifiche
            # Attenzione: Assicurati che i nomi colonne siano corretti nel foglio
            try:
                # Trova indici colonne (gspread find)
                col_ver = worksheet.find("Verification").col
                col_src = worksheet.find("Source").col
                col_note = worksheet.find("Notes").col
                
                worksheet.update_cell(row_idx, col_ver, "verified")
                if result['best_link']:
                    worksheet.update_cell(row_idx, col_src, result['best_link'])
                
                # Aggiunge nota AI
                old_note = event.get('Notes', '')
                new_note = f"{old_note} [AI Verified: {result['summary']}]".strip()
                worksheet.update_cell(row_idx, col_note, new_note)
                
            except Exception as e:
                print(f"❌ Errore scrittura foglio: {e}")
        else:
            print("   ⚠️ Non abbastanza sicuro o nessun match.")

if __name__ == "__main__":
    main()
