import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getReportsMeta } from "@/api/reports";
import { getRuns } from "@/api/runs";
import type { ReportMeta, RunMeta, ReportTrend } from "@/api/types";
import { ScoreRing } from "@/components/shared/ScoreRing";
import { TrendChart } from "@/components/shared/TrendChart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function getRiskLevel(score: number) {
  if (score >= 70) return { label: "Low", variant: "secondary" as const, dotColor: "bg-emerald-500" };
  if (score >= 50) return { label: "Medium", variant: "outline" as const, dotColor: "bg-amber-500" };
  if (score >= 30) return { label: "High", variant: "outline" as const, dotColor: "bg-orange-500" };
  return { label: "Critical", variant: "destructive" as const, dotColor: "bg-red-500" };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [reportsMeta, setReportsMeta] = useState<ReportMeta[]>([]);
  const [trend, setTrend] = useState<ReportTrend[]>([]);
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getReportsMeta(1, 200), getRuns()])
      .then(([reportsRes, runsRes]) => {
        setReportsMeta(reportsRes.items);
        setTrend(reportsRes.trend ?? []);
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

  // ── Active runs ──
  const activeRuns = runs.filter((r) => r.status === "running" || r.status === "queued");

  // ── Attack category analysis ──
  const categoryCounts: Record<string, number> = {};
  const categoryVulnCounts: Record<string, number> = {};
  reportsMeta.forEach((r) => {
    (r.attackCategories ?? []).forEach((cat) => {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      categoryVulnCounts[cat] = (categoryVulnCounts[cat] || 0) + r.passed;
    });
  });
  const topCategories = Object.entries(categoryVulnCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxCatVulns = topCategories.length > 0 ? topCategories[0][1] : 1;

  // ── Score distribution ──
  const scoreBuckets = { critical: 0, high: 0, medium: 0, secure: 0 };
  reportsMeta.forEach((r) => {
    if (r.score < 30) scoreBuckets.critical++;
    else if (r.score < 50) scoreBuckets.high++;
    else if (r.score < 70) scoreBuckets.medium++;
    else scoreBuckets.secure++;
  });

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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Row 1: Key metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Security Score */}
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 pt-5 pb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Security Score
            </span>
            <ScoreRing score={latestScore} size={96} />
            <span className="text-xs text-muted-foreground">Latest scan</span>
          </CardContent>
        </Card>

        {/* Total Attacks */}
        <Card>
          <CardContent className="flex flex-col gap-2 pt-5 pb-4">
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
          </CardContent>
        </Card>

        {/* Vulnerabilities Found */}
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50">
          <CardContent className="flex flex-col gap-2 pt-5 pb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vulnerabilities Found
            </span>
            <div className="flex items-center gap-2 mt-auto">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-3xl font-bold text-red-600 dark:text-red-400">{totalVulns.toLocaleString()}</span>
            </div>
            <span className="text-xs text-muted-foreground">Across all scans</span>
          </CardContent>
        </Card>

        {/* Attacks Blocked */}
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50">
          <CardContent className="flex flex-col gap-2 pt-5 pb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Attacks Blocked
            </span>
            <div className="flex items-center gap-2 mt-auto">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{totalBlocked.toLocaleString()}</span>
            </div>
            <span className="text-xs text-muted-foreground">Successfully defended</span>
          </CardContent>
        </Card>

        {/* Overall Risk */}
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 pt-5 pb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overall Risk
            </span>
            <Badge variant={risk.variant} className="text-lg px-4 py-1.5">
              {risk.label}
            </Badge>
            <span className="text-xs text-muted-foreground">Avg score: {avgScore}</span>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Active runs banner (if any) */}
      {activeRuns.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/50">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-medium">
                {activeRuns.length} scan{activeRuns.length > 1 ? "s" : ""} in progress
              </span>
              {activeRuns[0]?.targetUrl && (
                <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                  {activeRuns[0].targetUrl}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate("/runs")}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View runs
            </button>
          </CardContent>
        </Card>
      )}

      {/* Row 3: Trend + Score distribution + Severity breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Score Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length > 1 ? (
              <TrendChart data={trend} width={320} height={80} />
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Need 2+ scans for trend data
              </p>
            )}
          </CardContent>
        </Card>

        {/* Scan Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {([
              { label: "Critical (<30)", count: scoreBuckets.critical, color: "bg-red-500" },
              { label: "High (30-49)", count: scoreBuckets.high, color: "bg-orange-500" },
              { label: "Medium (50-69)", count: scoreBuckets.medium, color: "bg-amber-500" },
              { label: "Secure (70+)", count: scoreBuckets.secure, color: "bg-emerald-500" },
            ] as const).map((bucket) => (
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
          </CardContent>
        </Card>

        {/* Top Vulnerable Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top Vulnerable Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCategories.length > 0 ? (
              <div className="space-y-3">
                {topCategories.map(([cat, count]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-foreground font-medium truncate max-w-[65%]" title={cat}>
                        {cat}
                      </span>
                      <span className="font-semibold text-red-600 dark:text-red-400">{count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500 transition-all duration-500"
                        style={{ width: `${(count / maxCatVulns) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Top targets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Top Targets by Vulnerabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topTargets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
              {topTargets.map(([url, count]) => (
                <div key={url}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground font-medium truncate max-w-[70%]" title={url}>
                      {url}
                    </span>
                    <span className="font-semibold text-red-600 dark:text-red-400">{count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-500 transition-all duration-500"
                      style={{ width: `${(count / maxTargetVulns) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No scan data available</p>
          )}
        </CardContent>
      </Card>

      {/* Row 5: Recent scans table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Scans
          </CardTitle>
          <CardDescription>
            Last {recentScans.length} security scans
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentScans.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Attacks</TableHead>
                  <TableHead>Vulnerabilities</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentScans.map((r) => {
                  const riskInfo = getRiskLevel(r.score);
                  return (
                    <TableRow
                      key={r.filename}
                      className="cursor-pointer"
                      onClick={() => navigate(`/reports/${r.filename}`)}
                    >
                      <TableCell className="text-muted-foreground">
                        {new Date(r.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={r.targetUrl}>
                        {r.targetUrl}
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          r.score >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                          r.score >= 50 ? "text-amber-600 dark:text-amber-400" :
                          r.score >= 30 ? "text-orange-600 dark:text-orange-400" :
                          "text-red-600 dark:text-red-400"
                        }`}>
                          {r.score}
                        </span>
                      </TableCell>
                      <TableCell>{r.totalAttacks}</TableCell>
                      <TableCell>
                        <span className="text-red-600 dark:text-red-400 font-medium">{r.passed}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={riskInfo.variant}>
                          <span className={`w-1.5 h-1.5 rounded-full ${riskInfo.dotColor}`} />
                          {riskInfo.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                No scans completed yet. Run your first security scan to see results here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
