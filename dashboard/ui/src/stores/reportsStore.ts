import { create } from "zustand";
import type { ReportMeta, ReportTrend, FullReport } from "@/api/types";

interface ReportsState {
  reportsMeta: ReportMeta[];
  trendData: ReportTrend[];
  currentFile: string | null;
  report: FullReport | null;
  currentPage: number;
  totalPages: number;
  searchTerm: string;

  setReportsMeta: (items: ReportMeta[]) => void;
  setTrendData: (trend: ReportTrend[]) => void;
  setCurrentFile: (file: string | null) => void;
  setReport: (report: FullReport | null) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  setSearchTerm: (term: string) => void;
}

export const useReportsStore = create<ReportsState>((set) => ({
  reportsMeta: [],
  trendData: [],
  currentFile: null,
  report: null,
  currentPage: 1,
  totalPages: 1,
  searchTerm: "",

  setReportsMeta: (reportsMeta) => set({ reportsMeta }),
  setTrendData: (trendData) => set({ trendData }),
  setCurrentFile: (currentFile) => set({ currentFile }),
  setReport: (report) => set({ report }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setTotalPages: (totalPages) => set({ totalPages }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
}));
