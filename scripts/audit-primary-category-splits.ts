import { pathToFileURL } from "node:url";

import { pg } from "@/db/client";
import {
  buildPrimaryCategorySplitAudit,
  legacySplitPrimaryCategories,
  type LegacyPrimaryCategory,
  type PrimaryCategorySplitAuditRow
} from "./lib/primary-category-split-audit";

type AuditArgs = {
  json: boolean;
  category?: LegacyPrimaryCategory;
  limit?: number;
};

if (isMain()) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const rows = await loadRows(args);
    const audit = buildPrimaryCategorySplitAudit(rows);
    console.log(args.json ? JSON.stringify(audit, null, 2) : formatMarkdown(audit));
  } finally {
    await pg.end({ timeout: 5 });
  }
}

export function parseArgs(argv: string[]): AuditArgs {
  const args: AuditArgs = { json: false };
  for (const arg of argv) {
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
    }
  }
  return args;
}

async function loadRows(args: AuditArgs) {
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

export function formatMarkdown(audit: ReturnType<typeof buildPrimaryCategorySplitAudit>) {
  const lines: string[] = [];
  lines.push("# Primary Category Split Audit");
  lines.push("");
  lines.push(`Generated: ${audit.generatedAt}`);
  lines.push(`Places scanned: ${audit.total}`);
  lines.push("");
  lines.push("## Current Categories");
  for (const [category, count] of sortedCounts(audit.countsByCurrentCategory)) {
    lines.push(`- ${category}: ${count}`);
  }
  lines.push("");
  lines.push("## Suggestions");
  for (const [category, count] of sortedCounts(audit.countsBySuggestion)) {
    lines.push(`- ${category}: ${count}`);
  }
  lines.push("");
  lines.push("## Items");
  for (const item of audit.items) {
    lines.push(
      `- ${item.name} (${item.currentPrimaryCategory} -> ${item.suggestedPrimaryCategory}, ${item.confidence}) [${item.id}]`
    );
    if (item.region) lines.push(`  - region: ${item.region}`);
    if (item.address) lines.push(`  - address: ${item.address}`);
    lines.push(`  - reasons: ${item.reasonCodes.join(", ")}`);
    if (item.evidence.length > 0) lines.push(`  - evidence: ${item.evidence.join(", ")}`);
  }
  return lines.join("\n");
}

function sortedCounts(counts: Record<string, number>) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function isTargetCategory(value: string): value is LegacyPrimaryCategory {
  return legacySplitPrimaryCategories.includes(value as LegacyPrimaryCategory);
}

function isMain() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
