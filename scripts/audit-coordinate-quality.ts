import { pathToFileURL } from "node:url";

import { checkAigoReadOnlyApiReadiness, exactNameSearchReadOnly, readAigoJsonReadOnly, type AigoSearchItem, type AigoSearchOptions } from "./lib/aigo-search";

type CoordinateQualityArgs = {
  apiBaseUrl?: string;
  apiKey?: string;
  candidates: OfficialCoordinateInput[];
  duplicateLimit: number;
  json: boolean;
  skipHealthcheck: boolean;
  thresholdMeters: number;
  timeoutMs: number;
};

type OfficialCoordinateInput = {
  name: string;
  lat: number;
  lng: number;
  sourceUrl: string;
  sourceTitle?: string;
};

type CoordinateQualityReport = {
  generatedAt: string;
  thresholdMeters: number;
  candidates: CoordinateCandidateAudit[];
};

type CoordinateCandidateAudit = {
  name: string;
  status: "ok" | "review" | "missing" | "error";
  existing: ExistingCoordinateSummary | null;
  officialCoordinate: OfficialCoordinateSummary;
  distanceMeters: number | null;
  coordinateProvenanceLevel: string | null;
  coordinateSourceUsable: boolean;
  duplicateCandidates: DuplicateCoordinateSummary[];
  warnings: string[];
};

type ExistingCoordinateSummary = {
  id: string;
  name: string;
  primaryCategory: string | null;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
};

type OfficialCoordinateSummary = {
  lat: number;
  lng: number;
  sourceUrl: string;
  sourceTitle: string | null;
};

type DuplicateCoordinateSummary = {
  id: string | null;
  name: string | null;
  confidence: string | null;
  suggestedAction: string | null;
  distanceMeters: number | null;
  reasonCodes: string[];
};

const PRODUCTION_AIGO_API_BASE_URL = "https://aigo.o-r.kr";
const lowTrustCoordinateLevels = new Set(["none", "unknown", "manual_hold", "third_party_listing", "public_dataset_centroid", "parent_building_coordinate"]);

if (isMain()) {
  void main();
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = await auditCoordinateQuality(args);
    console.log(args.json ? JSON.stringify(report, null, 2) : formatCoordinateQualityReport(report));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): CoordinateQualityArgs {
  const args: CoordinateQualityArgs = {
    candidates: [],
    apiBaseUrl: PRODUCTION_AIGO_API_BASE_URL,
    duplicateLimit: 10,
    json: false,
    skipHealthcheck: false,
    thresholdMeters: 100,
    timeoutMs: 10_000
  };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--skip-healthcheck") {
      args.skipHealthcheck = true;
      continue;
    }
    if (arg.startsWith("--candidate=")) {
      args.candidates.push(parseOfficialCoordinateSpec(arg.slice("--candidate=".length)));
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
    if (arg.startsWith("--duplicate-limit=")) {
      args.duplicateLimit = positiveInteger(arg.slice("--duplicate-limit=".length), "duplicate-limit", 20);
      continue;
    }
    if (arg.startsWith("--threshold-meters=")) {
      args.thresholdMeters = positiveInteger(arg.slice("--threshold-meters=".length), "threshold-meters");
      continue;
    }
    if (arg.startsWith("--timeout-ms=")) {
      args.timeoutMs = positiveInteger(arg.slice("--timeout-ms=".length), "timeout-ms");
      continue;
    }
  }

  if (args.candidates.length === 0) {
    throw new Error(
      "Usage: pnpm tsx scripts/audit-coordinate-quality.ts --candidate='name|lat|lng|sourceUrl|sourceTitle' [--candidate=...] [--json]"
    );
  }

  return args;
}

export function parseOfficialCoordinateSpec(value: string): OfficialCoordinateInput {
  const [name, latRaw, lngRaw, sourceUrl, sourceTitle] = value.split("|").map((part) => part.trim());
  if (!name || !latRaw || !lngRaw || !sourceUrl) {
    throw new Error("--candidate must be formatted as name|lat|lng|sourceUrl|sourceTitle");
  }
  const lat = numberInRange(latRaw, "lat", -90, 90);
  const lng = numberInRange(lngRaw, "lng", -180, 180);
  return {
    name,
    lat,
    lng,
    sourceUrl,
    ...(sourceTitle ? { sourceTitle } : {})
  };
}

export async function auditCoordinateQuality(args: CoordinateQualityArgs): Promise<CoordinateQualityReport> {
  const options: AigoSearchOptions = {
    apiBaseUrl: args.apiBaseUrl,
    apiKey: args.apiKey,
    timeoutMs: args.timeoutMs
  };
  if (!args.skipHealthcheck) {
    await checkAigoReadOnlyApiReadiness({
      ...options,
      log: (message) => {
        if (!args.json) console.error(message);
      }
    });
  }

  const candidates = await Promise.all(args.candidates.map((candidate) => auditCoordinateCandidate(candidate, args, options)));
  return {
    generatedAt: new Date().toISOString(),
    thresholdMeters: args.thresholdMeters,
    candidates
  };
}

export async function auditCoordinateCandidate(
  candidate: OfficialCoordinateInput,
  args: Pick<CoordinateQualityArgs, "duplicateLimit" | "thresholdMeters">,
  options: AigoSearchOptions
): Promise<CoordinateCandidateAudit> {
  try {
    const search = await exactNameSearchReadOnly(candidate.name, { ...options, limit: 3 });
    const first = search.items[0];
    const id = searchItemId(first);
    const detail = id ? await readAigoJsonReadOnly<Record<string, unknown>>(`/v1/places/${id}`, options) : null;
    const existing = detail ? existingCoordinateSummary(detail) : null;
    const coordinateProvenanceLevel = detail ? coordinateProvenanceLevelFromDetail(detail) : null;
    const distanceMeters = existing ? coordinateDistanceMeters(existing, candidate) : null;
    const coordinateSourceUsable = isUsableCoordinateSourceUrl(candidate.sourceUrl);
    const duplicateCandidates = await readDuplicateCandidates(candidate, args.duplicateLimit, options);
    const warnings = coordinateAuditWarnings({
      coordinateSourceUsable,
      coordinateProvenanceLevel,
      distanceMeters,
      thresholdMeters: args.thresholdMeters
    });

    return {
      name: candidate.name,
      status: !existing ? "missing" : warnings.length > 0 ? "review" : "ok",
      existing,
      officialCoordinate: {
        lat: candidate.lat,
        lng: candidate.lng,
        sourceUrl: candidate.sourceUrl,
        sourceTitle: candidate.sourceTitle ?? null
      },
      distanceMeters,
      coordinateProvenanceLevel,
      coordinateSourceUsable,
      duplicateCandidates,
      warnings
    };
  } catch (error) {
    return {
      name: candidate.name,
      status: "error",
      existing: null,
      officialCoordinate: {
        lat: candidate.lat,
        lng: candidate.lng,
        sourceUrl: candidate.sourceUrl,
        sourceTitle: candidate.sourceTitle ?? null
      },
      distanceMeters: null,
      coordinateProvenanceLevel: null,
      coordinateSourceUsable: isUsableCoordinateSourceUrl(candidate.sourceUrl),
      duplicateCandidates: [],
      warnings: [error instanceof Error ? error.message : String(error)]
    };
  }
}

export function coordinateAuditWarnings(input: {
  coordinateSourceUsable: boolean;
  coordinateProvenanceLevel: string | null;
  distanceMeters: number | null;
  thresholdMeters: number;
}) {
  const warnings: string[] = [];
  if (!input.coordinateSourceUsable) warnings.push("coordinate_source_unusable");
  if (!input.coordinateProvenanceLevel || lowTrustCoordinateLevels.has(input.coordinateProvenanceLevel)) warnings.push("low_trust_existing_provenance");
  if (input.distanceMeters !== null && input.distanceMeters > input.thresholdMeters) warnings.push("coordinate_distance_exceeds_threshold");
  return warnings;
}

export function isUsableCoordinateSourceUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const isKakaoMap = host === "map.kakao.com" || host.endsWith(".map.kakao.com");
  if (!isKakaoMap) return true;

  const hasCoordinateParams = url.searchParams.has("urlX") && url.searchParams.has("urlY");
  if (hasCoordinateParams) return true;

  return !/\/link\/(?:map|to)\//.test(url.pathname);
}

export function coordinateDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadiusMeters = 6_371_000;
  const lat1 = degreesToRadians(a.lat);
  const lat2 = degreesToRadians(b.lat);
  const deltaLat = degreesToRadians(b.lat - a.lat);
  const deltaLng = degreesToRadians(b.lng - a.lng);
  const haversine = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

function existingCoordinateSummary(detail: Record<string, unknown>): ExistingCoordinateSummary | null {
  const id = stringField(detail, "id");
  const name = stringField(detail, "name");
  const lat = numberField(detail, "lat");
  const lng = numberField(detail, "lng");
  if (!id || !name || lat === null || lng === null) return null;
  return {
    id,
    name,
    primaryCategory: stringField(detail, "primaryCategory"),
    address: stringField(detail, "address"),
    roadAddress: stringField(detail, "roadAddress"),
    lat,
    lng
  };
}

function coordinateProvenanceLevelFromDetail(detail: Record<string, unknown>) {
  const externalRefs = recordField(detail, "externalRefs");
  const provenance = recordField(externalRefs, "coordinateProvenance");
  return stringField(provenance, "level");
}

async function readDuplicateCandidates(candidate: OfficialCoordinateInput, limit: number, options: AigoSearchOptions) {
  const response = await readAigoJsonReadOnly<{ items?: unknown[] }>("/v1/places/duplicates", {
    ...options,
    method: "POST",
    body: {
      name: candidate.name,
      lat: candidate.lat,
      lng: candidate.lng,
      radiusMeters: 500,
      projection: "compact",
      limit
    }
  });
  return (Array.isArray(response.items) ? response.items : []).map(duplicateSummary);
}

function duplicateSummary(value: unknown): DuplicateCoordinateSummary {
  const item = recordField(value);
  const place = recordField(item, "place");
  return {
    id: stringField(place, "id") ?? stringField(place, "placeId"),
    name: stringField(place, "name"),
    confidence: stringField(item, "confidence"),
    suggestedAction: stringField(item, "suggestedAction"),
    distanceMeters: numberField(item, "distanceMeters"),
    reasonCodes: stringArrayField(item, "reasonCodes")
  };
}

function formatCoordinateQualityReport(report: CoordinateQualityReport) {
  const lines = [`Coordinate quality audit generated ${report.generatedAt}`, `threshold: ${report.thresholdMeters}m`, ""];
  for (const candidate of report.candidates) {
    lines.push(`${candidate.name}: ${candidate.status}`);
    lines.push(`  existing: ${candidate.existing ? `${candidate.existing.id} ${candidate.existing.name}` : "missing"}`);
    lines.push(`  official: ${candidate.officialCoordinate.lat}, ${candidate.officialCoordinate.lng} (${candidate.officialCoordinate.sourceTitle ?? candidate.officialCoordinate.sourceUrl})`);
    lines.push(`  distance: ${candidate.distanceMeters === null ? "unknown" : `${candidate.distanceMeters}m`}`);
    lines.push(`  provenance: ${candidate.coordinateProvenanceLevel ?? "none"}; source usable: ${candidate.coordinateSourceUsable ? "yes" : "no"}`);
    if (candidate.warnings.length > 0) lines.push(`  warnings: ${candidate.warnings.join(", ")}`);
    if (candidate.duplicateCandidates.length > 0) {
      lines.push("  duplicate candidates:");
      for (const duplicate of candidate.duplicateCandidates) {
        lines.push(`    - ${duplicate.id ?? "unknown"} ${duplicate.name ?? "unknown"} ${duplicate.confidence ?? "unknown"} ${duplicate.distanceMeters ?? "unknown"}m`);
      }
    }
  }
  return lines.join("\n");
}

function searchItemId(item: AigoSearchItem | undefined) {
  const id = item?.id ?? item?.placeId;
  return typeof id === "string" ? id : null;
}

function recordField(value: unknown, key?: string): Record<string, unknown> {
  const target = key && isRecord(value) ? value[key] : value;
  return isRecord(target) ? target : {};
}

function stringField(value: unknown, key: string) {
  const target = isRecord(value) ? value[key] : undefined;
  return typeof target === "string" && target.trim() ? target : null;
}

function numberField(value: unknown, key: string) {
  const target = isRecord(value) ? value[key] : undefined;
  return typeof target === "number" && Number.isFinite(target) ? target : null;
}

function stringArrayField(value: unknown, key: string) {
  const target = isRecord(value) ? value[key] : undefined;
  return Array.isArray(target) ? target.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function positiveInteger(rawValue: string, key: string, max = Number.POSITIVE_INFINITY) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0 || value > max) throw new Error(`--${key} must be a positive integer${Number.isFinite(max) ? ` <= ${max}` : ""}`);
  return value;
}

function numberInRange(rawValue: string, key: string, min: number, max: number) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${key} must be a number between ${min} and ${max}`);
  return value;
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function isMain() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
