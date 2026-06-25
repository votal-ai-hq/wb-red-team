import { useState, useEffect, useCallback } from "react";
import { getAuditLog } from "@/api/audit";
import type { AuditEntry } from "@/api/types";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText, ChevronDown, Clock } from "lucide-react";

const cardClass =
  "bg-white border border-[rgba(20,45,90,0.14)] rounded-xl p-5 shadow-sm";

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
          <h2 className="text-lg font-semibold text-[#1a2433] mb-2">
            Audit Log Unavailable
          </h2>
          <p className="text-sm text-[#5a6b82] max-w-md mx-auto">
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
          <h2 className="text-lg font-semibold text-[#1a2433] flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Activity Log
            {!loading && (
              <span className="text-sm font-normal text-text-secondary">
                ({total} entries)
              </span>
            )}
          </h2>

          {/* Action filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-text-primary hover:border-accent transition-colors"
            >
              <span>
                {ACTION_TYPES.find((a) => a.value === actionFilter)?.label ||
                  "All Actions"}
              </span>
              <ChevronDown className="w-4 h-4 text-text-secondary" />
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-20 mt-1 w-48 bg-white border border-border rounded-lg shadow-lg overflow-hidden">
                {ACTION_TYPES.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => {
                      setActionFilter(a.value);
                      setFilterOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-surface2 transition-colors ${
                      actionFilter === a.value
                        ? "bg-surface2 font-medium text-accent"
                        : "text-text-primary"
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
                  <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                    Timestamp
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                    Action
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                    Resource Type
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                    Resource ID
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-text-secondary">
                    User
                  </th>
                  <th className="text-left py-2 font-semibold text-text-secondary">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2.5 pr-4 text-text-secondary whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-text-primary">
                      {entry.resource_type}
                    </td>
                    <td className="py-2.5 pr-4 text-text-primary font-mono text-xs max-w-[180px] truncate" title={entry.resource_id}>
                      {entry.resource_id}
                    </td>
                    <td className="py-2.5 pr-4 text-text-secondary">
                      {entry.user_id || "-"}
                    </td>
                    <td className="py-2.5 text-text-secondary text-xs max-w-[200px] truncate">
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
