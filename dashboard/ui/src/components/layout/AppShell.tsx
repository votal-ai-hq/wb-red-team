import { Outlet } from "react-router";
import { NavRail } from "./NavRail";
import { TopBar } from "./TopBar";

export function AppShell() {
  return (
    <div className="flex h-screen">
      <NavRail />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
