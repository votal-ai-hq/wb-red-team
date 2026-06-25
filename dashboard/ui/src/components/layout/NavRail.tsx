import { useLocation, useNavigate } from "react-router";
import { useUIStore } from "@/stores/uiStore";
import {
  LayoutDashboard,
  Play,
  PlusCircle,
  FileText,
  AlertTriangle,
  CheckSquare,
  Shield,
  Briefcase,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/scans", label: "Scan Activity", icon: Play },
  { path: "/new-scan", label: "Launch Scan", icon: PlusCircle },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/risk", label: "Risk", icon: AlertTriangle },
  { path: "/compliance", label: "Compliance", icon: CheckSquare },
  { path: "/activity-log", label: "Activity Log", icon: Shield },
  { path: "/policies", label: "Policies", icon: Briefcase },
] as const;

export function NavRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { navCollapsed, toggleNav } = useUIStore();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <aside
      className={`flex flex-col shrink-0 border-r border-border bg-[#fbfcfe] transition-[width] duration-200 ${
        navCollapsed ? "w-[72px]" : "w-[248px]"
      }`}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-3 h-14 px-[18px] border-b border-border cursor-pointer shrink-0 overflow-hidden"
        onClick={() => navigate("/dashboard")}
      >
        <div className="w-9 h-9 shrink-0 rounded-[11px] bg-accent flex items-center justify-center shadow-sm">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!navCollapsed && (
          <span className="text-base font-semibold text-text-primary tracking-tight whitespace-nowrap">
            Red Team <span className="font-normal text-text-secondary ml-0.5">AI</span>
          </span>
        )}
      </div>

      {/* Section label */}
      {!navCollapsed && (
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-secondary px-5 pt-[18px] pb-2">
          Menu
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-1.5 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => {
                navigate(path);
                // Close mobile nav on selection
                if (window.innerWidth < 1100) useUIStore.getState().setNavCollapsed(true);
              }}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors relative group ${
                active
                  ? "text-accent bg-accent-bg-subtle font-semibold"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface2"
              } ${navCollapsed ? "justify-center px-0" : ""}`}
            >
              {active && (
                <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-accent" />
              )}
              <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-accent" : "opacity-70 group-hover:opacity-100"}`} />
              {!navCollapsed && <span className="flex-1 text-left">{label}</span>}
              {navCollapsed && (
                <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 bg-surface3 text-text-primary text-xs font-medium px-2.5 py-1.5 rounded-md border border-border shadow-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 z-50">
                  {label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface2 cursor-pointer"
          onClick={toggleNav}
        >
          <div className="w-8 h-8 shrink-0 rounded-lg bg-accent/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-accent" />
          </div>
          {!navCollapsed && (
            <div className="min-w-0">
              <div className="text-xs font-semibold text-text-primary">Enterprise</div>
              <div className="text-[10px] text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Defenses active
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
