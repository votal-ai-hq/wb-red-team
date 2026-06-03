#!/usr/bin/env python3
"""Split a labeled JSONL file into separate files by expected_label (unsafe, safe, error)."""

import json
import sys

if len(sys.argv) < 2:
    print("Usage: python3 scripts/split-by-label.py <input.jsonl>")
    sys.exit(1)

INPUT = sys.argv[1]
base = INPUT.rsplit(".jsonl", 1)[0]

with open(INPUT) as f:
    rows = [json.loads(line) for line in f if line.strip()]

buckets = {}
for row in rows:
    label = row.get("expected_label", "unknown")
    buckets.setdefault(label, []).append(row)

print(f"Total: {len(rows)}")
for label, items in sorted(buckets.items(), key=lambda x: -len(x[1])):
    out = f"{base}-{label}.jsonl"
    with open(out, "w") as f:
        for r in items:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"  {label}: {len(items)} → {out}")
