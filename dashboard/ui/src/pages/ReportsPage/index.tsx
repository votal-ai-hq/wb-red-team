import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { getReportsMeta, getReport } from "@/api/reports";
import type { ReportMeta, FullReport, ReportResult, ReportSummary } from "@/api/types";
import { useDebounce } from "@/hooks/useDebounce";
import { ScoreRing } from "@/components/shared/ScoreRing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText, ArrowLeft, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

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

function scoreTextColor(score: number) {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function severityVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  const l = s.toLowerCase();
  if (l === "critical" || l === "high") return "destructive";
  if (l === "medium") return "default";
  if (l === "low") return "secondary";
  return "outline";
}

/** Extract summary stats from a FullReport, handling both top-level and nested summary object */
function getReportStats(report: FullReport) {
  const s = typeof report.summary === "object" && report.summary ? report.summary as ReportSummary : null;
  return {
    score: s?.score ?? report.score ?? 0,
    passed: s?.passed ?? report.passed ?? 0,
    failed: s?.failed ?? report.failed ?? 0,
    errors: s?.errors ?? report.errors ?? 0,
    totalAttacks: s?.totalAttacks ?? report.totalAttacks ?? 0,
  };
}

/** Get the display name for a result's attack */
function getAttackName(result: ReportResult): string {
  const atk = result.attack;
  if (typeof atk === "object" && atk !== null) return (atk as Record<string, unknown>).name as string ?? "Unknown";
  if (typeof atk === "string") return atk;
  return result.attackName ?? "Unknown";
}

/** Get category from result, falling back to attack object */
function getCategory(result: ReportResult): string {
  if (result.category) return result.category;
  const atk = result.attack;
  if (typeof atk === "object" && atk !== null) return (atk as Record<string, unknown>).category as string ?? "";
  return "";
}

/** Get severity from result, falling back to attack object */
function getSeverity(result: ReportResult): string {
  if (result.severity) return result.severity;
  const atk = result.attack;
  if (typeof atk === "object" && atk !== null) return (atk as Record<string, unknown>).severity as string ?? "";
  return "";
}

/** Get the round number from a round object */
function getRoundNumber(round: { round?: number; roundNumber?: number }): number {
  return round.round ?? round.roundNumber ?? 0;
}

function verdictVariant(v: string): "destructive" | "default" | "secondary" {
  const l = v.toLowerCase();
  if (l === "vulnerable" || l === "fail" || l === "failed") return "destructive";
  if (l === "pass" || l === "passed" || l === "blocked" || l === "safe") return "default";
  return "secondary";
}

/* ─── Grid Mode (Table-based list) ─── */

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
          className="w-full max-w-md px-4 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
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
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px]">Score</TableHead>
                    <TableHead>Target URL</TableHead>
                    <TableHead className="w-[180px]">Date</TableHead>
                    <TableHead className="w-[90px] text-center">Attacks</TableHead>
                    <TableHead className="w-[80px] text-center">Passed</TableHead>
                    <TableHead className="w-[80px] text-center">Failed</TableHead>
                    <TableHead className="w-[80px] text-center">Errors</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow
                      key={r.filename}
                      className="cursor-pointer"
                      onClick={() => navigate(`/reports/${encodeURIComponent(r.filename)}`)}
                    >
                      <TableCell>
                        <span className={`text-lg font-bold tabular-nums ${scoreTextColor(r.score)}`}>
                          {r.score}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate max-w-[400px]">
                            {r.targetUrl || truncate(r.filename, 50)}
                          </p>
                          {r.targetUrl && (
                            <p className="text-xs text-muted-foreground truncate max-w-[400px] mt-0.5">
                              {truncate(r.filename, 60)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmtDate(r.timestamp)}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        {r.totalAttacks}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm tabular-nums text-green-600 dark:text-green-400 font-medium">
                          {r.passed}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm tabular-nums text-red-600 dark:text-red-400 font-medium">
                          {r.failed}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm tabular-nums text-orange-600 dark:text-orange-400 font-medium">
                          {r.errors}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ExternalLink size={14} className="text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card disabled:opacity-40 hover:bg-muted"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card disabled:opacity-40 hover:bg-muted"
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
      <TableRow
        className="cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell className="text-sm">
          <span className="inline-flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown size={14} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground" />
            )}
            {getAttackName(result)}
          </span>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{getCategory(result) || "-"}</TableCell>
        <TableCell>
          <Badge variant={severityVariant(getSeverity(result) || "unknown")}>{getSeverity(result) || "unknown"}</Badge>
        </TableCell>
        <TableCell>
          <Badge variant={verdictVariant(result.verdict)}>{result.verdict}</Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
          {result.reasoning || result.llmReasoning || "-"}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/40">
          <TableCell colSpan={5} className="px-6 py-4">
            <div className="space-y-3 text-sm">
              {(result.reasoning || result.llmReasoning) && (
                <div>
                  <span className="font-medium text-foreground">Reasoning: </span>
                  <span className="text-muted-foreground">
                    {result.reasoning || result.llmReasoning}
                  </span>
                </div>
              )}
              {result.payload && (
                <div>
                  <span className="font-medium text-foreground">Payload: </span>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground break-all">
                    {result.payload}
                  </code>
                </div>
              )}
              {result.findings && result.findings.length > 0 && (
                <div>
                  <span className="font-medium text-foreground">Findings:</span>
                  <ul className="list-disc list-inside text-muted-foreground mt-1">
                    {result.findings.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.steps && result.steps.length > 0 && (
                <div>
                  <span className="font-medium text-foreground">
                    Conversation ({result.steps.length} steps):
                  </span>
                  <div className="mt-2 space-y-2">
                    {result.steps.map((step, i) => (
                      <div
                        key={i}
                        className={`rounded-lg px-3 py-2 text-xs ${
                          step.role === "user"
                            ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className="font-semibold capitalize">{step.role}: </span>
                        <span className="whitespace-pre-wrap break-words">{step.content}</span>
                        {step.statusCode && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
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
                  <span className="font-medium text-foreground">Threat Assessment: </span>
                  <Badge variant={severityVariant(result.threatAssessment.level)}>
                    {result.threatAssessment.level}
                  </Badge>
                  <span className="ml-2 text-muted-foreground">
                    {result.threatAssessment.description}
                  </span>
                </div>
              )}
              {result.idealResponse && (
                <div>
                  <span className="font-medium text-foreground">Ideal Response: </span>
                  <span className="text-muted-foreground">{result.idealResponse}</span>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
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
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
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
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to reports
      </button>

      {/* Header */}
      {(() => {
        const stats = getReportStats(report);
        return (
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <ScoreRing score={stats.score} size={90} />
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-foreground truncate">
                    {report.filename || filename}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">{report.targetUrl}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmtDate(report.timestamp)}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="destructive">
                      {stats.failed} vulnerable
                    </Badge>
                    <Badge variant="default">
                      {stats.passed} blocked
                    </Badge>
                    <Badge variant="outline">
                      {stats.errors} errors
                    </Badge>
                    <Badge variant="secondary">
                      {stats.totalAttacks} total
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Summary / LLM Analysis */}
      {report.llmAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {report.llmAnalysis}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rounds tabs */}
      {rounds.length > 1 && (
        <div className="flex gap-1 border-b border-border">
          {rounds.map((r, idx) => (
            <button
              key={getRoundNumber(r)}
              onClick={() => {
                setActiveRound(idx);
                setFindingsPage(1);
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                idx === activeRound
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Round {getRoundNumber(r)}
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
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">
                    Attack Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">
                    Category
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">
                    Severity
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">
                    Verdict
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">
                    Reasoning
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedFindings.map((result, i) => (
                  <FindingRow key={`${getAttackName(result)}-${i}`} result={result} />
                ))}
              </TableBody>
            </Table>

            {/* Findings pagination */}
            {totalFindingsPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-3 border-t border-border">
                <button
                  disabled={findingsPage <= 1}
                  onClick={() => setFindingsPage((p) => p - 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card disabled:opacity-40 hover:bg-muted"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  {findingsPage} / {totalFindingsPages}
                </span>
                <button
                  disabled={findingsPage >= totalFindingsPages}
                  onClick={() => setFindingsPage((p) => p + 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card disabled:opacity-40 hover:bg-muted"
                >
                  Next
                </button>
              </div>
            )}
          </CardContent>
        </Card>
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
