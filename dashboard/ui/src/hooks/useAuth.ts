import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import * as authApi from "@/api/auth";

export function useAuthInit() {
  const { setAuthMode, setUser, setToken, setHcaptchaSiteKey, setClerkPublishableKey, setInitialized } =
    useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const config = await authApi.getAuthConfig();
        if (cancelled) return;

        setAuthMode(config.authMode);
        if (config.hcaptchaSiteKey) setHcaptchaSiteKey(config.hcaptchaSiteKey);
        if (config.clerkPublishableKey) setClerkPublishableKey(config.clerkPublishableKey);

        if (config.authMode === "none" || config.authMode === "dev") {
          setInitialized(true);
          return;
        }

        if (config.authMode === "simple") {
          // Try to restore session
          try {
            const { user } = await authApi.getMe();
            if (!cancelled) {
              setUser(user);
              setToken("session");
            }
          } catch {
            // No active session, will show login
          }
        }

        if (!cancelled) setInitialized(true);
      } catch {
        if (!cancelled) setInitialized(true);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [setAuthMode, setUser, setToken, setHcaptchaSiteKey, setClerkPublishableKey, setInitialized]);
}
