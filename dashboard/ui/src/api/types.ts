// ── Auth ──
export interface AuthConfig {
  mode: "none" | "simple" | "dev" | "oidc";
  clerkPublishableKey?: string | null;
  hcaptchaSiteKey?: string | null;
}

export interface AuthUser {
  username: string;
  role: string;
}

// ── Reports ──
export interface ReportMeta {
  filename: string;
  timestamp: string;
  targetUrl: string;
  score: number;
  totalAttacks: number;
  passed: number;
  partial: number;
  failed: number;
  errors: number;
  attackCategories?: string[];
  summary?: string;
}

export interface ReportTrend {
  date: string;
  score: number;
}

export interface ReportsMetaResponse {
  items: ReportMeta[];
  total: number;
  page: number;
  totalPages: number;
  trend: ReportTrend[];
}

export interface ReportRound {
  roundNumber: number;
  results: ReportResult[];
}

export interface ReportResult {
  attackName: string;
  category: string;
  severity: string;
  verdict: string;
  llmVerdict?: string;
  statusCode?: number;
  reasoning?: string;
  llmReasoning?: string;
  payload?: string;
  responseBody?: string;
  findings?: string[];
  steps?: ConversationStep[];
  affectedFiles?: AffectedFile[];
  executionTrace?: ExecutionTrace;
  threatAssessment?: ThreatAssessment;
  idealResponse?: string;
}

export interface ConversationStep {
  role: string;
  content: string;
  statusCode?: number;
}

export interface AffectedFile {
  path: string;
  reason: string;
}

export interface ExecutionTrace {
  transcript?: string;
  stderr?: string;
}

export interface ThreatAssessment {
  level: string;
  description: string;
}

export interface FullReport {
  id?: string;
  filename?: string;
  targetUrl: string;
  timestamp: string;
  score: number;
  totalAttacks: number;
  passed: number;
  partial: number;
  failed: number;
  errors: number;
  rounds: ReportRound[];
  summary?: string;
  llmAnalysis?: string;
  attackCategories?: string[];
}

// ── Runs ──
export interface RunMeta {
  runId: string;
  status: "queued" | "running" | "done" | "error" | "cancelled";
  startedAt: string;
  finishedAt?: string;
  targetUrl?: string;
  error?: string;
  progressCount?: number;
  reportFile?: string;
  summary?: string;
}

export interface RunProgress {
  index: number;
  attackName: string;
  category: string;
  verdict: string;
  severity?: string;
  timestamp?: string;
}

export interface RunDetail {
  runId: string;
  status: string;
  progress: RunProgress[];
  progressTotal?: number;
  reportFile?: string;
  summary?: string;
  error?: string;
  config?: RunConfig;
}

export interface RunConfig {
  targetUrl?: string;
  attackCategories?: string[];
  strategies?: string[];
  [key: string]: unknown;
}

// ── Compliance ──
export interface ComplianceFramework {
  id: string;
  name: string;
  controlCount: number;
}

export interface ComplianceResult {
  framework: string;
  code: string;
  title: string;
  status: "vulnerable" | "at_risk" | "secure" | "not_tested";
  summary: string;
  findings?: string[];
  details?: string;
  recommendations?: string[];
  attacksAnalyzed?: number;
}

// ── Risk ──
export interface RiskAnalysisResult {
  attackName: string;
  category: string;
  impactLevel: string;
  businessImpact: string;
  financialExposure: string;
  relatedIncidents: string;
  complianceRisk: string;
  remediationEstimate: string;
}

// ── Audit ──
export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  resource_type: string;
  resource_id: string;
  user_id?: string;
  details?: Record<string, unknown>;
}

export interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
}

// ── Guardrails ──
export interface GuardrailReportMeta {
  filename: string;
  created_at: string;
  model?: string;
  guardrails?: string[];
  goodTotal: number;
  badTotal: number;
  blocked: number;
  total: number;
}

export interface GuardrailReport {
  filename: string;
  results: GuardrailResult[];
  model?: string;
  guardrails?: string[];
}

export interface GuardrailResult {
  prompt: string;
  response: string;
  guardrail: string;
  verdict: string;
  blocked: boolean;
  details?: string;
}

// ── Reference ──
export interface ReferenceData {
  categories: string[];
  strategies: StrategyInfo[];
  categoryCompliance: Record<string, string[]>;
  frameworks?: { name: string; items: unknown[] }[];
}

export interface StrategyInfo {
  slug: string;
  name: string;
  level: string;
}
