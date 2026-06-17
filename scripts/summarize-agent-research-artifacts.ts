import { createReadStream } from "node:fs";
import { opendir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type SummaryArgs = {
  researchDir: string;
  json: boolean;
  maxReadBytes: number;
  maxSamples: number;
  maxFiles?: number;
};

type ArtifactKind = "handoff" | "api_result" | "source_capture" | "temporary_script" | "other";

type ArtifactSummary = {
  generatedAt: string;
  researchDir: string;
  totals: {
    fileCount: number;
    totalBytes: number;
    unreadableCount: number;
    truncatedReadCount: number;
  };
  byExtension: Record<string, number>;
  byKind: Record<ArtifactKind, number>;
  recentFiles: FileSample[];
  largeFiles: FileSample[];
  extracted: {
    productionIds: string[];
    unresolvedCandidateLines: TextSample[];
    blockers: TextSample[];
    sourceUrls: string[];
    imageCandidates: string[];
    coordinateProvenance: TextSample[];
  };
};

type FileSample = {
  path: string;
  bytes: number;
  modifiedAt: string;
  kind: ArtifactKind;
};

type TextSample = {
  path: string;
  line: number;
  text: string;
};

const textExtensions = new Set([".csv", ".htm", ".html", ".js", ".json", ".jsonl", ".log", ".md", ".mjs", ".txt", ".ts", ".yml", ".yaml"]);
const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const urlPattern = /https?:\/\/[^\s"'<>\\]+/gi;
const imageUrlPattern = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#][^\s"'<>\\)]*)?$/i;
const unresolvedLinePattern = /(Suggested action|suggestedAction|action)\s*[:=]\s*["']?(create|update|hold_for_later|manual_duplicate_review|create_candidate|update_existing)|\b(create_candidate|hold_for_later|manual_duplicate_review|needs_update)\b/i;
const blockerLinePattern = /\b(blocker|blocked|error|failed|failure|invalid|validation|unreachable|timeout|401|403|404|500|fetch failed)\b|실패|오류|차단|검증/i;
const coordinateLinePattern = /coordinateProvenance|official_embedded_map|public_dataset_exact_address|public_address_coordinate|parent_building_coordinate|\b(lat|lng|latitude|longitude)\b/i;

if (isMain()) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const summary = await summarizeAgentResearchArtifacts(args);
    console.log(args.json ? JSON.stringify(summary, null, 2) : formatAgentResearchArtifactSummary(summary));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): SummaryArgs {
  const args: SummaryArgs = {
    researchDir: "agent-research",
    json: false,
    maxReadBytes: 200_000,
    maxSamples: 30
  };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg.startsWith("--research-dir=")) {
      args.researchDir = requiredValue(arg, "research-dir");
      continue;
    }
    if (arg.startsWith("--max-read-bytes=")) {
      args.maxReadBytes = positiveInteger(requiredValue(arg, "max-read-bytes"), "max-read-bytes", 5_000_000);
      continue;
    }
    if (arg.startsWith("--max-samples=")) {
      args.maxSamples = positiveInteger(requiredValue(arg, "max-samples"), "max-samples", 200);
      continue;
    }
    if (arg.startsWith("--max-files=")) {
      args.maxFiles = positiveInteger(requiredValue(arg, "max-files"), "max-files", 100_000);
      continue;
    }
  }

  return args;
}

export async function summarizeAgentResearchArtifacts(args: SummaryArgs): Promise<ArtifactSummary> {
  const researchDir = path.resolve(args.researchDir);
  const rootStat = await stat(researchDir).catch(() => undefined);
  if (!rootStat?.isDirectory()) {
    throw new Error(`Research directory not found: ${researchDir}`);
  }

  const summary: ArtifactSummary = {
    generatedAt: new Date().toISOString(),
    researchDir,
    totals: {
      fileCount: 0,
      totalBytes: 0,
      unreadableCount: 0,
      truncatedReadCount: 0
    },
    byExtension: {},
    byKind: {
      handoff: 0,
      api_result: 0,
      source_capture: 0,
      temporary_script: 0,
      other: 0
    },
    recentFiles: [],
    largeFiles: [],
    extracted: {
      productionIds: [],
      unresolvedCandidateLines: [],
      blockers: [],
      sourceUrls: [],
      imageCandidates: [],
      coordinateProvenance: []
    }
  };

  const ids = new Set<string>();
  const sourceUrls = new Set<string>();
  const imageCandidates = new Set<string>();

  for await (const filePath of walkFiles(researchDir, args.maxFiles)) {
    const metadata = await stat(filePath).catch(() => undefined);
    if (!metadata?.isFile()) continue;

    const sample = buildFileSample(researchDir, filePath, metadata.size, metadata.mtime);
    const extension = path.extname(filePath).toLowerCase() || "(none)";
    summary.totals.fileCount += 1;
    summary.totals.totalBytes += metadata.size;
    summary.byExtension[extension] = (summary.byExtension[extension] ?? 0) + 1;
    summary.byKind[sample.kind] += 1;
    pushTop(summary.recentFiles, sample, args.maxSamples, (left, right) => Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt));
    pushTop(summary.largeFiles, sample, args.maxSamples, (left, right) => right.bytes - left.bytes);

    if (!textExtensions.has(extension)) continue;

    let text: string;
    try {
      text = await readTextPrefix(filePath, args.maxReadBytes);
    } catch {
      summary.totals.unreadableCount += 1;
      continue;
    }
    if (metadata.size > args.maxReadBytes) summary.totals.truncatedReadCount += 1;

    collectMatches(text, uuidPattern, (value) => ids.add(value.toLowerCase()));
    collectUrls(text, sourceUrls, imageCandidates);
    collectLineSamples(text, sample.path, unresolvedLinePattern, summary.extracted.unresolvedCandidateLines, args.maxSamples);
    collectLineSamples(text, sample.path, blockerLinePattern, summary.extracted.blockers, args.maxSamples);
    collectLineSamples(text, sample.path, coordinateLinePattern, summary.extracted.coordinateProvenance, args.maxSamples);
  }

  summary.extracted.productionIds = Array.from(ids).sort().slice(0, args.maxSamples * 4);
  summary.extracted.sourceUrls = Array.from(sourceUrls).sort().slice(0, args.maxSamples * 4);
  summary.extracted.imageCandidates = Array.from(imageCandidates).sort().slice(0, args.maxSamples * 4);

  return summary;
}

export function formatAgentResearchArtifactSummary(summary: ArtifactSummary): string {
  const lines = [
    "# Agent Research Artifact Summary",
    "",
    `- Generated at: ${summary.generatedAt}`,
    `- Research dir: ${summary.researchDir}`,
    `- Files: ${summary.totals.fileCount}`,
    `- Total size: ${formatBytes(summary.totals.totalBytes)}`,
    `- Unreadable text files: ${summary.totals.unreadableCount}`,
    `- Truncated text reads: ${summary.totals.truncatedReadCount}`,
    "",
    "## File Types",
    "",
    ...Object.entries(summary.byExtension)
      .sort((left, right) => right[1] - left[1])
      .map(([extension, count]) => `- ${extension}: ${count}`),
    "",
    "## Artifact Kinds",
    "",
    ...Object.entries(summary.byKind).map(([kind, count]) => `- ${kind}: ${count}`),
    "",
    "## Extracted Signals",
    "",
    `- Production ids: ${summary.extracted.productionIds.length}`,
    `- Source URLs: ${summary.extracted.sourceUrls.length}`,
    `- Image candidates: ${summary.extracted.imageCandidates.length}`,
    `- Unresolved candidate lines: ${summary.extracted.unresolvedCandidateLines.length}`,
    `- Blocker lines: ${summary.extracted.blockers.length}`,
    `- Coordinate provenance lines: ${summary.extracted.coordinateProvenance.length}`,
    "",
    formatList("Production Ids", summary.extracted.productionIds),
    formatList("Source URLs", summary.extracted.sourceUrls),
    formatList("Image Candidates", summary.extracted.imageCandidates),
    formatSamples("Unresolved Candidate Lines", summary.extracted.unresolvedCandidateLines),
    formatSamples("Blockers", summary.extracted.blockers),
    formatSamples("Coordinate Provenance", summary.extracted.coordinateProvenance),
    formatFiles("Recent Files", summary.recentFiles),
    formatFiles("Large Files", summary.largeFiles),
    ""
  ];

  return lines.join("\n");
}

function buildFileSample(root: string, filePath: string, bytes: number, mtime: Date): FileSample {
  const relativePath = path.relative(root, filePath);
  return {
    path: relativePath,
    bytes,
    modifiedAt: mtime.toISOString(),
    kind: classifyArtifact(relativePath)
  };
}

function classifyArtifact(relativePath: string): ArtifactKind {
  const lower = relativePath.toLowerCase();
  const basename = path.basename(lower);
  if (lower.endsWith(".md")) return "handoff";
  if (/\.(html?|mhtml)$/.test(lower) || lower.includes("source") || lower.includes("capture")) return "source_capture";
  if (/\.(ts|js|mjs)$/.test(lower) || basename.includes("tmp") || basename.includes("patch-script")) return "temporary_script";
  if (/\.(json|jsonl|log|txt)$/.test(lower) && /(detail|duplicate|health|patch|search|verify|version|result|response|payload)/i.test(lower)) {
    return "api_result";
  }
  return "other";
}

async function* walkFiles(root: string, maxFiles?: number): AsyncGenerator<string> {
  let yielded = 0;

  async function* walk(current: string): AsyncGenerator<string> {
    const dir = await opendir(current);
    for await (const entry of dir) {
      if (entry.name === ".DS_Store") continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        yield* walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (maxFiles !== undefined && yielded >= maxFiles) return;
      yielded += 1;
      yield fullPath;
    }
  }

  yield* walk(root);
}

async function readTextPrefix(filePath: string, maxBytes: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const stream = createReadStream(filePath, { start: 0, end: Math.max(0, maxBytes - 1) });
    stream.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buffer);
      total += buffer.length;
      if (total >= maxBytes) stream.destroy();
    });
    stream.on("error", reject);
    stream.on("close", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function collectMatches(text: string, pattern: RegExp, onMatch: (value: string) => void) {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match[0]) onMatch(match[0]);
  }
}

function collectUrls(text: string, sourceUrls: Set<string>, imageCandidates: Set<string>) {
  collectMatches(text, urlPattern, (value) => {
    const url = cleanUrl(value);
    if (!url) return;
    if (imageUrlPattern.test(url)) {
      imageCandidates.add(url);
    } else {
      sourceUrls.add(url);
    }
  });
}

function collectLineSamples(text: string, filePath: string, pattern: RegExp, target: TextSample[], maxSamples: number) {
  if (target.length >= maxSamples) return;
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length && target.length < maxSamples; index += 1) {
    const line = lines[index]?.trim();
    if (!line || !pattern.test(line)) continue;
    target.push({ path: filePath, line: index + 1, text: truncate(line, 220) });
  }
}

function pushTop<T>(target: T[], value: T, maxItems: number, compare: (left: T, right: T) => number) {
  target.push(value);
  target.sort(compare);
  if (target.length > maxItems) target.length = maxItems;
}

function formatList(title: string, values: string[]) {
  if (values.length === 0) return `## ${title}\n\n- None found\n`;
  return `## ${title}\n\n${values.map((value) => `- ${value}`).join("\n")}\n`;
}

function formatSamples(title: string, samples: TextSample[]) {
  if (samples.length === 0) return `## ${title}\n\n- None found\n`;
  return `## ${title}\n\n${samples.map((sample) => `- ${sample.path}:${sample.line} - ${sample.text}`).join("\n")}\n`;
}

function formatFiles(title: string, files: FileSample[]) {
  if (files.length === 0) return `## ${title}\n\n- None found\n`;
  return `## ${title}\n\n${files
    .map((file) => `- ${file.path} (${formatBytes(file.bytes)}, ${file.kind}, ${file.modifiedAt})`)
    .join("\n")}\n`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(1)} MiB`;
  return `${(mib / 1024).toFixed(1)} GiB`;
}

function cleanUrl(value: string) {
  return value.replace(/[`),.;\]}]+$/g, "");
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function requiredValue(arg: string, key: string) {
  const prefix = `--${key}=`;
  const value = arg.slice(prefix.length).trim();
  if (!value) throw new Error(`Missing value for --${key}=...`);
  return value;
}

function positiveInteger(value: string, label: string, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new Error(`--${label} must be an integer between 1 and ${max}`);
  }
  return parsed;
}

function isMain() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}
