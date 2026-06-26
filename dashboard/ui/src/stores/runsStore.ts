import { create } from "zustand";
import type { RunMeta, RunDetail } from "@/api/types";

interface RunsState {
  runs: RunMeta[];
  runCache: Map<string, RunDetail>;
  selectedRunId: string | null;
  searchTerm: string;

  setRuns: (runs: RunMeta[]) => void;
  updateRunCache: (id: string, data: RunDetail) => void;
  setSelectedRunId: (id: string | null) => void;
  setSearchTerm: (term: string) => void;
}

export const useRunsStore = create<RunsState>((set) => ({
  runs: [],
  runCache: new Map(),
  selectedRunId: null,
  searchTerm: "",

  setRuns: (runs) => set({ runs }),
  updateRunCache: (id, data) =>
    set((state) => {
      const next = new Map(state.runCache);
      next.set(id, data);
      return { runCache: next };
    }),
  setSelectedRunId: (selectedRunId) => set({ selectedRunId }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
}));
