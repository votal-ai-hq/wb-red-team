import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { mapCategoriesToFiles } from "./codebase-analyzer.js";
import type { AttackCategory, Config, PrAwareSelection } from "./types.js";

const DEFAULT_BASE_REF = "origin/main";

function normalizeChangedFile(file: string, basePath: string): string {
  const trimmed = file.trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(/\\/g, "/").replace(/^\.\//, "");
  const normalizedBase = basePath.replace(/\\/g, "/");
  if (normalized.startsWith(`${normalizedBase}/`)) {
    return relative(basePath, normalized).replace(/\\/g, "/");
  }
  return normalized;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function skipped(
  baseRef: string | undefined,
  changedFiles: string[],
  skipReason: string,
): PrAwareSelection {
  return {
    enabled: true,
    baseRef,
    changedFiles,
    selectedCategories: [],
    reasons: [],
    skipped: true,
    skipReason,
  };
}

function readChangedFilesFromGit(
  basePath: string,
  baseRef: string,
  includeDeletedFiles: boolean,
): string[] {
  const diffFilter = includeDeletedFiles ? "ACMRD" : "ACMR";
  const output = execFileSync(
    "git",
    ["diff", "--name-only", `--diff-filter=${diffFilter}`, `${baseRef}...HEAD`],
    { cwd: basePath, encoding: "utf-8" },
  );
  return output
    .split(/\r?\n/)
    .map((file) => normalizeChangedFile(file, basePath));
}

function resolveChangedFiles(
  config: Config,
  basePath: string,
  baseRef: string,
  includeDeletedFiles: boolean,
): { files: string[]; error?: string } {
  const configuredFiles = config.attackConfig.prAware?.changedFiles;
  if (configuredFiles?.length) {
    return {
      files: uniqueSorted(
        configuredFiles.map((file) => normalizeChangedFile(file, basePath)),
      ),
    };
  }

  try {
    return {
      files: uniqueSorted(
        readChangedFilesFromGit(basePath, baseRef, includeDeletedFiles),
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { files: [], error: message };
  }
}

export function selectPrAwareCategories(config: Config): PrAwareSelection {
  const prAware = config.attackConfig.prAware;
  if (!prAware?.enabled) {
    return {
      enabled: false,
      changedFiles: [],
      selectedCategories: [],
      reasons: [],
      skipped: false,
    };
  }

  const baseRef = prAware.baseRef ?? DEFAULT_BASE_REF;
  if (!config.codebasePath) {
    return skipped(
      baseRef,
      [],
      "PR-aware mode requires codebasePath so changed files can be mapped to source categories.",
    );
  }

  const basePath = resolve(config.codebasePath);
  const includeDeletedFiles = prAware.includeDeletedFiles ?? false;
  const resolved = resolveChangedFiles(config, basePath, baseRef, includeDeletedFiles);
  if (resolved.error) {
    return skipped(
      baseRef,
      [],
      `Unable to resolve changed files from git diff: ${resolved.error}`,
    );
  }

  const changedFiles = includeDeletedFiles
    ? resolved.files
    : resolved.files.filter((file) => existsSync(resolve(basePath, file)));

  if (changedFiles.length === 0) {
    return skipped(
      baseRef,
      [],
      "No changed files were found for PR-aware scanning.",
    );
  }

  const affectedFiles = mapCategoriesToFiles(basePath, changedFiles);
  const enabledCategories = config.attackConfig.enabledCategories;
  const enabledSet = enabledCategories?.length
    ? new Set<AttackCategory>(enabledCategories)
    : undefined;
  const selectedCategories = (Object.keys(affectedFiles) as AttackCategory[])
    .filter((category) => affectedFiles[category]?.length)
    .filter((category) => !enabledSet || enabledSet.has(category))
    .sort((a, b) => a.localeCompare(b));

  const reasons = selectedCategories.flatMap((category) =>
    (affectedFiles[category] ?? []).map((file) => ({
      category,
      file: file.file,
      line: file.line,
      reason: file.reason,
    })),
  );

  if (selectedCategories.length === 0) {
    return skipped(
      baseRef,
      changedFiles,
      "Changed files did not map to any attack categories.",
    );
  }

  return {
    enabled: true,
    baseRef,
    changedFiles,
    selectedCategories,
    reasons,
    skipped: false,
  };
}
