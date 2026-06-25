import { apiFetch } from "./client";
import type { GuardrailReportMeta, GuardrailReport } from "./types";

export function getGuardrailReports() {
  return apiFetch<GuardrailReportMeta[]>("/api/litellm-reports");
}

export function getGuardrailReport(filename: string) {
  return apiFetch<GuardrailReport>(`/api/litellm-report/${filename}`);
}

export function uploadGuardrailReport(data: unknown) {
  return apiFetch<{ filename: string }>("/api/litellm-report-upload", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
