import { type ReactNode } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useAuthInit } from "@/hooks/useAuth";
import { LoginForm } from "./LoginForm";

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  useAuthInit();

  const { initialized, authMode, user, token } = useAuthStore();

  if (!initialized) {
    return (
      <div className="fixed inset-0 bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">Loading...</span>
        </div>
      </div>
    );
  }

  // No auth needed
  if (authMode === "none" || authMode === "dev") {
    return <>{children}</>;
  }

  // Simple auth - show login if no session
  if (authMode === "simple" && !user && !token) {
    return <LoginForm />;
  }

  // OIDC - would need Clerk integration here
  if (authMode === "oidc" && !user && !token) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
