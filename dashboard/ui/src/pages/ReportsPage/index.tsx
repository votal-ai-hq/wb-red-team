import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { getReportsMeta, getReport } from "@/api/reports";
import type { ReportMeta, FullReport, ReportResult } from "@/api/types";
import { useDebounce } from "@/hooks/useDebounce";
import { ScoreRing } from "@/components/shared/ScoreRing";
import { Badge } from "@/components/shared/Badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText, ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";

/* ─── helpers ─── */

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreColor(score: number) {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function severityVariant(s: string): "critical" | "high" | "medium" | "low" | "info" {
  const l = s.toLowerCase();
  if (l === "critical") return "critical";
  if (l === "high") return "high";
  if (l === "medium") return "medium";
  if (l === "low") return "low";
  return "info";
}

function verdictVariant(v: string): "critical" | "success" | "info" {
  const l = v.toLowerCase();
  if (l === "vulnerable" || l === "fail" || l === "failed") return "critical";
  if (l === "pass" || l === "passed" || l === "blocked" || l === "safe") return "success";
  return "info";
}

/* ─── Grid Mode ─── */

function ReportsGrid() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReportsMeta(page, 50, debouncedSearch);
      setReports(res.items);
      setTotalPages(res.totalPages);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-lg border border-[rgba(20,45,90,0.14)] bg-white text-sm text-[#1a2433] placeholder-[#5a6b82] focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
        />
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title="No reports found"
          description="Run a scan to generate your first report."
          icon={<FileText size={48} />}
        />
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {reports.map((r) => (
              <button
                key={r.filename}
                onClick={() => navigate(`/reports/${encodeURIComponent(r.filename)}`)}
                className="text-left bg-white rounded-xl border border-[rgba(20,45,90,0.14)] p-5 transition-all hover:border-accent/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                {/* Icon + Name */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                    <FileText size={18} className="text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1a2433] truncate">
                      {truncate(r.filename, 40)}
                    </p>
                    <p className="text-xs text-[#5a6b82] truncate mt-0.5">
                      {r.targetUrl}
                    </p>
                  </div>
                </div>

                {/* Date + Score */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-[#5a6b82]">{fmtDate(r.timestamp)}</span>
                  <span
                    className={`w-3 h-3 rounded-full ${scoreColor(r.score)}`}
                    title={`Score: ${r.score}`}
                  />
                </div>

                {/* Stats pills */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    {r.failed} vulnerable
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    {r.passed} blocked
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    {r.errors} errors
                  </span>
                </div>

                {/* Status */}
                <Badge variant="success">Completed</Badge>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-[rgba(20,45,90,0.14)] bg-white disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-[#5a6b82]">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-[rgba(20,45,90,0.14)] bg-white disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Finding Row ─── */

function FindingRow({ result }: { result: ReportResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-[rgba(20,45,90,0.08)] hover:bg-gray-50/60 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown size={14} className="text-[#5a6b82]" />
            ) : (
              <ChevronRight size={14} className="text-[#5a6b82]" />
            )}
            {result.attackName}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-[#5a6b82]">{result.category}</td>
        <td className="px-4 py-3">
          <Badge variant={severityVariant(result.severity)}>{result.severity}</Badge>
        </td>
        <td className="px-4 py-3">
          <Badge variant={verdictVariant(result.verdict)}>{result.verdict}</Badge>
        </td>
        <td className="px-4 py-3 text-sm text-[#5a6b82] max-w-xs truncate">
          {result.reasoning || result.llmReasoning || "-"}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50/40">
          <td colSpan={5} className="px-6 py-4">
            <div className="space-y-3 text-sm">
              {(result.reasoning || result.llmReasoning) && (
                <div>
                  <span className="font-medium text-[#1a2433]">Reasoning: </span>
                  <span className="text-[#5a6b82]">
                    {result.reasoning || result.llmReasoning}
                  </span>
                </div>
              )}
              {result.payload && (
                <div>
                  <span className="font-medium text-[#1a2433]">Payload: </span>
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-[#5a6b82] break-all">
                    {result.payload}
                  </code>
                </div>
              )}
              {result.findings && result.findings.length > 0 && (
                <div>
                  <span className="font-medium text-[#1a2433]">Findings:</span>
                  <ul className="list-disc list-inside text-[#5a6b82] mt-1">
                    {result.findings.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.steps && result.steps.length > 0 && (
                <div>
                  <span className="font-medium text-[#1a2433]">
                    Conversation ({result.steps.length} steps):
                  </span>
                  <div className="mt-2 space-y-2">
                    {result.steps.map((step, i) => (
                      <div
                        key={i}
                        className={`rounded-lg px-3 py-2 text-xs ${
                          step.role === "user"
                            ? "bg-blue-50 text-blue-900"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        <span className="font-semibold capitalize">{step.role}: </span>
                        <span className="whitespace-pre-wrap break-words">{step.content}</span>
                        {step.statusCode && (
                          <span className="ml-2 text-[10px] text-gray-400">
                            [{step.statusCode}]
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.threatAssessment && (
                <div>
                  <span className="font-medium text-[#1a2433]">Threat Assessment: </span>
                  <Badge variant={severityVariant(result.threatAssessment.level)}>
                    {result.threatAssessment.level}
                  </Badge>
                  <span className="ml-2 text-[#5a6b82]">
                    {result.threatAssessment.description}
                  </span>
                </div>
              )}
              {result.idealResponse && (
                <div>
                  <span className="font-medium text-[#1a2433]">Ideal Response: </span>
                  <span className="text-[#5a6b82]">{result.idealResponse}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Detail Mode ─── */

function ReportDetail({ filename }: { filename: string }) {
  const navigate = useNavigate();
  const [report, setReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRound, setActiveRound] = useState(0);
  const [findingsPage, setFindingsPage] = useState(1);
  const perPage = 25;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getReport(filename, false)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load report");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filename]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate("/reports")}
          className="flex items-center gap-1.5 text-sm text-[#5a6b82] hover:text-[#1a2433] mb-4"
        >
          <ArrowLeft size={16} /> Back to reports
        </button>
        <EmptyState title={error || "Report not found"} icon={<FileText size={48} />} />
      </div>
    );
  }

  const rounds = report.rounds ?? [];
  const currentResults: ReportResult[] =
    rounds.length > 0 ? rounds[activeRound]?.results ?? [] : [];
  const totalFindings = currentResults.length;
  const totalFindingsPages = Math.max(1, Math.ceil(totalFindings / perPage));
  const pagedFindings = currentResults.slice(
    (findingsPage - 1) * perPage,
    findingsPage * perPage,
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate("/reports")}
        className="flex items-center gap-1.5 text-sm text-[#5a6b82] hover:text-[#1a2433]"
      >
        <ArrowLeft size={16} /> Back to reports
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-[rgba(20,45,90,0.14)] p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <ScoreRing score={report.score} size={90} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#1a2433] truncate">
              {report.filename || filename}
            </h1>
            <p className="text-sm text-[#5a6b82] mt-1">{report.targetUrl}</p>
            <p className="text-xs text-[#5a6b82] mt-1">{fmtDate(report.timestamp)}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {report.failed} vulnerable
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                {report.passed} blocked
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                {report.errors} errors
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {report.totalAttacks} total
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary / LLM Analysis */}
      {(report.summary || report.llmAnalysis) && (
        <div className="bg-white rounded-xl border border-[rgba(20,45,90,0.14)] p-6">
          <h2 className="text-base font-semibold text-[#1a2433] mb-2">Summary</h2>
          <p className="text-sm text-[#5a6b82] whitespace-pre-wrap leading-relaxed">
            {report.llmAnalysis || report.summary}
          </p>
        </div>
      )}

      {/* Rounds tabs */}
      {rounds.length > 1 && (
        <div className="flex gap-1 border-b border-[rgba(20,45,90,0.1)]">
          {rounds.map((r, idx) => (
            <button
              key={r.roundNumber}
              onClick={() => {
                setActiveRound(idx);
                setFindingsPage(1);
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                idx === activeRound
                  ? "border-accent text-accent"
                  : "border-transparent text-[#5a6b82] hover:text-[#1a2433]"
              }`}
            >
              Round {r.roundNumber}
            </button>
          ))}
        </div>
      )}

      {/* Findings table */}
      {currentResults.length === 0 ? (
        <EmptyState
          title="No findings in this round"
          icon={<FileText size={40} />}
        />
      ) : (
        <div className="bg-white rounded-xl border border-[rgba(20,45,90,0.14)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[rgba(20,45,90,0.1)] bg-gray-50/60">
                  <th className="px-4 py-3 text-xs font-semibold text-[#5a6b82] uppercase tracking-wider">
                    Attack Name
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#5a6b82] uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#5a6b82] uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#5a6b82] uppercase tracking-wider">
                    Verdict
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#5a6b82] uppercase tracking-wider">
                    Reasoning
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedFindings.map((result, i) => (
                  <FindingRow key={`${result.attackName}-${i}`} result={result} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Findings pagination */}
          {totalFindingsPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t border-[rgba(20,45,90,0.08)]">
              <button
                disabled={findingsPage <= 1}
                onClick={() => setFindingsPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-[rgba(20,45,90,0.14)] bg-white disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-[#5a6b82]">
                {findingsPage} / {totalFindingsPages}
              </span>
              <button
                disabled={findingsPage >= totalFindingsPages}
                onClick={() => setFindingsPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-[rgba(20,45,90,0.14)] bg-white disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Page Root ─── */

export default function ReportsPage() {
  const { filename } = useParams<{ filename?: string }>();

  if (filename) {
    return <ReportDetail filename={decodeURIComponent(filename)} />;
  }

  return <ReportsGrid />;
}
