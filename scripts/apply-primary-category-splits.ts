import { pathToFileURL } from "node:url";

import { DEFAULT_DEV_API_KEY } from "@/env";
import { pg } from "@/db/client";
import type { SourceInput, UpdatePlaceInput } from "@/lib/schemas";
import {
  buildPrimaryCategorySplitAudit,
  legacySplitPrimaryCategories,
  type LegacyPrimaryCategory,
  type PrimaryCategorySplitAudit,
  type PrimaryCategorySplitAuditRow,
  type PrimaryCategorySplitSuggestion,
  type SplitConfidence
} from "./lib/primary-category-split-audit";

type ApplyArgs = {
  apply: boolean;
  json: boolean;
  category?: LegacyPrimaryCategory;
  limit?: number;
  minConfidence: "high" | "medium";
};

type PlaceDetail = {
  id: string;
  name: string;
  primaryCategory: string;
};

type VersionList = {
  items?: unknown[];
  versions?: unknown[];
};

type PlannedPatch = {
  id: string;
  name: string;
  currentPrimaryCategory: LegacyPrimaryCategory;
  suggestedPrimaryCategory: Exclude<PrimaryCategorySplitSuggestion["suggestedPrimaryCategory"], "needs_review">;
  confidence: SplitConfidence;
  reasonCodes: string[];
  evidence: string[];
};

type AppliedPatch = PlannedPatch & {
  verifiedPrimaryCategory: string;
  versionCount: number | null;
};

type FailedPatch = PlannedPatch & {
  error: string;
};

const apiBaseUrl = normalizeBaseUrl(process.env.AIGO_API_BASE_URL ?? "http://localhost:3000");
const apiKey = process.env.AIGO_API_KEY ?? DEFAULT_DEV_API_KEY;
const confidenceRank: Record<SplitConfidence, number> = { low: 0, medium: 1, high: 2 };

if (isMain()) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const rows = await loadRows(args);
    const audit = buildPrimaryCategorySplitAudit(rows);
    const report = await runPrimaryCategorySplitMigration(audit, args);
    console.log(args.json ? JSON.stringify(report, null, 2) : formatMarkdown(report));
  } finally {
    await pg.end({ timeout: 5 });
  }
}

export function parseArgs(argv: string[]): ApplyArgs {
  const args: ApplyArgs = { apply: false, json: false, minConfidence: "high" };
  for (const arg of argv) {
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg.startsWith("--category=")) {
      const category = arg.slice("--category=".length).trim();
      if (!isTargetCategory(category)) {
        throw new Error(`Unsupported --category=${category}. Use one of: ${legacySplitPrimaryCategories.join(", ")}`);
      }
      args.category = category;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const limit = Number(arg.slice("--limit=".length));
      if (!Number.isInteger(limit) || limit <= 0) throw new Error(`Invalid --limit=${arg.slice("--limit=".length)}`);
      args.limit = limit;
      continue;
    }
    if (arg.startsWith("--min-confidence=")) {
      const minConfidence = arg.slice("--min-confidence=".length).trim();
      if (minConfidence !== "high" && minConfidence !== "medium") {
        throw new Error(`Invalid --min-confidence=${minConfidence}. Use high or medium.`);
      }
      args.minConfidence = minConfidence;
    }
  }
  return args;
}

export async function runPrimaryCategorySplitMigration(audit: PrimaryCategorySplitAudit, args: ApplyArgs, now = new Date().toISOString()) {
  const planned = selectPatchCandidates(audit, args);
  const applied: AppliedPatch[] = [];
  const failed: FailedPatch[] = [];

  if (args.apply) {
    for (const plan of planned) {
      try {
        const detail = await fetchPlaceDetail(plan.id);
        if (detail.primaryCategory !== plan.currentPrimaryCategory) {
          throw new Error(`current category changed before patch: detail=${detail.primaryCategory}, audit=${plan.currentPrimaryCategory}`);
        }
        await patchPlace(plan.id, buildPatchPayload(plan, now));
        const verified = await fetchPlaceDetail(plan.id);
        if (verified.primaryCategory !== plan.suggestedPrimaryCategory) {
          throw new Error(`patch verification failed: expected=${plan.suggestedPrimaryCategory}, actual=${verified.primaryCategory}`);
        }
        const versionCount = await fetchVersionCount(plan.id);
        applied.push({ ...plan, verifiedPrimaryCategory: verified.primaryCategory, versionCount });
      } catch (error) {
        failed.push({ ...plan, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return {
    generatedAt: now,
    mode: args.apply ? "apply" : "dry-run",
    apiBaseUrl,
    filters: {
      category: args.category ?? null,
      limit: args.limit ?? null,
      minConfidence: args.minConfidence
    },
    scanned: audit.total,
    planned: planned.length,
    applied: applied.length,
    failed: failed.length,
    plannedSamples: planned.slice(0, 20),
    appliedSamples: applied.slice(0, 20),
    failedSamples: failed.slice(0, 20),
    skippedNeedsReview: audit.items.filter((item) => item.suggestedPrimaryCategory === "needs_review").length,
    skippedUnchanged: audit.items.filter((item) => item.suggestedPrimaryCategory === item.currentPrimaryCategory).length
  };
}

export function selectPatchCandidates(audit: PrimaryCategorySplitAudit, args: Pick<ApplyArgs, "minConfidence">): PlannedPatch[] {
  const minimumRank = confidenceRank[args.minConfidence];
  return audit.items
    .filter((item) => item.suggestedPrimaryCategory !== "needs_review")
    .filter((item) => item.suggestedPrimaryCategory !== item.currentPrimaryCategory)
    .filter((item) => confidenceRank[item.confidence] >= minimumRank)
    .map((item) => ({
      id: item.id,
      name: item.name,
      currentPrimaryCategory: item.currentPrimaryCategory,
      suggestedPrimaryCategory: item.suggestedPrimaryCategory as PlannedPatch["suggestedPrimaryCategory"],
      confidence: item.confidence,
      reasonCodes: item.reasonCodes,
      evidence: item.evidence
    }));
}

export function buildPatchPayload(plan: PlannedPatch, now: string): UpdatePlaceInput {
  return {
    primaryCategory: plan.suggestedPrimaryCategory,
    sources: [buildAuditSource(plan, now)],
    sourceMode: "append",
    imageMode: "append",
    relatedPlaceMode: "append",
    actor: "agent",
    changeSummary: `Reclassify primaryCategory from ${plan.currentPrimaryCategory} to ${plan.suggestedPrimaryCategory} after split audit.`
  };
}

async function loadRows(args: ApplyArgs) {
  const categories = args.category ? [args.category] : [...legacySplitPrimaryCategories];

  if (args.limit !== undefined) {
    return pg<PrimaryCategorySplitAuditRow[]>`
      select
        id,
        name,
        primary_category,
        tags,
        description,
        parent_notes,
        safety_notes,
        play_features,
        taxonomy,
        region_sido,
        region_sigungu,
        address,
        road_address
      from places
      where primary_category = any(${categories})
        and status = 'active'
      order by primary_category asc, name asc
      limit ${args.limit}
    `;
  }

  return pg<PrimaryCategorySplitAuditRow[]>`
    select
      id,
      name,
      primary_category,
      tags,
      description,
      parent_notes,
      safety_notes,
      play_features,
      taxonomy,
      region_sido,
      region_sigungu,
      address,
      road_address
    from places
    where primary_category = any(${categories})
      and status = 'active'
    order by primary_category asc, name asc
  `;
}

function buildAuditSource(plan: PlannedPatch, now: string): SourceInput {
  const evidence = plan.evidence.length > 0 ? ` Evidence: ${plan.evidence.join(", ")}.` : "";
  return {
    sourceType: "agent_observation",
    title: "AiGo primaryCategory split audit",
    externalId: `primary-category-split:${plan.id}:${now.slice(0, 10)}`,
    summary:
      `Read-only split audit suggested ${plan.suggestedPrimaryCategory} from ${plan.currentPrimaryCategory} for ${plan.name}. ` +
      `Confidence: ${plan.confidence}. Reason codes: ${plan.reasonCodes.join(", ")}.${evidence}`,
    checkedAt: now
  };
}

async function fetchPlaceDetail(placeId: string) {
  return apiRequest<PlaceDetail>(`/v1/places/${encodeURIComponent(placeId)}`, { method: "GET" });
}

async function patchPlace(placeId: string, payload: UpdatePlaceInput) {
  await apiRequest<PlaceDetail>(`/v1/places/${encodeURIComponent(placeId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

async function fetchVersionCount(placeId: string) {
  const versions = await apiRequest<VersionList>(`/v1/places/${encodeURIComponent(placeId)}/versions`, { method: "GET" });
  if (Array.isArray(versions.items)) return versions.items.length;
  if (Array.isArray(versions.versions)) return versions.versions.length;
  return null;
}

async function apiRequest<T>(path: string, init: RequestInit) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    },
    signal: AbortSignal.timeout(10_000)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export function formatMarkdown(report: Awaited<ReturnType<typeof runPrimaryCategorySplitMigration>>) {
  const lines: string[] = [];
  lines.push("# Primary Category Split Migration");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push(`API base URL: ${report.apiBaseUrl}`);
  lines.push(`Filter category: ${report.filters.category ?? "all"}`);
  lines.push(`Minimum confidence: ${report.filters.minConfidence}`);
  lines.push(`Rows scanned: ${report.scanned}`);
  lines.push(`Planned patches: ${report.planned}`);
  lines.push(`Applied patches: ${report.applied}`);
  lines.push(`Failed patches: ${report.failed}`);
  lines.push(`Skipped needs_review: ${report.skippedNeedsReview}`);
  lines.push(`Skipped unchanged: ${report.skippedUnchanged}`);
  lines.push("");
  lines.push("## Planned Samples");
  for (const item of report.plannedSamples) {
    lines.push(`- ${item.name}: ${item.currentPrimaryCategory} -> ${item.suggestedPrimaryCategory} (${item.confidence}) [${item.id}]`);
  }
  if (report.failedSamples.length > 0) {
    lines.push("");
    lines.push("## Failed Samples");
    for (const item of report.failedSamples) {
      lines.push(`- ${item.name}: ${item.error}`);
    }
  }
  return lines.join("\n");
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isTargetCategory(value: string): value is LegacyPrimaryCategory {
  return legacySplitPrimaryCategories.includes(value as LegacyPrimaryCategory);
}

function isMain() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
