import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/stores/authStore";
import * as authApi from "@/api/auth";
import { Shield } from "lucide-react";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser, setToken } = useAuthStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { user } = await authApi.login(username, password);
      setUser(user);
      setToken("session");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#f0f2f5] flex items-center justify-center z-[9999]">
      <div className="w-full max-w-[400px] mx-5 bg-white border border-[#e2e6ed] rounded-xl p-10 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-sm">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              Red Team Dashboard
            </h1>
            <p className="text-sm text-text-secondary">
              Sign in with your credentials
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-[#d1d9e6] bg-white text-text-primary text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-[#d1d9e6] bg-white text-text-primary text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 rounded-lg bg-[#1a2433] text-white text-sm font-semibold hover:bg-[#0f1720] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-xs text-text-secondary text-center mt-4">
          Session is shared across tabs with a secure cookie
        </p>
      </div>
    </div>
  );
}
