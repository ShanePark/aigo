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
const closedSignalPattern = /(?:종료|폐점|영업\s*종료|장기\s*휴관|임시\s*휴장|휴업|폐관|closed|permanently\s*closed|temporarily\s*closed)/i;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isMain() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}
