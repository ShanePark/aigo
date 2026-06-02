import { pathToFileURL } from "node:url";

import { exactNameSearchReadOnly, readAigoJsonReadOnly, type AigoSearchItem, type AigoSearchOptions } from "./lib/aigo-search";
import { latestVersionSummary, sourceFreshnessFromDetail } from "./audit-region-candidates";

type PatchExtractorArgs = {
  candidates: string[];
  apiBaseUrl?: string;
  apiKey?: string;
  json: boolean;
  limit: number;
  staleAfterDays: number;
  timeoutMs: number;
};

type CandidatePatchExtraction = {
  query: string;
  status: "update_ready" | "no_update_needed" | "no_match" | "ambiguous" | "error";
  exactSearchCount: number;
  places: PlacePatchExtraction[];
  errors: string[];
};

type PlacePatchExtraction = {
  id: string;
  name: string;
  primaryCategory: string | null;
  address: string | null;
  roadAddress: string | null;
  sourceFreshness: ReturnType<typeof sourceFreshnessFromDetail>;
  latestVersion: ReturnType<typeof latestVersionSummary>;
  missingFields: MissingField[];
  imageGap: ImageGap | null;
  patchDraft: SuggestedPatchDraft | null;
};

type MissingField = {
  path: string;
  writableField: string;
  group: "notes" | "age_fit" | "baby_logistics" | "visit_planning" | "scoring" | "taxonomy" | "operations" | "subfacilities";
  reason: string;
};

type ImageGap = {
  reason: "no_images" | "no_primary_image" | "unapproved_primary";
  activeCount: number;
  hasPrimary: boolean;
  primaryReviewStatus: string | null;
};

type SuggestedPatchDraft = {
  route: string;
  status: "needs_source_values";
  payloadSkeleton: {
    sourceMode: "append";
    imageMode: "append";
    changeSummary: string;
    sources: Array<{
      sourceType: "official_site";
      title: "TODO: source title";
      url: "TODO: source URL";
      summary: "TODO: summarize source-backed changes";
      checkedAt: "TODO: ISO datetime";
    }>;
  };
  fieldInstructions: Array<{
    writableField: string;
    currentPath: string;
    group: MissingField["group"] | "images" | "sources";
    instruction: string;
  }>;
};

type PatchExtractionReport = {
  generatedAt: string;
  candidates: CandidatePatchExtraction[];
};

type PlaceDetail = Record<string, unknown>;

const PRODUCTION_AIGO_API_BASE_URL = "https://aigo.o-r.kr";

const trackedFields: MissingField[] = [
  { path: "notes.parent", writableField: "parentNotes", group: "notes", reason: "Parent-facing fit notes are missing." },
  { path: "notes.safety", writableField: "safetyNotes", group: "notes", reason: "Safety notes are missing." },
  { path: "recommendedAgeMonths.min", writableField: "minRecommendedAgeMonths", group: "age_fit", reason: "Minimum age fit is missing." },
  { path: "recommendedAgeMonths.max", writableField: "maxRecommendedAgeMonths", group: "age_fit", reason: "Maximum age fit is missing." },
  { path: "facilities.strollerFriendly", writableField: "strollerFriendly", group: "baby_logistics", reason: "Stroller accessibility is unknown." },
  { path: "facilities.parkingAvailable", writableField: "parkingAvailable", group: "baby_logistics", reason: "Parking availability is unknown." },
  { path: "facilities.nursingRoom", writableField: "nursingRoom", group: "baby_logistics", reason: "Nursing room availability is unknown." },
  { path: "facilities.diaperChangingTable", writableField: "diaperChangingTable", group: "baby_logistics", reason: "Diaper table availability is unknown." },
  { path: "facilities.kidsToilet", writableField: "kidsToilet", group: "baby_logistics", reason: "Kids toilet availability is unknown." },
  { path: "facilities.elevator", writableField: "elevator", group: "baby_logistics", reason: "Elevator access is unknown." },
  { path: "facilities.babyChair", writableField: "babyChair", group: "baby_logistics", reason: "Baby chair availability is unknown." },
  { path: "facilities.foodAllowed", writableField: "foodAllowed", group: "baby_logistics", reason: "Food/snack handling is unknown." },
  { path: "visit.reservationRequired", writableField: "reservationRequired", group: "visit_planning", reason: "Reservation requirement is unknown." },
  { path: "visit.walkInAvailable", writableField: "walkInAvailable", group: "visit_planning", reason: "Walk-in availability is unknown." },
  { path: "visit.sessionBased", writableField: "sessionBased", group: "visit_planning", reason: "Session-based operation is unknown." },
  { path: "visit.sameDayAvailabilityKnown", writableField: "sameDayAvailabilityKnown", group: "visit_planning", reason: "Same-day availability evidence is missing." },
  { path: "visit.averageStayMinutes", writableField: "averageStayMinutes", group: "visit_planning", reason: "Typical stay duration is missing." },
  { path: "visit.parentEffortLevel", writableField: "parentEffortLevel", group: "visit_planning", reason: "Parent effort level is missing." },
  { path: "visit.childEngagementLevel", writableField: "childEngagementLevel", group: "visit_planning", reason: "Child engagement level is missing." },
  { path: "visit.rainyDayScore", writableField: "rainyDayScore", group: "visit_planning", reason: "Rainy-day fit score is missing." },
  { path: "visit.hotDayScore", writableField: "hotDayScore", group: "visit_planning", reason: "Hot-day fit score is missing." },
  { path: "visit.coldDayScore", writableField: "coldDayScore", group: "visit_planning", reason: "Cold-day fit score is missing." },
  { path: "openingHours", writableField: "openingHours", group: "operations", reason: "Structured opening-hours evidence is missing; text or description-only notes do not clear the opening-hours gap." },
  { path: "pricing", writableField: "pricing", group: "operations", reason: "Pricing/free-entry evidence is missing." },
  { path: "scoring.placeScore", writableField: "placeScore", group: "scoring", reason: "Stored place quality score is missing." },
  { path: "scoring.placeScoreRationale", writableField: "placeScoreRationale", group: "scoring", reason: "Place score rationale is missing." },
  { path: "scoring.scoreSignals", writableField: "scoreSignals", group: "scoring", reason: "Structured score signals are missing." },
  { path: "taxonomy", writableField: "taxonomy", group: "taxonomy", reason: "Structured taxonomy is empty." },
  { path: "playFeatures", writableField: "playFeatures", group: "taxonomy", reason: "Structured play features are empty." },
  { path: "externalRefs.subfacilitySweep", writableField: "externalRefs.subfacilitySweep", group: "subfacilities", reason: "Subfacility sweep evidence is missing." }
];

if (isMain()) {
  void main();
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = await extractUpdateReadyPatches(args);
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatPatchExtractionReport(report));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): PatchExtractorArgs {
  const args: PatchExtractorArgs = {
    candidates: [],
    apiBaseUrl: PRODUCTION_AIGO_API_BASE_URL,
    json: false,
    limit: 3,
    staleAfterDays: 180,
    timeoutMs: 10_000
  };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
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
    throw new Error("Usage: pnpm tsx scripts/extract-update-ready-patches.ts --candidate=<existing place> [--candidate=<existing place>] [--json]");
  }

  return args;
}

export async function extractUpdateReadyPatches(args: PatchExtractorArgs): Promise<PatchExtractionReport> {
  const options: AigoSearchOptions = {
    apiBaseUrl: args.apiBaseUrl,
    apiKey: args.apiKey,
    timeoutMs: args.timeoutMs
  };
  const now = new Date();
  const candidates = await Promise.all(args.candidates.map((candidate) => extractCandidatePatch(candidate, args, options, now)));

  return {
    generatedAt: now.toISOString(),
    candidates
  };
}

export function buildPlacePatchExtraction(detail: PlaceDetail, now = new Date(), staleAfterDays = 180): PlacePatchExtraction {
  const id = stringField(detail, "id") ?? "unknown";
  const name = stringField(detail, "name") ?? "unknown";
  const sourceFreshness = sourceFreshnessFromDetail(detail, now, staleAfterDays);
  const missingFields = missingUpdateFields(detail);
  const imageGap = imageGapFromDetail(detail);
  const latestVersion = latestVersionSummary(detail);
  const patchDraft = missingFields.length > 0 || imageGap || sourceFreshness.stale ? buildPatchDraft({ id, name, missingFields, imageGap, sourceFreshness }) : null;

  return {
    id,
    name,
    primaryCategory: stringField(detail, "primaryCategory"),
    address: stringField(detail, "address"),
    roadAddress: stringField(detail, "roadAddress"),
    sourceFreshness,
    latestVersion,
    missingFields,
    imageGap,
    patchDraft
  };
}

export function buildCandidatePatchExtraction(input: {
  query: string;
  exactSearchCount: number;
  places: PlacePatchExtraction[];
  errors?: string[];
}): CandidatePatchExtraction {
  const errors = input.errors ?? [];
  let status: CandidatePatchExtraction["status"];

  if (errors.length > 0 && input.places.length === 0) {
    status = "error";
  } else if (input.places.length === 0) {
    status = "no_match";
  } else if (input.places.length > 1) {
    status = "ambiguous";
  } else if (input.places.some((place) => place.patchDraft !== null)) {
    status = "update_ready";
  } else {
    status = "no_update_needed";
  }

  return {
    query: input.query,
    status,
    exactSearchCount: input.exactSearchCount,
    places: input.places,
    errors
  };
}

export function missingUpdateFields(detail: PlaceDetail): MissingField[] {
  return trackedFields.filter((field) => fieldIsMissing(detail, field));
}

export function imageGapFromDetail(detail: PlaceDetail): ImageGap | null {
  const images = arrayField(detail, "images");
  const primaryImage = recordField(detail, "primaryImage");
  const activeCount = images.length;
  const hasPrimary = primaryImage !== null || images.some((image) => booleanField(image, "isPrimary") === true);
  const primaryReviewStatus = stringField(primaryImage, "reviewStatus") ?? stringField(images[0], "reviewStatus");

  if (activeCount === 0) {
    return { reason: "no_images", activeCount, hasPrimary, primaryReviewStatus };
  }
  if (!hasPrimary) {
    return { reason: "no_primary_image", activeCount, hasPrimary, primaryReviewStatus };
  }
  if (primaryReviewStatus && primaryReviewStatus !== "approved") {
    return { reason: "unapproved_primary", activeCount, hasPrimary, primaryReviewStatus };
  }
  return null;
}

export function formatPatchExtractionReport(report: PatchExtractionReport) {
  const lines = ["# Update-Ready Patch Extraction", "", `Generated at: ${report.generatedAt}`, ""];

  for (const candidate of report.candidates) {
    lines.push(`- ${candidate.query}: ${candidate.status} (${candidate.exactSearchCount} exact search item(s))`);
    for (const error of candidate.errors) lines.push(`  error: ${error}`);
    for (const place of candidate.places) {
      const source = place.sourceFreshness.freshestAt
        ? `${place.sourceFreshness.freshestAt}${place.sourceFreshness.stale ? " stale" : " fresh"}`
        : "no source date";
      const version = place.latestVersion?.versionNumber ? `v${place.latestVersion.versionNumber} ${place.latestVersion.action ?? ""}`.trim() : "no version summary";
      lines.push(`  - ${place.name} (${place.id}) ${place.primaryCategory ?? "unknown"} ${place.roadAddress ?? place.address ?? "address unknown"}`);
      lines.push(`    source: ${source}; latest: ${version}`);
      if (place.missingFields.length > 0) {
        lines.push(`    missing: ${place.missingFields.map((field) => field.writableField).join(", ")}`);
      }
      if (place.imageGap) {
        lines.push(`    image gap: ${place.imageGap.reason}`);
      }
      if (place.patchDraft) {
        lines.push(`    patch route: ${place.patchDraft.route}`);
      }
    }
  }

  return lines.join("\n");
}

async function extractCandidatePatch(candidate: string, args: PatchExtractorArgs, options: AigoSearchOptions, now: Date): Promise<CandidatePatchExtraction> {
  const errors: string[] = [];
  let exactSearchCount = 0;
  let places: PlacePatchExtraction[] = [];

  try {
    const search = await exactNameSearchReadOnly<AigoSearchItem>(candidate, { ...options, limit: args.limit });
    exactSearchCount = search.items.length;
    const extractions = await Promise.all(
      search.items.map(async (item) => {
        const id = stringField(item, "id") ?? stringField(item, "placeId");
        if (!id) return null;

        try {
          const detail = await readPlaceDetailReadOnly(id, args);
          return buildPlacePatchExtraction(detail, now, args.staleAfterDays);
        } catch (error) {
          errors.push(`${candidate}: detail read failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        }
      })
    );
    places = extractions.filter((place): place is PlacePatchExtraction => place !== null);
  } catch (error) {
    errors.push(`${candidate}: exact-name search failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return buildCandidatePatchExtraction({ query: candidate, exactSearchCount, places, errors });
}

function buildPatchDraft(input: {
  id: string;
  name: string;
  missingFields: MissingField[];
  imageGap: ImageGap | null;
  sourceFreshness: ReturnType<typeof sourceFreshnessFromDetail>;
}): SuggestedPatchDraft {
  const fieldInstructions: SuggestedPatchDraft["fieldInstructions"] = input.missingFields.map((field) => ({
    writableField: field.writableField,
    currentPath: field.path,
    group: field.group,
    instruction: `${field.reason} Fill this with source-backed evidence before calling PATCH.`
  }));

  if (input.imageGap) {
    fieldInstructions.push({
      writableField: "images",
      currentPath: "images",
      group: "images",
      instruction: `Image coverage needs attention (${input.imageGap.reason}). Add source-backed structured images with reviewStatus approved.`
    });
  }
  if (input.sourceFreshness.stale) {
    fieldInstructions.push({
      writableField: "sources",
      currentPath: "sources",
      group: "sources",
      instruction: "Sources are stale or missing. Append at least one freshly checked source that justifies the changed fields."
    });
  }

  return {
    route: `PATCH /v1/places/${input.id}`,
    status: "needs_source_values",
    payloadSkeleton: {
      sourceMode: "append",
      imageMode: "append",
      changeSummary: `Enrich ${input.name} with source-backed family logistics, age fit, taxonomy, and review evidence.`,
      sources: [
        {
          sourceType: "official_site",
          title: "TODO: source title",
          url: "TODO: source URL",
          summary: "TODO: summarize source-backed changes",
          checkedAt: "TODO: ISO datetime"
        }
      ]
    },
    fieldInstructions
  };
}

async function readPlaceDetailReadOnly(placeId: string, args: Pick<PatchExtractorArgs, "apiBaseUrl" | "apiKey" | "timeoutMs">): Promise<PlaceDetail> {
  const parsed = await readAigoJsonReadOnly(`/v1/places/${placeId}`, {
    apiBaseUrl: args.apiBaseUrl,
    apiKey: args.apiKey,
    timeoutMs: args.timeoutMs
  });
  return isRecord(parsed) ? parsed : {};
}

function readPath(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

function fieldIsMissing(detail: PlaceDetail, field: MissingField) {
  const value = readPath(detail, field.path);
  if (field.path === "taxonomy") return !objectHasMeaningfulValue(recordField(value, "sourceBacked"));
  if (field.path === "playFeatures") return !objectHasMeaningfulValue(value);
  if (field.path === "openingHours") return !hasStructuredOpeningHoursData(value);
  return isMissingValue(value);
}

function hasStructuredOpeningHoursData(value: unknown) {
  if (!isRecord(value)) return false;
  if (typeof value.openNow === "boolean" || typeof value.isOpen === "boolean") return true;
  if ([value.status, value.openStatus, value.businessStatus].some((status) => typeof status === "string" && status.trim().length > 0)) return true;
  if (Array.isArray(value.periods) && value.periods.length > 0) return true;
  if (Array.isArray(value.openingHoursSpecification) && value.openingHoursSpecification.length > 0) return true;
  if (isRecord(value.weekly) && Object.keys(value.weekly).length > 0) return true;
  return false;
}

function isMissingValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0 || value.trim().toLowerCase() === "unknown";
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return objectIsEmpty(value);
  return false;
}

function objectHasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0 && value.trim().toLowerCase() !== "unknown";
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => {
    if (["schemaVersion", "migration"].includes(key)) return false;
    return objectHasMeaningfulValue(child);
  });
}

function objectIsEmpty(value: Record<string, unknown>): boolean {
  const entries = Object.values(value);
  if (entries.length === 0) return true;
  return entries.every((entry) => {
    if (entry === null || entry === undefined) return true;
    if (typeof entry === "string") return entry.trim().length === 0 || entry.trim().toLowerCase() === "unknown";
    if (Array.isArray(entry)) return entry.length === 0;
    if (isRecord(entry)) return objectIsEmpty(entry);
    return false;
  });
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

function booleanField(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const child = value[key];
  return typeof child === "boolean" ? child : null;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function isMain() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}
