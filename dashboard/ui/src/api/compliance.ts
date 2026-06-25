import { apiFetch, apiStream } from "./client";
import type { ComplianceFramework, ComplianceResult } from "./types";

export function getFrameworks() {
  return apiFetch<ComplianceFramework[]>("/api/compliance-frameworks");
}

export function getStaticCompliance(file: string) {
  return apiFetch<{ results: ComplianceResult[] }>(
    `/api/compliance-static?file=${encodeURIComponent(file)}`,
  );
}

export function analyzeCompliance(
  reportFile: string,
  frameworkIds: string[],
  provider?: string,
  model?: string,
) {
  return apiStream("/api/owasp-analyze", {
    method: "POST",
    body: JSON.stringify({ reportFile, frameworkIds, provider, model }),
  });
}
