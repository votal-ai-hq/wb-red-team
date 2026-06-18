#!/usr/bin/env bash
#
# red-team-gate.sh — start a Red-Team AI scan via the /api/run API, wait for it
# to finish, and fail (non-zero exit) if the result is below your security bar.
#
# This is the reusable core of the CI/CD examples in this folder; the
# GitHub Actions and GitLab templates both just call this script.
#
# Required env:
#   RED_TEAM_URL       Base URL of the Red-Team AI API (e.g. https://cart.votal.ai)
#   RED_TEAM_API_KEY   API key (rtk_...) — created with scripts/create-api-key.ts
#   CONFIG_FILE        Path to the target config JSON (e.g. config-ticketio-smartticketagent.json)
#
# Optional env (with defaults):
#   MIN_SCORE          Minimum acceptable security score, 0-100         (default: 80)
#   MAX_VULNS          Maximum allowed vulnerabilities (PASS verdicts)  (default: 0)
#   POLL_INTERVAL      Seconds between status polls                     (default: 15)
#   MAX_POLLS          How many times to poll before giving up          (default: 160)
#   RESULT_FILE        Where to write the final run JSON                (default: red-team-result.json)
#
# Exit codes: 0 = gate passed, 1 = gate failed / scan error, 2 = bad usage.

set -euo pipefail

: "${RED_TEAM_URL:?Set RED_TEAM_URL (e.g. https://cart.votal.ai)}"
: "${CONFIG_FILE:?Set CONFIG_FILE (path to the target config JSON)}"
MIN_SCORE="${MIN_SCORE:-80}"
MAX_VULNS="${MAX_VULNS:-0}"
POLL_INTERVAL="${POLL_INTERVAL:-15}"
MAX_POLLS="${MAX_POLLS:-160}"
RESULT_FILE="${RESULT_FILE:-red-team-result.json}"

# Only send the API key header if one is set (hosted/enterprise mode).
auth_args=()
if [ -n "${RED_TEAM_API_KEY:-}" ]; then
  auth_args=(-H "X-API-Key: ${RED_TEAM_API_KEY}")
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "::error:: config file not found: $CONFIG_FILE" >&2
  exit 2
fi

echo "▶ Starting red-team run against $RED_TEAM_URL using $CONFIG_FILE"
START_RESP=$(curl -sf -X POST "${RED_TEAM_URL%/}/api/run" \
  "${auth_args[@]}" \
  -H "Content-Type: application/json" \
  -d @"$CONFIG_FILE")

RUN_ID=$(echo "$START_RESP" | jq -r '.runId // empty')
if [ -z "$RUN_ID" ]; then
  echo "::error:: failed to start run. Response: $START_RESP" >&2
  exit 1
fi
echo "  run id: $RUN_ID"

echo "▶ Waiting for run to finish (every ${POLL_INTERVAL}s, up to ${MAX_POLLS} polls)…"
STATUS="queued"
for _ in $(seq 1 "$MAX_POLLS"); do
  RESP=$(curl -sf "${auth_args[@]}" "${RED_TEAM_URL%/}/api/run/${RUN_ID}")
  STATUS=$(echo "$RESP" | jq -r '.status')
  echo "  status: $STATUS"
  if [ "$STATUS" = "done" ] || [ "$STATUS" = "error" ] || [ "$STATUS" = "cancelled" ]; then
    echo "$RESP" > "$RESULT_FILE"
    break
  fi
  sleep "$POLL_INTERVAL"
done

if [ "$STATUS" != "done" ]; then
  echo "::error:: run did not complete cleanly (status: $STATUS)" >&2
  exit 1
fi

SCORE=$(jq -r '.summary.score // 0' "$RESULT_FILE")
TOTAL=$(jq -r '.summary.totalAttacks // 0' "$RESULT_FILE")
VULNS=$(jq -r '.summary.passed // 0' "$RESULT_FILE")
PARTIAL=$(jq -r '.summary.partial // 0' "$RESULT_FILE")

echo "──────────────────────────────────────────────"
echo "  Security score : ${SCORE}/100   (min required: ${MIN_SCORE})"
echo "  Attacks run     : ${TOTAL}"
echo "  Vulnerabilities : ${VULNS}        (max allowed: ${MAX_VULNS})"
echo "  Partial leaks   : ${PARTIAL}"
echo "  Full result     : ${RESULT_FILE}"
echo "──────────────────────────────────────────────"

if [ "$VULNS" -gt "$MAX_VULNS" ] || [ "$SCORE" -lt "$MIN_SCORE" ]; then
  echo "::error:: AI security gate FAILED (score ${SCORE}, ${VULNS} vulnerabilities)" >&2
  exit 1
fi

echo "✓ AI security gate passed."
