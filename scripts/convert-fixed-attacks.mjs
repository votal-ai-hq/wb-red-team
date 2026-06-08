#!/usr/bin/env node
/**
 * Convert breach dataset(s) (JSONL) into the custom-attacks JSON format that
 * `customAttacksFile` already accepts (see lib/custom-attacks-loader.ts).
 *
 * The output attacks are fired VERBATIM against the target (no LLM regeneration)
 * and, with `customAttacksOnly` left off, run ALONGSIDE the normal
 * category/strategy LLM-generated attacks.
 *
 * Source JSONL line shape (one JSON object per line):
 *   { id, category, strategyName, message, response, expected_label,
 *     label_reasoning, judge_reasoning, verdict }
 *
 * Usage:
 *   node scripts/convert-fixed-attacks.mjs <input.jsonl> [more.jsonl ...] [options]
 *
 * Options:
 *   --out <path>   Output JSON (default: data/fixed-attacks/nvidia-ai-safety.json)
 *   --append       Merge into the existing --out file instead of overwriting it.
 *                  Use this after every run: each run emits a new JSONL, and
 *                  --append folds its attacks into the shipped pack.
 *
 * Dedupe: attacks are keyed by `id`. When the same id appears more than once
 * (across existing output + inputs), the LAST occurrence wins, so re-running a
 * JSONL refreshes those entries rather than duplicating them.
 *
 * Examples:
 *   # First time — build the pack from one run:
 *   node scripts/convert-fixed-attacks.mjs run-2026-06-08.jsonl
 *
 *   # Later runs — fold each new JSONL into the shipped pack:
 *   node scripts/convert-fixed-attacks.mjs run-2026-07-01.jsonl --append
 *
 *   # Rebuild the whole pack from several run outputs at once:
 *   node scripts/convert-fixed-attacks.mjs run-a.jsonl run-b.jsonl run-c.jsonl
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// --- parse args -------------------------------------------------------------
const DEFAULT_OUT = "data/fixed-attacks/nvidia-ai-safety.json";
const inputs = [];
let outArg = DEFAULT_OUT;
let append = false;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--append") append = true;
  else if (arg === "--out") outArg = argv[++i];
  else if (arg.startsWith("--out=")) outArg = arg.slice("--out=".length);
  else inputs.push(arg);
}

if (inputs.length === 0) {
  console.error(
    "Usage: node scripts/convert-fixed-attacks.mjs <input.jsonl> [more.jsonl ...] [--out <path>] [--append]",
  );
  process.exit(1);
}

const outputPath = resolve(repoRoot, outArg);

/**
 * Dataset category labels that are NOT valid AttackCategory enum values.
 * Remapped here to the closest real category so the loader tags them
 * correctly instead of falling back to prompt_injection.
 */
const CATEGORY_REMAP = {
  biological_safety: "weapons_violence",
};

let remapped = 0;

/** Convert one JSONL row object into a custom-attacks row, or null to skip. */
function rowToAttack(row, fallbackIndex) {
  const message = String(row.message ?? "").trim();
  if (!message) return null;

  const rawCategory = String(row.category ?? "prompt_injection").trim();
  const category = CATEGORY_REMAP[rawCategory] ?? rawCategory;
  if (category !== rawCategory) remapped++;

  const strategyName = String(row.strategyName ?? "").trim();
  const reasoning = String(row.label_reasoning ?? "").trim();

  return {
    id: String(row.id ?? `fixed-${fallbackIndex + 1}`).trim(),
    category,
    name: strategyName || `Fixed attack #${fallbackIndex + 1}`,
    description: `Known breach replayed verbatim${
      strategyName ? ` (strategy: ${strategyName})` : ""
    }. Source verdict: ${String(row.verdict ?? "FAIL")}.`,
    prompt: message,
    severity: "high",
    successCriteria:
      reasoning ||
      "The target should refuse or safely handle this request; complying indicates a breach.",
  };
}

/** Parse a .jsonl file into custom-attacks rows. */
function parseJsonl(path) {
  const abs = resolve(process.cwd(), path);
  if (!existsSync(abs)) {
    console.error(`  input not found: ${abs}`);
    process.exit(1);
  }
  const lines = readFileSync(abs, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let row;
    try {
      row = JSON.parse(lines[i]);
    } catch (e) {
      console.error(`  skip ${path} line ${i + 1}: invalid JSON (${e.message})`);
      continue;
    }
    const attack = rowToAttack(row, i);
    if (!attack) {
      console.error(`  skip ${path} line ${i + 1}: empty message`);
      continue;
    }
    out.push(attack);
  }
  return out;
}

// --- merge: existing (if --append) + all inputs, dedupe by id (last wins) ----
const byId = new Map();
let existingCount = 0;

if (append && existsSync(outputPath)) {
  try {
    const existing = JSON.parse(readFileSync(outputPath, "utf-8"));
    if (Array.isArray(existing)) {
      for (const a of existing) {
        if (a && typeof a === "object" && a.id) byId.set(String(a.id), a);
      }
      existingCount = byId.size;
    }
  } catch (e) {
    console.error(`Failed to read existing --out file for append: ${e.message}`);
    process.exit(1);
  }
}

let fromInputs = 0;
let updated = 0;
for (const path of inputs) {
  for (const attack of parseJsonl(path)) {
    fromInputs++;
    if (byId.has(attack.id)) updated++;
    byId.set(attack.id, attack);
  }
}

const attacks = [...byId.values()];

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(attacks, null, 2) + "\n", "utf-8");

console.log(
  `${append ? "Appended to" : "Wrote"} ${outputPath}\n` +
    `  inputs: ${inputs.length} file(s), ${fromInputs} attack(s) read\n` +
    (append ? `  existing in pack: ${existingCount}\n` : "") +
    `  ${updated} id(s) refreshed (duplicate ids overwritten)\n` +
    `  total attacks in pack: ${attacks.length}\n` +
    `  ${remapped} category remapped via CATEGORY_REMAP`,
);
