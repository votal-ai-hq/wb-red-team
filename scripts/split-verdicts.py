#!/usr/bin/env python3
"""
Split a red-team report into separate PASS and FAIL JSON files.
Also creates a summary JSON with counts by category.

Usage: python3 split-verdicts.py [report-path]
"""

import json
import sys

REPORT_PATH = (
    sys.argv[1]
    if len(sys.argv) > 1
    else "report/report-2026-05-26T10-00-07-311Z.json"
)


def main():
    with open(REPORT_PATH) as f:
        report = json.load(f)

    pass_results = []
    fail_results = []
    partial_results = []
    error_results = []

    for rnd in report["rounds"]:
        for result in rnd["results"]:
            verdict = result.get("verdict", "UNKNOWN")
            entry = {
                "attack_id": result.get("attack", {}).get("id", ""),
                "attack_name": result.get("attack", {}).get("name", ""),
                "category": result.get("attack", {}).get("category", ""),
                "severity": result.get("attack", {}).get("severity", ""),
                "strategy": result.get("attack", {}).get("strategyName", ""),
                "verdict": verdict,
                "message": result.get("attack", {}).get("payload", {}).get("message", ""),
                "response": result.get("responseBody", ""),
                "response_time_ms": result.get("responseTimeMs", 0),
                "findings": result.get("findings", []),
                "llm_reasoning": result.get("llmReasoning", ""),
            }

            if verdict == "PASS":
                pass_results.append(entry)
            elif verdict == "FAIL":
                fail_results.append(entry)
            elif verdict == "PARTIAL":
                partial_results.append(entry)
            else:
                error_results.append(entry)

    # Category breakdown
    def category_counts(results):
        counts = {}
        for r in results:
            cat = r["category"]
            counts[cat] = counts.get(cat, 0) + 1
        return dict(sorted(counts.items(), key=lambda x: -x[1]))

    summary = {
        "source_report": REPORT_PATH,
        "total": len(pass_results) + len(fail_results) + len(partial_results) + len(error_results),
        "pass_count": len(pass_results),
        "fail_count": len(fail_results),
        "partial_count": len(partial_results),
        "error_count": len(error_results),
        "pass_by_category": category_counts(pass_results),
        "fail_by_category": category_counts(fail_results),
        "partial_by_category": category_counts(partial_results),
    }

    base = REPORT_PATH.replace(".json", "")
    pass_path = f"{base}-PASS-only.json"
    fail_path = f"{base}-FAIL-only.json"
    summary_path = f"{base}-summary.json"

    with open(pass_path, "w") as f:
        json.dump({"count": len(pass_results), "results": pass_results}, f, indent=2)

    with open(fail_path, "w") as f:
        json.dump({"count": len(fail_results), "results": fail_results}, f, indent=2)

    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"PASS: {len(pass_results)} -> {pass_path}")
    print(f"FAIL: {len(fail_results)} -> {fail_path}")
    print(f"PARTIAL: {len(partial_results)}")
    print(f"ERROR: {len(error_results)}")
    print(f"Summary -> {summary_path}")
    print()
    print("PASS by category:")
    for cat, n in category_counts(pass_results).items():
        print(f"  {cat}: {n}")
    print()
    print("FAIL by category:")
    for cat, n in category_counts(fail_results).items():
        print(f"  {cat}: {n}")


if __name__ == "__main__":
    main()
