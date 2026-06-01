import { pathToFileURL } from "node:url";

import { DEFAULT_DEV_API_KEY } from "@/env";
import type { PlaceTaxonomyInput, SourceInput, UpdatePlaceInput } from "@/lib/schemas";

type Args = {
  apiBaseUrl: string;
  apiKey: string;
  apply: boolean;
  concurrency: number;
  json: boolean;
  limit?: number;
  maxPatches?: number;
  offset: number;
  pruneStale: boolean;
};

type ImageHealthResponse = {
  items?: ImageHealthItem[];
  meta?: {
    total?: number;
    count?: number;
    limit?: number;
    offset?: number;
  };
};

type ImageHealthItem = {
  placeId?: unknown;
  id?: unknown;
  name?: unknown;
  primaryCategory?: unknown;
};

type PlaceDetail = {
  id: string;
  name: string;
  primaryCategory: string;
  tags?: string[];
  description?: string | null;
  address?: string | null;
  roadAddress?: string | null;
  regionSido?: string | null;
  regionSigungu?: string | null;
  taxonomy?: PlaceTaxonomyInput | null;
  pricing?: Record<string, unknown> | null;
  scoring?: {
    scoreSignals?: Record<string, unknown> | null;
  } | null;
  sources?: SourceDetail[];
};

type SourceDetail = {
  sourceType?: string | null;
  title?: string | null;
  url?: string | null;
  externalId?: string | null;
  summary?: string | null;
  checkedAt?: string | null;
};

type VersionList = {
  items?: unknown[];
  versions?: unknown[];
};

type Classification = {
  action: "patch" | "remove" | "skip_existing" | "hold" | "skip";
  confidence: "high" | "medium" | "low";
  evidence: string[];
  reasonCodes: string[];
};

type TaxonomyFacetSetInput = Partial<NonNullable<PlaceTaxonomyInput["sourceBacked"]>>;
type TaxonomyInferredInput = TaxonomyFacetSetInput & Pick<NonNullable<PlaceTaxonomyInput["inferred"]>, "basis" | "confidence">;

type PlannedPatch = {
  id: string;
  name: string;
  primaryCategory: string;
  confidence: Classification["confidence"];
  evidence: string[];
  reasonCodes: string[];
};

type AppliedPatch = PlannedPatch & {
  versionCount: number | null;
  verified: boolean;
};

type FailedPatch = PlannedPatch & {
  error: string;
};

const PAGE_LIMIT = 200;
const PUBLIC_FACILITY_TAG = "public_facility";
const publicCategoryAllowList = new Set([
  "toy_library",
  "library",
  "science_museum",
  "museum",
  "art_museum",
  "experience_center",
  "sports_venue",
  "park",
  "indoor_playground"
]);
const alwaysHoldCategories = new Set(["kids_cafe", "family_cafe", "family_restaurant", "shopping_mall", "toy_store", "accommodation", "rest_area"]);
const publicTagTerms = [
  "public_facility",
  "public_child_facility",
  "public_library",
  "public_childcare",
  "public_museum",
  "공공시설",
  "공공실내",
  "공공육아",
  "공공 키즈카페"
];
const strongNameTerms = [
  "국립",
  "시립",
  "구립",
  "도립",
  "군립",
  "공립",
  "서울형 키즈카페",
  "공동육아나눔터",
  "육아종합지원센터",
  "아이사랑놀이터",
  "장난감도서관",
  "어린이회관",
  "어린이박물관",
  "어린이자료실",
  "국립수목원",
  "한밭수목원"
];
const sourcePublicPattern =
  /(public_agency|go\.kr|국립|시립|구립|도립|군립|공립|시청|구청|군청|도청|교육청|육아종합지원센터|가족센터|건강가정지원센터|장난감도서관|공동육아나눔터)/i;
const ambiguousNamePattern = /(문화센터|체험관|테마파크|수목원|도서관|과학관|박물관|센터)/;
const commercialPublicFacilityExclusionPattern = /(넥스페리움|키자니아|상록리조트|아쿠아피아|챔피언|블랙벨트|플레이타임|바운스|트니트니)/;

if (isMain()) {
  const args = parseArgs(process.argv.slice(2));
  const report = await run(args);
  console.log(args.json ? JSON.stringify(report, null, 2) : formatMarkdown(report));
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    apiBaseUrl: normalizeBaseUrl(process.env.AIGO_API_BASE_URL ?? "http://localhost:3000"),
    apiKey: process.env.AIGO_API_KEY ?? DEFAULT_DEV_API_KEY,
    apply: false,
    concurrency: 8,
    json: true,
    offset: 0,
    pruneStale: false
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--markdown") {
      args.json = false;
      continue;
    }
    if (arg === "--prune-stale") {
      args.pruneStale = true;
      continue;
    }
    if (arg.startsWith("--base-url=")) {
      args.apiBaseUrl = normalizeBaseUrl(arg.slice("--base-url=".length));
      continue;
    }
    if (arg.startsWith("--api-key=")) {
      args.apiKey = arg.slice("--api-key=".length);
      continue;
    }
    if (arg.startsWith("--limit=")) {
      args.limit = positiveIntegerArg(arg, "--limit=");
      continue;
    }
    if (arg.startsWith("--concurrency=")) {
      const concurrency = positiveIntegerArg(arg, "--concurrency=");
      if (concurrency < 1 || concurrency > 24) throw new Error("--concurrency must be between 1 and 24");
      args.concurrency = concurrency;
      continue;
    }
    if (arg.startsWith("--max-patches=")) {
      args.maxPatches = positiveIntegerArg(arg, "--max-patches=");
      continue;
    }
    if (arg.startsWith("--offset=")) {
      args.offset = positiveIntegerArg(arg, "--offset=");
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

export async function run(args: Args, now = new Date().toISOString()) {
  await apiRequest(args, "/v1/health", { method: "GET" });

  const summaries = await listAllActivePlaceSummaries(args);
  const planned: PlannedPatch[] = [];
  const removalPlanned: PlannedPatch[] = [];
  const existing: PlannedPatch[] = [];
  const held: PlannedPatch[] = [];
  const skipped: PlannedPatch[] = [];
  const applied: AppliedPatch[] = [];
  const removed: AppliedPatch[] = [];
  const failed: FailedPatch[] = [];

  await mapConcurrent(summaries, args.concurrency, async (summary) => {
    const id = placeId(summary);
    if (!id) return;
    const detail = await apiRequest<PlaceDetail>(args, `/v1/places/${encodeURIComponent(id)}`, { method: "GET" });
    const classification = classifyPublicFacility(detail, args);
    const item = {
      id: detail.id,
      name: detail.name,
      primaryCategory: detail.primaryCategory,
      confidence: classification.confidence,
      evidence: classification.evidence,
      reasonCodes: classification.reasonCodes
    };

    if (classification.action === "patch") planned.push(item);
    if (classification.action === "remove") removalPlanned.push(item);
    if (classification.action === "skip_existing") existing.push(item);
    if (classification.action === "hold") held.push(item);
    if (classification.action === "skip") skipped.push(item);
  });

  planned.sort(comparePatchItems);
  removalPlanned.sort(comparePatchItems);
  existing.sort(comparePatchItems);
  held.sort(comparePatchItems);
  skipped.sort(comparePatchItems);

  const patchQueue = args.maxPatches === undefined ? planned : planned.slice(0, args.maxPatches);
  const removalQueue = args.maxPatches === undefined ? removalPlanned : removalPlanned.slice(0, Math.max(0, args.maxPatches - patchQueue.length));
  if (args.apply) {
    await mapConcurrent(patchQueue, Math.min(args.concurrency, 8), async (plan) => {
      try {
        const detail = await apiRequest<PlaceDetail>(args, `/v1/places/${encodeURIComponent(plan.id)}`, { method: "GET" });
        if (hasPublicFacility(detail.taxonomy)) {
          applied.push({ ...plan, versionCount: await fetchVersionCount(args, plan.id), verified: true });
          return;
        }
        await apiRequest<PlaceDetail>(args, `/v1/places/${encodeURIComponent(plan.id)}`, {
          method: "PATCH",
          body: JSON.stringify(buildPatchPayload(detail, plan, now))
        });
        const verified = await apiRequest<PlaceDetail>(args, `/v1/places/${encodeURIComponent(plan.id)}`, { method: "GET" });
        const versionCount = await fetchVersionCount(args, plan.id);
        applied.push({ ...plan, versionCount, verified: hasPublicFacility(verified.taxonomy) });
      } catch (error) {
        failed.push({ ...plan, error: error instanceof Error ? error.message : String(error) });
      }
    });
    await mapConcurrent(removalQueue, Math.min(args.concurrency, 8), async (plan) => {
      try {
        const detail = await apiRequest<PlaceDetail>(args, `/v1/places/${encodeURIComponent(plan.id)}`, { method: "GET" });
        if (!hasPublicFacility(detail.taxonomy)) {
          removed.push({ ...plan, versionCount: await fetchVersionCount(args, plan.id), verified: true });
          return;
        }
        await apiRequest<PlaceDetail>(args, `/v1/places/${encodeURIComponent(plan.id)}`, {
          method: "PATCH",
          body: JSON.stringify(buildRemovalPayload(detail, plan, now))
        });
        const verified = await apiRequest<PlaceDetail>(args, `/v1/places/${encodeURIComponent(plan.id)}`, { method: "GET" });
        const versionCount = await fetchVersionCount(args, plan.id);
        removed.push({ ...plan, versionCount, verified: !hasPublicFacility(verified.taxonomy) });
      } catch (error) {
        failed.push({ ...plan, error: error instanceof Error ? error.message : String(error) });
      }
    });
    applied.sort(comparePatchItems);
    removed.sort(comparePatchItems);
    failed.sort(comparePatchItems);
  }

  return {
    generatedAt: now,
    mode: args.apply ? "apply" : "dry-run",
    apiBaseUrl: args.apiBaseUrl,
    summary: {
      scannedActivePlaces: summaries.length,
      totalCandidates: planned.length + removalPlanned.length + existing.length + held.length,
      alreadyTagged: existing.length,
      patchNeeded: planned.length,
      removalNeeded: removalPlanned.length,
      ambiguousHold: held.length,
      skipped: skipped.length,
      applied: applied.length,
      removed: removed.length,
      failed: failed.length
    },
    scanned: summaries.length,
    planned: planned.length,
    removalPlanned: removalPlanned.length,
    existing: existing.length,
    held: held.length,
    skipped: skipped.length,
    applyLimit: args.maxPatches ?? null,
    concurrency: args.concurrency,
    pruneStale: args.pruneStale,
    applied: applied.length,
    removed: removed.length,
    failed: failed.length,
    plannedSamples: planned.slice(0, 30),
    removalSamples: removalPlanned.slice(0, 30),
    existingSamples: existing.slice(0, 15),
    heldSamples: held.slice(0, 30),
    appliedSamples: applied.slice(0, 20),
    removedSamples: removed.slice(0, 20),
    failedSamples: failed.slice(0, 20)
  };
}

export function classifyPublicFacility(place: PlaceDetail, options: Pick<Args, "pruneStale"> = { pruneStale: false }): Classification {
  const tags = place.tags ?? [];
  const evidence: string[] = [];
  const reasonCodes: string[] = [];
  const publicTags = tags.filter((tag) => publicTagTerms.some((term) => normalizeText(tag).includes(normalizeText(term))));
  const nameTerms = strongNameTerms.filter((term) => place.name.includes(term));
  const sourceEvidence = (place.sources ?? []).filter((source) => sourcePublicPattern.test(sourceSearchText(source)));

  if (publicTags.length > 0) {
    reasonCodes.push("PUBLIC_TAG");
    evidence.push(`tags: ${publicTags.slice(0, 5).join(", ")}`);
  }
  if (nameTerms.length > 0) {
    reasonCodes.push("PUBLIC_NAME_TERM");
    evidence.push(`name terms: ${nameTerms.slice(0, 5).join(", ")}`);
  }
  if (sourceEvidence.length > 0) {
    reasonCodes.push("PUBLIC_SOURCE");
    evidence.push(`sources: ${sourceEvidence.slice(0, 3).map(sourceLabel).join(", ")}`);
  }

  if (!publicCategoryAllowList.has(place.primaryCategory)) {
    if (hasPublicFacility(place.taxonomy) && options.pruneStale) {
      return {
        action: "remove",
        confidence: "high",
        evidence: [...evidence, `primaryCategory: ${place.primaryCategory}`],
        reasonCodes: [...reasonCodes, "STALE_PUBLIC_FACILITY_OUT_OF_SCOPE_CATEGORY"]
      };
    }
    if (reasonCodes.length > 0 && alwaysHoldCategories.has(place.primaryCategory)) {
      return { action: "hold", confidence: "low", evidence, reasonCodes: [...reasonCodes, "CATEGORY_HOLD"] };
    }
    return { action: "skip", confidence: "low", evidence, reasonCodes: ["CATEGORY_NOT_PUBLIC_FACILITY_SCOPE"] };
  }

  if (isCommercialPublicFacilityExclusion(place)) {
    const commercialEvidence = [...evidence, "commercial/private operator signal in name or tags"];
    const commercialReasons = [...reasonCodes, "COMMERCIAL_OPERATOR_EXCLUSION"];
    if (hasPublicFacility(place.taxonomy) && options.pruneStale) {
      return {
        action: "remove",
        confidence: "high",
        evidence: commercialEvidence,
        reasonCodes: commercialReasons
      };
    }
    return { action: "hold", confidence: "low", evidence: commercialEvidence, reasonCodes: commercialReasons };
  }

  if (hasPublicFacility(place.taxonomy)) {
    return {
      action: "skip_existing",
      confidence: "high",
      evidence: ["taxonomy already includes public_facility"],
      reasonCodes: ["ALREADY_CLASSIFIED"]
    };
  }

  if (reasonCodes.includes("PUBLIC_SOURCE") && (reasonCodes.includes("PUBLIC_NAME_TERM") || reasonCodes.includes("PUBLIC_TAG"))) {
    return { action: "patch", confidence: "high", evidence, reasonCodes };
  }

  if (reasonCodes.includes("PUBLIC_TAG") || reasonCodes.includes("PUBLIC_NAME_TERM")) {
    return { action: "patch", confidence: "medium", evidence, reasonCodes };
  }

  if (reasonCodes.includes("PUBLIC_SOURCE")) {
    if (place.primaryCategory === "indoor_playground" && ambiguousNamePattern.test(place.name)) {
      return { action: "hold", confidence: "low", evidence, reasonCodes: [...reasonCodes, "AMBIGUOUS_NAME_NEEDS_SOURCE_REVIEW"] };
    }
    return { action: "hold", confidence: "low", evidence, reasonCodes: [...reasonCodes, "PUBLIC_SOURCE_NEEDS_OPERATOR_REVIEW"] };
  }

  if (ambiguousNamePattern.test(place.name)) {
    return {
      action: "hold",
      confidence: "low",
      evidence: ["generic public-ish facility name without public source evidence"],
      reasonCodes: ["AMBIGUOUS_NAME_NEEDS_SOURCE_REVIEW"]
    };
  }

  return { action: "skip", confidence: "low", evidence, reasonCodes: ["NO_PUBLIC_SIGNAL"] };
}

function buildPatchPayload(place: PlaceDetail, plan: PlannedPatch, now: string): UpdatePlaceInput {
  const taxonomy = withPublicFacility(place.taxonomy);
  return {
    taxonomy,
    sources: [buildAuditSource(plan, now)],
    sourceMode: "append",
    imageMode: "append",
    relatedPlaceMode: "append",
    actor: "agent",
    changeSummary: "공공/비영리 운영 가족 나들이 시설로 확인되어 taxonomy.accessTags에 public_facility를 추가합니다."
  };
}

function buildRemovalPayload(place: PlaceDetail, plan: PlannedPatch, now: string): UpdatePlaceInput {
  const taxonomy = withoutPublicFacility(place.taxonomy);
  return {
    taxonomy,
    sources: [buildRemovalAuditSource(plan, now)],
    sourceMode: "append",
    imageMode: "append",
    relatedPlaceMode: "append",
    actor: "agent",
    changeSummary: "일반 동네 놀이터는 공공시설 필터 범위에서 제외하기 위해 taxonomy.accessTags에서 public_facility를 제거합니다."
  };
}

function buildAuditSource(plan: PlannedPatch, now: string): SourceInput {
  return {
    sourceType: "agent_observation",
    title: "AiGo public facility taxonomy audit",
    externalId: `public-facility-taxonomy:${plan.id}:${now.slice(0, 10)}`,
    summary:
      `공공/비영리 운영 시설 전수조사에서 ${plan.name}을 public_facility로 분류했습니다. ` +
      `Confidence: ${plan.confidence}. Reason codes: ${plan.reasonCodes.join(", ")}. Evidence: ${plan.evidence.join(" / ")}`,
    checkedAt: now
  };
}

function buildRemovalAuditSource(plan: PlannedPatch, now: string): SourceInput {
  return {
    sourceType: "agent_observation",
    title: "AiGo public facility taxonomy cleanup",
    externalId: `public-facility-taxonomy-cleanup:${plan.id}:${now.slice(0, 10)}`,
    summary:
      `공공시설 필터 기준 조정으로 ${plan.name}의 public_facility 분류를 제거했습니다. ` +
      `일반 동네 놀이터(primaryCategory: playground)는 공공시설 필터 범위에서 제외합니다. ` +
      `Confidence: ${plan.confidence}. Reason codes: ${plan.reasonCodes.join(", ")}. Evidence: ${plan.evidence.join(" / ")}`,
    checkedAt: now
  };
}

function withPublicFacility(taxonomy: PlaceTaxonomyInput | null | undefined): PlaceTaxonomyInput {
  const sourceBacked: TaxonomyFacetSetInput = taxonomy?.sourceBacked ?? {};
  const inferred: TaxonomyInferredInput = taxonomy?.inferred ?? {};
  return {
    schemaVersion: 1,
    sourceBacked: {
      familyFitGates: sourceBacked.familyFitGates ?? [],
      activityTypes: sourceBacked.activityTypes ?? [],
      visitUseCases: sourceBacked.visitUseCases ?? [],
      ageBands: sourceBacked.ageBands ?? [],
      accessTags: unique([...(sourceBacked.accessTags ?? []), PUBLIC_FACILITY_TAG]),
      logisticsTags: sourceBacked.logisticsTags ?? [],
      riskTags: sourceBacked.riskTags ?? []
    },
    inferred: {
      familyFitGates: inferred.familyFitGates ?? [],
      activityTypes: inferred.activityTypes ?? [],
      visitUseCases: inferred.visitUseCases ?? [],
      ageBands: inferred.ageBands ?? [],
      accessTags: inferred.accessTags ?? [],
      logisticsTags: inferred.logisticsTags ?? [],
      riskTags: inferred.riskTags ?? [],
      confidence: inferred.confidence,
      basis: inferred.basis
    },
    migration: taxonomy?.migration ?? { legacyTags: [], broadMappedTags: [], unmappedTags: [] }
  };
}

function withoutPublicFacility(taxonomy: PlaceTaxonomyInput | null | undefined): PlaceTaxonomyInput {
  const sourceBacked: TaxonomyFacetSetInput = taxonomy?.sourceBacked ?? {};
  const inferred: TaxonomyInferredInput = taxonomy?.inferred ?? {};
  return {
    schemaVersion: 1,
    sourceBacked: {
      familyFitGates: sourceBacked.familyFitGates ?? [],
      activityTypes: sourceBacked.activityTypes ?? [],
      visitUseCases: sourceBacked.visitUseCases ?? [],
      ageBands: sourceBacked.ageBands ?? [],
      accessTags: removePublicFacility(sourceBacked.accessTags),
      logisticsTags: sourceBacked.logisticsTags ?? [],
      riskTags: sourceBacked.riskTags ?? []
    },
    inferred: {
      familyFitGates: inferred.familyFitGates ?? [],
      activityTypes: inferred.activityTypes ?? [],
      visitUseCases: inferred.visitUseCases ?? [],
      ageBands: inferred.ageBands ?? [],
      accessTags: removePublicFacility(inferred.accessTags),
      logisticsTags: inferred.logisticsTags ?? [],
      riskTags: inferred.riskTags ?? [],
      confidence: inferred.confidence,
      basis: inferred.basis
    },
    migration: taxonomy?.migration ?? { legacyTags: [], broadMappedTags: [], unmappedTags: [] }
  };
}

function hasPublicFacility(taxonomy: PlaceTaxonomyInput | null | undefined) {
  return Boolean(taxonomy?.sourceBacked?.accessTags?.includes(PUBLIC_FACILITY_TAG) || taxonomy?.inferred?.accessTags?.includes(PUBLIC_FACILITY_TAG));
}

function isCommercialPublicFacilityExclusion(place: PlaceDetail) {
  const text = [place.name, ...(place.tags ?? [])].join(" ");
  return commercialPublicFacilityExclusionPattern.test(text);
}

async function listAllActivePlaceSummaries(args: Args) {
  const items: ImageHealthItem[] = [];
  const requestedLimit = args.limit ?? Number.POSITIVE_INFINITY;
  let offset = args.offset;
  while (items.length < requestedLimit) {
    const pageLimit = Math.min(PAGE_LIMIT, requestedLimit - items.length);
    const response = await apiRequest<ImageHealthResponse>(
      args,
      `/v1/places/image-health?status=all&limit=${pageLimit}&offset=${offset}`,
      { method: "GET" }
    );
    const pageItems = response.items ?? [];
    items.push(...pageItems);
    offset += pageItems.length;
    const total = response.meta?.total ?? 0;
    if (pageItems.length === 0 || offset >= total) break;
  }
  return items;
}

async function fetchVersionCount(args: Args, placeId: string) {
  const versions = await apiRequest<VersionList>(args, `/v1/places/${encodeURIComponent(placeId)}/versions`, { method: "GET" });
  if (Array.isArray(versions.items)) return versions.items.length;
  if (Array.isArray(versions.versions)) return versions.versions.length;
  return null;
}

async function apiRequest<T = unknown>(args: Args, path: string, init: RequestInit) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${args.apiBaseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${args.apiKey}`,
          "content-type": "application/json",
          ...(init.headers ?? {})
        },
        signal: AbortSignal.timeout(30_000)
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
      }
      return (text ? JSON.parse(text) : {}) as T;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await delay(250 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function formatMarkdown(report: Awaited<ReturnType<typeof run>>) {
  const lines: string[] = [];
  lines.push("# Public Facility Taxonomy Audit");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push(`API base URL: ${report.apiBaseUrl}`);
  lines.push(`Scanned active places: ${report.scanned}`);
  lines.push(`Already classified: ${report.existing}`);
  lines.push(`Planned patches: ${report.planned}`);
  lines.push(`Planned removals: ${report.removalPlanned}`);
  lines.push(`Held for source review: ${report.held}`);
  lines.push(`Skipped: ${report.skipped}`);
  lines.push(`Applied: ${report.applied}`);
  lines.push(`Removed: ${report.removed}`);
  lines.push(`Failed: ${report.failed}`);
  lines.push("");
  lines.push("## Planned Samples");
  for (const item of report.plannedSamples) {
    lines.push(`- ${item.name} (${item.primaryCategory}, ${item.confidence}) [${item.reasonCodes.join(", ")}]`);
  }
  if (report.removalSamples.length > 0) {
    lines.push("");
    lines.push("## Removal Samples");
    for (const item of report.removalSamples) {
      lines.push(`- ${item.name} (${item.primaryCategory}, ${item.confidence}) [${item.reasonCodes.join(", ")}]`);
    }
  }
  if (report.heldSamples.length > 0) {
    lines.push("");
    lines.push("## Held Samples");
    for (const item of report.heldSamples) {
      lines.push(`- ${item.name} (${item.primaryCategory}) [${item.reasonCodes.join(", ")}]`);
    }
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

function placeId(item: ImageHealthItem) {
  const id = item.placeId ?? item.id;
  return typeof id === "string" ? id : null;
}

function sourceSearchText(source: SourceDetail) {
  return [source.sourceType, source.title, source.url, source.externalId, source.summary].filter(Boolean).join(" ");
}

function sourceLabel(source: SourceDetail) {
  return [source.sourceType, source.title || source.url || source.externalId].filter(Boolean).join(":");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapConcurrent<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
}

function comparePatchItems(a: PlannedPatch, b: PlannedPatch) {
  return a.primaryCategory.localeCompare(b.primaryCategory) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

function positiveIntegerArg(arg: string, prefix: string) {
  const value = Number(arg.slice(prefix.length));
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid ${prefix}${arg.slice(prefix.length)}`);
  return value;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function removePublicFacility(values: string[] | undefined) {
  return (values ?? []).filter((value) => value !== PUBLIC_FACILITY_TAG) as NonNullable<TaxonomyFacetSetInput["accessTags"]>;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isMain() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
