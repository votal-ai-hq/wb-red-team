# CI/CD examples — AI security gate

Templates for running Red-Team AI as a security gate in a CI/CD pipeline for an
AI-enabled application.

> **These files do not run on this repository.** The workflows live under
> `examples/` (not `.github/workflows/`) so GitHub never picks them up here.
> Copy them into _your_ application repo to activate them.

| File | What it is |
|------|------------|
| `red-team-gate.sh` | Reusable gate: starts a run via `/api/run`, polls until done, fails if the score/vuln count is over the line. Both CI templates call it. |
| `github-actions-ai-security-gate.yml` | GitHub Actions workflow (PR + nightly + manual). Copy to `.github/workflows/`. |
| `gitlab-ci-ai-security-gate.yml` | GitLab CI job. Copy into `.gitlab-ci.yml` or `include:` it. |

## Quick start

1. Copy `red-team-gate.sh` and the workflow for your CI into your app repo.
2. Commit a target config (e.g. `config-ticketio-smartticketagent.json`).
3. Add a secret/variable `RED_TEAM_API_KEY` (create one with
   `npx tsx scripts/create-api-key.ts --tenant default --role admin --name "CI pipeline"`).
4. Tune `MIN_SCORE` and `MAX_VULNS` to your risk tolerance.

## The API contract the gate uses

```
POST /api/run        body: target config JSON   -> { "runId": "..." }
GET  /api/run/<id>                               -> { "status": "queued|running|done|error|cancelled",
                                                      "summary": { "score", "totalAttacks",
                                                                   "passed", "partial", "failed" },
                                                      "reportFile": "..." }
DELETE /api/run/<id>                             -> cancel
```

`summary.passed` = attacks that reproduced a vulnerability (PASS). A non-zero
value means the build should fail.

## Local / self-hosted variant (source-aware)

If the app source is in the same repo, run the scanner in the job instead of
calling a hosted API, so it also reads the codebase (tools, roles, guardrails,
secrets) and tailors attacks:

```bash
npx tsx red-team.ts config-ticketio-smartticketagent.json
SCORE=$(jq -r '.summary.score' report/report-*.json | tail -1)
[ "$SCORE" -ge 80 ] || { echo "gate failed: $SCORE"; exit 1; }
```

See [`docs/cicd.md`](../../docs/cicd.md) for the full lifecycle walkthrough.
