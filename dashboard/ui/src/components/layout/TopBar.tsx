import { useLocation } from "react-router";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { Menu, Search } from "lucide-react";
import * as authApi from "@/api/auth";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/scans": "Scan Activity",
  "/new-scan": "Launch Scan",
  "/reports": "Reports",
  "/risk": "Risk Analysis",
  "/compliance": "Compliance",
  "/activity-log": "Activity Log",
  "/policies": "Policies",
};

function getTitle(pathname: string) {
  for (const [prefix, title] of Object.entries(TITLES)) {
    if (pathname.startsWith(prefix)) return title;
  }
  return "Dashboard";
}

export function TopBar() {
  const location = useLocation();
  const toggleNav = useUIStore((s) => s.toggleNav);
  const { user, authMode, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    logout();
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "?";

  return (
    <header className="h-14 shrink-0 flex items-center gap-4 px-5 border-b border-border bg-white/85">
      <button
        onClick={toggleNav}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
      >
        <Menu className="w-[18px] h-[18px] text-muted-foreground" />
      </button>

      <h1 className="text-base font-semibold text-foreground tracking-tight">
        {getTitle(location.pathname)}
      </h1>

      <div className="hidden sm:flex items-center gap-2 flex-1 max-w-md ml-4 px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground text-sm">
        <Search className="w-4 h-4 opacity-50" />
        <input
          type="search"
          placeholder="Search scans, reports, risks..."
          className="bg-transparent outline-none flex-1 text-foreground placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="flex-1" />

      {(authMode === "simple" || authMode === "oidc") && user && (
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-white border-2 border-white shadow-sm">
            {initials}
          </div>
          <span className="hidden md:inline">{user.username}</span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
