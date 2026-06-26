import { apiFetch } from "./client";
import type { ReportsMetaResponse, FullReport } from "./types";

export function getReportsMeta(page = 1, limit = 50, search = "") {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set("search", search);
  return apiFetch<ReportsMetaResponse>(`/api/reports-meta?${params}`);
}

export function getReport(filename: string, slim = true) {
  return apiFetch<FullReport>(`/api/report/${filename}${slim ? "?slim=1" : ""}`);
}

export function deleteReport(filename: string) {
  return apiFetch<void>(`/api/report/${filename}`, { method: "DELETE" });
}

export function getReportCsvUrl(filename: string) {
  return `/api/report-csv/${filename}`;
}
