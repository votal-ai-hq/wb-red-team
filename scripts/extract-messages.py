#!/usr/bin/env python3
"""Extract all attack payload messages from a report JSON file, one per line."""

import json
import sys

INPUT = sys.argv[1] if len(sys.argv) > 1 else "/Users/jyotirmoysundi/Downloads/report-2026-05-31T07-03-24-829Z.json"
OUTPUT = sys.argv[2] if len(sys.argv) > 2 else INPUT.rsplit(".", 1)[0] + "-messages.jsonl"

with open(INPUT) as f:
    data = json.load(f)

rows = []
for rnd in data.get("rounds", []):
    for result in rnd.get("results", []):
        attack = result.get("attack", {})
        msg = attack.get("payload", {}).get("message")
        if msg:
            rows.append({
                "message": msg,
                "strategyId": attack.get("strategyId"),
                "strategyName": attack.get("strategyName"),
                "category": attack.get("category"),
            })

with open(OUTPUT, "w") as f:
    for row in rows:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

print(f"Extracted {len(rows)} messages to {OUTPUT}")
