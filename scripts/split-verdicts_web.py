#!/usr/bin/env python3
"""
Split a red-team report into separate PASS, FAIL, PARTIAL, and ERROR JSON files.
Also creates a summary JSON with counts by category and severity.

Works with both CLI (npx tsx red-team.ts) and web UI report formats.

Usage: python3 split-verdicts_web.py [report-path]
"""

import json
import sys

REPORT_PATH = (
    sys.argv[1]
    if len(sys.argv) > 1
    else "/Users/jyotirmoysundi/Downloads/report-2026-05-27T19-26-11-791Z.json"
)


def main():
    with open(REPORT_PATH) as f:
        report = json.load(f)

    pass_results = []
    fail_results = []
    partial_results = []
    error_results = []

    for rnd in report.get("rounds", []):
        for result in rnd.get("results", []):
            verdict = result.get("verdict", "UNKNOWN")
            attack = result.get("attack", {})
            payload = attack.get("payload", {})
            message = payload.get("message", "") if isinstance(payload, dict) else ""

            entry = {
                "attack_id": attack.get("id", ""),
                "attack_name": attack.get("name", ""),
                "category": attack.get("category", ""),
                "severity": attack.get("severity", ""),
                "strategy": attack.get("strategyName", ""),
                "verdict": verdict,
                "message": message,
                "response": result.get("responseBody", ""),
                "response_time_ms": result.get("responseTimeMs", 0),
                "findings": result.get("findings", []),
                "llm_reasoning": result.get("llmReasoning", ""),
                "judge_confidence": result.get("judgeConfidence"),
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

    # Severity breakdown
    def severity_counts(results):
        counts = {}
        for r in results:
            sev = r["severity"] or "unknown"
            counts[sev] = counts.get(sev, 0) + 1
        return dict(sorted(counts.items(), key=lambda x: -x[1]))

    total = len(pass_results) + len(fail_results) + len(partial_results) + len(error_results)
    summary = {
        "source_report": REPORT_PATH,
        "total": total,
        "pass_count": len(pass_results),
        "fail_count": len(fail_results),
        "partial_count": len(partial_results),
        "error_count": len(error_results),
        "pass_rate": round(len(pass_results) / total * 100, 1) if total else 0,
        "security_score": round((len(fail_results) + len(error_results)) / total * 100) if total else 0,
        "pass_by_category": category_counts(pass_results),
        "fail_by_category": category_counts(fail_results),
        "partial_by_category": category_counts(partial_results),
        "pass_by_severity": severity_counts(pass_results),
        "fail_by_severity": severity_counts(fail_results),
    }

    base = REPORT_PATH.replace(".json", "")
    pass_path = f"{base}-PASS-only.json"
    fail_path = f"{base}-FAIL-only.json"
    partial_path = f"{base}-PARTIAL-only.json"
    error_path = f"{base}-ERROR-only.json"
    summary_path = f"{base}-summary.json"

    with open(pass_path, "w") as f:
        json.dump({"count": len(pass_results), "results": pass_results}, f, indent=2)

    with open(fail_path, "w") as f:
        json.dump({"count": len(fail_results), "results": fail_results}, f, indent=2)

    if partial_results:
        with open(partial_path, "w") as f:
            json.dump({"count": len(partial_results), "results": partial_results}, f, indent=2)

    if error_results:
        with open(error_path, "w") as f:
            json.dump({"count": len(error_results), "results": error_results}, f, indent=2)

    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"Total: {total}")
    print(f"PASS:    {len(pass_results):>4} -> {pass_path}")
    print(f"FAIL:    {len(fail_results):>4} -> {fail_path}")
    print(f"PARTIAL: {len(partial_results):>4}" + (f" -> {partial_path}" if partial_results else ""))
    print(f"ERROR:   {len(error_results):>4}" + (f" -> {error_path}" if error_results else ""))
    print(f"Summary: {summary_path}")
    print(f"\nSecurity Score: {summary['security_score']}/100 (higher = more secure)")
    print(f"Pass Rate: {summary['pass_rate']}% (lower = more secure)")

    print(f"\nPASS by category ({len(summary['pass_by_category'])} categories):")
    for cat, n in list(summary["pass_by_category"].items())[:20]:
        print(f"  {cat}: {n}")
    if len(summary["pass_by_category"]) > 20:
        print(f"  ... and {len(summary['pass_by_category']) - 20} more")

    print(f"\nPASS by severity:")
    for sev, n in summary["pass_by_severity"].items():
        print(f"  {sev}: {n}")

    print(f"\nFAIL by category ({len(summary['fail_by_category'])} categories):")
    for cat, n in list(summary["fail_by_category"].items())[:20]:
        print(f"  {cat}: {n}")
    if len(summary["fail_by_category"]) > 20:
        print(f"  ... and {len(summary['fail_by_category']) - 20} more")


if __name__ == "__main__":
    main()
