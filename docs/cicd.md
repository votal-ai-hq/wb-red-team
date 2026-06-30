---
title: CI/CD Integration
parent: Deploy & Operate
nav_order: 3
---

# CI/CD Integration

Run Red-Team AI as a **security gate** in your delivery pipeline: every pull
request (and on a nightly schedule) starts a red-team scan against your
AI-enabled application, and the build fails if the result is below your
security bar. This page walks through the full end-to-end testing lifecycle.

Ready-to-copy templates live in
[`examples/cicd/`](https://github.com/sundi133/wb-red-team/tree/main/examples/cicd):
a reusable gate script plus GitHub Actions and GitLab CI workflows. They sit
under `examples/` on purpose so they don't run on this repository — copy them
into your own app repo to activate them.

## The end-to-end lifecycle

1. **Define the target as config** — version-control a config JSON next to your
   app (see [Configuration]({{ site.baseurl }}/configuration/) and
   [API-Only Testing]({{ site.baseurl }}/api-only/)). It declares the endpoint,
   request/response schema, sensitive-data patterns, judge policy, and the
   attack categories/strategies to run.
2. **Trigger the scan** — `POST /api/run` with that config (hosted or
   self-hosted), or run the CLI in-job for source-aware white-box testing.
3. **Validate** — every response is scored PASS / PARTIAL / FAIL by an
   LLM-as-judge against the policy, with reasoning and a confidence score (not
   keyword matching). See [Judge Evaluation]({{ site.baseurl }}/judge-evaluation-prompt/).
4. **Gate** — the pipeline reads the run summary and fails the build if the
   security score is below threshold or any vulnerability (PASS) was found.
5. **Report** — JSON + Markdown artifacts (score, per-category breakdown,
   [compliance mapping]({{ site.baseurl }}/compliance/), per-finding
   remediation) are uploaded as build artifacts and shown in the
   [Dashboard]({{ site.baseurl }}/dashboard/).

## The API contract

The gate is built on the async run API exposed by the dashboard server
(`POST /api/run` is the same endpoint whether self-hosted at
`http://localhost:4200` or hosted at `https://cart.votal.ai`):

```
POST   /api/run        body: target config JSON  ->  { "runId": "..." }
GET    /api/run/<id>                              ->  { "status": "queued|running|done|error|cancelled",
                                                        "summary": { "score", "totalAttacks",
                                                                     "passed", "partial", "failed" },
                                                        "reportFile": "..." }
DELETE /api/run/<id>                              ->  cancel a run
```

`summary.passed` is the number of attacks that reproduced a vulnerability — a
non-zero value should fail the build. `summary.score` is the 0–100 security
score.

### Authentication

For hosted or enterprise (multi-tenant) deployments, create a key and pass it as
`X-API-Key`:

```bash
npx tsx scripts/create-api-key.ts --tenant default --role admin --name "CI pipeline"
# -> rtk_a1b2c3...

curl -X POST https://cart.votal.ai/api/run \
  -H "X-API-Key: rtk_a1b2c3..." \
  -H "Content-Type: application/json" \
  -d @config-ticketio-smartticketagent.json
```

## GitHub Actions

Copy [`examples/cicd/github-actions-ai-security-gate.yml`](https://github.com/sundi133/wb-red-team/blob/main/examples/cicd/github-actions-ai-security-gate.yml)
to `.github/workflows/ai-security-gate.yml` and
[`examples/cicd/red-team-gate.sh`](https://github.com/sundi133/wb-red-team/blob/main/examples/cicd/red-team-gate.sh)
into your repo, then add the `RED_TEAM_API_KEY` repo secret.

```yaml
name: ai-security-gate
on:
  pull_request:
  schedule:
    - cron: "0 3 * * *"
jobs:
  red-team:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run AI security gate
        env:
          RED_TEAM_URL: https://cart.votal.ai
          RED_TEAM_API_KEY: ${{ secrets.RED_TEAM_API_KEY }}
          CONFIG_FILE: config-ticketio-smartticketagent.json
          MIN_SCORE: "80"
          MAX_VULNS: "0"
        run: |
          chmod +x examples/cicd/red-team-gate.sh
          ./examples/cicd/red-team-gate.sh
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: red-team-report
          path: red-team-result.json
```

## GitLab CI

See [`examples/cicd/gitlab-ci-ai-security-gate.yml`](https://github.com/sundi133/wb-red-team/blob/main/examples/cicd/gitlab-ci-ai-security-gate.yml).
The job calls the same `red-team-gate.sh` and gates on `MIN_SCORE` / `MAX_VULNS`.

## The gate script

Both templates call [`examples/cicd/red-team-gate.sh`](https://github.com/sundi133/wb-red-team/blob/main/examples/cicd/red-team-gate.sh),
which starts the run, polls until it finishes, prints a summary, and exits
non-zero if `summary.passed > MAX_VULNS` or `summary.score < MIN_SCORE`.

Tunable via env: `RED_TEAM_URL`, `RED_TEAM_API_KEY`, `CONFIG_FILE`,
`MIN_SCORE` (default 80), `MAX_VULNS` (default 0), `POLL_INTERVAL` (15s),
`MAX_POLLS` (160).

## Self-hosted, source-aware variant

If your app's source is in the same repo, run the scanner inside the job so it
also reads the codebase (tools, roles, guardrails, hardcoded secrets) and
[tailors attacks]({{ site.baseurl }}/white-box/) to the implementation:

```bash
npx tsx red-team.ts config-ticketio-smartticketagent.json
SCORE=$(jq -r '.summary.score' report/report-*.json | tail -1)
[ "$SCORE" -ge 80 ] || { echo "AI security gate failed: $SCORE"; exit 1; }
```

> Note: the CLI exits non-zero only on fatal errors — it does not self-gate on
> score. Enforce your threshold in the pipeline by reading `summary.score` /
> `summary.passed` from the report, as shown above.

## Where else this fits

The same `/api/run` contract works outside CI too: a pre-deploy approval gate, a
release step, a cron-driven nightly scan, or a webhook fired when the model,
system prompt, or tool set changes.
