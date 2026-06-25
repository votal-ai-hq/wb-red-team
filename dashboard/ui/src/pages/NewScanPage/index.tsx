import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { createRun } from "@/api/runs";
import { getReference } from "@/api/reference";
import type { ReferenceData } from "@/api/types";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Play, Zap, Shield, Settings, Rocket } from "lucide-react";

const cardClass =
  "bg-card border border-border rounded-xl shadow-sm";

const TEMPLATES: {
  key: string;
  label: string;
  icon: typeof Zap;
  description: string;
  categories: string[];
  strategy: string;
} [] = [
  {
    key: "quick",
    label: "Quick Scan",
    icon: Zap,
    description: "Fast scan with core attack categories",
    categories: ["prompt_injection", "jailbreak"],
    strategy: "single-shot",
  },
  {
    key: "full",
    label: "Full Scan",
    icon: Shield,
    description: "Comprehensive scan across all categories",
    categories: [], // means all
    strategy: "multi-round",
  },
  {
    key: "custom",
    label: "Custom Agent",
    icon: Settings,
    description: "Advanced config with custom JSON",
    categories: [],
    strategy: "agentic",
  },
];

export default function NewScanPage() {
  const navigate = useNavigate();
  const [ref, setRef] = useState<ReferenceData | null>(null);
  const [refLoading, setRefLoading] = useState(true);

  // Form state
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [strategy, setStrategy] = useState("");
  const [jsonConfig, setJsonConfig] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    getReference()
      .then((data) => {
        setRef(data);
        if (data.strategies.length > 0) {
          setStrategy(data.strategies[0].slug);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load reference data.");
      })
      .finally(() => setRefLoading(false));
  }, []);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const applyTemplate = (key: string) => {
    const tpl = TEMPLATES.find((t) => t.key === key);
    if (!tpl || !ref) return;

    if (tpl.categories.length > 0) {
      // Only select categories that exist in reference data
      setSelectedCategories(
        tpl.categories.filter((c) => ref.categories.includes(c))
      );
    } else {
      // "all" means select every category
      setSelectedCategories([...ref.categories]);
    }

    // Match strategy by slug
    const matchedStrategy = ref.strategies.find((s) => s.slug === tpl.strategy);
    if (matchedStrategy) {
      setStrategy(matchedStrategy.slug);
    }

    if (tpl.key === "custom") {
      setJsonConfig(
        JSON.stringify(
          {
            targetUrl: targetUrl || "https://example.com",
            attackCategories: ref.categories,
            strategies: [tpl.strategy],
          },
          null,
          2
        )
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
        // Ensure target URL is set
        config.targetUrl = targetUrl;
      } else {
        config = {
          targetUrl,
          attackCategories:
            selectedCategories.length > 0 ? selectedCategories : undefined,
          strategies: strategy ? [strategy] : undefined,
        };
      }

      const result = await createRun(config);
      setSuccess(`Scan started! Run ID: ${result.runId}`);
      setTimeout(() => navigate("/scans"), 1200);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start scan.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (refLoading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <span className="text-sm text-muted-foreground">
            Loading scan configuration...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Rocket className="w-6 h-6 text-primary" />
          Launch Scan
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure and start a new security scan
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-emerald-600">
          <span className="font-medium">Success:</span> {success}
        </div>
      )}

      {/* Templates */}
      <div className={`${cardClass} p-5`}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Templates
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <button
                key={tpl.key}
                type="button"
                onClick={() => applyTemplate(tpl.key)}
                className="flex flex-col items-center gap-2 p-4 border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center"
              >
                <Icon className="w-5 h-5 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {tpl.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tpl.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Target URL */}
        <div className={`${cardClass} p-5`}>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Target URL <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://api.example.com"
            required
            className="w-full px-4 py-2.5 text-sm border border-border rounded-lg bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Attack Categories */}
        {ref && ref.categories.length > 0 && (
          <div className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Attack Categories
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCategories([...ref.categories])
                  }
                  className="text-xs text-primary hover:text-primary/80"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategories([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ref.categories.map((cat) => {
                const selected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-primary text-white border-primary"
                        : "bg-muted text-muted-foreground border-border hover:border-primary hover:text-foreground"
                    }`}
                  >
                    {cat.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
            {selectedCategories.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {selectedCategories.length} of {ref.categories.length}{" "}
                selected
              </p>
            )}
          </div>
        )}

        {/* Strategy */}
        {ref && ref.strategies.length > 0 && (
          <div className={`${cardClass} p-5`}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Strategy
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              {ref.strategies.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name} ({s.level})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* JSON Config Editor */}
        <div className={`${cardClass} p-5`}>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Advanced JSON Config
          </label>
          <textarea
            value={jsonConfig}
            onChange={(e) => setJsonConfig(e.target.value)}
            placeholder='{"targetUrl": "...", "attackCategories": [...], ...}'
            rows={6}
            className="w-full px-4 py-2.5 text-sm border border-border rounded-lg bg-muted text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Optional. Overrides form fields when provided.
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !targetUrl.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
