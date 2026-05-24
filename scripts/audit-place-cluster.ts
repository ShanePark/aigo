import { pathToFileURL } from "node:url";

import { DEFAULT_DEV_API_KEY } from "@/env";
import { exactNameSearchReadOnly, type AigoSearchItem, type AigoSearchOptions } from "./lib/aigo-search";

type ClusterAuditArgs = {
  candidates: string[];
  apiBaseUrl?: string;
  apiKey?: string;
  json: boolean;
  limit: number;
  sameSiteMeters: number;
  nearbyMeters: number;
  timeoutMs: number;
};

type CandidateAudit = {
  query: string;
  status: "found" | "missing" | "error";
  searchCount: number;
  places: AuditPlace[];
  error?: string;
};

type AuditPlace = {
  id: string;
  query: string;
  name: string;
  primaryCategory: string | null;
  address: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  officialUrl: string | null;
  sourceHosts: string[];
  sourceHierarchyKeys: string[];
  relatedPlaceIds: string[];
};

type PairAudit = {
  a: Pick<AuditPlace, "id" | "name" | "query">;
  b: Pick<AuditPlace, "id" | "name" | "query">;
  distanceMeters: number | null;
  relationSuggestion: "already_related" | "parent_child" | "same_site" | "nearby" | "manual_review";
  confidence: "high" | "medium" | "low";
  evidence: {
    alreadyRelated: boolean;
    sameAddress: boolean;
    nestedName: boolean;
    sharedSourceHosts: string[];
    sharedSourceHierarchyKeys: string[];
    missingCoordinates: boolean;
  };
  patchDraft: RelatedPlacePatchDraft | null;
};

type RelatedPlacePatchDraft = {
  placeId: string;
  relatedPlaces: [
    {
      placeId: string;
      relationType: "parent_child" | "same_site" | "nearby";
      note: string;
      evidence: Record<string, unknown>;
    }
  ];
};

type ClusterAuditReport = {
  candidates: CandidateAudit[];
  pairs: PairAudit[];
  patchDrafts: RelatedPlacePatchDraft[];
};

type PlaceDetail = Record<string, unknown>;

if (isMain()) {
  void main();
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = await auditPlaceCluster(args);
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatClusterAuditReport(report));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): ClusterAuditArgs {
  const args: ClusterAuditArgs = {
    candidates: [],
    json: false,
    limit: 3,
    sameSiteMeters: 350,
    nearbyMeters: 1_000,
    timeoutMs: 10_000
  };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg.startsWith("--candidate=")) {
      const value = arg.slice("--candidate=".length).trim();
      if (value) args.candidates.push(value);
      continue;
    }
    if (arg.startsWith("--candidates=")) {
      args.candidates.push(...splitCandidates(arg.slice("--candidates=".length)));
      continue;
    }
    if (arg.startsWith("--api-base-url=")) {
      args.apiBaseUrl = arg.slice("--api-base-url=".length).trim();
      continue;
    }
    if (arg.startsWith("--api-key=")) {
      args.apiKey = arg.slice("--api-key=".length).trim();
      continue;
    }
    if (arg.startsWith("--limit=")) {
      args.limit = positiveInteger(arg.slice("--limit=".length), "limit");
      continue;
    }
    if (arg.startsWith("--same-site-meters=")) {
      args.sameSiteMeters = positiveInteger(arg.slice("--same-site-meters=".length), "same-site-meters");
      continue;
    }
    if (arg.startsWith("--nearby-meters=")) {
      args.nearbyMeters = positiveInteger(arg.slice("--nearby-meters=".length), "nearby-meters");
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
  if (args.candidates.length < 2) {
    throw new Error(
      "Usage: pnpm tsx scripts/audit-place-cluster.ts --candidate=<name> --candidate=<name> [--json] [--same-site-meters=350]"
    );
  }

  return args;
}

export async function auditPlaceCluster(args: ClusterAuditArgs): Promise<ClusterAuditReport> {
  const options: AigoSearchOptions = {
    apiBaseUrl: args.apiBaseUrl,
    apiKey: args.apiKey,
    timeoutMs: args.timeoutMs
  };

  const candidates = await Promise.all(args.candidates.map((candidate) => auditCandidate(candidate, args, options)));
  return buildClusterAuditReport(candidates, {
    sameSiteMeters: args.sameSiteMeters,
    nearbyMeters: args.nearbyMeters
  });
}

export function buildClusterAuditReport(
  candidates: CandidateAudit[],
  options: Pick<ClusterAuditArgs, "sameSiteMeters" | "nearbyMeters">
): ClusterAuditReport {
  const places = candidates.flatMap((candidate) => candidate.places);
  const pairs: PairAudit[] = [];

  for (let i = 0; i < places.length; i += 1) {
    for (let j = i + 1; j < places.length; j += 1) {
      const a = places[i]!;
      const b = places[j]!;
      if (a.id === b.id) continue;
      pairs.push(buildPairAudit(a, b, options));
    }
  }

  return {
    candidates,
    pairs,
    patchDrafts: pairs.flatMap((pair) => (pair.patchDraft ? [pair.patchDraft] : []))
  };
}

export function buildPairAudit(
  a: AuditPlace,
  b: AuditPlace,
  options: Pick<ClusterAuditArgs, "sameSiteMeters" | "nearbyMeters">
): PairAudit {
  const distanceMeters = placeDistanceMeters(a, b);
  const sameAddress = Boolean(normalizeAddress(a.roadAddress ?? a.address) && normalizeAddress(a.roadAddress ?? a.address) === normalizeAddress(b.roadAddress ?? b.address));
  const nestedName = hasNestedName(a.name, b.name);
  const sharedSourceHosts = intersection(a.sourceHosts, b.sourceHosts);
  const sharedSourceHierarchyKeys = intersection(a.sourceHierarchyKeys, b.sourceHierarchyKeys);
  const alreadyRelated = a.relatedPlaceIds.includes(b.id) || b.relatedPlaceIds.includes(a.id);
  const missingCoordinates = distanceMeters === null;
  const suggestion = relationSuggestion({
    alreadyRelated,
    sameAddress,
    nestedName,
    sharedSourceHosts,
    sharedSourceHierarchyKeys,
    distanceMeters,
    missingCoordinates,
    sameSiteMeters: options.sameSiteMeters,
    nearbyMeters: options.nearbyMeters
  });

  return {
    a: pickPairPlace(a),
    b: pickPairPlace(b),
    distanceMeters,
    relationSuggestion: suggestion.relationSuggestion,
    confidence: suggestion.confidence,
    evidence: {
      alreadyRelated,
      sameAddress,
      nestedName,
      sharedSourceHosts,
      sharedSourceHierarchyKeys,
      missingCoordinates
    },
    patchDraft: buildPatchDraft(a, b, distanceMeters, suggestion.relationSuggestion, suggestion.confidence, {
      sameAddress,
      nestedName,
      sharedSourceHosts,
      sharedSourceHierarchyKeys
    })
  };
}

async function auditCandidate(candidate: string, args: ClusterAuditArgs, options: AigoSearchOptions): Promise<CandidateAudit> {
  try {
    const search = await exactNameSearchReadOnly<AigoSearchItem>(candidate, { ...options, limit: args.limit });
    const places = await Promise.all(
      search.items.map(async (item) => {
        const id = stringField(item, "id") ?? stringField(item, "placeId");
        const detail = id ? await readPlaceDetailReadOnly(id, args) : null;
        return toAuditPlace(candidate, item, detail);
      })
    );

    return {
      query: candidate,
      status: places.length > 0 ? "found" : "missing",
      searchCount: search.items.length,
      places: places.filter((place): place is AuditPlace => place !== null)
    };
  } catch (error) {
    return {
      query: candidate,
      status: "error",
      searchCount: 0,
      places: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function readPlaceDetailReadOnly(placeId: string, args: Pick<ClusterAuditArgs, "apiBaseUrl" | "apiKey" | "timeoutMs">): Promise<PlaceDetail> {
  const apiBaseUrl = normalizeBaseUrl(args.apiBaseUrl ?? process.env.AIGO_API_BASE_URL ?? "http://localhost:3000");
  const apiKey = args.apiKey ?? process.env.AIGO_API_KEY ?? DEFAULT_DEV_API_KEY;
  const response = await fetch(`${apiBaseUrl}/v1/places/${placeId}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json"
    },
    signal: AbortSignal.timeout(args.timeoutMs)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AiGo place detail failed with ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }
  const parsed = text ? JSON.parse(text) : {};
  return isRecord(parsed) ? parsed : {};
}

function toAuditPlace(query: string, item: AigoSearchItem, detail: PlaceDetail | null): AuditPlace | null {
  const id = stringField(detail, "id") ?? stringField(item, "id") ?? stringField(item, "placeId");
  const name = stringField(detail, "name") ?? stringField(item, "name");
  if (!id || !name) return null;

  const contact = recordField(detail, "contact") ?? recordField(item, "contact");
  const sources = arrayField(detail, "sources");
  const relatedPlaces = arrayField(detail, "relatedPlaces");
  const sourceUrls = unique([
    stringField(contact, "officialUrl"),
    stringField(detail, "officialUrl"),
    ...sources.map((source) => stringField(source, "url")).filter((value): value is string => Boolean(value))
  ].filter((value): value is string => Boolean(value)));

  return {
    id,
    query,
    name,
    primaryCategory: stringField(detail, "primaryCategory") ?? stringField(item, "primaryCategory"),
    address: stringField(detail, "address") ?? stringField(item, "address"),
    roadAddress: stringField(detail, "roadAddress") ?? stringField(item, "roadAddress"),
    lat: numberField(detail, "lat") ?? numberField(item, "lat"),
    lng: numberField(detail, "lng") ?? numberField(item, "lng"),
    officialUrl: stringField(contact, "officialUrl") ?? stringField(detail, "officialUrl") ?? null,
    sourceHosts: unique(sourceUrls.map(urlHost).filter((value): value is string => Boolean(value))),
    sourceHierarchyKeys: unique(sourceUrls.map(sourceHierarchyKey).filter((value): value is string => Boolean(value))),
    relatedPlaceIds: unique(relatedPlaces.map((place) => stringField(place, "placeId")).filter((value): value is string => Boolean(value)))
  };
}

function relationSuggestion(input: {
  alreadyRelated: boolean;
  sameAddress: boolean;
  nestedName: boolean;
  sharedSourceHosts: string[];
  sharedSourceHierarchyKeys: string[];
  distanceMeters: number | null;
  missingCoordinates: boolean;
  sameSiteMeters: number;
  nearbyMeters: number;
}): Pick<PairAudit, "relationSuggestion" | "confidence"> {
  if (input.alreadyRelated) return { relationSuggestion: "already_related", confidence: "high" };

  if (input.nestedName) {
    const strong = input.sameAddress || (input.distanceMeters !== null && input.distanceMeters <= input.sameSiteMeters) || input.sharedSourceHosts.length > 0;
    return { relationSuggestion: "parent_child", confidence: strong ? "high" : "medium" };
  }

  if (input.sameAddress || (input.distanceMeters !== null && input.distanceMeters <= input.sameSiteMeters)) {
    return { relationSuggestion: "same_site", confidence: "high" };
  }

  if (input.sharedSourceHierarchyKeys.length > 0) {
    return { relationSuggestion: "same_site", confidence: "high" };
  }

  if (input.sharedSourceHosts.length > 0) {
    return { relationSuggestion: "same_site", confidence: input.missingCoordinates ? "medium" : "low" };
  }

  if (input.distanceMeters !== null && input.distanceMeters <= input.nearbyMeters) {
    return { relationSuggestion: "nearby", confidence: "medium" };
  }

  return { relationSuggestion: "manual_review", confidence: "low" };
}

function buildPatchDraft(
  a: AuditPlace,
  b: AuditPlace,
  distanceMeters: number | null,
  relationSuggestionValue: PairAudit["relationSuggestion"],
  confidence: PairAudit["confidence"],
  evidence: Pick<PairAudit["evidence"], "sameAddress" | "nestedName" | "sharedSourceHosts" | "sharedSourceHierarchyKeys">
): RelatedPlacePatchDraft | null {
  if (!["parent_child", "same_site", "nearby"].includes(relationSuggestionValue)) return null;

  return {
    placeId: a.id,
    relatedPlaces: [
      {
        placeId: b.id,
        relationType: relationSuggestionValue as "parent_child" | "same_site" | "nearby",
        note: `${a.name} / ${b.name} cluster audit suggestion; verify source hierarchy before mutation.`,
        evidence: {
          auditHelper: "scripts/audit-place-cluster.ts",
          confidence,
          distanceMeters,
          ...evidence
        }
      }
    ]
  };
}

export function formatClusterAuditReport(report: ClusterAuditReport) {
  const lines = ["# Place Cluster Audit", "", "Candidates:"];
  for (const candidate of report.candidates) {
    lines.push(`- ${candidate.query}: ${candidate.status}${candidate.error ? ` (${candidate.error})` : ""}`);
    for (const place of candidate.places) {
      lines.push(`  - ${place.name} (${place.id}) ${place.primaryCategory ?? "unknown"} ${place.roadAddress ?? place.address ?? "address unknown"}`);
    }
  }

  lines.push("", "Relation suggestions:");
  if (report.pairs.length === 0) {
    lines.push("- none");
  }
  for (const pair of report.pairs) {
    const distance = pair.distanceMeters === null ? "distance unknown" : `${pair.distanceMeters}m`;
    lines.push(`- ${pair.a.name} <-> ${pair.b.name}: ${pair.relationSuggestion} (${pair.confidence}, ${distance})`);
    const evidence = [
      pair.evidence.sameAddress ? "same address" : null,
      pair.evidence.nestedName ? "nested name" : null,
      pair.evidence.sharedSourceHosts.length > 0 ? `shared hosts: ${pair.evidence.sharedSourceHosts.join(", ")}` : null,
      pair.evidence.sharedSourceHierarchyKeys.length > 0 ? `shared hierarchy: ${pair.evidence.sharedSourceHierarchyKeys.join(", ")}` : null,
      pair.evidence.alreadyRelated ? "already related" : null
    ].filter(Boolean);
    if (evidence.length > 0) lines.push(`  evidence: ${evidence.join("; ")}`);
  }

  if (report.patchDrafts.length > 0) {
    lines.push("", "Review-only PATCH drafts:");
    lines.push(JSON.stringify(report.patchDrafts, null, 2));
  }

  return lines.join("\n");
}

function placeDistanceMeters(a: Pick<AuditPlace, "lat" | "lng">, b: Pick<AuditPlace, "lat" | "lng">) {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return null;
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function hasNestedName(a: string, b: string) {
  const first = normalizeName(a);
  const second = normalizeName(b);
  return first.length >= 3 && second.length >= 3 && first !== second && (first.includes(second) || second.includes(first));
}

function pickPairPlace(place: AuditPlace) {
  return {
    id: place.id,
    name: place.name,
    query: place.query
  };
}

function splitCandidates(value: string) {
  return value
    .split(/[,\n]/)
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function positiveInteger(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${label} must be a positive integer`);
  return parsed;
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

function urlHost(value: string) {
  try {
    return new URL(value).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function sourceHierarchyKey(value: string) {
  try {
    const url = new URL(value);
    const firstPathSegment = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return `${url.host.replace(/^www\./, "").toLowerCase()}/${firstPathSegment}`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function intersection(first: string[], second: string[]) {
  const secondSet = new Set(second);
  return first.filter((value) => secondSet.has(value));
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function normalizeAddress(value: string | null) {
  return value
    ?.normalize("NFKC")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, "")
    .replace(/[,.]/g, "")
    .toLowerCase();
}

function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[()·ㆍ.,-]/g, "")
    .toLowerCase();
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function isMain() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}
