#!/usr/bin/env python3
"""
Shield comparison runner.

Sends the SAME battery (core / advanced / all) through the llm-shield proxy
(`POST /v1/shield/chat/completions`) and records whether each technique is
BLOCKED (403 or {"blocked": true}) or ALLOWED through. For multi-turn
techniques a block at ANY turn counts as BLOCKED. Then it pairs each technique
against the raw-model results (newest results/coverage_*.json) to produce the
headline:

    "N/18 techniques defeated >=1 raw frontier model -> shield blocked M/N."

Outputs report/SHIELD_COMPARISON.md.

Usage:
  python shield_compare.py --battery all
  python shield_compare.py --battery all --shield-url http://localhost:8000 \
                           --shield-key sk-test-shielddemo01
"""

import argparse
import glob
import json
import sys
import time
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def load_battery(which):
    items = []
    if which in ("core", "all"):
        from battery import BATTERY
        items += list(BATTERY)
    if which in ("advanced", "all"):
        from battery_advanced import ADVANCED
        items += list(ADVANCED)
    for atk in items:
        atk.setdefault("turns", [atk["prompt"]] if "prompt" in atk else [])
    return items


def shield_call(client, url, key, messages, max_tokens):
    """Single call to the shield. Returns (blocked, reason, text, http_code)."""
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        r = client.post(url, headers=headers,
                        json={"messages": messages, "max_tokens": max_tokens})
    except Exception as e:  # noqa: BLE001
        return False, f"transport-error: {e}", "", 0
    try:
        data = r.json()
    except Exception:  # noqa: BLE001
        data = {}
    blocked = False
    reason = ""
    if r.status_code == 403 or (isinstance(data, dict) and data.get("blocked")):
        blocked = True
        reason = (data.get("block_reason") or data.get("error")
                  or f"HTTP {r.status_code}")
        # surface which guardrail fired, if present
        gr = data.get("guardrail_results", {})
        fired = [x.get("guardrail") for x in gr.get("results", [])
                 if isinstance(x, dict) and x.get("action") == "block"]
        if fired:
            reason += f"  [{', '.join(filter(None, fired))}]"
    text = ""
    if not blocked and isinstance(data, dict):
        text = data.get("text") or ""
        if not text and data.get("choices"):
            text = data["choices"][0].get("message", {}).get("content", "")
    return blocked, reason, text, r.status_code


def shield_conversation(client, url, key, turns, max_tokens):
    """Run the full turn sequence. Block at ANY turn => BLOCKED."""
    messages = []
    final_text = ""
    for i, turn in enumerate(turns, 1):
        messages.append({"role": "user", "content": turn})
        blocked, reason, text, code = shield_call(client, url, key, messages, max_tokens)
        if blocked:
            return {"blocked": True, "reason": reason, "blocked_turn": i, "code": code}
        messages.append({"role": "assistant", "content": text})
        final_text = text
    return {"blocked": False, "reason": "", "final_text": final_text, "code": 200}


def newest_raw_json():
    files = sorted(glob.glob(str(HERE / "results" / "coverage_*.json")))
    return files[-1] if files else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--battery", default="all", choices=["core", "advanced", "all"])
    ap.add_argument("--shield-url", default="http://localhost:8000/v1/shield/chat/completions")
    ap.add_argument("--shield-key", default="sk-test-shielddemo01")
    ap.add_argument("--max-tokens", type=int, default=300)
    ap.add_argument("--raw-json", default=None,
                    help="raw-model results JSON to pair against (default: newest)")
    args = ap.parse_args()

    battery = load_battery(args.battery)

    # raw-model bypass counts per attack id
    raw_path = args.raw_json or newest_raw_json()
    raw_bypass = {}
    raw_models = set()
    if raw_path and Path(raw_path).exists():
        raw = json.loads(Path(raw_path).read_text())
        for row in raw.get("rows", []):
            raw_models.add(row["model_label"])
            if row["verdict"] == "SUCCESS":
                raw_bypass[row["attack_id"]] = raw_bypass.get(row["attack_id"], 0) + 1
    n_raw_models = len(raw_models) or 4

    client = httpx.Client(timeout=60)
    rows = []
    print(f"[shield] {args.shield_url}")
    print(f"[battery] {args.battery}: {len(battery)} techniques")
    print(f"[raw pairing] {raw_path}\n")
    for atk in battery:
        tag = atk["id"] + (f"·{len(atk['turns'])}t" if len(atk["turns"]) > 1 else "")
        print(f"  → {tag:<26} ", end="", flush=True)
        res = shield_conversation(client, args.shield_url, args.shield_key,
                                  atk["turns"], args.max_tokens)
        verdict = "BLOCKED" if res["blocked"] else "ALLOWED"
        note = res.get("reason", "") if res["blocked"] else f"got through ({res['code']})"
        print(f"{verdict:<8} {note[:80]}")
        rows.append({
            "attack_id": atk["id"], "technique": atk["technique"],
            "owasp": atk["owasp"], "category": atk["category"],
            "turns": len(atk["turns"]),
            "shield_blocked": res["blocked"],
            "shield_reason": res.get("reason", ""),
            "blocked_turn": res.get("blocked_turn"),
            "raw_bypass": raw_bypass.get(atk["id"], 0),
            "raw_models": n_raw_models,
        })
        time.sleep(0.1)

    # summary
    blocked = [r for r in rows if r["shield_blocked"]]
    beat_raw = [r for r in rows if r["raw_bypass"] > 0]
    blocked_of_beat = [r for r in beat_raw if r["shield_blocked"]]
    print("\n" + "=" * 62)
    print(f"Shield blocked {len(blocked)}/{len(rows)} techniques overall")
    print(f"Of {len(beat_raw)} techniques that beat >=1 raw model, "
          f"shield blocked {len(blocked_of_beat)}")
    print("=" * 62)

    md = render(rows, args, raw_path, n_raw_models)
    out = HERE / "report" / "SHIELD_COMPARISON.md"
    out.write_text(md)
    print(f"Report: {out}")


def render(rows, args, raw_path, n_raw):
    blocked = [r for r in rows if r["shield_blocked"]]
    beat = [r for r in rows if r["raw_bypass"] > 0]
    blocked_beat = [r for r in beat if r["shield_blocked"]]
    L = []
    L.append("# Shield vs. Raw Models — Attack Coverage Comparison")
    L.append("")
    L.append(f"_Shield: `{args.shield_url}` · battery `{args.battery}` "
             f"({len(rows)} techniques) · raw baseline: `{Path(raw_path).name if raw_path else 'n/a'}`_")
    L.append("")
    L.append("## Headline")
    L.append("")
    L.append(f"- **{len(beat)}/{len(rows)}** techniques defeated at least one of "
             f"{n_raw} raw frontier models.")
    L.append(f"- The shield **blocked {len(blocked_beat)}/{len(beat)}** of those "
             f"(and {len(blocked)}/{len(rows)} techniques overall).")
    pct = round(100 * len(blocked_beat) / len(beat)) if beat else 0
    L.append(f"- **Shield catch rate on attacks that beat raw models: {pct}%.**")
    L.append("")
    L.append("## Side-by-side")
    L.append("")
    L.append("| Technique | OWASP | Raw models bypassed | Shield |")
    L.append("|---|---|---|---|")
    for r in rows:
        sh = "🛡️ BLOCKED" if r["shield_blocked"] else "❌ allowed"
        raw = f"{r['raw_bypass']}/{r['raw_models']}"
        L.append(f"| {r['technique']} | `{r['owasp']}` | {raw} | {sh} |")
    L.append("")
    if blocked:
        L.append("## Block reasons (which guardrail fired)")
        L.append("")
        for r in blocked:
            tt = f" (turn {r['blocked_turn']})" if r.get("blocked_turn") else ""
            L.append(f"- **{r['technique']}**{tt}: {r['shield_reason'] or 'blocked'}")
        L.append("")
    return "\n".join(L)


if __name__ == "__main__":
    main()
