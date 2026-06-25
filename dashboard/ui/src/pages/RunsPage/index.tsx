import { useState, useEffect, useCallback } from "react";
import { getRuns, getRun } from "@/api/runs";
import type { RunMeta, RunDetail } from "@/api/types";
import { usePolling } from "@/hooks/usePolling";
import { useDebounce } from "@/hooks/useDebounce";
import { Badge } from "@/components/shared/Badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Play,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";

const cardClass =
  "bg-card border border-border rounded-xl shadow-sm";

type RunStatus = RunMeta["status"];

const statusConfig: Record<
  RunStatus,
  { label: string; variant: "info" | "success" | "critical" | "medium" | "low"; icon: typeof Play; pulse?: boolean }
> = {
  running: { label: "Running", variant: "info", icon: Play, pulse: true },
  done: { label: "Done", variant: "success", icon: CheckCircle },
  error: { label: "Error", variant: "critical", icon: XCircle },
  cancelled: { label: "Cancelled", variant: "low", icon: AlertCircle },
  queued: { label: "Queued", variant: "medium", icon: Clock },
};

function StatusBadge({ status }: { status: RunStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.queued;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 ${cfg.pulse ? "animate-pulse" : ""}`}>
      <Badge variant={cfg.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {cfg.label}
      </Badge>
    </span>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateId(id: string) {
  return id.length > 12 ? id.slice(0, 12) + "..." : id;
}

function verdictColor(verdict: string) {
  const v = verdict.toLowerCase();
  if (v === "pass" || v === "passed") return "text-emerald-600";
  if (v === "fail" || v === "failed") return "text-red-600";
  return "text-muted-foreground";
}

export default function RunsPage() {
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<Record<string, RunDetail>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});

  // Fetch runs list
  useEffect(() => {
    getRuns()
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Determine which runs are active (need polling)
  const activeRunIds = runs
    .filter((r) => r.status === "running" || r.status === "queued")
    .map((r) => r.runId);

  const hasActiveRuns = activeRunIds.length > 0;

  // Poll active runs
  const pollActiveRuns = useCallback(() => {
    // Refresh the runs list
    getRuns().then(setRuns).catch(console.error);

    // If an active run is expanded, refresh its detail
    if (expandedId && activeRunIds.includes(expandedId)) {
      getRun(expandedId)
        .then((detail) =>
          setRunDetails((prev) => ({ ...prev, [expandedId]: detail }))
        )
        .catch(console.error);
    }
  }, [expandedId, activeRunIds]);

  usePolling(pollActiveRuns, 2000, hasActiveRuns);

  // Load detail when a card is expanded
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
    [expandedId, runDetails]
  );

  // Filter runs by search
  const filtered = debouncedSearch
    ? runs.filter((r) =>
        (r.targetUrl ?? "").toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : runs;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <span className="text-sm text-muted-foreground">Loading runs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scan Runs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Active and historical scan activity
          </p>
        </div>
        {hasActiveRuns && (
          <span className="inline-flex items-center gap-2 text-sm text-primary font-medium animate-pulse">
            <Play className="w-4 h-4" />
            {activeRunIds.length} active
          </span>
        )}
      </div>

      {/* Search */}
      <div className={`${cardClass} p-3`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by target URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
      </div>

      {/* Runs list */}
      {filtered.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            title={debouncedSearch ? "No matching runs" : "No scan runs yet"}
            description={
              debouncedSearch
                ? "Try a different search term."
                : "Start a new scan to see runs here."
            }
            icon={<Clock className="w-12 h-12" />}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((run) => {
            const isExpanded = expandedId === run.runId;
            const detail = runDetails[run.runId];
            const isDetailLoading = detailLoading[run.runId];

            return (
              <div key={run.runId} className={cardClass}>
                {/* Run card header */}
                <button
                  onClick={() => toggleExpand(run.runId)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/50 rounded-xl transition-colors"
                >
                  <span className="text-muted-foreground">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {truncateId(run.runId)}
                      </code>
                      <StatusBadge status={run.status} />
                      {run.progressCount != null && (
                        <span className="text-xs text-muted-foreground">
                          {run.progressCount} attacks
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      {run.targetUrl && (
                        <span className="text-sm font-medium text-foreground truncate max-w-[400px]">
                          {run.targetUrl}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(run.startedAt)}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    {isDetailLoading ? (
                      <div className="py-8">
                        <LoadingSpinner size="sm" />
                      </div>
                    ) : detail ? (
                      <div className="space-y-4">
                        {/* Summary */}
                        {detail.summary && (
                          <p className="text-sm text-muted-foreground italic">
                            {detail.summary}
                          </p>
                        )}

                        {/* Error message */}
                        {detail.error && (
                          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-600">{detail.error}</p>
                          </div>
                        )}

                        {/* Progress list */}
                        {detail.progress.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                              Progress ({detail.progress.length}
                              {detail.progressTotal
                                ? ` / ${detail.progressTotal}`
                                : ""}
                              )
                            </h4>
                            <div className="max-h-64 overflow-y-auto space-y-1">
                              {detail.progress.map((p) => (
                                <div
                                  key={p.index}
                                  className="flex items-center gap-3 text-sm py-1.5 px-2 rounded hover:bg-muted/50"
                                >
                                  <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                                    {p.index + 1}
                                  </span>
                                  <span className="font-medium text-foreground truncate flex-1">
                                    {p.attackName}
                                  </span>
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {p.category}
                                  </span>
                                  <span
                                    className={`text-xs font-semibold shrink-0 ${verdictColor(
                                      p.verdict
                                    )}`}
                                  >
                                    {p.verdict}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Link to report */}
                        {run.status === "done" && detail.reportFile && (
                          <a
                            href={`/reports`}
                            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            View Report
                          </a>
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
