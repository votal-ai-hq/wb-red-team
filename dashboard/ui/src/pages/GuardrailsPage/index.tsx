import { useState, useEffect } from "react";
import { getGuardrailReports, getGuardrailReport } from "@/api/guardrails";
import type { GuardrailReportMeta, GuardrailReport, GuardrailResult } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Search,
  Loader2,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

/* ─── helpers ─── */

function getPrompt(r: GuardrailResult): string {
  return r.without_guardrails?.message ?? r.prompt ?? "-";
}

function getBaselineResponse(r: GuardrailResult): string {
  return r.without_guardrails?.response_text ?? "-";
}

function getGuardrailResponse(r: GuardrailResult, report: GuardrailReport): string {
  return r.with_guardrails?.response_text ?? r.response ?? "-";
}

function getGuardrailName(r: GuardrailResult, report: GuardrailReport): string {
  return r.guardrail ?? (report.guardrails?.join(", ") || "N/A");
}

function getCategory(r: GuardrailResult): string {
  return r.without_guardrails?.category ?? r.verdict ?? "unknown";
}

function getVerdict(r: GuardrailResult): string {
  return r.assessment?.guardrail_effect ?? r.with_guardrails?.guardrail_verdict ?? r.verdict ?? "-";
}

function isBlocked(r: GuardrailResult): boolean {
  return r.assessment?.blocked ?? r.blocked ?? false;
}

function isBad(r: GuardrailResult): boolean {
  const cat = getCategory(r);
  return cat === "bad" || cat === "harmful" || cat === "unsafe";
}

function isGood(r: GuardrailResult): boolean {
  const cat = getCategory(r);
  return cat === "good" || cat === "safe" || cat === "benign";
}

type FilterType = "all" | "bad_allowed" | "bad_blocked" | "good";

/* ─── component ─── */

export default function GuardrailsPage() {
  const [reportsMeta, setReportsMeta] = useState<GuardrailReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState("");
  const [report, setReport] = useState<GuardrailReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Fetch sidebar list
  useEffect(() => {
    getGuardrailReports()
      .then((data) => {
        setReportsMeta(data);
        if (data.length > 0) setSelectedFile(data[0].filename);
      })
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
    setFilter("all");
    setExpandedRow(null);
    getGuardrailReport(selectedFile)
      .then(setReport)
      .catch(console.error)
      .finally(() => setReportLoading(false));
  }, [selectedFile]);

  const filteredMeta = reportsMeta.filter(
    (r) =>
      !searchQuery ||
      r.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.model || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Compute stats from loaded report
  const results = report?.results ?? [];
  const totalCount = results.length;
  const blockedCount = results.filter(isBlocked).length;
  const badCount = results.filter(isBad).length;
  const goodCount = results.filter(isGood).length;
  const badAllowed = results.filter((r) => isBad(r) && !isBlocked(r)).length;
  const badBlocked = results.filter((r) => isBad(r) && isBlocked(r)).length;
  const blockedPct = badCount > 0 ? Math.round((badBlocked / badCount) * 100) : 0;
  const falsePosRate = goodCount > 0
    ? Math.round((results.filter((r) => isGood(r) && isBlocked(r)).length / goodCount) * 100)
    : 0;

  // Apply filter
  const filteredResults =
    filter === "all"
      ? results
      : filter === "bad_allowed"
        ? results.filter((r) => isBad(r) && !isBlocked(r))
        : filter === "bad_blocked"
          ? results.filter((r) => isBad(r) && isBlocked(r))
          : results.filter(isGood);

  const filterTabs: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "All", count: totalCount },
    { key: "bad_allowed", label: "Bad Allowed", count: badAllowed },
    { key: "bad_blocked", label: "Bad Blocked", count: badBlocked },
    { key: "good", label: "Good", count: goodCount },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex gap-5 min-h-[calc(100vh-12rem)]">
        {/* ═══ Sidebar ═══ */}
        <div className="w-72 flex-shrink-0">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Guardrail Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reports..."
                  className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* List */}
              <div className="space-y-1 max-h-[calc(100vh-22rem)] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredMeta.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No guardrail reports found.
                  </p>
                ) : (
                  filteredMeta.map((r) => (
                    <button
                      key={r.filename}
                      onClick={() => setSelectedFile(r.filename)}
                      className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                        selectedFile === r.filename
                          ? "bg-primary/5 border-2 border-primary dark:bg-primary/10"
                          : "hover:bg-muted border-2 border-transparent"
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground truncate">{r.filename}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(r.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {r.model && <span className="ml-2 text-primary">{r.model}</span>}
                      </p>
                      <div className="flex gap-3 mt-1.5 text-xs font-medium">
                        <span className="text-emerald-600 dark:text-emerald-400">{r.goodTotal} good</span>
                        <span className="text-red-600 dark:text-red-400">{r.badTotal} bad</span>
                        <span className="text-orange-600 dark:text-orange-400">{r.blocked} blocked</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ Main content ═══ */}
        <div className="flex-1 min-w-0 space-y-4">
          {reportLoading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !report ? (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <Shield className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Select a guardrail report</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Choose a report from the sidebar to view details
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── Header: Model + Guardrails + Stats ── */}
              <Card>
                <CardContent className="py-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-foreground">
                        Guardrail Report: {report.model || "unknown"}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Model: <span className="font-medium text-foreground">{report.model || "N/A"}</span>
                        {(report.guardrails ?? []).length > 0 && (
                          <>
                            {" · "}Guardrails:{" "}
                            {(report.guardrails ?? []).map((g) => (
                              <Badge key={g} variant="secondary" className="mr-1">{g}</Badge>
                            ))}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-foreground tabular-nums">{totalCount}</div>
                      <div className="text-[11px] text-muted-foreground">Total Prompts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{goodCount}</div>
                      <div className="text-[11px] text-muted-foreground">Good Prompts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums">{badCount}</div>
                      <div className="text-[11px] text-muted-foreground">Bad Prompts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 tabular-nums">{blockedCount}</div>
                      <div className="text-[11px] text-muted-foreground">Blocked</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Guardrail Effectiveness ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Guardrail Effectiveness</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Blocked rate */}
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
                          <circle
                            cx="40" cy="40" r="34" fill="none"
                            stroke="currentColor" strokeWidth="6"
                            strokeDasharray={`${2 * Math.PI * 34}`}
                            strokeDashoffset={`${2 * Math.PI * 34 * (1 - blockedPct / 100)}`}
                            strokeLinecap="round"
                            className="text-emerald-500 transition-all duration-500"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-foreground">{blockedPct}%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">Blocked by Guardrails</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {badBlocked} of {badCount} bad prompts blocked
                        </div>
                      </div>
                    </div>

                    {/* False positive rate */}
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
                          <circle
                            cx="40" cy="40" r="34" fill="none"
                            stroke="currentColor" strokeWidth="6"
                            strokeDasharray={`${2 * Math.PI * 34}`}
                            strokeDashoffset={`${2 * Math.PI * 34 * (1 - falsePosRate / 100)}`}
                            strokeLinecap="round"
                            className="text-red-500 transition-all duration-500"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-foreground">{falsePosRate}%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">False Positive Rate</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Good prompts incorrectly blocked
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Effectiveness bar */}
                  {badCount > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Bad prompts blocked {badBlocked}/{badCount}</span>
                        <span>Baselines the guardrail blocked {blockedCount} evaluations</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${blockedPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Results table ── */}
              <Card>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      Results
                    </CardTitle>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 mt-3 border-b border-border -mx-[var(--card-spacing)] px-[var(--card-spacing)]">
                    {filterTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => { setFilter(tab.key); setExpandedRow(null); }}
                        className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                          filter === tab.key
                            ? "border-foreground text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                        <span className="ml-1.5 text-muted-foreground">({tab.count})</span>
                      </button>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {filteredResults.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      No results match the current filter
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-8 text-xs">#</TableHead>
                          <TableHead className="text-xs">TYPE</TableHead>
                          <TableHead className="text-xs">PROMPT</TableHead>
                          <TableHead className="text-xs">BASELINE</TableHead>
                          <TableHead className="text-xs">GUARDRAIL</TableHead>
                          <TableHead className="text-xs">ASSESSMENT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredResults.map((r, i) => {
                          const prompt = getPrompt(r);
                          const baseline = getBaselineResponse(r);
                          const guardrail = getGuardrailResponse(r, report);
                          const category = getCategory(r);
                          const blocked = isBlocked(r);
                          const isExp = expandedRow === i;

                          return (
                            <TableRow
                              key={i}
                              className="cursor-pointer hover:bg-muted/30 align-top"
                              onClick={() => setExpandedRow(isExp ? null : i)}
                            >
                              <TableCell className="text-xs text-muted-foreground tabular-nums">
                                {i + 1}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={category === "bad" || category === "harmful" || category === "unsafe" ? "destructive" : "secondary"}
                                >
                                  {category}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                <p className={`text-sm text-foreground ${isExp ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
                                  {prompt}
                                </p>
                              </TableCell>
                              <TableCell className="max-w-[180px]">
                                <p className={`text-sm text-muted-foreground ${isExp ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
                                  {baseline}
                                </p>
                              </TableCell>
                              <TableCell className="max-w-[180px]">
                                <p className={`text-sm ${blocked ? "text-orange-600 dark:text-orange-400 font-medium" : "text-muted-foreground"} ${isExp ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
                                  {blocked ? "Blocked by guardrail" : guardrail}
                                </p>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {blocked ? (
                                    <Badge variant="destructive">
                                      <ShieldCheck className="w-3 h-3 mr-1" />
                                      Blocked
                                    </Badge>
                                  ) : isBad(r) ? (
                                    <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">
                                      <ShieldOff className="w-3 h-3 mr-1" />
                                      Allowed
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary">
                                      <ShieldCheck className="w-3 h-3 mr-1" />
                                      OK
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
