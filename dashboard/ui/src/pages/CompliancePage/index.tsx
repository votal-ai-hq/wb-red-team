import { useState, useEffect, useCallback, useRef } from "react";
import { getReportsMeta } from "@/api/reports";
import {
  getFrameworks,
  getStaticCompliance,
  analyzeCompliance,
} from "@/api/compliance";
import { useNDJSONStream } from "@/hooks/useNDJSONStream";
import type {
  ReportMeta,
  ComplianceFramework,
  ComplianceResult,
} from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckSquare,
  Play,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  CheckCircle,
} from "lucide-react";

/* ---------- helpers ---------- */

const STATUS_CONFIG: Record<
  string,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    label: string;
    icon: React.ElementType;
    dotColor: string;
  }
> = {
  vulnerable: {
    variant: "destructive",
    label: "Vulnerable",
    icon: XCircle,
    dotColor: "bg-red-500",
  },
  at_risk: {
    variant: "outline",
    label: "At Risk",
    icon: AlertTriangle,
    dotColor: "bg-orange-500",
  },
  secure: {
    variant: "secondary",
    label: "Secure",
    icon: ShieldCheck,
    dotColor: "bg-emerald-500",
  },
  not_tested: {
    variant: "outline",
    label: "Not Tested",
    icon: HelpCircle,
    dotColor: "bg-gray-400",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_tested;
  return (
    <Badge variant={cfg.variant}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </Badge>
  );
}

function scoreBadgeClasses(score: number): string {
  if (score >= 80)
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (score >= 60)
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
}

function truncateUrl(url: string, max = 32): string {
  if (url.length <= max) return url;
  try {
    const u = new URL(url);
    const short = u.hostname + u.pathname;
    return short.length > max ? short.slice(0, max - 1) + "\u2026" : short;
  } catch {
    return url.slice(0, max - 1) + "\u2026";
  }
}

/* ---------- component ---------- */

export default function CompliancePage() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reports
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState("");

  // Config
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState("Anthropic");
  const [model, setModel] = useState("");

  // Results
  const [staticResults, setStaticResults] = useState<ComplianceResult[]>([]);
  const [staticLoading, setStaticLoading] = useState(false);
  const {
    data: aiResults,
    isStreaming,
    error: streamError,
    start,
  } = useNDJSONStream<ComplianceResult>();

  // Fetch reports + frameworks on mount, auto-select first
  useEffect(() => {
    Promise.all([getReportsMeta(1, 200), getFrameworks()])
      .then(([reportsRes, fws]) => {
        setReports(reportsRes.items);
        setFrameworks(fws);
        setSelectedFrameworks(new Set(fws.map((f) => f.id)));
        if (reportsRes.items.length > 0) {
          setSelectedFile(reportsRes.items[0].filename);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Auto-fetch static compliance when report is selected
  useEffect(() => {
    if (!selectedFile) {
      setStaticResults([]);
      return;
    }
    setStaticLoading(true);
    getStaticCompliance(selectedFile)
      .then((res) => setStaticResults(res.results))
      .catch(console.error)
      .finally(() => setStaticLoading(false));
  }, [selectedFile]);

  const handleSelectAll = useCallback(() => {
    setSelectedFrameworks(new Set(frameworks.map((f) => f.id)));
  }, [frameworks]);

  const handleSelectNone = useCallback(() => {
    setSelectedFrameworks(new Set());
  }, []);

  const toggleFramework = useCallback((id: string) => {
    setSelectedFrameworks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRunAI = useCallback(async () => {
    if (!selectedFile || selectedFrameworks.size === 0) return;
    const response = await analyzeCompliance(
      selectedFile,
      Array.from(selectedFrameworks),
      provider,
      model || undefined,
    );
    start(response);
  }, [selectedFile, selectedFrameworks, provider, model, start]);

  // Combine results (AI overrides static if available)
  const displayResults = aiResults.length > 0 ? aiResults : staticResults;

  // Group by framework
  const grouped: Record<string, ComplianceResult[]> = {};
  displayResults.forEach((r) => {
    if (!grouped[r.framework]) grouped[r.framework] = [];
    grouped[r.framework].push(r);
  });

  // Summary counts
  const statusCounts = { vulnerable: 0, at_risk: 0, secure: 0, not_tested: 0 };
  displayResults.forEach((r) => {
    if (r.status in statusCounts) statusCounts[r.status as keyof typeof statusCounts]++;
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* ===== Report selector — horizontal scrollable cards (same as Risk page) ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            Compliance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No reports available. Run a scan first.
            </p>
          ) : (
            <div
              ref={scrollRef}
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            >
              {reports.map((r) => {
                const isSelected = selectedFile === r.filename;
                const date = new Date(r.timestamp);
                return (
                  <button
                    key={r.filename}
                    onClick={() => setSelectedFile(r.filename)}
                    className={`
                      flex-shrink-0 w-56 rounded-lg border-2 p-3 text-left transition-all
                      hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                      ${
                        isSelected
                          ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                          : "border-border bg-card hover:border-muted-foreground/30 dark:bg-card"
                      }
                    `}
                  >
                    <p
                      className="text-sm font-medium text-foreground truncate"
                      title={r.targetUrl}
                    >
                      {truncateUrl(r.targetUrl)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadgeClasses(r.score)}`}
                      >
                        {r.score}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.totalAttacks} attacks
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Config + Run AI ===== */}
      {selectedFile && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              AI Deep Analysis Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  LLM Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
                >
                  <option value="Anthropic">Anthropic</option>
                  <option value="OpenAI">OpenAI</option>
                  <option value="OpenRouter">OpenRouter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Model (optional)
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. claude-sonnet-4-20250514"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            {/* Framework selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-foreground">
                  Compliance Frameworks
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-medium text-primary hover:text-primary/80"
                  >
                    Select all
                  </button>
                  <span className="text-border">|</span>
                  <button
                    onClick={handleSelectNone}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {frameworks.map((fw) => {
                  const selected = selectedFrameworks.has(fw.id);
                  return (
                    <button
                      key={fw.id}
                      onClick={() => toggleFramework(fw.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        selected
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:border-muted-foreground/30 hover:text-foreground"
                      }`}
                    >
                      {selected && <CheckCircle className="w-3 h-3" />}
                      {fw.name}
                      <span className={selected ? "text-white/70" : "text-muted-foreground"}>
                        ({fw.controlCount})
                      </span>
                    </button>
                  );
                })}
                {frameworks.length === 0 && (
                  <span className="text-sm text-muted-foreground">No frameworks available</span>
                )}
              </div>
            </div>

            <button
              onClick={handleRunAI}
              disabled={isStreaming || selectedFrameworks.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isStreaming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run AI Deep Analysis
                </>
              )}
            </button>
          </CardContent>
        </Card>
      )}

      {/* ===== Error ===== */}
      {streamError && (
        <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-700 dark:text-red-400">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {streamError}
        </div>
      )}

      {/* ===== Loading static ===== */}
      {staticLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ===== Summary counts ===== */}
      {displayResults.length > 0 && !staticLoading && (
        <div className="grid grid-cols-4 gap-4">
          {([
            { key: "vulnerable", icon: XCircle, color: "text-red-600 dark:text-red-400" },
            { key: "at_risk", icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400" },
            { key: "secure", icon: ShieldCheck, color: "text-emerald-600 dark:text-emerald-400" },
            { key: "not_tested", icon: HelpCircle, color: "text-muted-foreground" },
          ] as const).map(({ key, icon: Icon, color }) => {
            const cfg = STATUS_CONFIG[key];
            return (
              <Card key={key}>
                <CardContent className="flex items-center gap-3 py-4 px-5">
                  <Icon className={`w-5 h-5 ${color}`} />
                  <div>
                    <div className="text-2xl font-bold tracking-tight text-foreground">
                      {statusCounts[key]}
                    </div>
                    <div className="text-xs text-muted-foreground">{cfg.label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== Results grouped by framework ===== */}
      {Object.keys(grouped).length > 0 && !staticLoading && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([framework, results]) => {
            const fwCounts = { vulnerable: 0, at_risk: 0, secure: 0, not_tested: 0 };
            results.forEach((r) => {
              if (r.status in fwCounts) fwCounts[r.status as keyof typeof fwCounts]++;
            });

            return (
              <Card key={framework}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-primary" />
                      {framework}
                      <span className="text-xs text-muted-foreground font-normal">
                        ({results.length} controls)
                      </span>
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs">
                      {fwCounts.vulnerable > 0 && (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          {fwCounts.vulnerable}
                        </span>
                      )}
                      {fwCounts.at_risk > 0 && (
                        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          {fwCounts.at_risk}
                        </span>
                      )}
                      {fwCounts.secure > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {fwCounts.secure}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="divide-y divide-border">
                    {results.map((r, i) => (
                      <div
                        key={`${r.code}-${i}`}
                        className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-primary font-semibold">
                              {r.code}
                            </span>
                            <span className="text-sm font-medium text-foreground">{r.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {r.summary}
                          </p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== Empty states ===== */}
      {!selectedFile && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Select a report</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Choose a scan report above to view compliance analysis
            </p>
          </CardContent>
        </Card>
      )}

      {selectedFile && !staticLoading && displayResults.length === 0 && !isStreaming && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No compliance results</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              No rule-based mappings found. Try running the AI deep analysis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
