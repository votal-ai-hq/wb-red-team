import { create } from "zustand";

interface Alert {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface UIState {
  navCollapsed: boolean;
  alerts: Alert[];

  toggleNav: () => void;
  setNavCollapsed: (v: boolean) => void;
  showAlert: (type: Alert["type"], message: string) => void;
  dismissAlert: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  navCollapsed: false,
  alerts: [],

  toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
  setNavCollapsed: (navCollapsed) => set({ navCollapsed }),
  showAlert: (type, message) =>
    set((s) => ({
      alerts: [
        ...s.alerts,
        { id: `${Date.now()}-${Math.random()}`, type, message },
      ],
    })),
  dismissAlert: (id) =>
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
}));
