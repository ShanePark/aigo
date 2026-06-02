import { pathToFileURL } from "node:url";

import { checkAigoReadOnlyApiReadiness, exactNameSearchReadOnly, readAigoJsonReadOnly, type AigoSearchItem, type AigoSearchOptions } from "./lib/aigo-search";

type RegionCandidateAuditArgs = {
  candidates: string[];
  region?: string;
  regionSido?: string;
  regionSigungu?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  json: boolean;
  limit: number;
  duplicateLimit: number;
  healthcheckName?: string;
  healthcheckPlaceId?: string;
  radiusMeters: number;
  skipHealthcheck: boolean;
  staleAfterDays: number;
  timeoutMs: number;
};

type CandidateStatus = "registered" | "missing" | "needs_update" | "duplicate_review" | "error";
type SuggestedAction = "skip_existing" | "update_existing" | "create_candidate" | "manual_duplicate_review";

type RegionCandidateAuditReport = {
  region: string | null;
  generatedAt: string;
  candidates: CandidateAudit[];
};

type CandidateAudit = {
  query: string;
  region: string | null;
  status: CandidateStatus;
  suggestedAction: SuggestedAction;
  exactSearchCount: number;
  exactMatches: PlaceAuditSummary[];
  duplicateCandidates: DuplicateAuditSummary[];
  errors: string[];
};

type PlaceAuditSummary = {
  id: string;
  name: string;
  primaryCategory: string | null;
  address: string | null;
  roadAddress: string | null;
  updatedAt: string | null;
  sourceFreshness: SourceFreshnessSummary;
  latestVersion: VersionAuditSummary | null;
  imageHealth: ImageHealthSummary | null;
};

type SourceFreshnessSummary = {
  sourceCount: number;
  latestCheckedAt: string | null;
  latestCreatedAt: string | null;
  freshestAt: string | null;
  daysSinceFreshest: number | null;
  stale: boolean;
};

type VersionAuditSummary = {
  versionNumber: number | null;
  action: string | null;
  changeSummary: string | null;
  createdAt: string | null;
};

type ImageHealthSummary = {
  status: string | null;
  suggestedAction: string | null;
  activeCount: number | null;
  approvedCount: number | null;
  needsReviewCount: number | null;
  pendingReviewCount: number | null;
  hasPrimary: boolean | null;
};

type DuplicateAuditSummary = {
  id: string | null;
  name: string | null;
  primaryCategory: string | null;
  address: string | null;
  roadAddress: string | null;
  confidence: string | null;
  reasonCodes: string[];
  suggestedAction: string | null;
  outsideRadiusReviewOnly: boolean | null;
  distanceMeters: number | null;
};

type PlaceDetail = Record<string, unknown>;

const PRODUCTION_AIGO_API_BASE_URL = "https://aigo.o-r.kr";

if (isMain()) {
  void main();
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = await auditRegionCandidates(args);
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatRegionCandidateAuditReport(report));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): RegionCandidateAuditArgs {
  const args: RegionCandidateAuditArgs = {
    candidates: [],
    apiBaseUrl: PRODUCTION_AIGO_API_BASE_URL,
    json: false,
    limit: 5,
    duplicateLimit: 10,
    radiusMeters: 500,
    skipHealthcheck: false,
    staleAfterDays: 180,
    timeoutMs: 10_000
  };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg.startsWith("--region=")) {
      args.region = optionalString(arg.slice("--region=".length));
      continue;
    }
    if (arg.startsWith("--region-sido=")) {
      args.regionSido = optionalString(arg.slice("--region-sido=".length));
      continue;
    }
    if (arg.startsWith("--region-sigungu=")) {
      args.regionSigungu = optionalString(arg.slice("--region-sigungu=".length));
      continue;
    }
    if (arg.startsWith("--candidate=")) {
      const value = optionalString(arg.slice("--candidate=".length));
      if (value) args.candidates.push(value);
      continue;
    }
    if (arg.startsWith("--candidates=")) {
      args.candidates.push(...splitCandidates(arg.slice("--candidates=".length)));
      continue;
    }
    if (arg.startsWith("--api-base-url=")) {
      args.apiBaseUrl = optionalString(arg.slice("--api-base-url=".length));
      continue;
    }
    if (arg.startsWith("--api-key=")) {
      args.apiKey = optionalString(arg.slice("--api-key=".length));
      continue;
    }
    if (arg.startsWith("--limit=")) {
      args.limit = positiveInteger(arg.slice("--limit=".length), "limit");
      continue;
    }
    if (arg.startsWith("--duplicate-limit=")) {
      args.duplicateLimit = positiveInteger(arg.slice("--duplicate-limit=".length), "duplicate-limit", 20);
      continue;
    }
    if (arg.startsWith("--healthcheck-name=")) {
      args.healthcheckName = optionalString(arg.slice("--healthcheck-name=".length));
      continue;
    }
    if (arg.startsWith("--healthcheck-place-id=")) {
      args.healthcheckPlaceId = optionalString(arg.slice("--healthcheck-place-id=".length));
      continue;
    }
    if (arg === "--skip-healthcheck") {
      args.skipHealthcheck = true;
      continue;
    }
    if (arg.startsWith("--radius-meters=")) {
      args.radiusMeters = positiveInteger(arg.slice("--radius-meters=".length), "radius-meters", 5000);
      continue;
    }
    if (arg.startsWith("--stale-after-days=")) {
      args.staleAfterDays = positiveInteger(arg.slice("--stale-after-days=".length), "stale-after-days");
      continue;
    }
    if (arg.startsWith("--timeout-ms=")) {
      args.timeoutMs = positiveInteger(arg.slice("--timeout-ms=".length), "timeout-ms");
      continue;
    }
    if (!arg.startsWith("--")) {
      args.candidates.push(arg.trim());
    }
  }

  args.candidates = unique(args.candidates.filter(Boolean));
  if (args.candidates.length === 0) {
    throw new Error(
      "Usage: pnpm tsx scripts/audit-region-candidates.ts --region=<name> --candidate=<place> [--candidate=<place>] [--json]"
    );
  }

  return args;
}

export async function auditRegionCandidates(args: RegionCandidateAuditArgs): Promise<RegionCandidateAuditReport> {
  const options: AigoSearchOptions = {
    apiBaseUrl: args.apiBaseUrl,
    apiKey: args.apiKey,
    timeoutMs: args.timeoutMs
  };
  if (!args.skipHealthcheck) {
    await checkAigoReadOnlyApiReadiness({
      ...options,
      exactName: args.healthcheckName,
      expectedExactNamePlaceId: args.healthcheckPlaceId,
      log: (message) => {
        if (!args.json) console.error(message);
      }
    });
  }
  const now = new Date();
  const candidates = await Promise.all(args.candidates.map((candidate) => auditCandidate(candidate, args, options, now)));

  return {
    region: displayRegion(args),
    generatedAt: now.toISOString(),
    candidates
  };
}

export function buildCandidateAudit(input: {
  query: string;
  region?: string | null;
  exactSearchCount: number;
  exactMatches: PlaceAuditSummary[];
  duplicateCandidates: DuplicateAuditSummary[];
  errors?: string[];
}): CandidateAudit {
  const errors = input.errors ?? [];
  let status: CandidateStatus;
  let suggestedAction: SuggestedAction;

  if (input.exactMatches.length > 0) {
    const hasUpdateNeed = input.exactMatches.some(placeNeedsUpdate);
    status = hasUpdateNeed ? "needs_update" : "registered";
    suggestedAction = hasUpdateNeed ? "update_existing" : "skip_existing";
  } else if (input.duplicateCandidates.some(requiresDuplicateReview)) {
    status = "duplicate_review";
    suggestedAction = "manual_duplicate_review";
  } else if (errors.length > 0) {
    status = "error";
    suggestedAction = "manual_duplicate_review";
  } else {
    status = "missing";
    suggestedAction = "create_candidate";
  }

  return {
    query: input.query,
    region: input.region ?? null,
    status,
    suggestedAction,
    exactSearchCount: input.exactSearchCount,
    exactMatches: input.exactMatches,
    duplicateCandidates: input.duplicateCandidates,
    errors
  };
}

export function sourceFreshnessFromDetail(detail: PlaceDetail, now = new Date(), staleAfterDays = 180): SourceFreshnessSummary {
  const sources = arrayField(detail, "sources");
  const latestCheckedAt = latestIso(sources.map((source) => stringField(source, "checkedAt")));
  const latestCreatedAt = latestIso(sources.map((source) => stringField(source, "createdAt")));
  const freshestAt = latestCheckedAt ?? latestCreatedAt;
  const daysSinceFreshest = freshestAt ? daysBetween(freshestAt, now) : null;

  return {
    sourceCount: sources.length,
    latestCheckedAt,
    latestCreatedAt,
    freshestAt,
    daysSinceFreshest,
    stale: sources.length === 0 || daysSinceFreshest === null || daysSinceFreshest > staleAfterDays
  };
}

export function latestVersionSummary(...versionSources: unknown[]): VersionAuditSummary | null {
  const versions = versionSources.flatMap((source) => {
    if (Array.isArray(source)) return source.filter(isRecord);
    if (isRecord(source)) return arrayField(source, "versions").concat(arrayField(source, "items"));
    return [];
  });
  if (versions.length === 0) return null;

  const sorted = [...versions].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const versionDiff = (numberField(b, "versionNumber") ?? -1) - (numberField(a, "versionNumber") ?? -1);
    if (versionDiff !== 0) return versionDiff;
    return Date.parse(stringField(b, "createdAt") ?? "") - Date.parse(stringField(a, "createdAt") ?? "");
  });
  const latest = sorted[0]!;

  return {
    versionNumber: numberField(latest, "versionNumber"),
    action: stringField(latest, "action"),
    changeSummary: stringField(latest, "changeSummary"),
    createdAt: stringField(latest, "createdAt")
  };
}

export function formatRegionCandidateAuditReport(report: RegionCandidateAuditReport) {
  const lines = ["# Region Candidate Audit", "", `Region: ${report.region ?? "not specified"}`, `Generated at: ${report.generatedAt}`, ""];

  for (const candidate of report.candidates) {
    lines.push(`- ${candidate.query}: ${candidate.status} -> ${candidate.suggestedAction}`);
    if (candidate.errors.length > 0) {
      for (const error of candidate.errors) lines.push(`  error: ${error}`);
    }
    if (candidate.exactMatches.length === 0) {
      lines.push(`  exact matches: none (${candidate.exactSearchCount} search item(s))`);
    }
    for (const place of candidate.exactMatches) {
      const source = place.sourceFreshness.freshestAt
        ? `${place.sourceFreshness.freshestAt}${place.sourceFreshness.stale ? " stale" : " fresh"}`
        : "no source date";
      const image = place.imageHealth?.status ? `${place.imageHealth.status}${place.imageHealth.hasPrimary === false ? ", no primary" : ""}` : "image health unknown";
      const version = place.latestVersion?.versionNumber ? `v${place.latestVersion.versionNumber} ${place.latestVersion.action ?? ""}`.trim() : "no version summary";
      lines.push(`  exact: ${place.name} (${place.id}) ${place.primaryCategory ?? "unknown"} ${place.roadAddress ?? place.address ?? "address unknown"}`);
      lines.push(`    source: ${source}; image: ${image}; latest: ${version}`);
    }
    if (candidate.duplicateCandidates.length > 0) {
      lines.push("  duplicate candidates:");
      for (const duplicate of candidate.duplicateCandidates) {
        const codes = duplicate.reasonCodes.length > 0 ? ` [${duplicate.reasonCodes.join(", ")}]` : "";
        const action = duplicate.suggestedAction ? ` action=${duplicate.suggestedAction}` : "";
        lines.push(`    - ${duplicate.name ?? "unknown"} (${duplicate.id ?? "no id"}) ${duplicate.confidence ?? "unknown"}${action}${codes}`);
      }
    }
  }

  return lines.join("\n");
}

async function auditCandidate(candidate: string, args: RegionCandidateAuditArgs, options: AigoSearchOptions, now: Date): Promise<CandidateAudit> {
  const errors: string[] = [];
  let exactSearchCount = 0;
  let exactMatches: PlaceAuditSummary[] = [];

  try {
    const search = await exactNameSearchReadOnly<AigoSearchItem>(candidate, { ...options, limit: args.limit });
    exactSearchCount = search.items.length;
    const places = await Promise.all(
      search.items.map(async (item) => {
        const id = stringField(item, "id") ?? stringField(item, "placeId");
        if (!id) return null;

        try {
          const detail = await readPlaceDetailReadOnly(id, args);
          const versions = await readPlaceVersionsReadOnly(id, args).catch((error) => {
            errors.push(`${candidate}: version read failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
          });
          return toPlaceAuditSummary(item, detail, versions, now, args.staleAfterDays);
        } catch (error) {
          errors.push(`${candidate}: detail read failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        }
      })
    );
    exactMatches = places.filter((place): place is PlaceAuditSummary => place !== null);
  } catch (error) {
    errors.push(`${candidate}: exact-name search failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const imageHealth = await readImageHealthByPlaceId(
    exactMatches.map((place) => place.id),
    args
  ).catch((error) => {
    errors.push(`${candidate}: image-health read failed: ${error instanceof Error ? error.message : String(error)}`);
    return new Map<string, ImageHealthSummary>();
  });
  exactMatches = exactMatches.map((place) => ({ ...place, imageHealth: imageHealth.get(place.id) ?? place.imageHealth }));

  const duplicateCandidates = await readDuplicateCandidatesReadOnly(candidate, args).catch((error) => {
    errors.push(`${candidate}: duplicate check failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  });

  return buildCandidateAudit({
    query: candidate,
    region: displayRegion(args),
    exactSearchCount,
    exactMatches,
    duplicateCandidates,
    errors
  });
}

function toPlaceAuditSummary(
  item: AigoSearchItem,
  detail: PlaceDetail,
  versionsResponse: PlaceDetail | null,
  now: Date,
  staleAfterDays: number
): PlaceAuditSummary | null {
  const id = stringField(detail, "id") ?? stringField(item, "id") ?? stringField(item, "placeId");
  const name = stringField(detail, "name") ?? stringField(item, "name");
  if (!id || !name) return null;

  return {
    id,
    name,
    primaryCategory: stringField(detail, "primaryCategory") ?? stringField(item, "primaryCategory"),
    address: stringField(detail, "address") ?? stringField(item, "address"),
    roadAddress: stringField(detail, "roadAddress") ?? stringField(item, "roadAddress"),
    updatedAt: stringField(detail, "updatedAt") ?? stringField(item, "updatedAt"),
    sourceFreshness: sourceFreshnessFromDetail(detail, now, staleAfterDays),
    latestVersion: latestVersionSummary(versionsResponse, detail),
    imageHealth: compactImageHealth(recordField(item, "imageHealth"))
  };
}

async function readPlaceDetailReadOnly(placeId: string, args: Pick<RegionCandidateAuditArgs, "apiBaseUrl" | "apiKey" | "timeoutMs">): Promise<PlaceDetail> {
  return readJsonRoute(`/v1/places/${placeId}`, args);
}

async function readPlaceVersionsReadOnly(placeId: string, args: Pick<RegionCandidateAuditArgs, "apiBaseUrl" | "apiKey" | "timeoutMs">): Promise<PlaceDetail> {
  return readJsonRoute(`/v1/places/${placeId}/versions`, args);
}

async function readImageHealthByPlaceId(
  placeIds: string[],
  args: Pick<RegionCandidateAuditArgs, "apiBaseUrl" | "apiKey" | "timeoutMs">
): Promise<Map<string, ImageHealthSummary>> {
  if (placeIds.length === 0) return new Map();
  const params = new URLSearchParams({
    status: "all",
    limit: String(Math.min(placeIds.length, 200)),
    placeIds: placeIds.join(",")
  });
  const response = await readJsonRoute(`/v1/places/image-health?${params.toString()}`, args);
  const map = new Map<string, ImageHealthSummary>();

  for (const item of arrayField(response, "items")) {
    const placeId = stringField(item, "placeId");
    if (!placeId) continue;
    const imageHealth = compactImageHealth(recordField(item, "imageHealth"));
    if (imageHealth) map.set(placeId, imageHealth);
  }

  return map;
}

async function readDuplicateCandidatesReadOnly(candidate: string, args: RegionCandidateAuditArgs): Promise<DuplicateAuditSummary[]> {
  const regionSigungu = args.regionSigungu ?? args.region;
  if (!regionSigungu && !args.regionSido) return [];

  const body: Record<string, unknown> = {
    name: candidate,
    radiusMeters: args.radiusMeters,
    projection: "compact",
    limit: args.duplicateLimit
  };
  if (args.regionSido) body.regionSido = args.regionSido;
  if (regionSigungu) body.regionSigungu = regionSigungu;

  const response = await readJsonRoute("/v1/places/duplicates", args, {
    method: "POST",
    body: JSON.stringify(body)
  });

  return arrayField(response, "items").map(toDuplicateAuditSummary);
}

async function readJsonRoute(
  path: string,
  args: Pick<RegionCandidateAuditArgs, "apiBaseUrl" | "apiKey" | "timeoutMs">,
  init: RequestInit = {}
): Promise<PlaceDetail> {
  const parsed = await readAigoJsonReadOnly(path, {
    apiBaseUrl: args.apiBaseUrl,
    apiKey: args.apiKey,
    body: init.body ?? undefined,
    headers: Object.fromEntries(new Headers(init.headers).entries()),
    method: init.method ?? "GET",
    timeoutMs: args.timeoutMs
  });
  return isRecord(parsed) ? parsed : {};
}

function toDuplicateAuditSummary(item: Record<string, unknown>): DuplicateAuditSummary {
  const place = recordField(item, "place");
  return {
    id: stringField(place, "id"),
    name: stringField(place, "name"),
    primaryCategory: stringField(place, "primaryCategory"),
    address: stringField(place, "address"),
    roadAddress: stringField(place, "roadAddress"),
    confidence: stringField(item, "confidence"),
    reasonCodes: stringArrayField(item, "reasonCodes"),
    suggestedAction: stringField(item, "suggestedAction"),
    outsideRadiusReviewOnly: booleanField(item, "outsideRadiusReviewOnly"),
    distanceMeters: numberField(item, "distanceMeters")
  };
}

function compactImageHealth(value: Record<string, unknown> | null): ImageHealthSummary | null {
  if (!value) return null;
  return {
    status: stringField(value, "status"),
    suggestedAction: stringField(value, "suggestedAction"),
    activeCount: numberField(value, "activeCount"),
    approvedCount: numberField(value, "approvedCount"),
    needsReviewCount: numberField(value, "needsReviewCount"),
    pendingReviewCount: numberField(value, "pendingReviewCount"),
    hasPrimary: booleanField(value, "hasPrimary")
  };
}

function placeNeedsUpdate(place: PlaceAuditSummary) {
  if (place.sourceFreshness.stale) return true;
  const imageStatus = place.imageHealth?.status;
  return Boolean(imageStatus && imageStatus !== "healthy");
}

function requiresDuplicateReview(candidate: DuplicateAuditSummary) {
  if (candidate.suggestedAction === "hold_duplicate_review") return true;
  return candidate.confidence === "high" || candidate.confidence === "medium";
}

function displayRegion(args: Pick<RegionCandidateAuditArgs, "region" | "regionSido" | "regionSigungu">) {
  return args.region ?? ([args.regionSido, args.regionSigungu].filter(Boolean).join(" ") || null);
}

function splitCandidates(value: string) {
  return value
    .split(/[,\n]/)
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function positiveInteger(value: string, label: string, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new Error(`--${label} must be a positive integer${max === Number.MAX_SAFE_INTEGER ? "" : ` up to ${max}`}`);
  }
  return parsed;
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordField(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const child = value[key];
  return isRecord(child) ? child : null;
}

function arrayField(value: unknown, key: string): Record<string, unknown>[] {
  if (!isRecord(value)) return [];
  const child = value[key];
  return Array.isArray(child) ? child.filter(isRecord) : [];
}

function stringField(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const child = value[key];
  return typeof child === "string" && child.trim() ? child.trim() : null;
}

function stringArrayField(value: unknown, key: string) {
  if (!isRecord(value)) return [];
  const child = value[key];
  return Array.isArray(child) ? child.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

function numberField(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const child = value[key];
  if (typeof child === "number" && Number.isFinite(child)) return child;
  if (typeof child === "string" && child.trim()) {
    const parsed = Number(child);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function booleanField(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const child = value[key];
  return typeof child === "boolean" ? child : null;
}

function latestIso(values: Array<string | null>) {
  const dated = values
    .map((value) => (value ? { value, time: Date.parse(value) } : null))
    .filter((value): value is { value: string; time: number } => value !== null && Number.isFinite(value.time));
  dated.sort((a, b) => b.time - a.time);
  return dated[0]?.value ?? null;
}

function daysBetween(iso: string, now: Date) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return Math.floor((now.getTime() - time) / 86_400_000);
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function isMain() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}
