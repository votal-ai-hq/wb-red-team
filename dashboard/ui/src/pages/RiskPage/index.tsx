import { useState, useEffect, useCallback } from "react";
import { getReportsMeta, getReport } from "@/api/reports";
import { analyzeRisk } from "@/api/risk";
import { useNDJSONStream } from "@/hooks/useNDJSONStream";
import type { ReportMeta, FullReport, RiskAnalysisResult } from "@/api/types";
import { ScoreRing } from "@/components/shared/ScoreRing";
import { Badge } from "@/components/shared/Badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Shield, AlertTriangle, Play, ChevronDown } from "lucide-react";

const cardClass =
  "bg-white border border-[rgba(20,45,90,0.14)] rounded-xl p-5 shadow-sm";

function severityBadgeVariant(severity: string): "critical" | "high" | "medium" | "low" | "info" {
  const s = severity.toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  if (s === "low") return "low";
  return "info";
}

function severityPriority(severity: string): number {
  const s = severity.toLowerCase();
  if (s === "critical") return 0;
  if (s === "high") return 1;
  if (s === "medium") return 2;
  if (s === "low") return 3;
  return 4;
}

export default function RiskPage() {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [fullReport, setFullReport] = useState<FullReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: riskResults, isStreaming, error: streamError, start } =
    useNDJSONStream<RiskAnalysisResult>();

  // Fetch reports list
  useEffect(() => {
    getReportsMeta(1, 200)
      .then((res) => setReports(res.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch full report when selected
  useEffect(() => {
    if (!selectedFile) {
      setFullReport(null);
      return;
    }
    setReportLoading(true);
    getReport(selectedFile, false)
      .then(setFullReport)
      .catch(console.error)
      .finally(() => setReportLoading(false));
  }, [selectedFile]);

  const handleRunAI = useCallback(async () => {
    if (!fullReport) return;
    const attacks = fullReport.rounds.flatMap((r) =>
      r.results.map((res) => ({
        attackName: res.attackName,
        category: res.category,
        severity: res.severity,
        verdict: res.verdict,
        reasoning: res.reasoning,
      }))
    );
    const response = await analyzeRisk(attacks);
    start(response);
  }, [fullReport, start]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center py-32">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // ---- Derived data from full report ----
  const allResults = fullReport
    ? fullReport.rounds.flatMap((r) => r.results)
    : [];

  const severityDist: Record<string, number> = {};
  const vulnerabilities = allResults.filter(
    (r) => r.verdict === "vulnerable" || r.verdict === "fail"
  );
  allResults.forEach((r) => {
    const sev = r.severity || "unknown";
    severityDist[sev] = (severityDist[sev] || 0) + 1;
  });

  const maxSevCount = Math.max(...Object.values(severityDist), 1);

  // Group vulnerabilities by priority for remediation matrix
  const remediationGroups: Record<string, typeof vulnerabilities> = {};
  vulnerabilities.forEach((v) => {
    const key = v.severity || "unknown";
    if (!remediationGroups[key]) remediationGroups[key] = [];
    remediationGroups[key].push(v);
  });
  const sortedRemediationKeys = Object.keys(remediationGroups).sort(
    (a, b) => severityPriority(a) - severityPriority(b)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Step 1: Report selector */}
      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-[#1a2433] mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          Risk Analysis
        </h2>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-surface2 border border-border rounded-lg text-sm text-text-primary hover:border-accent transition-colors"
          >
            <span>
              {selectedFile
                ? reports.find((r) => r.filename === selectedFile)?.targetUrl +
                  " - " +
                  new Date(
                    reports.find((r) => r.filename === selectedFile)?.timestamp ?? ""
                  ).toLocaleDateString()
                : "Select a report to analyze..."}
            </span>
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          </button>
          {dropdownOpen && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {reports.length === 0 ? (
                <div className="px-4 py-3 text-sm text-text-secondary">
                  No reports available
                </div>
              ) : (
                reports.map((r) => (
                  <button
                    key={r.filename}
                    onClick={() => {
                      setSelectedFile(r.filename);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface2 transition-colors flex items-center justify-between ${
                      selectedFile === r.filename ? "bg-surface2 font-medium" : ""
                    }`}
                  >
                    <span className="truncate">
                      {r.targetUrl} -{" "}
                      {new Date(r.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="ml-2 text-xs text-text-secondary">
                      Score: {r.score}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Report breakdown */}
      {reportLoading && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      )}

      {fullReport && !reportLoading && (
        <>
          {/* Score + Severity Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Score Ring */}
            <div className={`${cardClass} flex flex-col items-center justify-center gap-3`}>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Security Score
              </span>
              <ScoreRing score={fullReport.score} size={140} />
              <div className="text-center">
                <p className="text-sm text-text-secondary">
                  {fullReport.passed} passed / {fullReport.failed} failed / {fullReport.errors} errors
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {fullReport.totalAttacks} total attacks
                </p>
              </div>
            </div>

            {/* Severity Distribution */}
            <div className={`${cardClass} col-span-1 lg:col-span-2`}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-4">
                Severity Distribution
              </h3>
              <div className="space-y-3">
                {["critical", "high", "medium", "low", "unknown"]
                  .filter((sev) => severityDist[sev])
                  .map((sev) => {
                    const count = severityDist[sev] || 0;
                    const colors: Record<string, string> = {
                      critical: "bg-critical",
                      high: "bg-warning",
                      medium: "bg-yellow",
                      low: "bg-success",
                      unknown: "bg-gray-400",
                    };
                    return (
                      <div key={sev}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-text-secondary capitalize">{sev}</span>
                          <span className="font-semibold text-text-primary">{count}</span>
                        </div>
                        <div className="h-2.5 bg-surface2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[sev] || "bg-gray-400"} transition-all duration-500`}
                            style={{ width: `${(count / maxSevCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Exploitability Section */}
          <div className={cardClass}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-4">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Exploitable Vulnerabilities ({vulnerabilities.length})
              </span>
            </h3>
            {vulnerabilities.length === 0 ? (
              <p className="text-sm text-text-secondary py-4 text-center">
                No exploitable vulnerabilities found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                        Attack
                      </th>
                      <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                        Category
                      </th>
                      <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                        Severity
                      </th>
                      <th className="text-left py-2 font-semibold text-text-secondary">
                        Verdict
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vulnerabilities.slice(0, 50).map((v, i) => (
                      <tr
                        key={`${v.attackName}-${i}`}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-2.5 pr-4 text-text-primary font-medium max-w-[300px] truncate">
                          {v.attackName}
                        </td>
                        <td className="py-2.5 pr-4 text-text-secondary">{v.category}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={severityBadgeVariant(v.severity)}>
                            {v.severity || "unknown"}
                          </Badge>
                        </td>
                        <td className="py-2.5">
                          <Badge variant="critical">{v.verdict}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {vulnerabilities.length > 50 && (
                  <p className="text-xs text-text-secondary mt-2">
                    Showing 50 of {vulnerabilities.length} vulnerabilities
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Remediation Matrix */}
          {sortedRemediationKeys.length > 0 && (
            <div className={cardClass}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-4">
                Remediation Matrix (by priority)
              </h3>
              <div className="space-y-4">
                {sortedRemediationKeys.map((severity) => {
                  const items = remediationGroups[severity];
                  const colors: Record<string, string> = {
                    critical: "border-l-red-500",
                    high: "border-l-orange-500",
                    medium: "border-l-yellow-500",
                    low: "border-l-green-500",
                    unknown: "border-l-gray-400",
                  };
                  return (
                    <div
                      key={severity}
                      className={`border-l-4 ${colors[severity.toLowerCase()] || "border-l-gray-400"} pl-4`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={severityBadgeVariant(severity)}>
                          {severity}
                        </Badge>
                        <span className="text-sm text-text-secondary">
                          {items.length} finding{items.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {items.slice(0, 10).map((item, idx) => (
                          <li
                            key={`${item.attackName}-${idx}`}
                            className="text-sm text-text-primary"
                          >
                            <span className="font-medium">{item.attackName}</span>
                            <span className="text-text-secondary ml-2">({item.category})</span>
                          </li>
                        ))}
                        {items.length > 10 && (
                          <li className="text-xs text-text-secondary">
                            +{items.length - 10} more
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: AI Risk Analysis */}
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                AI Risk Analysis
              </h3>
              <button
                onClick={handleRunAI}
                disabled={isStreaming}
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {isStreaming ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run AI Risk Analysis
                  </>
                )}
              </button>
            </div>

            {streamError && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {streamError}
              </div>
            )}

            {riskResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {riskResults.map((result, i) => (
                  <div
                    key={`${result.attackName}-${i}`}
                    className="border border-border rounded-lg p-4 space-y-2"
                  >
                    <h4 className="font-semibold text-text-primary text-sm">
                      {result.attackName}
                    </h4>
                    <p className="text-xs text-text-secondary">{result.category}</p>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div>
                        <span className="block text-xs text-text-secondary">Impact Level</span>
                        <span className="text-sm font-medium text-text-primary">
                          {result.impactLevel}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-text-secondary">Business Impact</span>
                        <span className="text-sm font-medium text-text-primary">
                          {result.businessImpact}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-text-secondary">
                          Financial Exposure
                        </span>
                        <span className="text-sm font-medium text-text-primary">
                          {result.financialExposure}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-text-secondary">
                          Remediation Estimate
                        </span>
                        <span className="text-sm font-medium text-text-primary">
                          {result.remediationEstimate}
                        </span>
                      </div>
                    </div>
                    {result.complianceRisk && (
                      <div className="pt-1">
                        <span className="block text-xs text-text-secondary">Compliance Risk</span>
                        <span className="text-sm text-text-primary">{result.complianceRisk}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              !isStreaming && (
                <EmptyState
                  title="No AI analysis yet"
                  description="Click 'Run AI Risk Analysis' to get detailed risk insights powered by AI."
                  icon={<Shield className="w-12 h-12" />}
                />
              )
            )}
          </div>
        </>
      )}

      {!selectedFile && !loading && (
        <EmptyState
          title="Select a report"
          description="Choose a scan report above to view its risk analysis breakdown."
          icon={<Shield className="w-12 h-12" />}
        />
      )}
    </div>
  );
}
