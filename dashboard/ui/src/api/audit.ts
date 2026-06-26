import { apiFetch } from "./client";
import type { AuditLogResponse } from "./types";

export function getAuditLog(limit = 100, offset = 0, action?: string) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (action) params.set("action", action);
  return apiFetch<AuditLogResponse>(`/api/audit-log?${params}`);
}
