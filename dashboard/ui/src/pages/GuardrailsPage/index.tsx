import { useState, useEffect } from "react";
import { getGuardrailReports, getGuardrailReport } from "@/api/guardrails";
import type { GuardrailReportMeta, GuardrailReport } from "@/api/types";
import { Badge } from "@/components/shared/Badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Shield, Search } from "lucide-react";

const cardClass =
  "bg-white border border-[rgba(20,45,90,0.14)] rounded-xl p-5 shadow-sm";

export default function GuardrailsPage() {
  const [reportsMeta, setReportsMeta] = useState<GuardrailReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState("");
  const [report, setReport] = useState<GuardrailReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch sidebar list
  useEffect(() => {
    getGuardrailReports()
      .then(setReportsMeta)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch full report when selected
  useEffect(() => {
    if (!selectedFile) {
      setReport(null);
      return;
    }
    setReportLoading(true);
    getGuardrailReport(selectedFile)
      .then(setReport)
      .catch(console.error)
      .finally(() => setReportLoading(false));
  }, [selectedFile]);

  const filteredMeta = reportsMeta.filter(
    (r) =>
      !searchQuery ||
      r.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.model || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex gap-5 min-h-[calc(100vh-12rem)]">
        {/* Sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className={`${cardClass} h-full flex flex-col`}>
            <h2 className="text-sm font-semibold text-[#1a2433] mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              Guardrail Reports
            </h2>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports..."
                className="w-full pl-9 pr-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-1 -mx-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              ) : filteredMeta.length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-8 px-2">
                  No guardrail reports found.
                </p>
              ) : (
                filteredMeta.map((r) => (
                  <button
                    key={r.filename}
                    onClick={() => setSelectedFile(r.filename)}
                    className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                      selectedFile === r.filename
                        ? "bg-accent/10 border border-accent/30"
                        : "hover:bg-surface2 border border-transparent"
                    }`}
                  >
                    <p className="text-sm font-medium text-text-primary truncate">
                      {r.filename}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {new Date(r.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {r.model && (
                        <span className="ml-2 text-accent">{r.model}</span>
                      )}
                    </p>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-xs text-green-600 font-medium">
                        {r.goodTotal} good
                      </span>
                      <span className="text-xs text-red-600 font-medium">
                        {r.badTotal} bad
                      </span>
                      <span className="text-xs text-orange-600 font-medium">
                        {r.blocked} blocked
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {reportLoading ? (
            <div className="flex items-center justify-center py-32">
              <LoadingSpinner />
            </div>
          ) : !report ? (
            <div className={`${cardClass} h-full flex items-center justify-center`}>
              <EmptyState
                title="Select a guardrail report"
                description="Choose a report from the sidebar to view its details and results."
                icon={<Shield className="w-12 h-12" />}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Report header */}
              <div className={cardClass}>
                <h2 className="text-lg font-semibold text-[#1a2433] mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-accent" />
                  {report.filename}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Model */}
                  <div>
                    <span className="block text-xs text-text-secondary uppercase tracking-wider font-semibold">
                      Model
                    </span>
                    <span className="text-sm font-medium text-text-primary mt-1">
                      {report.model || "N/A"}
                    </span>
                  </div>
                  {/* Guardrails used */}
                  <div className="col-span-2 md:col-span-3">
                    <span className="block text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1">
                      Guardrails Used
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(report.guardrails || []).length > 0 ? (
                        report.guardrails!.map((g) => (
                          <span
                            key={g}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent"
                          >
                            {g}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-text-secondary">N/A</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary stats */}
                {(() => {
                  const totalResults = report.results.length;
                  const blockedCount = report.results.filter(
                    (r) => r.blocked
                  ).length;
                  const goodCount = report.results.filter(
                    (r) => r.verdict === "good" || r.verdict === "pass"
                  ).length;
                  const badCount = report.results.filter(
                    (r) => r.verdict === "bad" || r.verdict === "fail"
                  ).length;
                  return (
                    <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
                      <div className="text-center">
                        <span className="block text-2xl font-bold text-text-primary">
                          {totalResults}
                        </span>
                        <span className="text-xs text-text-secondary">Total</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-2xl font-bold text-green-600">
                          {goodCount}
                        </span>
                        <span className="text-xs text-text-secondary">Good</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-2xl font-bold text-red-600">
                          {badCount}
                        </span>
                        <span className="text-xs text-text-secondary">Bad</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-2xl font-bold text-orange-600">
                          {blockedCount}
                        </span>
                        <span className="text-xs text-text-secondary">Blocked</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Results table */}
              <div className={cardClass}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-4">
                  Results ({report.results.length})
                </h3>
                {report.results.length === 0 ? (
                  <p className="text-sm text-text-secondary text-center py-8">
                    No results in this report.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                            Prompt
                          </th>
                          <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                            Response
                          </th>
                          <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                            Guardrail
                          </th>
                          <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                            Verdict
                          </th>
                          <th className="text-left py-2 font-semibold text-text-secondary">
                            Blocked
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.results.map((r, i) => (
                          <tr
                            key={i}
                            className="border-b border-border/50 last:border-0 align-top"
                          >
                            <td className="py-2.5 pr-4 text-text-primary max-w-[250px]">
                              <p className="truncate" title={r.prompt}>
                                {r.prompt}
                              </p>
                            </td>
                            <td className="py-2.5 pr-4 text-text-secondary max-w-[250px]">
                              <p className="truncate" title={r.response}>
                                {r.response}
                              </p>
                            </td>
                            <td className="py-2.5 pr-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                                {r.guardrail}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4">
                              <Badge
                                variant={
                                  r.verdict === "good" || r.verdict === "pass"
                                    ? "success"
                                    : r.verdict === "bad" || r.verdict === "fail"
                                      ? "critical"
                                      : "info"
                                }
                              >
                                {r.verdict}
                              </Badge>
                            </td>
                            <td className="py-2.5">
                              {r.blocked ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  Blocked
                                </span>
                              ) : (
                                <span className="text-xs text-text-secondary">
                                  -
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
