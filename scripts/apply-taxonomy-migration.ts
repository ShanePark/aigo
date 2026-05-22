import { DEFAULT_DEV_API_KEY } from "@/env";
import { pg } from "@/db/client";
import type { SourceInput, UpdatePlaceInput } from "@/lib/schemas";
import {
  emptyPlaceTaxonomy,
  emptyTaxonomyFacetSet,
  inferTaxonomyFromPlace,
  normalizeLegacyTags,
  normalizeRegionSido,
  normalizeSourceType,
  taxonomyFacetFamilies,
  type PlaceTaxonomy,
  type SourceType,
  type TaxonomyConfidence,
  type TaxonomyFacetFamily,
  type TaxonomyFacetSet
} from "@/lib/taxonomy";

type MigrationArgs = {
  apply: boolean;
  json: boolean;
  category?: string;
  limit?: number;
};

type PlaceCandidateRow = {
  id: string;
  name: string;
  primary_category: string;
  updated_at: Date;
};

type DetailSource = {
  id?: string;
  sourceType: string;
  title?: string | null;
  url?: string | null;
  externalId?: string | null;
  summary?: string | null;
  checkedAt?: string | null;
};

type PlaceDetail = {
  id: string;
  name: string;
  primaryCategory: string;
  tags: string[];
  region?: {
    sido?: string | null;
  };
  facilities?: {
    indoorType?: string;
    strollerFriendly?: string;
    parkingAvailable?: string;
    nursingRoom?: string;
    diaperChangingTable?: string;
    kidsToilet?: string;
    elevator?: string;
    babyChair?: string;
    foodAllowed?: string;
  };
  visit?: {
    reservationRequired?: string;
    sessionBased?: string;
  };
  taxonomy?: PlaceTaxonomy | null;
  sources: DetailSource[];
};

type PlannedRow = {
  id: string;
  name: string;
  changes: string[];
};

type FailedRow = {
  id: string;
  name: string;
  error: string;
};

const taxonomyFacetKeys = Object.keys(taxonomyFacetFamilies) as TaxonomyFacetFamily[];
const migrationAuditExternalId = "taxonomy-v1-migration";
const changeSummary = "Normalize taxonomy, tags, region, and source types for taxonomy v1.";
const apiBaseUrl = normalizeBaseUrl(process.env.AIGO_API_BASE_URL ?? "http://localhost:3000");
const apiKey = process.env.AIGO_API_KEY ?? DEFAULT_DEV_API_KEY;
const args = parseArgs(process.argv.slice(2));

try {
  const results = await runMigration(args);
  console.log(args.json ? JSON.stringify(results, null, 2) : formatMarkdown(results));
} finally {
  await pg.end({ timeout: 5 });
}

function parseArgs(argv: string[]): MigrationArgs {
  const args: MigrationArgs = { apply: false, json: false };

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
      args.category = arg.slice("--category=".length).trim();
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const limit = Number(arg.slice("--limit=".length));
      if (Number.isInteger(limit) && limit > 0) args.limit = limit;
    }
  }

  return args;
}

async function runMigration(args: MigrationArgs) {
  const rows = await loadCandidates(args);
  const now = new Date().toISOString();
  const planned: PlannedRow[] = [];
  const failed: FailedRow[] = [];
  let skipped = 0;
  let updated = 0;

  for (const row of rows) {
    try {
      const detail = await fetchPlaceDetail(row.id);
      const payload = buildPatchPayload(detail, now);
      const changes = changeList(detail, payload);

      if (changes.length === 0) {
        skipped += 1;
        continue;
      }

      planned.push({ id: row.id, name: row.name, changes });

      if (args.apply) {
        await patchPlace(row.id, payload);
        updated += 1;
      }
    } catch (error) {
      failed.push({
        id: row.id,
        name: row.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    generatedAt: now,
    mode: args.apply ? "apply" : "dry-run",
    apiBaseUrl,
    filters: {
      category: args.category ?? null,
      limit: args.limit ?? null
    },
    scanned: rows.length,
    planned: planned.length,
    updated,
    skipped,
    failed: failed.length,
    plannedSamples: planned.slice(0, 10),
    failedSamples: failed.slice(0, 10)
  };
}

async function loadCandidates(args: MigrationArgs) {
  if (args.category && args.limit !== undefined) {
    return pg<PlaceCandidateRow[]>`
      select id, name, primary_category, updated_at
      from places
      where primary_category = ${args.category}
      order by updated_at desc
      limit ${args.limit}
    `;
  }

  if (args.category) {
    return pg<PlaceCandidateRow[]>`
      select id, name, primary_category, updated_at
      from places
      where primary_category = ${args.category}
      order by updated_at desc
    `;
  }

  if (args.limit !== undefined) {
    return pg<PlaceCandidateRow[]>`
      select id, name, primary_category, updated_at
      from places
      order by updated_at desc
      limit ${args.limit}
    `;
  }

  return pg<PlaceCandidateRow[]>`
    select id, name, primary_category, updated_at
    from places
    order by updated_at desc
  `;
}

async function fetchPlaceDetail(placeId: string) {
  return apiRequest<PlaceDetail>(`/v1/places/${encodeURIComponent(placeId)}`, {
    method: "GET"
  });
}

async function patchPlace(placeId: string, payload: UpdatePlaceInput) {
  await apiRequest<PlaceDetail>(`/v1/places/${encodeURIComponent(placeId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
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

function buildPatchPayload(detail: PlaceDetail, now: string): UpdatePlaceInput {
  const tags = canonicalTags(detail.tags ?? []);
  const regionSido = detail.region?.sido ? normalizeRegionSido(detail.region.sido) : undefined;

  return {
    tags,
    taxonomy: buildTaxonomy(detail, tags, now),
    ...(regionSido !== undefined ? { regionSido } : {}),
    sources: canonicalSources(detail.sources ?? [], now),
    sourceMode: "replace",
    imageMode: "append",
    relatedPlaceMode: "append",
    actor: "agent",
    changeSummary
  };
}

function buildTaxonomy(detail: PlaceDetail, tags: string[], now: string): PlaceTaxonomy {
  const current = detail.taxonomy ?? emptyPlaceTaxonomy();
  const legacyTags = normalizeLegacyTags(tags);
  const inferred = inferTaxonomyFromPlace({
    primaryCategory: detail.primaryCategory,
    tags,
    indoorType: detail.facilities?.indoorType,
    strollerFriendly: detail.facilities?.strollerFriendly,
    elevator: detail.facilities?.elevator,
    nursingRoom: detail.facilities?.nursingRoom,
    diaperChangingTable: detail.facilities?.diaperChangingTable,
    kidsToilet: detail.facilities?.kidsToilet,
    babyChair: detail.facilities?.babyChair,
    foodAllowed: detail.facilities?.foodAllowed,
    parkingAvailable: detail.facilities?.parkingAvailable,
    reservationRequired: detail.visit?.reservationRequired,
    sessionBased: detail.visit?.sessionBased
  });
  const mergedInferred = mergeFacetSets(current.inferred, inferred);
  const hasInferred = hasFacetValues(mergedInferred);

  return {
    schemaVersion: 1,
    sourceBacked: normalizeFacetSet(current.sourceBacked),
    inferred: {
      ...mergedInferred,
      confidence: normalizeConfidence(current.inferred?.confidence) ?? (hasInferred ? "medium" : "low"),
      basis:
        cleanString(current.inferred?.basis) ??
        (hasInferred
          ? "Merged existing inferred facets with taxonomy v1 migration signals."
          : "No taxonomy facets were inferred during taxonomy v1 migration.")
    },
    migration: {
      legacyTags: limitedUnique([...(current.migration?.legacyTags ?? []), ...tags], 200),
      broadMappedTags: limitedUnique([...(current.migration?.broadMappedTags ?? []), ...legacyTags.broadMappedTags], 200),
      unmappedTags: limitedUnique([...(current.migration?.unmappedTags ?? []), ...legacyTags.unmappedTags], 200),
      normalizedAt: current.migration?.normalizedAt ?? now
    }
  };
}

function canonicalSources(sources: DetailSource[], now: string): SourceInput[] {
  const canonical: SourceInput[] = [];
  let existingAuditSource: SourceInput | null = null;

  for (const source of sources) {
    const normalized = canonicalSource(source);
    if (normalized.externalId === migrationAuditExternalId) {
      existingAuditSource = normalized;
      continue;
    }
    canonical.push(normalized);
  }

  canonical.push(existingAuditSource ?? migrationAuditSource(now));
  return dedupeSources(canonical);
}

function canonicalSource(source: DetailSource): SourceInput {
  const sourceType = normalizeSourceType(source.sourceType) ?? "unknown";
  const canonical: SourceInput = {
    sourceType,
    ...(cleanString(source.title) ? { title: cleanString(source.title) } : {}),
    ...(cleanString(source.url) ? { url: cleanString(source.url) } : {}),
    ...(cleanString(source.externalId) ? { externalId: cleanString(source.externalId) } : {}),
    ...(cleanString(source.summary) ? { summary: truncate(cleanString(source.summary), 2000) } : {}),
    ...(cleanString(source.checkedAt) ? { checkedAt: cleanString(source.checkedAt) } : {})
  };

  if (!canonical.url && !canonical.externalId) {
    canonical.externalId = source.id ? `legacy-source:${source.id}` : `legacy-source:${sourceType}`;
  }

  return canonical;
}

function migrationAuditSource(now: string): SourceInput {
  return {
    sourceType: "agent_observation",
    externalId: migrationAuditExternalId,
    title: "AiGo taxonomy v1 migration audit",
    summary: "Agent normalization pass for taxonomy v1; canonicalizes tags, source types, region names, and taxonomy facets without direct DB writes.",
    checkedAt: now
  };
}

function changeList(detail: PlaceDetail, payload: UpdatePlaceInput) {
  const changes: string[] = [];
  const currentRegion = detail.region?.sido ?? undefined;

  if (!sameStringArray(canonicalTags(detail.tags ?? []), payload.tags ?? [])) changes.push("tags");
  if (currentRegion !== undefined && payload.regionSido !== undefined && currentRegion !== payload.regionSido) changes.push("regionSido");
  if (stableJson(detail.taxonomy ?? emptyPlaceTaxonomy()) !== stableJson(payload.taxonomy)) changes.push("taxonomy");
  if (stableJson((detail.sources ?? []).map(sourceComparable)) !== stableJson((payload.sources ?? []).map(sourceComparable))) changes.push("sources");

  return changes;
}

function normalizeFacetSet(value: Partial<TaxonomyFacetSet> | undefined): TaxonomyFacetSet {
  const target = emptyTaxonomyFacetSet();

  for (const family of taxonomyFacetKeys) {
    const values = value?.[family] ?? [];
    for (const facet of values) {
      if ((taxonomyFacetFamilies[family] as readonly string[]).includes(facet)) {
        (target[family] as string[]).push(facet);
      }
    }
  }

  return compactFacetSet(target);
}

function mergeFacetSets(...sets: Array<Partial<TaxonomyFacetSet> | undefined>): TaxonomyFacetSet {
  const target = emptyTaxonomyFacetSet();

  for (const set of sets) {
    for (const family of taxonomyFacetKeys) {
      for (const value of set?.[family] ?? []) {
        if ((taxonomyFacetFamilies[family] as readonly string[]).includes(value)) {
          (target[family] as string[]).push(value);
        }
      }
    }
  }

  return compactFacetSet(target);
}

function compactFacetSet(facets: TaxonomyFacetSet): TaxonomyFacetSet {
  return Object.fromEntries(taxonomyFacetKeys.map((family) => [family, limitedUnique(facets[family], 200)])) as TaxonomyFacetSet;
}

function canonicalTags(tags: string[]) {
  return limitedUnique(tags.map((tag) => tag.trim()).filter(Boolean), 50);
}

function dedupeSources(sources: SourceInput[]) {
  const seen = new Set<string>();
  const deduped: SourceInput[] = [];

  for (const source of sources) {
    const key = stableJson(sourceComparable(source));
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(source);
  }

  return deduped;
}

function sourceComparable(source: DetailSource | SourceInput) {
  const sourceType = normalizeSourceType(source.sourceType) ?? ("unknown" satisfies SourceType);

  return {
    sourceType,
    title: cleanString(source.title) ?? null,
    url: cleanString(source.url) ?? null,
    externalId: cleanString(source.externalId) ?? null,
    summary: cleanString(source.summary) ?? null,
    checkedAt: cleanString(source.checkedAt) ?? null
  };
}

function hasFacetValues(facets: TaxonomyFacetSet) {
  return taxonomyFacetKeys.some((family) => facets[family].length > 0);
}

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeConfidence(value: unknown): TaxonomyConfidence | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function truncate(value: string | undefined, maxLength: number) {
  if (value === undefined || value.length <= maxLength) return value;
  return value.slice(0, maxLength);
}

function limitedUnique<T>(values: T[], limit: number) {
  return Array.from(new Set(values)).slice(0, limit);
}

function stableJson(value: unknown) {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)])
  );
}

function formatMarkdown(results: Awaited<ReturnType<typeof runMigration>>) {
  const lines: string[] = [];
  lines.push(`# AiGo Taxonomy Migration ${results.mode === "apply" ? "Apply" : "Dry Run"}`);
  lines.push("");
  lines.push(`Generated: ${results.generatedAt}`);
  lines.push(`API base URL: ${results.apiBaseUrl}`);
  lines.push(`Filter category: ${results.filters.category ?? "all"}`);
  lines.push(`Limit: ${results.filters.limit ?? "none"}`);
  lines.push(`Rows scanned: ${results.scanned}`);
  lines.push(`Planned updates: ${results.planned}`);
  lines.push(`Updated: ${results.updated}`);
  lines.push(`Skipped: ${results.skipped}`);
  lines.push(`Failed: ${results.failed}`);

  if (results.plannedSamples.length > 0) {
    lines.push("");
    lines.push("## Planned Samples");
    for (const sample of results.plannedSamples) {
      lines.push(`- ${sample.name} (${sample.id}): ${sample.changes.join(", ")}`);
    }
  }

  if (results.failedSamples.length > 0) {
    lines.push("");
    lines.push("## Failed Samples");
    for (const sample of results.failedSamples) {
      lines.push(`- ${sample.name} (${sample.id}): ${sample.error}`);
    }
  }

  return lines.join("\n");
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}
