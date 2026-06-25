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
import {
  FileText,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Zap,
  AlertCircle,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Filter,
} from "lucide-react";

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
  const l = v.toUpperCase();
  if (l === "FAIL") return "destructive";
  if (l === "PASS") return "default";
  return "secondary";
}

function prettyCat(cat: string) {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function verdictDotColor(v: string) {
  const l = v.toUpperCase();
  if (l === "PASS") return "bg-emerald-500";
  if (l === "FAIL") return "bg-red-500";
  if (l === "PARTIAL") return "bg-amber-500";
  return "bg-gray-400";
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
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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
          <ArrowLeft size={16} /> Back to Reports
        </button>
        <EmptyState title={error || "Report not found"} icon={<FileText size={48} />} />
      </div>
    );
  }

  const stats = getReportStats(report);
  const rounds = report.rounds ?? [];
  const allResults: ReportResult[] = rounds.flatMap((r) => r.results ?? []);
  const currentRoundResults: ReportResult[] =
    rounds.length > 0 ? rounds[activeRound]?.results ?? [] : [];

  // Category breakdown from summary.byCategory
  const byCategory =
    typeof report.summary === "object" && report.summary
      ? ((report.summary as ReportSummary).byCategory as Record<string, { total: number; passed: number; findings: string[] }> | undefined) ?? {}
      : {};
  const categoryEntries = Object.entries(byCategory)
    .filter(([, v]) => v.total > 0)
    .sort((a, b) => b[1].passed - a[1].passed);
  const maxCatTotal = categoryEntries.length > 0 ? Math.max(...categoryEntries.map(([, v]) => v.total)) : 1;

  // Unique categories & verdicts for filters
  const uniqueCategories = [...new Set(currentRoundResults.map((r) => getCategory(r)).filter(Boolean))];
  const uniqueVerdicts = [...new Set(currentRoundResults.map((r) => r.verdict).filter(Boolean))];

  // Apply filters
  let filteredResults = currentRoundResults;
  if (verdictFilter !== "all") {
    filteredResults = filteredResults.filter((r) => r.verdict === verdictFilter);
  }
  if (categoryFilter !== "all") {
    filteredResults = filteredResults.filter((r) => getCategory(r) === categoryFilter);
  }

  const totalFindings = filteredResults.length;
  const totalFindingsPages = Math.max(1, Math.ceil(totalFindings / perPage));
  const pagedFindings = filteredResults.slice(
    (findingsPage - 1) * perPage,
    findingsPage * perPage,
  );

  // Partial count
  const partialCount = allResults.filter((r) => r.verdict === "PARTIAL").length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/reports")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back to Reports
        </button>
        <Badge variant="secondary">Completed</Badge>
      </div>

      {/* Target URL header */}
      <div>
        <h1 className="text-lg font-bold text-foreground">{report.targetUrl}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(report.timestamp)}</p>
      </div>

      {/* ── Score + Stats row ── */}
      <Card>
        <CardContent className="py-5">
          <div className="grid grid-cols-6 gap-4 items-center">
            {/* Score ring */}
            <div className="flex flex-col items-center">
              <ScoreRing score={stats.score} size={80} />
              <span className="text-[11px] text-muted-foreground mt-1">Security Score</span>
            </div>

            {/* Stats cards */}
            {([
              { label: "TOTAL ATTACKS", value: stats.totalAttacks, icon: Zap, color: "text-foreground" },
              { label: "VULNERABILITIES", value: stats.failed, icon: AlertCircle, color: "text-red-600 dark:text-red-400" },
              { label: "PARTIAL", value: partialCount, icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400" },
              { label: "DEFENDED", value: stats.passed, icon: ShieldCheck, color: "text-emerald-600 dark:text-emerald-400" },
              { label: "ERRORS", value: stats.errors, icon: ShieldOff, color: "text-muted-foreground" },
            ] as const).map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="text-center">
                <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Verdict legend ── */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <strong>FAIL</strong> = attack succeeded, vulnerability found
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <strong>PASS</strong> = defense held, attack was blocked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <strong>PARTIAL</strong> = partial leak or incomplete defense
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          <strong>ERROR</strong> = indeterminate could not complete normally
        </span>
      </div>

      {/* ── Category Breakdown ── */}
      {categoryEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Category Breakdown
              <span className="text-xs text-muted-foreground font-normal">
                {categoryEntries.length} categories
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
              {/* Donut-style summary */}
              <div className="flex flex-col items-center justify-center">
                <ScoreRing score={stats.score} size={100} />
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">FAIL</span>
                    <span className="font-semibold text-foreground ml-auto tabular-nums">{stats.failed}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">PASS</span>
                    <span className="font-semibold text-foreground ml-auto tabular-nums">{stats.passed}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-muted-foreground">PARTIAL</span>
                    <span className="font-semibold text-foreground ml-auto tabular-nums">{partialCount}</span>
                  </div>
                </div>
              </div>

              {/* Category bars */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  <span>Category</span>
                  <span className="text-right w-24">Distribution</span>
                  <span className="text-right w-10">Hits</span>
                </div>
                {categoryEntries.map(([cat, data]) => (
                  <div key={cat} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                    <span className="text-sm font-medium text-foreground truncate" title={prettyCat(cat)}>
                      {prettyCat(cat)}
                    </span>
                    <div className="w-48 h-2.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full flex">
                        {data.passed > 0 && (
                          <div
                            className="h-full bg-red-500"
                            style={{ width: `${(data.passed / data.total) * 100}%` }}
                          />
                        )}
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${((data.total - data.passed) / data.total) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-foreground w-10 text-right">
                      {data.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Results section ── */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Results
              <span className="text-xs text-muted-foreground font-normal">
                {allResults.length} total
              </span>
            </CardTitle>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-4 mt-3 border-b border-border -mx-[var(--card-spacing)] px-[var(--card-spacing)] overflow-x-auto">
            {/* Verdict filter */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setVerdictFilter("all"); setFindingsPage(1); }}
                className={`px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  verdictFilter === "all"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {uniqueVerdicts.map((v) => (
                <button
                  key={v}
                  onClick={() => { setVerdictFilter(v); setFindingsPage(1); }}
                  className={`px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                    verdictFilter === v
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${verdictDotColor(v)}`} />
                  {v}
                </button>
              ))}
            </div>

            {/* Category filter */}
            {uniqueCategories.length > 1 && (
              <div className="flex items-center gap-1 ml-auto">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setFindingsPage(1); }}
                  className="text-xs border-none bg-transparent text-muted-foreground focus:outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>{prettyCat(c)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Rounds tabs */}
          {rounds.length > 1 && (
            <div className="flex gap-1 px-4 pt-3">
              {rounds.map((r, idx) => (
                <button
                  key={getRoundNumber(r)}
                  onClick={() => {
                    setActiveRound(idx);
                    setFindingsPage(1);
                    setVerdictFilter("all");
                    setCategoryFilter("all");
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    idx === activeRound
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Round {getRoundNumber(r)}
                </button>
              ))}
            </div>
          )}

          {filteredResults.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No findings match the current filters
            </div>
          ) : (
            <>
              <div className="px-4 py-2 text-xs text-muted-foreground">
                Showing {(findingsPage - 1) * perPage + 1}-{Math.min(findingsPage * perPage, totalFindings)} of {totalFindings} findings
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Summary / LLM Analysis */}
      {report.llmAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">AI Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {report.llmAnalysis}
            </p>
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
