import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { getRuns, getRun, deleteRun, createRun } from "@/api/runs";
import type { RunMeta, RunDetail } from "@/api/types";
import { usePolling } from "@/hooks/usePolling";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";

/* ─── helpers ─── */

type RunStatus = RunMeta["status"];

const STATUS_CONFIG: Record<
  RunStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    borderColor: string;
    bgColor: string;
    icon: React.ElementType;
    pulse?: boolean;
  }
> = {
  running: {
    label: "RUNNING",
    variant: "default",
    borderColor: "border-l-blue-500",
    bgColor: "bg-blue-50/50 dark:bg-blue-950/20",
    icon: Loader2,
    pulse: true,
  },
  queued: {
    label: "QUEUED",
    variant: "outline",
    borderColor: "border-l-amber-500",
    bgColor: "bg-amber-50/50 dark:bg-amber-950/20",
    icon: Clock,
  },
  done: {
    label: "DONE",
    variant: "secondary",
    borderColor: "border-l-emerald-500",
    bgColor: "",
    icon: CheckCircle,
  },
  error: {
    label: "ERROR",
    variant: "destructive",
    borderColor: "border-l-red-500",
    bgColor: "bg-red-50/50 dark:bg-red-950/20",
    icon: XCircle,
  },
  cancelled: {
    label: "CANCELLED",
    variant: "destructive",
    borderColor: "border-l-red-400",
    bgColor: "bg-red-50/30 dark:bg-red-950/10",
    icon: AlertCircle,
  },
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function verdictColor(verdict: string) {
  const v = verdict.toUpperCase();
  if (v === "PASS") return "text-emerald-600 dark:text-emerald-400";
  if (v === "FAIL") return "text-red-600 dark:text-red-400";
  if (v === "PARTIAL") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

/* ─── main component ─── */

export default function RunsPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<Record<string, RunDetail>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [rerunningIds, setRerunningIds] = useState<Set<string>>(new Set());

  const refreshRuns = useCallback(() => {
    getRuns()
      .then((data) => setRuns(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    refreshRuns();
    setLoading(false);
  }, [refreshRuns]);

  // Poll active runs
  const activeRunIds = runs
    .filter((r) => r.status === "running" || r.status === "queued")
    .map((r) => r.runId);

  const pollActiveRuns = useCallback(() => {
    refreshRuns();
    if (expandedId && activeRunIds.includes(expandedId)) {
      getRun(expandedId)
        .then((detail) =>
          setRunDetails((prev) => ({ ...prev, [expandedId]: detail }))
        )
        .catch(console.error);
    }
  }, [expandedId, activeRunIds, refreshRuns]);

  usePolling(pollActiveRuns, 3000, activeRunIds.length > 0);

  // Expand/collapse run detail
  const toggleExpand = useCallback(
    (runId: string) => {
      if (expandedId === runId) {
        setExpandedId(null);
        return;
      }
      setExpandedId(runId);
      if (!runDetails[runId]) {
        setDetailLoading((prev) => ({ ...prev, [runId]: true }));
        getRun(runId, 0, true)
          .then((detail) =>
            setRunDetails((prev) => ({ ...prev, [runId]: detail }))
          )
          .catch(console.error)
          .finally(() =>
            setDetailLoading((prev) => ({ ...prev, [runId]: false }))
          );
      }
    },
    [expandedId, runDetails],
  );

  // Delete run
  const handleDelete = useCallback(
    async (runId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Delete this run? This cannot be undone.")) return;
      setDeletingIds((prev) => new Set(prev).add(runId));
      try {
        await deleteRun(runId, true);
        setRuns((prev) => prev.filter((r) => r.runId !== runId));
        if (expandedId === runId) setExpandedId(null);
      } catch (err) {
        console.error("Failed to delete run:", err);
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(runId);
          return next;
        });
      }
    },
    [expandedId],
  );

  // Edit & Rerun
  const handleRerun = useCallback(
    async (runId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setRerunningIds((prev) => new Set(prev).add(runId));
      try {
        // Fetch run detail with config
        let detail = runDetails[runId];
        if (!detail?.config) {
          detail = await getRun(runId, 0, true);
          setRunDetails((prev) => ({ ...prev, [runId]: detail }));
        }
        if (detail.config) {
          // Navigate to new scan page with the config pre-filled
          navigate("/new-scan", { state: { config: detail.config } });
        } else {
          // No config available — just navigate to new scan
          navigate("/new-scan");
        }
      } catch {
        navigate("/new-scan");
      } finally {
        setRerunningIds((prev) => {
          const next = new Set(prev);
          next.delete(runId);
          return next;
        });
      }
    },
    [runDetails, navigate],
  );

  // Cancel run
  const handleCancel = useCallback(
    async (runId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await deleteRun(runId, false); // cancel, not purge
        refreshRuns();
      } catch (err) {
        console.error("Failed to cancel run:", err);
      }
    },
    [refreshRuns],
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading runs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">Scan Activity</h1>
          <p className="text-sm text-muted-foreground">
            {runs.length} run{runs.length !== 1 ? "s" : ""}
            {activeRunIds.length > 0 && (
              <span className="text-primary ml-2 font-medium">
                ({activeRunIds.length} active)
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate("/new-scan")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Play className="w-4 h-4" />
          New Scan
        </button>
      </div>

      {/* Runs list */}
      {runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No scan runs yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Start a new scan to see activity here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.queued;
            const Icon = cfg.icon;
            const isExpanded = expandedId === run.runId;
            const detail = runDetails[run.runId];
            const isDetailLoading = detailLoading[run.runId];
            const isDeleting = deletingIds.has(run.runId);
            const isRerunning = rerunningIds.has(run.runId);

            return (
              <div
                key={run.runId}
                className={`rounded-xl border border-border border-l-4 ${cfg.borderColor} ${cfg.bgColor} overflow-hidden`}
              >
                {/* Run row — click anywhere to expand */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => toggleExpand(run.runId)}
                >
                  {/* Expand toggle */}
                  <span className="text-muted-foreground shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>

                  {/* Status badge */}
                  <Badge variant={cfg.variant} className="shrink-0">
                    <Icon className={`w-3 h-3 mr-1 ${cfg.pulse ? "animate-spin" : ""}`} />
                    {cfg.label}
                  </Badge>

                  {/* Date */}
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {fmtDateTime(run.startedAt)}
                  </span>

                  {/* Target URL */}
                  <span
                    className="text-sm font-medium text-foreground truncate flex-1 min-w-0"
                    title={run.targetUrl ?? ""}
                  >
                    {run.targetUrl ?? "—"}
                  </span>

                  {/* Attacks count */}
                  {run.progressCount != null && run.progressCount > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {run.progressCount} attacks
                    </span>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(run.status === "running" || run.status === "queued") && (
                      <button
                        onClick={(e) => handleCancel(run.runId, e)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={(e) => handleRerun(run.runId, e)}
                      disabled={isRerunning}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isRerunning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      Edit & Rerun
                    </button>
                    <button
                      onClick={(e) => handleDelete(run.runId, e)}
                      disabled={isDeleting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border px-5 pb-4 pt-3 bg-card">
                    {isDetailLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : detail ? (
                      <div className="space-y-4">
                        {/* Error message */}
                        {detail.error && (
                          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                                Run failed: Cancelled by user
                              </p>
                              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                                {detail.error}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Summary */}
                        {detail.summary && typeof detail.summary === "string" && (
                          <p className="text-sm text-muted-foreground">{detail.summary}</p>
                        )}

                        {/* Progress list */}
                        {(detail.progress?.length ?? 0) > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                              Progress ({detail.progress?.length ?? 0}
                              {detail.progressTotal ? ` / ${detail.progressTotal}` : ""})
                            </h4>
                            <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                              {(detail.progress ?? []).map((p) => (
                                <div
                                  key={p.index}
                                  className="flex items-center gap-3 text-sm py-2 px-3 hover:bg-muted/30"
                                >
                                  <span className="text-xs text-muted-foreground w-6 text-right tabular-nums shrink-0">
                                    {p.index + 1}
                                  </span>
                                  <span className="font-medium text-foreground truncate flex-1">
                                    {p.attackName}
                                  </span>
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {p.category}
                                  </span>
                                  <span className={`text-xs font-semibold shrink-0 ${verdictColor(p.verdict)}`}>
                                    {p.verdict}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Report link */}
                        {run.status === "done" && detail.reportFile && (
                          <button
                            onClick={() => navigate(`/reports/${detail.reportFile}`)}
                            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            View Report
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4">
                        Could not load run details.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
