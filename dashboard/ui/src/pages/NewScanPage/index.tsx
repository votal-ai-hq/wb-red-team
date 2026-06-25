import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { createRun } from "@/api/runs";
import { getReference } from "@/api/reference";
import type { ReferenceData } from "@/api/types";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Play,
  Zap,
  Shield,
  Settings,
  Rocket,
  Target,
  Layers,
  Code,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";

const TEMPLATES = [
  {
    key: "quick",
    label: "Quick Scan",
    icon: Zap,
    description: "Core attack categories with single-shot strategy. Fast results in minutes.",
    categories: ["prompt_injection", "jailbreak"],
    strategy: "single-shot",
    color: "text-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  {
    key: "full",
    label: "Full Scan",
    icon: Shield,
    description: "All attack categories with multi-round strategy. Thorough coverage.",
    categories: [] as string[],
    strategy: "multi-round",
    color: "text-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    key: "custom",
    label: "Custom Agent",
    icon: Settings,
    description: "Agentic strategy with custom JSON config for advanced use cases.",
    categories: [] as string[],
    strategy: "agentic",
    color: "text-violet-500",
    bg: "bg-violet-50",
    border: "border-violet-200",
  },
] as const;

function prettyCategoryName(cat: string) {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NewScanPage() {
  const navigate = useNavigate();
  const [ref, setRef] = useState<ReferenceData | null>(null);
  const [refLoading, setRefLoading] = useState(true);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  const [targetUrl, setTargetUrl] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [strategy, setStrategy] = useState("");
  const [jsonConfig, setJsonConfig] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    getReference()
      .then((data) => {
        setRef(data);
        if (data.strategies.length > 0) setStrategy(data.strategies[0].slug);
      })
      .catch(() => setError("Failed to load reference data."))
      .finally(() => setRefLoading(false));
  }, []);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const applyTemplate = (key: string) => {
    const tpl = TEMPLATES.find((t) => t.key === key);
    if (!tpl || !ref) return;
    setActiveTemplate(key);
    setShowAdvanced(key === "custom");

    if (tpl.categories.length > 0) {
      setSelectedCategories(tpl.categories.filter((c) => ref.categories.includes(c)));
    } else {
      setSelectedCategories([...ref.categories]);
    }

    const matched = ref.strategies.find((s) => s.slug === tpl.strategy);
    if (matched) setStrategy(matched.slug);

    if (key === "custom") {
      setJsonConfig(
        JSON.stringify(
          {
            targetUrl: targetUrl || "https://api.example.com",
            attackCategories: ref.categories,
            strategies: [tpl.strategy],
          },
          null,
          2,
        ),
      );
    } else {
      setJsonConfig("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!targetUrl.trim()) {
      setError("Target URL is required.");
      return;
    }

    setSubmitting(true);
    try {
      let config: Record<string, unknown>;
      if (jsonConfig.trim()) {
        try {
          config = JSON.parse(jsonConfig);
        } catch {
          setError("Invalid JSON configuration.");
          setSubmitting(false);
          return;
        }
        config.targetUrl = targetUrl;
      } else {
        config = {
          targetUrl,
          attackCategories: selectedCategories.length > 0 ? selectedCategories : undefined,
          strategies: strategy ? [strategy] : undefined,
        };
      }

      const result = await createRun(config);
      setSuccess(`Scan started! Run ID: ${result.runId}`);
      setTimeout(() => navigate("/scans"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start scan.");
    } finally {
      setSubmitting(false);
    }
  };

  if (refLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <span className="text-sm text-muted-foreground">Loading configuration...</span>
        </div>
      </div>
    );
  }

  const allSelected =
    ref && selectedCategories.length === ref.categories.length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Launch Scan
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure and start a new security scan against your target
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Choose a template */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              1
            </div>
            <h2 className="text-sm font-semibold text-foreground">
              Choose a scan template
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              const isActive = activeTemplate === tpl.key;
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => applyTemplate(tpl.key)}
                  className={`relative flex flex-col items-start gap-3 p-5 rounded-xl border-2 transition-all text-left ${
                    isActive
                      ? `${tpl.border} ${tpl.bg} shadow-sm`
                      : "border-border bg-card hover:border-muted-foreground/20 hover:shadow-sm"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isActive ? tpl.bg : "bg-muted"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${isActive ? tpl.color : "text-muted-foreground"}`}
                    />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground block">
                      {tpl.label}
                    </span>
                    <span className="text-xs text-muted-foreground leading-relaxed mt-1 block">
                      {tpl.description}
                    </span>
                  </div>
                  {isActive && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle className={`w-5 h-5 ${tpl.color}`} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2: Target URL */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              2
            </div>
            <h2 className="text-sm font-semibold text-foreground">
              Set your target
            </h2>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-4 h-4 text-muted-foreground" />
              <label className="text-sm font-medium text-foreground">
                Target URL <span className="text-red-500">*</span>
              </label>
            </div>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://api.example.com/v1/chat"
              required
              className="w-full px-4 py-3 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <p className="text-xs text-muted-foreground mt-2">
              The API endpoint or application URL to test
            </p>
          </div>
        </section>

        {/* Step 3: Attack categories */}
        {ref && ref.categories.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                3
              </div>
              <h2 className="text-sm font-semibold text-foreground">
                Select attack categories
              </h2>
              <span className="text-xs text-muted-foreground ml-1">
                ({selectedCategories.length}/{ref.categories.length})
              </span>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    Categories
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([...ref.categories])}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Select all
                  </button>
                  <span className="text-border">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {selectedCategories.length > 0 && (
                <div className="mb-4">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{
                        width: `${(selectedCategories.length / ref.categories.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {ref.categories.map((cat) => {
                  const selected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        selected
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:border-muted-foreground/30 hover:text-foreground"
                      }`}
                    >
                      {selected && <CheckCircle className="w-3 h-3" />}
                      {prettyCategoryName(cat)}
                    </button>
                  );
                })}
              </div>

              {allSelected && (
                <p className="text-xs text-emerald-600 mt-3 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  All categories selected — comprehensive coverage
                </p>
              )}
            </div>
          </section>
        )}

        {/* Step 4: Strategy */}
        {ref && ref.strategies.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                4
              </div>
              <h2 className="text-sm font-semibold text-foreground">
                Choose strategy
              </h2>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Play className="w-4 h-4 text-muted-foreground" />
                <label className="text-sm font-medium text-foreground">
                  Attack Strategy
                </label>
              </div>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
              >
                {ref.strategies.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name} — {s.level}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* Advanced config toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Code className="w-4 h-4" />
            {showAdvanced ? "Hide" : "Show"} advanced JSON config
          </button>
        </div>

        {showAdvanced && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Code className="w-4 h-4 text-muted-foreground" />
              <label className="text-sm font-medium text-foreground">
                JSON Configuration
              </label>
            </div>
            <textarea
              value={jsonConfig}
              onChange={(e) => setJsonConfig(e.target.value)}
              placeholder='{"targetUrl": "...", "attackCategories": [...], ...}'
              rows={8}
              className="w-full px-4 py-3 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground/50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Overrides form fields above when provided. Use for advanced configurations.
            </p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !targetUrl.trim()}
          className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-[0.99]"
        >
          {submitting ? (
            <>
              <LoadingSpinner size="sm" />
              Starting Scan...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Start Scan
            </>
          )}
        </button>
      </form>
    </div>
  );
}
