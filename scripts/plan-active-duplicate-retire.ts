import { pathToFileURL } from "node:url";

import { checkAigoReadOnlyApiReadiness, readAigoJsonReadOnly, type AigoSearchOptions } from "./lib/aigo-search";

type ActiveDuplicateRetireArgs = {
  apiBaseUrl?: string;
  apiKey?: string;
  pairs: RetirePairInput[];
  json: boolean;
  skipHealthcheck: boolean;
  timeoutMs: number;
};

type RetirePairInput = {
  keepId: string;
  retireId: string;
};

type ActiveDuplicateRetireReport = {
  generatedAt: string;
  pairs: RetirePairPlan[];
};

type RetirePairPlan = {
  keepId: string;
  retireId: string;
  status: "ready_for_review" | "blocked";
  keep: PlaceMergeSummary | null;
  retire: PlaceMergeSummary | null;
  transferPlan: TransferPlan;
  warnings: string[];
};

type PlaceMergeSummary = {
  id: string;
  name: string;
  status: string | null;
  address: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  externalRefs: Record<string, unknown>;
  aliases: string[];
  sources: SourceSummary[];
  images: ImageSummary[];
  latestVersion: VersionSummary | null;
};

type SourceSummary = {
  sourceType: string | null;
  title: string | null;
  url: string | null;
  externalId: string | null;
  summary: string | null;
  checkedAt: string | null;
};

type ImageSummary = {
  url: string;
  sourceUrl: string | null;
  sourceType: string | null;
  sourceTitle: string | null;
  altText: string | null;
  description: string | null;
  displayTier: string | null;
  reviewStatus: string | null;
  checkedAt: string | null;
};

type VersionSummary = {
  versionNumber: number | null;
  action: string | null;
  changeSummary: string | null;
  createdAt: string | null;
};

type TransferPlan = {
  aliasesToAppend: string[];
  sourceUrlsToReview: string[];
  sourcesToAppend: SourceSummary[];
  imageUrlsToAppend: string[];
  imagesToAppend: ImageSummary[];
  canonicalPatchDraft: CanonicalTransferPatchDraft | null;
  suggestedChangeSummary: string;
};

type CanonicalTransferPatchDraft = {
  route: string;
  payload: Record<string, unknown>;
};

const PRODUCTION_AIGO_API_BASE_URL = "https://aigo.o-r.kr";

if (isMain()) {
  void main();
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = await planActiveDuplicateRetire(args);
    console.log(args.json ? JSON.stringify(report, null, 2) : formatActiveDuplicateRetireReport(report));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): ActiveDuplicateRetireArgs {
  const args: ActiveDuplicateRetireArgs = {
    apiBaseUrl: PRODUCTION_AIGO_API_BASE_URL,
    json: false,
    pairs: [],
    skipHealthcheck: false,
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
    if (arg.startsWith("--pair=")) {
      args.pairs.push(parseRetirePair(arg.slice("--pair=".length)));
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
    if (arg.startsWith("--timeout-ms=")) {
      args.timeoutMs = positiveInteger(arg.slice("--timeout-ms=".length), "timeout-ms");
      continue;
    }
  }

  if (args.pairs.length === 0) {
    throw new Error("Usage: pnpm tsx scripts/plan-active-duplicate-retire.ts --pair=<keepId>:<retireId> [--pair=...] [--json]");
  }

  return args;
}

export function parseRetirePair(value: string): RetirePairInput {
  const [keepId, retireId] = value.split(":").map((part) => part.trim());
  if (!keepId || !retireId) throw new Error("--pair must be formatted as <keepId>:<retireId>");
  if (keepId === retireId) throw new Error("--pair keepId and retireId must differ");
  return { keepId, retireId };
}

export async function planActiveDuplicateRetire(args: ActiveDuplicateRetireArgs): Promise<ActiveDuplicateRetireReport> {
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

  const pairs = await Promise.all(args.pairs.map((pair) => planRetirePair(pair, options)));
  return {
    generatedAt: new Date().toISOString(),
    pairs
  };
}

export async function planRetirePair(pair: RetirePairInput, options: AigoSearchOptions): Promise<RetirePairPlan> {
  const [keepDetail, retireDetail] = await Promise.all([
    readPlaceDetail(pair.keepId, options),
    readPlaceDetail(pair.retireId, options)
  ]);
  return buildRetirePairPlan(pair, keepDetail, retireDetail);
}

export function buildRetirePairPlan(pair: RetirePairInput, keepDetail: Record<string, unknown> | null, retireDetail: Record<string, unknown> | null): RetirePairPlan {
  const keep = keepDetail ? placeMergeSummary(keepDetail) : null;
  const retire = retireDetail ? placeMergeSummary(retireDetail) : null;
  const warnings = retirePlanWarnings(keep, retire);
  const transferPlan = buildTransferPlan(keep, retire);
  return {
    keepId: pair.keepId,
    retireId: pair.retireId,
    status: warnings.some((warning) => warning.startsWith("blocked_")) ? "blocked" : "ready_for_review",
    keep,
    retire,
    transferPlan,
    warnings
  };
}

export function buildTransferPlan(keep: PlaceMergeSummary | null, retire: PlaceMergeSummary | null): TransferPlan {
  const keepAliases = new Set((keep?.aliases ?? []).map(normalizeAlias));
  const aliasesToAppend = (retire?.aliases ?? []).filter((alias) => !keepAliases.has(normalizeAlias(alias)));
  const keepSourceUrls = new Set((keep?.sources ?? []).map((source) => source.url).filter(Boolean));
  const sourcesToAppend = (retire?.sources ?? []).filter((source) => source.url && !keepSourceUrls.has(source.url));
  const sourceUrlsToReview = sourcesToAppend.map((source) => source.url).filter((url): url is string => Boolean(url));
  const keepImageUrls = new Set((keep?.images ?? []).map((image) => image.url));
  const imagesToAppend = (retire?.images ?? []).filter((image) => !keepImageUrls.has(image.url));
  const imageUrlsToAppend = imagesToAppend.map((image) => image.url);
  const suggestedChangeSummary = retire
    ? `중복 은퇴 전 canonical 레코드에 ${retire.name}의 별칭, 출처, 이미지 후보를 검토해 이전한다.`
    : "중복 은퇴 전 canonical 레코드 이전 계획을 세웠지만 retire 후보 상세를 확인하지 못했다.";
  return {
    aliasesToAppend,
    sourceUrlsToReview,
    sourcesToAppend,
    imageUrlsToAppend,
    imagesToAppend,
    canonicalPatchDraft: buildCanonicalTransferPatchDraft(keep, aliasesToAppend, sourcesToAppend, imagesToAppend, suggestedChangeSummary),
    suggestedChangeSummary
  };
}

export function buildCanonicalTransferPatchDraft(
  keep: PlaceMergeSummary | null,
  aliasesToAppend: string[],
  sourcesToAppend: SourceSummary[],
  imagesToAppend: ImageSummary[],
  changeSummary: string
): CanonicalTransferPatchDraft | null {
  if (!keep) return null;
  const payload: Record<string, unknown> = {
    actor: "agent",
    changeSummary,
    sourceMode: "append",
    imageMode: "append"
  };

  if (aliasesToAppend.length > 0) {
    payload.externalRefs = {
      ...keep.externalRefs,
      aliases: unique([...stringArrayField(keep.externalRefs, "aliases"), ...aliasesToAppend])
    };
  }

  const sourceInputs = sourcesToAppend.map(sourceInputFromSummary).filter((source): source is Record<string, unknown> => source !== null);
  if (sourceInputs.length > 0) {
    payload.sources = sourceInputs;
  }

  const imageInputs = imagesToAppend.map(imageInputFromSummary);
  if (imageInputs.length > 0) {
    payload.images = imageInputs;
  }

  if (!payload.externalRefs && !payload.sources && !payload.images) return null;
  return {
    route: `PATCH /v1/places/${keep.id}`,
    payload
  };
}

function retirePlanWarnings(keep: PlaceMergeSummary | null, retire: PlaceMergeSummary | null) {
  const warnings: string[] = [];
  if (!keep) warnings.push("blocked_keep_detail_missing");
  if (!retire) warnings.push("blocked_retire_detail_missing");
  if (keep && keep.status !== "active") warnings.push("blocked_keep_not_active");
  if (retire && retire.status !== "active") warnings.push("blocked_retire_not_active");
  if (keep && retire && normalizeAlias(keep.name) !== normalizeAlias(retire.name)) warnings.push("name_mismatch_review_required");
  if (keep && retire && keep.address && retire.address && normalizeAlias(keep.address) !== normalizeAlias(retire.address)) warnings.push("address_mismatch_review_required");
  return warnings;
}

function placeMergeSummary(detail: Record<string, unknown>): PlaceMergeSummary {
  return {
    id: stringField(detail, "id") ?? "unknown",
    name: stringField(detail, "name") ?? "unknown",
    status: stringField(detail, "status"),
    address: stringField(detail, "address"),
    roadAddress: stringField(detail, "roadAddress"),
    lat: numberField(detail, "lat"),
    lng: numberField(detail, "lng"),
    externalRefs: recordField(detail, "externalRefs"),
    aliases: aliasesFromDetail(detail),
    sources: sourcesFromDetail(detail),
    images: imagesFromDetail(detail),
    latestVersion: latestVersionFromDetail(detail)
  };
}

function aliasesFromDetail(detail: Record<string, unknown>) {
  const externalRefs = recordField(detail, "externalRefs");
  return unique([
    ...stringArrayField(externalRefs, "aliases"),
    ...stringArrayField(externalRefs, "koreanSearchAliases"),
    ...stringArrayField(detail, "tags")
  ]);
}

function sourcesFromDetail(detail: Record<string, unknown>) {
  return arrayField(detail, "sources").map((source) => {
    const record = recordField(source);
    return {
      sourceType: stringField(record, "sourceType"),
      title: stringField(record, "title"),
      url: stringField(record, "url"),
      externalId: stringField(record, "externalId"),
      summary: stringField(record, "summary"),
      checkedAt: stringField(record, "checkedAt")
    };
  });
}

function imagesFromDetail(detail: Record<string, unknown>) {
  return arrayField(detail, "images")
    .map((image) => {
      const record = recordField(image);
      const url = stringField(record, "url");
      if (!url) return null;
      return {
        url,
        sourceUrl: stringField(record, "sourceUrl"),
        sourceType: stringField(record, "sourceType"),
        sourceTitle: stringField(record, "sourceTitle"),
        altText: stringField(record, "altText"),
        description: stringField(record, "description"),
        displayTier: stringField(record, "displayTier"),
        reviewStatus: stringField(record, "reviewStatus"),
        checkedAt: stringField(record, "checkedAt")
      };
    })
    .filter((image): image is ImageSummary => image !== null);
}

function sourceInputFromSummary(source: SourceSummary) {
  if (!source.url && !source.externalId) return null;
  return dropNullish({
    sourceType: source.sourceType ?? "agent_observation",
    title: source.title,
    url: source.url,
    externalId: source.externalId,
    summary: source.summary,
    checkedAt: source.checkedAt
  });
}

function imageInputFromSummary(image: ImageSummary) {
  return dropNullish({
    url: image.url,
    sourceUrl: image.sourceUrl,
    sourceType: image.sourceType ?? undefined,
    sourceTitle: image.sourceTitle,
    altText: image.altText,
    description: image.description,
    displayTier: image.displayTier ?? undefined,
    reviewStatus: image.reviewStatus ?? undefined,
    checkedAt: image.checkedAt
  });
}

function latestVersionFromDetail(detail: Record<string, unknown>): VersionSummary | null {
  const version = arrayField(detail, "versions")[0];
  if (!version) return null;
  const record = recordField(version);
  return {
    versionNumber: numberField(record, "versionNumber"),
    action: stringField(record, "action"),
    changeSummary: stringField(record, "changeSummary"),
    createdAt: stringField(record, "createdAt")
  };
}

async function readPlaceDetail(placeId: string, options: AigoSearchOptions) {
  try {
    return await readAigoJsonReadOnly<Record<string, unknown>>(`/v1/places/${placeId}`, options);
  } catch {
    return null;
  }
}

function formatActiveDuplicateRetireReport(report: ActiveDuplicateRetireReport) {
  const lines = [`Active duplicate retire plan generated ${report.generatedAt}`, ""];
  for (const pair of report.pairs) {
    lines.push(`${pair.keepId} <- ${pair.retireId}: ${pair.status}`);
    lines.push(`  keep: ${pair.keep?.name ?? "missing"} (${pair.keep?.status ?? "unknown"})`);
    lines.push(`  retire: ${pair.retire?.name ?? "missing"} (${pair.retire?.status ?? "unknown"})`);
    if (pair.transferPlan.aliasesToAppend.length > 0) lines.push(`  aliases: ${pair.transferPlan.aliasesToAppend.join(", ")}`);
    if (pair.transferPlan.sourceUrlsToReview.length > 0) lines.push(`  sources: ${pair.transferPlan.sourceUrlsToReview.join(", ")}`);
    lines.push(`  images to append: ${pair.transferPlan.imageUrlsToAppend.length}`);
    if (pair.transferPlan.canonicalPatchDraft) lines.push(`  patch draft: ${pair.transferPlan.canonicalPatchDraft.route}`);
    if (pair.warnings.length > 0) lines.push(`  warnings: ${pair.warnings.join(", ")}`);
  }
  return lines.join("\n");
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
  return Array.isArray(target) ? target.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function arrayField(value: unknown, key: string) {
  const target = isRecord(value) ? value[key] : undefined;
  return Array.isArray(target) ? target : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAlias(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function dropNullish(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null && value !== undefined));
}

function positiveInteger(rawValue: string, key: string) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`--${key} must be a positive integer`);
  return value;
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isMain() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
