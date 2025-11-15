import csv, json, sys, requests
from io import StringIO

def csv_to_timeline(csv_url, output_file):
    print("Scarico CSV...")
    r = requests.get(csv_url)
    r.encoding = "utf-8"

    if r.status_code != 200:
        print("ERRORE nel download:", r.status_code)
        sys.exit(1)

    f = StringIO(r.text)
    reader = csv.DictReader(f)

    timeline = {
        "title": {
            "text": {
                "headline": "Attacchi dell'Ucraina alle raffinerie russe",
                "text": "Cronologia degli attacchi. Dati OSINT aggiornati automaticamente."
            }
        },
        "events": []
    }

    print("Creo evento per ogni riga...")
    for row in reader:
        if not row.get("date") or not row.get("title"):
            continue

        try:
            year, month, day = row["date"].split("-")
        except:
            continue

        event = {
            "start_date": {
                "year": year,
                "month": month,
                "day": day
            },
            "text": {
                "headline": row["title"],
                "text": (
                    f"Tipo: {row.get('type','')}<br>"
                    f"Luogo: {row.get('location','')}<br>"
                    f"Fonte: <a href='{row.get('source','')}'>link</a><br>"
                    f"Note: {row.get('notes','')}"
                )
            }
        }

        if row.get("latitude") and row.get("longitude"):
            event["location"] = {
                "lat": row["latitude"],
                "lon": row["longitude"]
            }

        timeline["events"].append(event)

    print(f"Scrivo JSON: {output_file}")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(timeline, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    csv_url = sys.argv[1]
    out = sys.argv[2]
    csv_to_timeline(csv_url, out)
