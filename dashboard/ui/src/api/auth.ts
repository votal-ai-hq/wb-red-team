import { apiFetch } from "./client";
import type { AuthConfig, AuthUser } from "./types";

export function getAuthConfig() {
  return apiFetch<AuthConfig>("/api/auth-config");
}

export function login(username: string, password: string, captchaToken?: string) {
  return apiFetch<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password, captchaToken }),
  });
}

export function logout() {
  return apiFetch<void>("/api/auth/logout", { method: "POST" });
}

export function getMe() {
  return apiFetch<{ user: AuthUser }>("/api/auth/me");
}
