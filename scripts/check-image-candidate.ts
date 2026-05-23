import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

type ProbeArgs = {
  urls: string[];
  sourceUrl?: string;
  title?: string;
  json: boolean;
  timeoutMs: number;
};

type ProbeAttempt = {
  method: "HEAD" | "GET_RANGE" | "GET";
  status: number | null;
  ok: boolean;
  contentType: string | null;
  declaredContentType?: string | null;
  sniffedContentType?: string | null;
  contentLength: number | null;
  fullContentLength?: number | null;
  contentSha256?: string | null;
  finalUrl: string;
  usedReferer: boolean;
  error?: string;
};

type ImageCandidateReport = {
  url: string;
  sourceUrl: string | null;
  title: string | null;
  isRemoteHttpUrl: boolean;
  status: number | null;
  ok: boolean;
  contentType: string | null;
  contentLength: number | null;
  fullContentLength: number | null;
  contentSha256: string | null;
  finalUrl: string | null;
  refererNeeded: boolean;
  hotlinkRisk: "low" | "medium" | "high";
  visualRisk: "low" | "medium" | "high";
  labels: string[];
  recommendation: "use" | "review" | "hold";
  attempts: ProbeAttempt[];
};

const defaultTimeoutMs = 8_000;
const imageExtensions = /\.(avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;
const logoLikePattern = /(?:^|[._/-])(logo|favicon|icon|brand|symbol|mark|ci|bi)(?:[._/-]|$)/i;
const genericLikePattern = /(?:placeholder|default|thumb|thumbnail|no[_-]?image|share|og[_-]?image|sns|banner|visual|main)(?:[._/-]|$)/i;
const knownPlaceholderImages = [
  {
    label: "diningcode_rest_main_photo_placeholder",
    urlPattern: /\/rest_main_photo\.jpg\?rest=[^&#]+/i,
    contentLength: 11_024,
    sha256: "9df49a55c73111ebf5addfa75c5aec3c17fac1919ee6dc36f85283678d00437a"
  }
];

if (isMain()) {
  void main();
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const reports = await Promise.all(args.urls.map((url) => probeImageCandidate({ ...args, url })));
    if (args.json) {
      console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
    } else {
      console.log(formatReports(reports));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): ProbeArgs {
  const args: ProbeArgs = { urls: [], json: false, timeoutMs: defaultTimeoutMs };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg.startsWith("--url=")) {
      const value = arg.slice("--url=".length).trim();
      if (value) args.urls.push(value);
      continue;
    }
    if (arg.startsWith("--source-url=")) {
      args.sourceUrl = arg.slice("--source-url=".length).trim();
      continue;
    }
    if (arg.startsWith("--title=")) {
      args.title = arg.slice("--title=".length).trim();
      continue;
    }
    if (arg.startsWith("--timeout-ms=")) {
      const value = Number(arg.slice("--timeout-ms=".length));
      if (Number.isInteger(value) && value > 0) args.timeoutMs = value;
    }
  }

  if (args.urls.length === 0) {
    throw new Error("Usage: pnpm tsx scripts/check-image-candidate.ts --url=<imageUrl> [--source-url=<pageUrl>] [--title=<title>] [--json]");
  }

  return args;
}

export async function probeImageCandidate(input: ProbeArgs & { url: string }): Promise<ImageCandidateReport> {
  const remote = isRemoteHttpUrl(input.url);
  const attempts: ProbeAttempt[] = [];

  if (!remote) {
    return buildReport(input, attempts);
  }

  attempts.push(await fetchImageProbe(input.url, "HEAD", input.timeoutMs, false));
  if (!isUsefulImageAttempt(attempts[0])) {
    attempts.push(await fetchImageProbe(input.url, "GET_RANGE", input.timeoutMs, false));
  }

  if (input.sourceUrl && !attempts.some(isUsefulImageAttempt)) {
    attempts.push(await fetchImageProbe(input.url, "GET_RANGE", input.timeoutMs, true, input.sourceUrl));
  }

  if (!attempts.some(isUsefulImageAttempt)) {
    attempts.push(await fetchImageProbe(input.url, "GET", input.timeoutMs, false));
  }

  if (input.sourceUrl && !attempts.some(isUsefulImageAttempt)) {
    attempts.push(await fetchImageProbe(input.url, "GET", input.timeoutMs, true, input.sourceUrl));
  }

  const usefulAttempt = attempts.find(isUsefulImageAttempt);
  if (usefulAttempt && shouldRunKnownPlaceholderBodyProbe(input.url, usefulAttempt)) {
    attempts.push(await fetchImageProbe(input.url, "GET", input.timeoutMs, usefulAttempt.usedReferer, usefulAttempt.usedReferer ? input.sourceUrl : undefined));
  }

  return buildReport(input, attempts);
}

export function buildReport(input: { url: string; sourceUrl?: string; title?: string }, attempts: ProbeAttempt[]): ImageCandidateReport {
  const bestAttempt = attempts.find(isUsefulImageAttempt) ?? attempts.find((attempt) => attempt.status !== null) ?? attempts[0] ?? null;
  const labels = new Set(imageCandidateLabels(input.url, input.title, bestAttempt?.contentType ?? null));
  if (bestAttempt?.sniffedContentType && !isImageContentType(bestAttempt.declaredContentType ?? null)) {
    labels.add("image_content_type_sniffed");
  }
  for (const attempt of attempts) {
    for (const label of knownPlaceholderLabels(input.url, attempt)) {
      labels.add(label);
    }
  }
  const isRemote = isRemoteHttpUrl(input.url);
  const ok = Boolean(isRemote && bestAttempt?.ok && isImageContentType(bestAttempt.contentType));
  const refererNeeded = Boolean(bestAttempt?.usedReferer);
  const hotlinkRisk = hotlinkRiskLevel({ isRemote, ok, refererNeeded, status: bestAttempt?.status ?? null });
  const labelList = Array.from(labels);
  const visualRisk = visualRiskLevel(labelList);

  return {
    url: input.url,
    sourceUrl: input.sourceUrl ?? null,
    title: input.title ?? null,
    isRemoteHttpUrl: isRemote,
    status: bestAttempt?.status ?? null,
    ok,
    contentType: bestAttempt?.contentType ?? dataUrlContentType(input.url),
    contentLength: bestAttempt?.contentLength ?? dataUrlApproxLength(input.url),
    fullContentLength: attempts.find((attempt) => attempt.fullContentLength !== null && attempt.fullContentLength !== undefined)?.fullContentLength ?? null,
    contentSha256: attempts.find((attempt) => attempt.contentSha256)?.contentSha256 ?? null,
    finalUrl: bestAttempt?.finalUrl ?? null,
    refererNeeded,
    hotlinkRisk,
    visualRisk,
    labels: labelList,
    recommendation: recommendation({ ok, isRemote, hotlinkRisk, visualRisk }),
    attempts
  };
}

export function imageCandidateLabels(url: string, title: string | undefined, contentType: string | null) {
  const labels = new Set<string>();
  const haystack = [url, title ?? ""].join(" ");

  if (url.startsWith("data:")) labels.add("data_url_not_remote");
  if (isRemoteHttpUrl(url)) labels.add("remote_http_url");
  if (contentType && isImageContentType(contentType)) labels.add("image_content_type");
  if (contentType && !isImageContentType(contentType)) labels.add("non_image_content_type");
  if (imageExtensions.test(url)) labels.add("image_extension");
  if (logoLikePattern.test(haystack)) labels.add("logo_or_icon_risk");
  if (genericLikePattern.test(haystack)) labels.add("generic_or_placeholder_risk");
  if (knownPlaceholderImages.some((candidate) => candidate.urlPattern.test(url))) labels.add("known_placeholder_url_pattern");
  if (!imageExtensions.test(url) && !contentType) labels.add("extension_unknown");

  return Array.from(labels);
}

function recommendation(input: { ok: boolean; isRemote: boolean; hotlinkRisk: string; visualRisk: string }) {
  if (!input.isRemote || !input.ok) return "hold";
  if (input.hotlinkRisk === "high" || input.visualRisk === "high") return "hold";
  if (input.hotlinkRisk === "medium" || input.visualRisk === "medium") return "review";
  return "use";
}

function hotlinkRiskLevel(input: { isRemote: boolean; ok: boolean; refererNeeded: boolean; status: number | null }) {
  if (!input.isRemote || !input.ok) return "high";
  if (input.refererNeeded) return "high";
  if (input.status !== null && [401, 403, 429].includes(input.status)) return "high";
  if (input.status !== null && input.status >= 300) return "medium";
  return "low";
}

function visualRiskLevel(labels: string[]) {
  if (labels.includes("known_placeholder_image")) return "high";
  if (labels.includes("logo_or_icon_risk")) return "high";
  if (labels.includes("generic_or_placeholder_risk") || labels.includes("extension_unknown")) return "medium";
  return "low";
}

function knownPlaceholderLabels(url: string, attempt: Pick<ProbeAttempt, "contentLength" | "fullContentLength" | "contentSha256">) {
  const labels = new Set<string>();
  const length = attempt.fullContentLength ?? attempt.contentLength ?? null;

  for (const candidate of knownPlaceholderImages) {
    if (!candidate.urlPattern.test(url)) continue;
    labels.add("known_placeholder_url_pattern");
    if (attempt.contentSha256 === candidate.sha256 || length === candidate.contentLength) {
      labels.add("known_placeholder_image");
      labels.add(candidate.label);
    }
  }

  return Array.from(labels);
}

function shouldRunKnownPlaceholderBodyProbe(url: string, attempt: ProbeAttempt) {
  if (attempt.method === "GET") return false;
  if (!knownPlaceholderImages.some((candidate) => candidate.urlPattern.test(url))) return false;
  if (knownPlaceholderLabels(url, attempt).includes("known_placeholder_image")) return false;

  const knownLength = attempt.fullContentLength ?? (attempt.method === "HEAD" ? attempt.contentLength : null);
  return knownLength === null || knownPlaceholderImages.some((candidate) => knownLength === candidate.contentLength);
}

function isUsefulImageAttempt(attempt: ProbeAttempt) {
  return attempt.ok && isImageContentType(attempt.contentType);
}

async function fetchImageProbe(url: string, method: ProbeAttempt["method"], timeoutMs: number, usedReferer: boolean, sourceUrl?: string): Promise<ProbeAttempt> {
  try {
    const response = await fetch(url, {
      method: method === "HEAD" ? "HEAD" : "GET",
      headers: {
        ...(method === "GET_RANGE" ? { range: "bytes=0-63" } : {}),
        ...(usedReferer && sourceUrl ? { referer: sourceUrl } : {})
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs)
    });
    const declaredContentType = normalizedHeader(response.headers.get("content-type"));
    const contentLength = numericHeader(response.headers.get("content-length"));
    const contentRangeLength = contentRangeTotalLength(response.headers.get("content-range"));
    let fullContentLength = method === "GET_RANGE" ? contentRangeLength : contentLength;
    let contentSha256: string | null = null;
    let sniffedContentType: string | null = null;
    let contentType = declaredContentType;
    let body: Buffer | null = null;
    const probeOk = response.ok || response.status === 206;

    if (method !== "HEAD" && probeOk) {
      body = Buffer.from(await response.arrayBuffer());
      sniffedContentType = sniffImageContentType(body);
      if (sniffedContentType && !isImageContentType(contentType)) {
        contentType = sniffedContentType;
      }
    }

    if (method === "GET" && probeOk && body && isImageContentType(contentType)) {
      fullContentLength = body.byteLength;
      contentSha256 = createHash("sha256").update(body).digest("hex");
    }

    return {
      method,
      status: response.status,
      ok: probeOk,
      contentType,
      declaredContentType,
      sniffedContentType,
      contentLength,
      fullContentLength,
      contentSha256,
      finalUrl: response.url,
      usedReferer
    };
  } catch (error) {
    return {
      method,
      status: null,
      ok: false,
      contentType: null,
      contentLength: null,
      finalUrl: url,
      usedReferer,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function formatReports(reports: ImageCandidateReport[]) {
  return reports
    .map((report) => {
      const lines = [
        `# Image Candidate Probe`,
        ``,
        `URL: ${report.url}`,
        `Source URL: ${report.sourceUrl ?? "none"}`,
        `Title: ${report.title ?? "none"}`,
        `Status: ${report.status ?? "unreachable"}`,
        `Content-Type: ${report.contentType ?? "unknown"}`,
        `Content-Length: ${report.contentLength ?? "unknown"}`,
        `Full Content-Length: ${report.fullContentLength ?? "unknown"}`,
        `Content SHA-256: ${report.contentSha256 ?? "unknown"}`,
        `Final URL: ${report.finalUrl ?? "none"}`,
        `Referer needed: ${report.refererNeeded ? "yes" : "no"}`,
        `Hotlink risk: ${report.hotlinkRisk}`,
        `Visual risk: ${report.visualRisk}`,
        `Labels: ${report.labels.join(", ") || "none"}`,
        `Recommendation: ${report.recommendation}`,
        ``,
        `Attempts:`
      ];
      for (const attempt of report.attempts) {
        lines.push(
          `- ${attempt.method}${attempt.usedReferer ? " with referer" : ""}: ${attempt.status ?? "error"} ${attempt.contentType ?? "unknown"}${attempt.error ? ` (${attempt.error})` : ""}`
        );
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function isRemoteHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isImageContentType(value: string | null) {
  return Boolean(value?.toLowerCase().startsWith("image/"));
}

function sniffImageContentType(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 && ascii(bytes, 0, 6).match(/^GIF8[79]a$/)) {
    return "image/gif";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 4))) {
    return "image/avif";
  }
  return null;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function normalizedHeader(value: string | null) {
  return value?.split(";")[0]?.trim().toLowerCase() || null;
}

function numericHeader(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function contentRangeTotalLength(value: string | null) {
  const total = value?.match(/\/(\d+)$/)?.[1];
  if (!total) return null;
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : null;
}

function dataUrlContentType(value: string) {
  if (!value.startsWith("data:")) return null;
  const match = /^data:([^;,]+)/.exec(value);
  return match?.[1]?.toLowerCase() ?? null;
}

function dataUrlApproxLength(value: string) {
  if (!value.startsWith("data:")) return null;
  const [, payload = ""] = value.split(",", 2);
  return payload.length || null;
}

function isMain() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
