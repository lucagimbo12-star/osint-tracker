import asyncio
import json
import os
import random
from datetime import datetime
from telethon import TelegramClient
from ntscraper import Nitter
from openai import OpenAI

# ==========================================
# ⚙️ CONFIGURAZIONE UTENTE (SECURE MODE)
# ==========================================

# Legge le chiavi dai Segreti di GitHub (o dal PC se impostate)
TELEGRAM_API_ID = os.getenv('TELEGRAM_API_ID')
TELEGRAM_API_HASH = os.getenv('TELEGRAM_API_HASH')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY2')

# Se non le trova (es. stai testando in locale senza var d'ambiente), avvisa
if not TELEGRAM_API_ID or not OPENAI_API_KEY:
    print("⚠️ ERRORE: Chiavi API mancanti! Assicurati di aver impostato i Secrets su GitHub.")
  
# 2. LISTA TARGET (Aggiungi qui quelli che vuoi!)
# Telegram: usa il nome utente del canale (senza @)
TELEGRAM_CHANNELS = [
    'deepstatemap',   
    'rybar',          
    'WarMonitors',    
    'CinCA_AFU', 
    'BRITISH INTELLIGENCE',
    'WMS 🇮🇹 - War Meme Squad Italia',
    'MAKS 25 🇺🇦👀',
    'NOELREPORTS 🇪🇺 🇺🇦',
    'DroneBomber',
    'Majakovsk73',
    'БПО | Братья по оружию',
    'LOSTARMOUR | Carthago delenda est!',
    'Fighterbomber',
]

# X (Twitter): usa il nome utente (senza @)
TWITTER_ACCOUNTS = [
    'GeoConfirmed',
    'DefenceHQ',
    'ISW',
    'Tatarigami_UA',
    'Mylovanov',
    '414magyarbirds',
    'wartranslated',
    'Maks_NAFO_FELLA',
    'Osinttechnical',
    'Playfra0',
    'clement_molin',
    'Majakovsk73'
    'ChrisO_wiki'
]

# 3. FILE DI DESTINAZIONE
DATA_FILE = 'assets/data/events.geojson'

# ==========================================
# 🧠 IL CERVELLO (AI PROCESSOR)
# ==========================================

client_ai = OpenAI(api_key=OPENAI_API_KEY)

def analyze_with_ai(text, source, platform, media_url=None):
    """
    Usa GPT-4o-mini per tradurre, classificare e geolocalizzare.
    """
    print(f"🤖 AI sta analizzando un post da {source} ({len(text)} chars)...")
    
    prompt = f"""
    Sei un analista OSINT esperto. Analizza questo report di guerra proveniente da {source} ({platform}).
    
    TESTO ORIGINALE: "{text}"
    
    COMPITI:
    1. TRADUZIONE: Traduci tutto in Italiano neutro e professionale.
    2. GEOLOCALIZZAZIONE: Estrai città/villaggi menzionati e STIMA le coordinate (lat, lon). Se non ci sono luoghi chiari, usa [0, 0].
    3. CLASSIFICAZIONE:
       - type: Scegli TRA [ground, air, missile, drone, artillery, naval, strategic, civil]
       - intensity: Da 0.1 (calmo) a 1.0 (nucleare/critico).
       - actor_code: Chi sta attaccando o muovendo? [RUS, UKR, NATO, UNK]
    
    OUTPUT: Restituisci SOLO un JSON valido (senza markdown) con questa struttura:
    {{
      "title": "Titolo breve (max 50 chars) in Italiano",
      "description": "Riassunto dell'evento in Italiano (max 400 chars).",
      "lat": 48.123,
      "lon": 37.456,
      "type": "ground",
      "intensity": 0.7,
      "actor_code": "RUS",
      "confidence": 80
    }}
    """

    try:
        response = client_ai.chat.completions.create(
            model="gpt-4o-mini", # <--- IL PIÙ ECONOMICO ED EFFICIENTE
            messages=[
                {"role": "system", "content": "Sei un sistema che risponde SOLO in JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        
        # Pulizia della risposta
        raw_content = response.choices[0].message.content.strip()
        if raw_content.startswith("```json"):
            raw_content = raw_content.replace("```json", "").replace("```", "")
        
        data = json.loads(raw_content)
        
        # Aggiungiamo metadati extra che l'AI non deve inventare
        data['date'] = datetime.now().strftime("%Y-%m-%d") # Usa data odierna di scansione
        data['timestamp'] = int(datetime.now().timestamp() * 1000)
        data['author'] = f"@{source} ({platform})"
        
        # Gestione Immagini (se presenti nel tweet/post originale)
        data['before_img'] = media_url if media_url else ""
        data['after_img'] = "" # Placeholder per juxtapose
        data['video'] = "null" # Placeholder
        
        return data

    except Exception as e:
        print(f"❌ Errore AI Parsing: {e}")
        return None

# ==========================================
# 🕵️ GLI SCRAPER
# ==========================================

async def scrape_telegram(existing_ids):
    new_events = []
    print("\n📡 Connessione a Telegram...")
    
    async with TelegramClient('osint_session', TELEGRAM_API_ID, TELEGRAM_API_HASH) as client:
        for channel in TELEGRAM_CHANNELS:
            print(f"   ↳ Scansiono @{channel}...")
            try:
                # Prende solo gli ultimi 3 messaggi per non finire i crediti subito
                async for message in client.iter_messages(channel, limit=4):
                    if not message.text or len(message.text) < 50: continue
                    
                    # ID univoco per evitare duplicati
                    unique_id = f"tg_{channel}_{message.id}"
                    if unique_id in existing_ids: continue
                    
                    # Recupera eventuale immagine (complesso su TG, per ora passiamo None)
                    # In futuro possiamo scaricare il media, caricarlo su un server e passare l'URL
                    
                    ai_result = analyze_with_ai(message.text, channel, "Telegram", None)
                    
                    if ai_result:
                        ai_result['original_id'] = unique_id
                        ai_result['source_url'] = f"[https://t.me/](https://t.me/){channel}/{message.id}"
                        new_events.append(ai_result)
                        existing_ids.add(unique_id) # Aggiungi al set temporaneo

            except Exception as e:
                print(f"   ⚠️ Errore su {channel}: {e}")
    
    return new_events

def scrape_twitter(existing_ids):
    new_events = []
    scraper = Nitter(log_level=1, skip_instance_check=False) # Usa istanze casuali
    print("\n🐦 Connessione a X (via Nitter)...")

    for user in TWITTER_ACCOUNTS:
        print(f"   ↳ Scansiono @{user}...")
        try:
            # Prende gli ultimi 3 tweet
            tweets = scraper.get_tweets(user, mode='user', number=3)
            
            for tweet in tweets['tweets']:
                text = tweet['text']
                if len(text) < 50: continue
                
                # ID univoco
                tid = tweet['link'].split('/')[-1] if 'link' in tweet else str(random.randint(1000,9999))
                unique_id = f"tw_{user}_{tid}"
                
                if unique_id in existing_ids: continue
                
                # Estrazione Immagine dal tweet (se c'è)
                img_url = None
                if tweet['pictures']:
                    img_url = tweet['pictures'][0]
                
                ai_result = analyze_with_ai(text, user, "X", img_url)
                
                if ai_result:
                    ai_result['original_id'] = unique_id
                    ai_result['source_url'] = tweet['link']
                    new_events.append(ai_result)
                    existing_ids.add(unique_id)

        except Exception as e:
            print(f"   ⚠️ Errore su {user} (Rate limit o Nitter down): {e}")
            
    return new_events

# ==========================================
# 🚀 MAIN LOOP
# ==========================================

async def main():
    print("=== 🌍 IMPACT ATLAS OSINT AGENT AVVIATO ===")
    
    # 1. Carica DB esistente
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            geojson = json.load(f)
            # Crea un set di ID già presenti per non duplicare
            existing_ids = set()
            for feat in geojson['features']:
                if 'original_id' in feat['properties']:
                    existing_ids.add(feat['properties']['original_id'])
            print(f"📂 Database caricato: {len(geojson['features'])} eventi esistenti.")
    else:
        geojson = {"type": "FeatureCollection", "features": []}
        existing_ids = set()

    # 2. Esegui Scraping
    # Telegram (Async)
    tg_data = await scrape_telegram(existing_ids)
    
    # Twitter (Sync - Nitter è bloccante)
    tw_data = scrape_twitter(existing_ids)
    
    all_new_data = tg_data + tw_data
    
    if not all_new_data:
        print("\n💤 Nessun nuovo evento rilevato.")
        return

    # 3. Converti in GeoJSON Features e Salva
    print(f"\n💾 Salvataggio di {len(all_new_data)} nuovi eventi...")
    
    for item in all_new_data:
        # Pulizia item per metterlo in properties
        props = item.copy()
        lat = props.pop('lat')
        lon = props.pop('lon')
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat] # GeoJSON vuole [lon, lat]
            },
            "properties": props
        }
        geojson['features'].append(feature)

    # Scrittura su file
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2, ensure_ascii=False)

    print("✅ AGGIORNAMENTO COMPLETATO CON SUCCESSO.")

if __name__ == '__main__':
    # Fix per loop asyncio su alcuni sistemi
    import nest_asyncio
    nest_asyncio.apply()
    
    asyncio.run(main())
