import { useState, useEffect, useCallback } from "react";
import { getAuditLog } from "@/api/audit";
import type { AuditEntry } from "@/api/types";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText, ChevronDown, Clock, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

const cardClass =
  "bg-card border border-border rounded-xl p-5 shadow-sm";

const ACTION_TYPES = [
  { value: "", label: "All Actions" },
  { value: "run.start", label: "Run Start" },
  { value: "run.complete", label: "Run Complete" },
  { value: "run.cancel", label: "Run Cancel" },
  { value: "report.view", label: "Report View" },
  { value: "report.delete", label: "Report Delete" },
  { value: "report.export", label: "Report Export" },
  { value: "compliance.analyze", label: "Compliance Analyze" },
  { value: "risk.analyze", label: "Risk Analyze" },
];

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [noDatabase, setNoDatabase] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);

  const fetchLog = useCallback(
    (action: string) => {
      setLoading(true);
      setNoDatabase(false);
      getAuditLog(200, 0, action || undefined)
        .then((res) => {
          setEntries(res.entries);
          setTotal(res.total);
        })
        .catch((err) => {
          if (err?.status === 503 || err?.message?.includes("503")) {
            setNoDatabase(true);
          } else {
            console.error(err);
          }
        })
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    fetchLog(actionFilter);
  }, [actionFilter, fetchLog]);

  if (noDatabase) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className={`${cardClass} text-center py-16`}>
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Audit Log Unavailable
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            No database is configured for the audit log. Please configure a
            database connection to enable activity tracking.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Activity Log
            {!loading && (
              <span className="text-sm font-normal text-muted-foreground">
                ({total} entries)
              </span>
            )}
          </h2>

          {/* Action filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground hover:border-primary transition-colors"
            >
              <span>
                {ACTION_TYPES.find((a) => a.value === actionFilter)?.label ||
                  "All Actions"}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-20 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {ACTION_TYPES.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => {
                      setActionFilter(a.value);
                      setFilterOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${
                      actionFilter === a.value
                        ? "bg-muted font-medium text-primary"
                        : "text-foreground"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by action, resource, or user..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No audit entries"
          description={
            actionFilter
              ? "No entries found for this action type. Try a different filter."
              : "No activity has been recorded yet."
          }
          icon={<FileText className="w-12 h-12" />}
        />
      ) : (
        <div className={cardClass}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">
                    Timestamp
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">
                    Action
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">
                    Resource Type
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">
                    Resource ID
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">
                    User
                  </th>
                  <th className="text-left py-2 font-semibold text-muted-foreground">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.filter((entry) => {
                  if (!debouncedSearch) return true;
                  const q = debouncedSearch.toLowerCase();
                  return (
                    (entry.action ?? "").toLowerCase().includes(q) ||
                    (entry.targetType ?? entry.resource_type ?? "").toLowerCase().includes(q) ||
                    (entry.targetId ?? entry.resource_id ?? "").toLowerCase().includes(q) ||
                    (entry.userId ?? entry.user_id ?? "").toLowerCase().includes(q)
                  );
                }).map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                      {new Date(entry.createdAt ?? entry.timestamp ?? "").toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-foreground">
                      {entry.targetType ?? entry.resource_type ?? "-"}
                    </td>
                    <td className="py-2.5 pr-4 text-foreground font-mono text-xs max-w-[180px] truncate" title={entry.targetId ?? entry.resource_id ?? ""}>
                      {entry.targetId ?? entry.resource_id ?? "-"}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {entry.userId ?? entry.user_id ?? "-"}
                    </td>
                    <td className="py-2.5 text-muted-foreground text-xs max-w-[200px] truncate">
                      {entry.details
                        ? JSON.stringify(entry.details)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
