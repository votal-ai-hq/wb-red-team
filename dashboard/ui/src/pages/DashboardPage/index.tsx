import { useEffect, useState } from "react";
import { getReportsMeta } from "@/api/reports";
import { getRuns } from "@/api/runs";
import type { ReportMeta, RunMeta } from "@/api/types";
import { ScoreRing } from "@/components/shared/ScoreRing";

function getRiskLevel(score: number): { label: string; color: string; bg: string } {
  if (score >= 70) return { label: "Low", color: "text-emerald-600", bg: "bg-emerald-50" };
  if (score >= 50) return { label: "Medium", color: "text-amber-600", bg: "bg-orange-50" };
  if (score >= 30) return { label: "High", color: "text-orange-600", bg: "bg-orange-50" };
  return { label: "Critical", color: "text-red-600", bg: "bg-red-50" };
}

const cardClass =
  "bg-card border border-border rounded-xl p-5 shadow-sm";

export default function DashboardPage() {
  const [reportsMeta, setReportsMeta] = useState<ReportMeta[]>([]);
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getReportsMeta(1, 200), getRuns()])
      .then(([reportsRes, runsRes]) => {
        setReportsMeta(reportsRes.items);
        setRuns(runsRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // ── Stats ──
  const totalVulns = reportsMeta.reduce((s, r) => s + r.passed, 0);
  const totalBlocked = reportsMeta.reduce((s, r) => s + r.failed, 0);
  const totalAttacks = reportsMeta.reduce((s, r) => s + r.totalAttacks, 0);
  const avgScore =
    reportsMeta.length > 0
      ? Math.round(reportsMeta.reduce((s, r) => s + r.score, 0) / reportsMeta.length)
      : 0;
  const latestScore = reportsMeta.length > 0 ? reportsMeta[0].score : 0;
  const scansCompleted = reportsMeta.length;
  const risk = getRiskLevel(avgScore);

  // ── Attack category analysis ──
  const categoryCounts: Record<string, number> = {};
  const categoryVulnCounts: Record<string, number> = {};
  reportsMeta.forEach((r) => {
    (r.attackCategories ?? []).forEach((cat) => {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      categoryVulnCounts[cat] = (categoryVulnCounts[cat] || 0) + r.passed;
    });
  });
  const mostCommonAttack = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const mostVulnerableAttack = Object.entries(categoryVulnCounts).sort((a, b) => b[1] - a[1])[0];

  // ── Score distribution ──
  const scoreBuckets = { critical: 0, high: 0, medium: 0, secure: 0 };
  reportsMeta.forEach((r) => {
    if (r.score < 30) scoreBuckets.critical++;
    else if (r.score < 50) scoreBuckets.high++;
    else if (r.score < 70) scoreBuckets.medium++;
    else scoreBuckets.secure++;
  });

  // ── Severity distribution (from score thresholds) ──
  const severityDist = {
    Critical: scoreBuckets.critical,
    High: scoreBuckets.high,
    Medium: scoreBuckets.medium,
    Low: scoreBuckets.secure,
  };

  // ── Top targets by vulnerabilities ──
  const targetVulns: Record<string, number> = {};
  reportsMeta.forEach((r) => {
    targetVulns[r.targetUrl] = (targetVulns[r.targetUrl] || 0) + r.passed;
  });
  const topTargets = Object.entries(targetVulns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxTargetVulns = topTargets.length > 0 ? topTargets[0][1] : 1;

  // ── Recent scans ──
  const recentScans = reportsMeta.slice(0, 10);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Row 1: Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Security Score */}
        <div className={`${cardClass} flex flex-col items-center justify-center gap-2`}>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Security Score
          </span>
          <ScoreRing score={latestScore} size={96} />
          <span className="text-xs text-muted-foreground">Latest scan</span>
        </div>

        {/* Total Attacks */}
        <div className={`${cardClass} flex flex-col gap-2`}>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Attacks
          </span>
          <div className="flex items-center gap-2 mt-auto">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-3xl font-bold text-foreground">{totalAttacks.toLocaleString()}</span>
          </div>
          <span className="text-xs text-muted-foreground">{scansCompleted} scans completed</span>
        </div>

        {/* Vulnerabilities Found */}
        <div className={`${cardClass} flex flex-col gap-2 bg-red-50`}>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vulnerabilities Found
          </span>
          <div className="flex items-center gap-2 mt-auto">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-3xl font-bold text-red-600">{totalVulns.toLocaleString()}</span>
          </div>
          <span className="text-xs text-muted-foreground">Across all scans</span>
        </div>

        {/* Attacks Blocked */}
        <div className={`${cardClass} flex flex-col gap-2 bg-emerald-50`}>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attacks Blocked
          </span>
          <div className="flex items-center gap-2 mt-auto">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-3xl font-bold text-emerald-600">{totalBlocked.toLocaleString()}</span>
          </div>
          <span className="text-xs text-muted-foreground">Successfully defended</span>
        </div>

        {/* Overall Risk */}
        <div className={`${cardClass} flex flex-col items-center justify-center gap-2`}>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Overall Risk
          </span>
          <div className={`px-4 py-2 rounded-lg ${risk.bg}`}>
            <span className={`text-2xl font-bold ${risk.color}`}>{risk.label}</span>
          </div>
          <span className="text-xs text-muted-foreground">Avg score: {avgScore}</span>
        </div>
      </div>

      {/* Row 2: Analysis cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Most Vulnerable Attack Type */}
        <div className={cardClass}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Most Vulnerable Attack Type
          </h3>
          {mostVulnerableAttack ? (
            <div>
              <p className="text-lg font-semibold text-foreground">{mostVulnerableAttack[0]}</p>
              <p className="text-sm text-red-600 mt-1">
                {mostVulnerableAttack[1]} vulnerabilities found
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data available yet</p>
          )}
        </div>

        {/* Most Common Attack Type */}
        <div className={cardClass}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Most Common Attack Type
          </h3>
          {mostCommonAttack ? (
            <div>
              <p className="text-lg font-semibold text-foreground">{mostCommonAttack[0]}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tested in {mostCommonAttack[1]} scans
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data available yet</p>
          )}
        </div>

        {/* Attack Severity Distribution */}
        <div className={cardClass}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Attack Severity Distribution
          </h3>
          <div className="space-y-2">
            {(
              [
                { label: "Critical", count: severityDist.Critical, color: "bg-red-500" },
                { label: "High", count: severityDist.High, color: "bg-orange-500" },
                { label: "Medium", count: severityDist.Medium, color: "bg-amber-500" },
                { label: "Low", count: severityDist.Low, color: "bg-emerald-500" },
              ] as const
            ).map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                <span className="text-muted-foreground w-16">{item.label}</span>
                <span className="font-semibold text-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Score distribution + Top targets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scan Score Distribution */}
        <div className={cardClass}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Scan Score Distribution
          </h3>
          <div className="space-y-3">
            {(
              [
                { label: "Critical (<30)", count: scoreBuckets.critical, color: "bg-red-500" },
                { label: "High Risk (30-49)", count: scoreBuckets.high, color: "bg-orange-500" },
                { label: "Medium (50-69)", count: scoreBuckets.medium, color: "bg-amber-500" },
                { label: "Secure (70+)", count: scoreBuckets.secure, color: "bg-emerald-500" },
              ] as const
            ).map((bucket) => (
              <div key={bucket.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{bucket.label}</span>
                  <span className="font-semibold text-foreground">{bucket.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${bucket.color} transition-all duration-500`}
                    style={{
                      width: scansCompleted > 0 ? `${(bucket.count / scansCompleted) * 100}%` : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Targets by Vulnerabilities */}
        <div className={cardClass}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Top Targets by Vulnerabilities
          </h3>
          {topTargets.length > 0 ? (
            <div className="space-y-3">
              {topTargets.map(([url, count]) => (
                <div key={url}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground font-medium truncate max-w-[70%]" title={url}>
                      {url}
                    </span>
                    <span className="font-semibold text-red-600">{count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-500 transition-all duration-500"
                      style={{ width: `${(count / maxTargetVulns) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No scan data available</p>
          )}
        </div>
      </div>

      {/* Row 4: Recent scans table */}
      <div className={cardClass}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Recent Scans
        </h3>
        {recentScans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Date</th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Target</th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Score</th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Attacks</th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Vulnerabilities</th>
                  <th className="text-left py-2 font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((r) => {
                  const riskInfo = getRiskLevel(r.score);
                  return (
                    <tr key={r.filename} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                        {new Date(r.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2.5 pr-4 text-foreground font-medium truncate max-w-[200px]" title={r.targetUrl}>
                        {r.targetUrl}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`font-semibold ${riskInfo.color}`}>{r.score}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-foreground">{r.totalAttacks}</td>
                      <td className="py-2.5 pr-4">
                        <span className="text-red-600 font-medium">{r.passed}</span>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${riskInfo.bg} ${riskInfo.color}`}
                        >
                          {riskInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No scans completed yet. Run your first security scan to see results here.
          </p>
        )}
      </div>
    </div>
  );
}
