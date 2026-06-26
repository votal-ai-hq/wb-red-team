import { apiFetch } from "./client";
import type { ReferenceData } from "./types";

export function getReference() {
  return apiFetch<ReferenceData>("/api/reference");
}
