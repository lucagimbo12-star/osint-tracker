import csv
import json
import sys
from datetime import datetime

def normalize_date(d):
    """Converte date tipo 26/10/25 → (2025, 10, 26)"""
    d = d.strip()
    parts = d.split("/")

    if len(parts) != 3:
        raise ValueError(f"Formato data non valido: {d}")

    day, month, year = parts

    # esempio: 25 → 2025
    if len(year) == 2:
        year = "20" + year

    return int(year), int(month), int(day)

def main(input_csv, output_json):
    events = []

    with open(input_csv, newline='', encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            try:
                y, m, d = normalize_date(row["date"])
            except Exception as e:
                print(f"Errore data: {e}")
                continue

            headline = row["title"].strip() if row["title"] else "Evento"

            # descrizione HTML
            text_parts = []
            if row.get("location"): text_parts.append(f"Luogo: {row['location']}")
            if row.get("source"): text_parts.append(f"<br>Fonte: <a href='{row['source']}'>link</a>")
            if row.get("archived"): text_parts.append(f"<br>Archivio: <a href='{row['archived']}'>archive</a>")
            if row.get("verification"): text_parts.append(f"<br>Verifica: {row['verification']}")
            if row.get("notes"): text_parts.append(f"<br>Note: {row['notes']}")

            description = "".join(text_parts)

            events.append({
                "start_date": {"year": y, "month": m, "day": d},
                "text": {
                    "headline": headline,
                    "text": description
                }
            })

    output = {"events": events}

    with open(output_json, "w", encoding="utf-8") as out:
        json.dump(output, out, ensure_ascii=False, indent=2)

    print(f"Creato JSON timeline con {len(events)} eventi")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
