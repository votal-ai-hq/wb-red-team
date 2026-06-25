import { useState, useEffect, useCallback } from "react";
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
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { CheckSquare, Play, ChevronDown } from "lucide-react";

const cardClass =
  "bg-white border border-[rgba(20,45,90,0.14)] rounded-xl p-5 shadow-sm";

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  vulnerable: { bg: "bg-red-100", text: "text-red-800", label: "Vulnerable" },
  at_risk: { bg: "bg-orange-100", text: "text-orange-800", label: "At Risk" },
  secure: { bg: "bg-green-100", text: "text-green-800", label: "Secure" },
  not_tested: { bg: "bg-gray-100", text: "text-gray-700", label: "Not Tested" },
};

function StatusBadge({ status }: { status: string }) {
  const style = statusColors[status] || statusColors.not_tested;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export default function CompliancePage() {
  // Step 1: Report selection
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Step 2: Config
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState("Anthropic");
  const [model, setModel] = useState("");

  // Step 3: Results
  const [staticResults, setStaticResults] = useState<ComplianceResult[]>([]);
  const [staticLoading, setStaticLoading] = useState(false);
  const {
    data: aiResults,
    isStreaming,
    error: streamError,
    start,
  } = useNDJSONStream<ComplianceResult>();

  // Fetch reports + frameworks on mount
  useEffect(() => {
    Promise.all([getReportsMeta(1, 200), getFrameworks()])
      .then(([reportsRes, fws]) => {
        setReports(reportsRes.items);
        setFrameworks(fws);
        setSelectedFrameworks(new Set(fws.map((f) => f.id)));
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
      model || undefined
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center py-32">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Step 1: Report Selector */}
      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-[#1a2433] mb-3 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-accent" />
          Compliance Analysis
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

      {/* Step 2: Configure & Run */}
      {selectedFile && (
        <div className={cardClass}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-4">
            AI Deep Analysis Configuration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Provider */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                LLM Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="Anthropic">Anthropic</option>
                <option value="OpenAI">OpenAI</option>
                <option value="OpenRouter">OpenRouter</option>
              </select>
            </div>
            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Model (optional)
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. claude-sonnet-4-20250514"
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Framework selector */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-primary">
                Compliance Frameworks
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-accent hover:underline"
                >
                  Select All
                </button>
                <span className="text-xs text-text-secondary">|</span>
                <button
                  onClick={handleSelectNone}
                  className="text-xs text-accent hover:underline"
                >
                  None
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {frameworks.map((fw) => (
                <button
                  key={fw.id}
                  onClick={() => toggleFramework(fw.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selectedFrameworks.has(fw.id)
                      ? "bg-accent/10 border-accent text-accent"
                      : "bg-surface2 border-border text-text-secondary hover:border-accent/50"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                      selectedFrameworks.has(fw.id)
                        ? "bg-accent border-accent text-white"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedFrameworks.has(fw.id) && "\u2713"}
                  </span>
                  {fw.name}
                  <span className="text-text-secondary">({fw.controlCount})</span>
                </button>
              ))}
              {frameworks.length === 0 && (
                <span className="text-sm text-text-secondary">
                  No frameworks available
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleRunAI}
            disabled={isStreaming || selectedFrameworks.size === 0}
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
                Run AI Deep Analysis
              </>
            )}
          </button>
        </div>
      )}

      {/* Step 3: Results */}
      {streamError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {streamError}
        </div>
      )}

      {staticLoading && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      )}

      {Object.keys(grouped).length > 0 && !staticLoading && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([framework, results]) => (
            <div key={framework} className={cardClass}>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-accent" />
                {framework}
                <span className="text-xs text-text-secondary font-normal">
                  ({results.length} controls)
                </span>
              </h3>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div
                    key={`${r.code}-${i}`}
                    className="flex items-start gap-3 p-3 bg-surface2/50 rounded-lg border border-border/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-accent font-semibold">
                          {r.code}
                        </span>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-sm font-medium text-text-primary">{r.title}</p>
                      <p className="text-xs text-text-secondary mt-1">{r.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!selectedFile && !loading && (
        <EmptyState
          title="Select a report"
          description="Choose a scan report above to view compliance analysis."
          icon={<CheckSquare className="w-12 h-12" />}
        />
      )}

      {selectedFile && !staticLoading && displayResults.length === 0 && !isStreaming && (
        <EmptyState
          title="No compliance results"
          description="No rule-based mappings found. Try running the AI deep analysis."
          icon={<CheckSquare className="w-12 h-12" />}
        />
      )}
    </div>
  );
}
