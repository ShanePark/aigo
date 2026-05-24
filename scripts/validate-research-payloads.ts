import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { createPlaceSchema, type CreatePlaceInput } from "@/lib/schemas";

type LintSeverity = "error" | "warning";

export type ResearchPayloadLintIssue = {
  severity: LintSeverity;
  code: string;
  path: string;
  message: string;
};

export type ResearchPayloadLintResult = {
  source: string;
  index: number;
  name: string | null;
  ok: boolean;
  issues: ResearchPayloadLintIssue[];
};

type PayloadEntry = {
  source: string;
  index: number;
  payload: unknown;
};

const registrationDataConfidence = new Set(["agent_collected", "official_verified", "user_reported"]);
const acceptedCoordinateLevels = new Set(["official_embedded_map", "public_dataset_exact_address", "public_address_coordinate", "parent_building_coordinate"]);
const operationalSourceTypes = new Set(["official_site", "operator_page", "public_agency", "public_tourism"]);
const parentReviewSourceTypes = new Set(["public_listing", "public_news", "public_blog", "user_observation", "agent_observation"]);
const privateKidsCafeCategories = new Set(["kids_cafe", "indoor_playground", "family_cafe"]);
const privateKidsCafeIdentitySourceTypes = new Set(["official_site", "operator_page", "public_agency", "public_listing"]);
const privateKidsCafeOperatorSourceTypes = new Set(["official_site", "operator_page"]);
const parentReviewRecommendedCategories = new Set([
  "kids_cafe",
  "indoor_playground",
  "toy_store",
  "toy_library",
  "library",
  "museum",
  "science_museum",
  "experience_center",
  "aquarium_zoo",
  "park",
  "family_cafe",
  "family_restaurant",
  "sports_venue",
  "shopping_mall"
]);
const richPublicDestinationCategories = new Set([
  "park",
  "library",
  "museum",
  "science_museum",
  "experience_center",
  "aquarium_zoo",
  "sports_venue",
  "shopping_mall",
  "accommodation"
]);
const subfacilitySweepTerms = [
  "놀이터",
  "실내놀이터",
  "키즈카페",
  "어린이",
  "어린이자료실",
  "체험",
  "프로그램",
  "예약",
  "도서관",
  "장난감",
  "수유실",
  "유모차",
  "기저귀",
  "유아화장실",
  "주차",
  "입장료",
  "무료",
  "시설안내",
  "전망대",
  "playground",
  "kids",
  "child",
  "experience",
  "program",
  "reservation",
  "stroller",
  "nursing",
  "diaper",
  "parking",
  "fee",
  "free",
  "facility guide"
];
const closedSignalPattern = /(?:종료|폐점|영업\s*종료|장기\s*휴관|임시\s*휴장|휴업|폐관|closed|permanently\s*closed|temporarily\s*closed)/i;
const personalizedPublicTextPattern =
  /(?:첫째|둘째|셋째|큰아이|20\d{2}년생|우리\s*(?:아이|애|가족)|사용자(?:의)?|쌍둥이\s*(?:영아|아기|동반)|쌍둥이(?:를|와|랑))/i;
const urlPattern = /^https?:\/\//i;

if (isMain()) {
  void main();
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const entries = await loadResearchPayloadEntries(args.paths);
    const results = entries.map((entry) => validateResearchPayload(entry.payload, { source: entry.source, index: entry.index }));

    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(formatResearchPayloadLintResults(results));
    }

    if (results.length === 0 || results.some((result) => !result.ok)) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]) {
  const args = { json: false, paths: [] as string[] };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    args.paths.push(arg);
  }

  if (args.paths.length === 0) {
    throw new Error("Usage: pnpm tsx scripts/validate-research-payloads.ts [--json] <payload.json|research.md> [...]");
  }

  return args;
}

export async function loadResearchPayloadEntries(paths: string[]): Promise<PayloadEntry[]> {
  const entries: PayloadEntry[] = [];

  for (const filePath of paths) {
    const text = await readFile(filePath, "utf8");
    const payloads = extractResearchPayloads(text, filePath);
    entries.push(...payloads.map((payload, index) => ({ source: filePath, index, payload })));
  }

  return entries;
}

export function extractResearchPayloads(text: string, source: string): unknown[] {
  if (/\.md(?:$|[?#])/i.test(source)) {
    const jsonBlocks = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
    return jsonBlocks.flatMap((match, index) => parsePayloadDocument(match[1] ?? "", `${source}#json-block-${index + 1}`));
  }

  return parsePayloadDocument(text, source);
}

export function validateResearchPayload(payload: unknown, context: { source?: string; index?: number } = {}): ResearchPayloadLintResult {
  const issues: ResearchPayloadLintIssue[] = [];
  const parsed = createPlaceSchema.safeParse(payload);
  const name = payloadName(payload);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        severity: "error",
        code: "api_schema",
        path: issue.path.length > 0 ? issue.path.join(".") : "$",
        message: issue.message
      });
    }

    return lintResult(context, name, issues);
  }

  collectWorkflowIssues(parsed.data, issues);
  return lintResult(context, parsed.data.name, issues);
}

export function formatResearchPayloadLintResults(results: ResearchPayloadLintResult[]) {
  if (results.length === 0) {
    return "No research payloads found.";
  }

  const lines: string[] = [];
  for (const result of results) {
    const label = `${result.source}#${result.index + 1}${result.name ? ` ${result.name}` : ""}`;
    lines.push(`${result.ok ? "[ok]" : "[fail]"} ${label}`);
    for (const issue of result.issues) {
      lines.push(`  [${issue.severity}] ${issue.path} ${issue.code}: ${issue.message}`);
    }
  }

  return lines.join("\n");
}

function collectWorkflowIssues(payload: CreatePlaceInput, issues: ResearchPayloadLintIssue[]) {
  if (payload.status !== "active") {
    issues.push(error("status", "workflow_status", 'research create payloads must explicitly use status "active"'));
  }

  if (!payload.dataConfidence || !registrationDataConfidence.has(payload.dataConfidence)) {
    issues.push(
      error(
        "dataConfidence",
        "workflow_data_confidence",
        'research create payloads must use dataConfidence "agent_collected", "official_verified", or "user_reported"'
      )
    );
  }

  if (!payload.images || payload.images.length === 0) {
    issues.push(error("images", "workflow_images_required", "research create payloads must include at least one structured images item"));
  } else {
    payload.images.forEach((image, index) => {
      const path = `images.${index}`;
      if (image.reviewStatus !== "approved") {
        issues.push(error(`${path}.reviewStatus`, "workflow_image_review_status", 'image reviewStatus must be "approved" before registration'));
      }
      if (!image.sourceUrl) {
        issues.push(error(`${path}.sourceUrl`, "workflow_image_source_url", "structured images must include the citeable page URL for the image"));
      }
      if (!image.sourceType) {
        issues.push(error(`${path}.sourceType`, "workflow_image_source_type", "structured images must include image sourceType provenance"));
      }
      if (!image.displayTier) {
        issues.push(error(`${path}.displayTier`, "workflow_image_display_tier", "structured images must include displayTier provenance"));
      }
      if (!image.altText && !image.description) {
        issues.push(warning(`${path}.altText`, "workflow_image_description", "image should include useful altText or description for review"));
      }
    });
  }

  if (payload.taxonomy) {
    if (payload.taxonomy.schemaVersion !== 1) {
      issues.push(error("taxonomy.schemaVersion", "workflow_taxonomy_version", "taxonomy must use schemaVersion 1"));
    }
    if (!payload.taxonomy.migration) {
      issues.push(error("taxonomy.migration", "workflow_taxonomy_migration", "taxonomy must preserve migration context"));
    }
  }

  collectCoordinateProvenanceIssues(payload, issues);
  collectOperationalStatusSignalIssues(payload, issues);
  collectPersonalizedPublicTextIssues(payload, issues);
  collectParentReviewEvidenceIssues(payload, issues);
  collectPrivateKidsCafeSourceRoleIssues(payload, issues);
  collectRichPublicDestinationSweepIssues(payload, issues);
}

function collectOperationalStatusSignalIssues(payload: CreatePlaceInput, issues: ResearchPayloadLintIssue[]) {
  payload.sources.forEach((source, index) => {
    if (!operationalSourceTypes.has(source.sourceType)) return;

    const text = [source.title, source.summary].filter(Boolean).join(" ");
    if (!closedSignalPattern.test(text)) return;

    issues.push(
      warning(
        `sources.${index}.summary`,
        "workflow_closed_source_signal",
        "official/operator source text appears to mention closure, end of operation, or suspension; hold the active registration until current operation is confirmed"
      )
    );
  });
}

function collectPersonalizedPublicTextIssues(payload: CreatePlaceInput, issues: ResearchPayloadLintIssue[]) {
  const fields: Array<[string, unknown]> = [
    ["description", payload.description],
    ["parentNotes", payload.parentNotes],
    ["safetyNotes", payload.safetyNotes],
    ["placeScoreRationale", payload.placeScoreRationale],
    ["playFeatures.notes", recordValue(payload.playFeatures, "notes")]
  ];

  for (const [path, value] of fields) {
    if (typeof value !== "string" || !personalizedPublicTextPattern.test(value)) continue;
    issues.push(
      error(
        path,
        "workflow_public_text_personalization",
        "public place text must describe the place for all users; keep specific household context in research notes, not description, parentNotes, safetyNotes, or scoring rationale"
      )
    );
  }
}

function collectParentReviewEvidenceIssues(payload: CreatePlaceInput, issues: ResearchPayloadLintIssue[]) {
  if (!parentReviewRecommendedCategories.has(payload.primaryCategory)) return;
  const evidenceStatus = parentReviewEvidenceStatus(payload);
  if (evidenceStatus === "present") return;

  if (evidenceStatus === "incomplete") {
    issues.push(
      warning(
        "externalRefs.parentReviewEvidence",
        "workflow_parent_review_evidence_detail",
        "parent-facing review evidence must preserve at least one review/listing/blog URL, or record parentReviewEvidence status not_found with attempted parent-intent queries"
      )
    );
    return;
  }

  issues.push(
    warning(
      "externalRefs.parentReviewEvidence",
      "workflow_parent_review_evidence",
      "local family create payloads should include a parent-facing review/listing/blog source or externalRefs.parentReviewEvidence; use \"not_found\" only after recording attempted parent-intent queries in the research note"
    )
  );
}

function parentReviewEvidenceStatus(payload: CreatePlaceInput): "present" | "incomplete" | "missing" {
  const hasParentReviewSource = payload.sources.some((source) => parentReviewSourceTypes.has(source.sourceType));
  if (payload.sources.some((source) => parentReviewSourceTypes.has(source.sourceType) && stringLooksLikeUrl(source.url))) {
    return "present";
  }

  const externalRefs = isRecord(payload.externalRefs) ? payload.externalRefs : null;
  const evidenceValues = [externalRefs?.parentReviewEvidence, externalRefs?.reviewLinks];
  if (evidenceValues.some(hasParentReviewUrlEvidence) || hasNotFoundParentReviewEvidence(externalRefs?.parentReviewEvidence)) {
    return "present";
  }

  if (hasParentReviewSource || evidenceValues.some(hasNonEmptyEvidenceValue)) {
    return "incomplete";
  }

  return "missing";
}

function hasParentReviewUrlEvidence(value: unknown): boolean {
  if (typeof value === "string") return stringLooksLikeUrl(value);
  if (Array.isArray(value)) return value.some(hasParentReviewUrlEvidence);
  if (!isRecord(value)) return false;

  const directUrl = stringValue(value, "url") ?? stringValue(value, "sourceUrl");
  if (stringLooksLikeUrl(directUrl)) return true;

  return Object.values(value).some(hasParentReviewUrlEvidence);
}

function hasNotFoundParentReviewEvidence(value: unknown): boolean {
  if (!isRecord(value)) return false;

  const status = stringValue(value, "status") ?? stringValue(value, "result");
  if (status?.toLowerCase() !== "not_found") return false;

  return hasNonEmptyStringList(value.attemptedQueries) || hasNonEmptyStringList(value.searchQueries) || hasNonEmptyStringList(value.queries);
}

function hasNonEmptyEvidenceValue(value: unknown): boolean {
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(hasNonEmptyEvidenceValue);
  if (!isRecord(value)) return false;
  return Object.values(value).some(hasNonEmptyEvidenceValue);
}

function hasNonEmptyStringList(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => typeof item === "string" && Boolean(item.trim()));
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap(collectStrings);
}

function collectPrivateKidsCafeSourceRoleIssues(payload: CreatePlaceInput, issues: ResearchPayloadLintIssue[]) {
  if (!privateKidsCafeCategories.has(payload.primaryCategory)) return;

  const hasIdentitySource = payload.sources.some((source) => privateKidsCafeIdentitySourceTypes.has(source.sourceType));
  if (!hasIdentitySource) {
    issues.push(
      warning(
        "sources",
        "workflow_private_kids_cafe_blog_only",
        "private kids cafe candidates should not be registered from blog-only or observation-only evidence; hold until a public listing, operator, official, or public-agency identity source confirms the exact branch"
      )
    );
    return;
  }

  const hasOperatorEvidence =
    Boolean(payload.officialUrl || payload.reservationUrl) || payload.sources.some((source) => privateKidsCafeOperatorSourceTypes.has(source.sourceType));
  const hasPublicListing = payload.sources.some((source) => source.sourceType === "public_listing");
  if (hasPublicListing && !hasOperatorEvidence) {
    issues.push(
      warning(
        "sources",
        "workflow_private_kids_cafe_operator_evidence",
        "private kids cafe public-listing identity is stronger when paired with operator or booking evidence such as operator_page, official_site, officialUrl, or reservationUrl"
      )
    );
  }
}

function collectRichPublicDestinationSweepIssues(payload: CreatePlaceInput, issues: ResearchPayloadLintIssue[]) {
  if (!richPublicDestinationCategories.has(payload.primaryCategory)) return;

  const sweep = recordValue(payload.externalRefs, "subfacilitySweep");
  if (!hasSubfacilitySweepChecklist(sweep)) {
    issues.push(
      warning(
        "externalRefs.subfacilitySweep",
        "workflow_subfacility_sweep_missing",
        "rich public destinations should record externalRefs.subfacilitySweep with exact-place child/logistics queries such as playground, kids cafe, child experience/program, stroller, nursing room, diaper, parking, fee, free, and facility-guide terms"
      )
    );
    return;
  }

  if (!hasSubfacilityStructuredEvidence(payload)) {
    issues.push(
      warning(
        "externalRefs.subfacilitySweep",
        "workflow_subfacility_sweep_unstructured",
        "subfacility sweep findings should be reflected in playFeatures, pricing, scoreSignals, parentNotes, or source summaries instead of staying only in raw research notes"
      )
    );
  }
}

function hasSubfacilitySweepChecklist(sweep: Record<string, unknown> | null) {
  if (!sweep) return false;

  const terms = matchingSubfacilityTerms(sweep);
  return terms.length >= 3 || (hasStructuredSubfacilitySweep(sweep) && terms.length >= 2) || hasNotFoundParentReviewEvidence(sweep);
}

function hasStructuredSubfacilitySweep(sweep: Record<string, unknown>) {
  const hasQueries =
    hasNonEmptyStringList(sweep.attemptedQueries) || hasNonEmptyStringList(sweep.searchQueries) || hasNonEmptyStringList(sweep.queries);
  const hasFindings = hasNonEmptyStringList(sweep.findings) || hasNonEmptyStringList(sweep.results);
  const hasSourceUrls = hasNonEmptyStringList(sweep.sourceUrls) || hasParentReviewUrlEvidence(sweep.sources);
  return hasQueries && (hasFindings || hasSourceUrls);
}

function hasSubfacilityStructuredEvidence(payload: CreatePlaceInput) {
  if (hasMeaningfulPlayFeatures(payload.playFeatures)) return true;
  if (hasMeaningfulPricing(payload.pricing)) return true;

  const scoreSignals = isRecord(payload.scoreSignals) ? payload.scoreSignals : null;
  if (hasNonEmptyEvidenceValue(scoreSignals?.facilityScale) || hasNonEmptyEvidenceValue(scoreSignals?.freeAdmission)) return true;

  const text = [
    payload.parentNotes,
    payload.placeScoreRationale,
    isRecord(payload.playFeatures) ? payload.playFeatures.notes : undefined,
    isRecord(payload.pricing) ? payload.pricing.summary : undefined,
    isRecord(payload.pricing) ? payload.pricing.notes : undefined,
    ...payload.sources.flatMap((source) => [source.title, source.summary])
  ].join(" ");
  return subfacilitySweepTerms.some((term) => text.includes(term));
}

function matchingSubfacilityTerms(value: unknown) {
  const text = collectStrings(value).join(" ");
  return subfacilitySweepTerms.filter((term) => text.includes(term));
}

function hasMeaningfulPlayFeatures(value: unknown) {
  if (!isRecord(value)) return false;

  return Object.entries(value).some(([key, item]) => {
    if (key === "schemaVersion") return false;
    if (key === "notes") return typeof item === "string" && subfacilitySweepTerms.some((term) => item.includes(term));
    if (key === "evidence") return Array.isArray(item) && item.length > 0;
    if (typeof item === "string") return item === "yes" || item === "partial";
    if (typeof item === "boolean") return item;
    return Array.isArray(item) ? item.length > 0 : isRecord(item) && Object.keys(item).length > 0;
  });
}

function hasMeaningfulPricing(value: unknown) {
  if (!isRecord(value)) return false;
  if (Array.isArray(value.items) && value.items.length > 0) return true;
  return ["summary", "basisDate", "checkedAt", "sourceUrl", "notes"].some((key) => hasNonEmptyEvidenceValue(value[key]));
}

function collectCoordinateProvenanceIssues(payload: CreatePlaceInput, issues: ResearchPayloadLintIssue[]) {
  const provenance = recordValue(payload.externalRefs, "coordinateProvenance");
  const level = stringValue(provenance, "level");

  if (!provenance) {
    issues.push(
      error(
        "externalRefs.coordinateProvenance",
        "workflow_coordinate_provenance",
        "coordinate provenance is required under externalRefs.coordinateProvenance before creating a place"
      )
    );
    return;
  }

  if (!level || !acceptedCoordinateLevels.has(level)) {
    issues.push(
      error(
        "externalRefs.coordinateProvenance.level",
        "workflow_coordinate_level",
        "coordinate provenance level must be official_embedded_map, public_dataset_exact_address, public_address_coordinate, or parent_building_coordinate"
      )
    );
  }

  if (!stringValue(provenance, "sourceUrl")) {
    issues.push(error("externalRefs.coordinateProvenance.sourceUrl", "workflow_coordinate_source", "coordinate provenance must include a sourceUrl"));
  }

  if (!stringValue(provenance, "basis")) {
    issues.push(warning("externalRefs.coordinateProvenance.basis", "workflow_coordinate_basis", "coordinate provenance should explain the address/name match basis"));
  }

  if (level === "parent_building_coordinate" && !stringValue(provenance, "addressMatched")) {
    issues.push(
      warning(
        "externalRefs.coordinateProvenance.addressMatched",
        "workflow_parent_coordinate_basis",
        "parent_building_coordinate should record the matched parent building or address"
      )
    );
  }
}

function parsePayloadDocument(text: string, source: string): unknown[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (isRecord(parsed) && Array.isArray(parsed.payloads)) return parsed.payloads;
    return [parsed];
  } catch (error) {
    throw new Error(`Failed to parse JSON payloads from ${source}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function lintResult(context: { source?: string; index?: number }, name: string | null, issues: ResearchPayloadLintIssue[]): ResearchPayloadLintResult {
  return {
    source: context.source ?? "<inline>",
    index: context.index ?? 0,
    name,
    ok: !issues.some((issue) => issue.severity === "error"),
    issues
  };
}

function error(path: string, code: string, message: string): ResearchPayloadLintIssue {
  return { severity: "error", code, path, message };
}

function warning(path: string, code: string, message: string): ResearchPayloadLintIssue {
  return { severity: "warning", code, path, message };
}

function payloadName(payload: unknown) {
  return isRecord(payload) && typeof payload.name === "string" ? payload.name : null;
}

function recordValue(value: unknown, key: string): Record<string, unknown> | null {
  const next = isRecord(value) ? value[key] : undefined;
  return isRecord(next) ? next : null;
}

function stringValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringLooksLikeUrl(value: unknown): boolean {
  return typeof value === "string" && urlPattern.test(value.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isMain() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}
