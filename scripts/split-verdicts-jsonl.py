#!/usr/bin/env python3
"""Split a verdicts JSONL file into separate files by verdict (PASS, FAIL, ERROR)."""

import json
import sys

if len(sys.argv) < 2:
    print("Usage: python3 scripts/split-verdicts-jsonl.py <input.jsonl>")
    sys.exit(1)

INPUT = sys.argv[1]
base = INPUT.rsplit(".jsonl", 1)[0]

with open(INPUT) as f:
    rows = [json.loads(line) for line in f if line.strip()]

buckets = {}
for row in rows:
    v = row.get("verdict", "UNKNOWN")
    buckets.setdefault(v, []).append(row)

print(f"Total: {len(rows)}")
for verdict, items in sorted(buckets.items()):
    out = f"{base}-{verdict.lower()}.jsonl"
    with open(out, "w") as f:
        for r in items:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"  {verdict}: {len(items)} → {out}")
