import { pathToFileURL } from "node:url";

import {
  normalizePrimaryCategory,
  normalizeRegionSido,
  normalizeSourceType,
  primaryCategories,
  sourceTypes,
  taxonomyFacetFamilies,
  type PlaceTaxonomy,
  type TaxonomyFacetFamily
} from "@/lib/taxonomy";

type AuditArgs = {
  json: boolean;
  category?: string;
};

type PlaceTaxonomyAuditRow = {
  id: string;
  name: string;
  primary_category: string;
  tags: string[];
  region_sido: string | null;
  taxonomy: PlaceTaxonomy | null;
};

type SourceTypeRow = {
  source_type: string;
  count: number;
};

type CountMap = Record<string, number>;
type PgClient = typeof import("@/db/client")["pg"];

const taxonomyFacetKeys = Object.keys(taxonomyFacetFamilies) as TaxonomyFacetFamily[];
const knownRegionSido = new Set([
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도"
]);

let pgClient: PgClient | null = null;

if (isMain()) {
  void main();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  try {
    const results = await runAudit(args);
    console.log(args.json ? JSON.stringify(results, null, 2) : formatMarkdown(results));
  } finally {
    if (pgClient) await pgClient.end({ timeout: 5 });
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
      args.category = arg.slice("--category=".length).trim();
    }
  }
  return args;
}

export async function runAudit(args: AuditArgs) {
  const pg = await getPg();
  const places = await loadPlaces(args);
  const sourceRows = await pg<SourceTypeRow[]>`
    select source_type, count(*)::int as count
    from place_sources
    group by source_type
    order by count(*) desc, source_type asc
  `;

  return {
    generatedAt: new Date().toISOString(),
    filters: { category: args.category ?? null },
    placeCount: places.length,
    primaryCategories: auditPrimaryCategories(places),
    tags: auditTags(places),
    sourceTypes: auditSourceTypes(sourceRows),
    regions: auditRegions(places),
    taxonomy: auditTaxonomy(places)
  };
}

async function loadPlaces(args: AuditArgs) {
  const pg = await getPg();
  if (args.category) {
    return pg<PlaceTaxonomyAuditRow[]>`
      select id, name, primary_category, tags, region_sido, taxonomy
      from places
      where primary_category = ${args.category}
      order by updated_at desc
    `;
  }

  return pg<PlaceTaxonomyAuditRow[]>`
    select id, name, primary_category, tags, region_sido, taxonomy
    from places
    order by updated_at desc
  `;
}

function auditPrimaryCategories(places: PlaceTaxonomyAuditRow[]) {
  const distribution = countBy(places.map((place) => place.primary_category));
  const invalid = Object.keys(distribution)
    .filter((category) => !normalizePrimaryCategory(category))
    .sort();

  return {
    distribution,
    invalid,
    canonicalMissing: primaryCategories.filter((category) => distribution[category] === undefined)
  };
}

function auditTags(places: PlaceTaxonomyAuditRow[]) {
  const counts = new Map<string, number>();
  for (const place of places) {
    for (const tag of place.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const processLike = Array.from(counts.keys())
    .filter(isProcessLikeTag)
    .sort();

  return {
    uniqueCount: counts.size,
    singletonCount: Array.from(counts.values()).filter((count) => count === 1).length,
    processLikeCount: processLike.length,
    processLikeExamples: processLike.slice(0, 25),
    top: Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 25)
      .map(([tag, count]) => ({ tag, count }))
  };
}

function auditSourceTypes(rows: SourceTypeRow[]) {
  const aliases = rows
    .map((row) => ({ sourceType: row.source_type, canonical: normalizeSourceType(row.source_type), count: row.count }))
    .filter((row) => row.canonical !== null && row.canonical !== row.sourceType);
  const unknown = rows
    .filter((row) => !normalizeSourceType(row.source_type))
    .map((row) => ({ sourceType: row.source_type, count: row.count }));

  return {
    distribution: Object.fromEntries(rows.map((row) => [row.source_type, row.count])),
    aliases,
    unknown,
    canonicalMissing: sourceTypes.filter((sourceType) => !rows.some((row) => row.source_type === sourceType))
  };
}

export function auditRegions(places: Array<Pick<PlaceTaxonomyAuditRow, "region_sido">>) {
  const rawDistribution = countBy(places.map((place) => place.region_sido ?? "unknown"));
  const regionValues = Object.keys(rawDistribution).filter((value) => value !== "unknown").sort();
  const aliases = regionValues
    .map((region) => ({ region, canonical: normalizeRegionSido(region), count: rawDistribution[region] ?? 0 }))
    .filter((row) => row.canonical !== row.region);
  const unknown = regionValues
    .map((region) => ({ region, normalized: normalizeRegionSido(region), count: rawDistribution[region] ?? 0 }))
    .filter((row) => !knownRegionSido.has(row.normalized));

  return {
    distribution: rawDistribution,
    normalizedDistribution: countBy(places.map((place) => (place.region_sido ? normalizeRegionSido(place.region_sido) : "unknown"))),
    aliases,
    unknown
  };
}

function auditTaxonomy(places: PlaceTaxonomyAuditRow[]) {
  const sourceBacked = emptyFacetCountMap();
  const inferred = emptyFacetCountMap();
  const broadMappedExamples = new Set<string>();
  const unmappedExamples = new Set<string>();
  let withTaxonomy = 0;

  for (const place of places) {
    const taxonomy = place.taxonomy;
    if (!taxonomy) continue;
    withTaxonomy += 1;

    for (const family of taxonomyFacetKeys) {
      for (const value of taxonomy.sourceBacked?.[family] ?? []) {
        incrementNested(sourceBacked, family, value);
      }
      for (const value of taxonomy.inferred?.[family] ?? []) {
        incrementNested(inferred, family, value);
      }
    }

    for (const tag of taxonomy.migration?.broadMappedTags ?? []) broadMappedExamples.add(tag);
    for (const tag of taxonomy.migration?.unmappedTags ?? []) unmappedExamples.add(tag);
  }

  return {
    withTaxonomy,
    sourceBacked,
    inferred,
    migration: {
      broadMappedExamples: Array.from(broadMappedExamples).sort().slice(0, 50),
      unmappedExamples: Array.from(unmappedExamples).sort().slice(0, 50)
    }
  };
}

function emptyFacetCountMap() {
  return Object.fromEntries(taxonomyFacetKeys.map((family) => [family, {} as CountMap])) as Record<TaxonomyFacetFamily, CountMap>;
}

function incrementNested(target: Record<TaxonomyFacetFamily, CountMap>, family: TaxonomyFacetFamily, value: string) {
  target[family][value] = (target[family][value] ?? 0) + 1;
}

function countBy(values: string[]) {
  return values.reduce<CountMap>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function isProcessLikeTag(tag: string) {
  return /batch|migration|migrated|audit|seed|source|geocode|import|agent|taxonomy|수집|마이그|검수|출처/i.test(tag);
}

export function formatMarkdown(results: Awaited<ReturnType<typeof runAudit>>) {
  const lines: string[] = [];
  lines.push("# AiGo Taxonomy Audit");
  lines.push("");
  lines.push(`Generated: ${results.generatedAt}`);
  lines.push(`Filter category: ${results.filters.category ?? "all"}`);
  lines.push(`Places scanned: ${results.placeCount}`);
  lines.push("");
  lines.push("## Primary Categories");
  lines.push("");
  lines.push(`Invalid categories: ${results.primaryCategories.invalid.length ? results.primaryCategories.invalid.join(", ") : "none"}`);
  lines.push(`Canonical categories not currently used: ${results.primaryCategories.canonicalMissing.join(", ") || "none"}`);
  lines.push(formatKeyCounts(results.primaryCategories.distribution));
  lines.push("");
  lines.push("## Tags");
  lines.push("");
  lines.push(`Unique tags: ${results.tags.uniqueCount}`);
  lines.push(`Singleton tags: ${results.tags.singletonCount}`);
  lines.push(`Process-like tags: ${results.tags.processLikeCount}`);
  lines.push(`Process-like examples: ${results.tags.processLikeExamples.join(", ") || "none"}`);
  lines.push("");
  lines.push("## Source Types");
  lines.push("");
  lines.push(`Aliases: ${results.sourceTypes.aliases.map((row) => `${row.sourceType}->${row.canonical} (${row.count})`).join(", ") || "none"}`);
  lines.push(`Unknown: ${results.sourceTypes.unknown.map((row) => `${row.sourceType} (${row.count})`).join(", ") || "none"}`);
  lines.push("");
  lines.push("## Regions");
  lines.push("");
  lines.push("Raw distribution:");
  lines.push(formatKeyCounts(results.regions.distribution));
  lines.push("");
  lines.push("Normalized distribution:");
  lines.push(formatKeyCounts(results.regions.normalizedDistribution));
  lines.push("");
  lines.push(`Aliases: ${results.regions.aliases.map((row) => `${row.region}->${row.canonical} (${row.count})`).join(", ") || "none"}`);
  lines.push(`Unknown: ${results.regions.unknown.map((row) => `${row.region}->${row.normalized} (${row.count})`).join(", ") || "none"}`);
  lines.push("");
  lines.push("## Taxonomy Facets");
  lines.push("");
  lines.push(`Rows with taxonomy: ${results.taxonomy.withTaxonomy}`);
  lines.push("Source-backed:");
  lines.push(formatFacetCounts(results.taxonomy.sourceBacked));
  lines.push("Inferred:");
  lines.push(formatFacetCounts(results.taxonomy.inferred));
  lines.push("");
  lines.push("## Migration Examples");
  lines.push("");
  lines.push(`Broad mapped: ${results.taxonomy.migration.broadMappedExamples.join(", ") || "none"}`);
  lines.push(`Unmapped: ${results.taxonomy.migration.unmappedExamples.join(", ") || "none"}`);
  return lines.join("\n");
}

async function getPg(): Promise<PgClient> {
  if (!pgClient) {
    pgClient = (await import("@/db/client")).pg;
  }
  return pgClient;
}

function isMain() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}

function formatKeyCounts(counts: CountMap) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `- ${key}: ${count}`)
    .join("\n");
}

function formatFacetCounts(counts: Record<TaxonomyFacetFamily, CountMap>) {
  return taxonomyFacetKeys
    .map((family) => {
      const values = Object.entries(counts[family])
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 15)
        .map(([value, count]) => `${value} ${count}`)
        .join(", ");
      return `- ${family}: ${values || "none"}`;
    })
    .join("\n");
}
