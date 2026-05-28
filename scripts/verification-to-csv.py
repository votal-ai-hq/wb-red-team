#!/usr/bin/env python3
"""
Convert a verification JSON to CSV format compatible with safety benchmarks.

Columns:
  id, prompt, response, prompt_label, response_label,
  violated_categories, prompt_label_source, response_label_source, tag

Usage: python3 scripts/verification-to-csv.py <verification.json> [output.csv]
"""

import csv
import json
import sys

if len(sys.argv) < 2:
    print("Usage: python3 verification-to-csv.py <verification.json> [output.csv]")
    sys.exit(1)

INPUT_PATH = sys.argv[1]
OUTPUT_PATH = sys.argv[2] if len(sys.argv) > 2 else INPUT_PATH.replace(".json", ".csv")

COLUMNS = [
    "id",
    "prompt",
    "response",
    "prompt_label",
    "response_label",
    "violated_categories",
    "prompt_label_source",
    "response_label_source",
    "tag",
]


def classify_prompt_label(entry: dict) -> str:
    """Classify the prompt as safe/unsafe based on the attack category."""
    # These are adversarial prompts — they are all unsafe by design
    return "unsafe"


def classify_response_label(entry: dict) -> str:
    """Classify the response based on nemotron and Claude verdicts."""
    nemo_rerun = entry.get("comparison", {}).get("nemotron_rerun", {})
    nemo_verdict = nemo_rerun.get("verdict", "")
    claude = entry.get("comparison", {}).get("claude_opus", {})
    claude_blocked = claude.get("blocked")

    # nemotron said safe (attack succeeded) = unsafe response
    # nemotron said unsafe (attack blocked) = safe response
    if nemo_verdict == "FAIL":
        return "safe"
    elif nemo_verdict == "PASS":
        # nemotron missed it — check Claude
        if claude_blocked is True:
            return "unsafe"  # nemotron said safe but Claude caught it
        elif claude_blocked is False:
            return "unsafe"  # both missed it
        else:
            return "unsafe"  # nemotron said safe = response is unsafe
    return "unknown"


def get_response_label_source(entry: dict) -> str:
    """Describe which models contributed to the label."""
    nemo_verdict = entry.get("comparison", {}).get("nemotron_rerun", {}).get("verdict", "")
    claude = entry.get("comparison", {}).get("claude_opus", {})
    claude_blocked = claude.get("blocked")

    sources = []
    if nemo_verdict in ("PASS", "FAIL"):
        sources.append(f"nemotron-safety:{nemo_verdict}")
    if claude_blocked is not None:
        sources.append(f"claude-opus:{'BLOCKED' if claude_blocked else 'ALLOWED'}")

    judge = claude.get("judge", {})
    if judge.get("reasoning"):
        sources.append(f"judge:{judge.get('confidence', '?')}%")

    return "; ".join(sources) if sources else "unknown"


def get_response_text(entry: dict) -> str:
    """Get the most relevant response text."""
    # Prefer nemotron rerun response (the actual safety classifier output)
    nemo = entry.get("comparison", {}).get("nemotron_rerun", {}).get("response", "")
    if nemo:
        return nemo
    return entry.get("comparison", {}).get("nemotron_original", {}).get("response", "")


def build_tag(entry: dict) -> str:
    """Build a tag combining final verdict, severity, and strategy info."""
    parts = [
        entry.get("final_verdict", ""),
        entry.get("severity", ""),
    ]
    return "|".join(p for p in parts if p)


def main():
    with open(INPUT_PATH) as f:
        data = json.load(f)

    results = data.get("results", [])
    print(f"Converting {len(results)} entries from {INPUT_PATH}")

    rows = []
    for entry in results:
        row = {
            "id": entry.get("attack_id", ""),
            "prompt": entry.get("message", ""),
            "response": get_response_text(entry),
            "prompt_label": classify_prompt_label(entry),
            "response_label": classify_response_label(entry),
            "violated_categories": entry.get("category", ""),
            "prompt_label_source": "red-team-framework",
            "response_label_source": get_response_label_source(entry),
            "tag": build_tag(entry),
        }
        rows.append(row)

    # Write CSV
    with open(OUTPUT_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(rows)

    # Write JSONL
    jsonl_path = OUTPUT_PATH.replace(".csv", ".jsonl")
    with open(jsonl_path, "w") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")

    # Summary
    labels = {}
    for r in rows:
        labels[r["response_label"]] = labels.get(r["response_label"], 0) + 1

    print(f"Written {len(rows)} rows to {OUTPUT_PATH}")
    print(f"Written {len(rows)} rows to {jsonl_path}")
    print(f"Response labels: {labels}")


if __name__ == "__main__":
    main()
