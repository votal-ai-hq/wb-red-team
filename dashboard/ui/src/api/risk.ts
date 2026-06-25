import { apiStream } from "./client";

export function analyzeRisk(
  attacks: unknown[],
  provider?: string,
  model?: string,
) {
  return apiStream("/api/risk-analyze", {
    method: "POST",
    body: JSON.stringify({ attacks, provider, model }),
  });
}
