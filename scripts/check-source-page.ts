import { pathToFileURL } from "node:url";

type SourcePageArgs = {
  url: string;
  json: boolean;
  timeoutMs: number;
  checklist: string[];
};

type SourcePageAttempt = {
  method: "GET";
  status: number | null;
  ok: boolean;
  contentType: string | null;
  finalUrl: string;
  textLength: number | null;
  dynamicReason?: string;
  error?: string;
};

type ManualReviewPlan = {
  tool: "browser_or_manual_source";
  reasonCodes: string[];
  checklist: string[];
  note: string;
};

export type SourcePageCheckReport = {
  url: string;
  ok: boolean;
  status: number | null;
  contentType: string | null;
  finalUrl: string | null;
  textLength: number | null;
  reasonCodes: string[];
  recommendation: "use_cli_source" | "manual_review";
  manualReview: ManualReviewPlan | null;
  attempts: SourcePageAttempt[];
};

const defaultTimeoutMs = 8_000;
const defaultChecklist = [
  "address or road address",
  "current operation status and opening hours",
  "official representative image or image source page",
  "nursing room",
  "diaper changing table",
  "stroller route, elevator, or step-free access",
  "parking and arrival friction",
  "child activity and family-fit evidence",
  "fees, reservation, or admission rules"
];

if (isMain()) {
  void main();
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = await checkSourcePage(args);
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatSourcePageCheckReport(report));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): SourcePageArgs {
  const args: SourcePageArgs = {
    url: "",
    json: false,
    timeoutMs: defaultTimeoutMs,
    checklist: defaultChecklist
  };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg.startsWith("--url=")) {
      args.url = arg.slice("--url=".length).trim();
      continue;
    }
    if (arg.startsWith("--timeout-ms=")) {
      const value = Number(arg.slice("--timeout-ms=".length));
      if (Number.isInteger(value) && value > 0) args.timeoutMs = value;
      continue;
    }
    if (arg.startsWith("--checklist=")) {
      const values = arg
        .slice("--checklist=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (values.length > 0) args.checklist = values;
    }
  }

  if (!args.url) {
    throw new Error("Usage: pnpm tsx scripts/check-source-page.ts --url=<sourcePageUrl> [--json] [--timeout-ms=8000]");
  }

  return args;
}

export async function checkSourcePage(input: SourcePageArgs, fetchImpl: typeof fetch = fetch): Promise<SourcePageCheckReport> {
  if (!isRemoteHttpUrl(input.url)) {
    return buildReport(input, [
      {
        method: "GET",
        status: null,
        ok: false,
        contentType: null,
        finalUrl: input.url,
        textLength: null,
        error: "URL must start with http:// or https://"
      }
    ]);
  }

  const attempt = await fetchSourcePage(input, fetchImpl);
  return buildReport(input, [attempt]);
}

export function buildReport(input: Pick<SourcePageArgs, "url" | "checklist">, attempts: SourcePageAttempt[]): SourcePageCheckReport {
  const bestAttempt = attempts[0] ?? null;
  const reasonCodes = sourcePageReasonCodes(bestAttempt);
  const requiresManualReview = reasonCodes.some((code) => manualReviewReasonCodes.has(code));

  return {
    url: input.url,
    ok: Boolean(bestAttempt?.ok && !requiresManualReview),
    status: bestAttempt?.status ?? null,
    contentType: bestAttempt?.contentType ?? null,
    finalUrl: bestAttempt?.finalUrl ?? null,
    textLength: bestAttempt?.textLength ?? null,
    reasonCodes,
    recommendation: requiresManualReview ? "manual_review" : "use_cli_source",
    manualReview: requiresManualReview
      ? {
          tool: "browser_or_manual_source",
          reasonCodes,
          checklist: input.checklist,
          note: "Open this source in Browser/manual mode and copy concise source-backed facts into the research note before mutation."
        }
      : null,
    attempts
  };
}

function sourcePageReasonCodes(attempt: SourcePageAttempt | null) {
  const codes = new Set<string>();
  if (!attempt) return ["NO_ATTEMPT"];

  if (attempt.error === "URL must start with http:// or https://") {
    codes.add("INVALID_REMOTE_URL");
  } else if (attempt.error) {
    codes.add(tlsErrorPattern.test(attempt.error) ? "TLS_OR_CERT_FAILURE" : "FETCH_FAILED");
  }

  if (attempt.status === 406) codes.add("HTTP_406_NOT_ACCEPTABLE");
  if (attempt.status === 401 || attempt.status === 403) codes.add("HTTP_ACCESS_DENIED");
  if (attempt.status === 429) codes.add("HTTP_RATE_LIMITED");
  if (attempt.status !== null && attempt.status >= 500) codes.add("HTTP_SERVER_ERROR");
  if (attempt.status !== null && attempt.status >= 400 && !codes.has("HTTP_406_NOT_ACCEPTABLE")) codes.add("HTTP_NOT_OK");

  const textLength = attempt.textLength ?? 0;
  if (attempt.ok && looksTextContentType(attempt.contentType) && textLength === 0) codes.add("EMPTY_TEXT");

  if (attempt.dynamicReason) codes.add(attempt.dynamicReason);

  return Array.from(codes);
}

const manualReviewReasonCodes = new Set([
  "NO_ATTEMPT",
  "FETCH_FAILED",
  "TLS_OR_CERT_FAILURE",
  "HTTP_406_NOT_ACCEPTABLE",
  "HTTP_ACCESS_DENIED",
  "HTTP_RATE_LIMITED",
  "HTTP_SERVER_ERROR",
  "HTTP_NOT_OK",
  "EMPTY_TEXT",
  "DYNAMIC_APP_SHELL",
  "JAVASCRIPT_REQUIRED",
  "INVALID_REMOTE_URL"
]);

const tlsErrorPattern = /(?:tls|ssl|cert|certificate|self[-\s]?signed|unable_to_verify|err_cert|handshake)/i;
const javascriptRequiredPattern =
  /(?:enable javascript|javascript.*required|requires javascript|자바스크립트(?:를|을)?\s*(?:사용|활성화|지원)|스크립트를\s*활성화)/i;
const dynamicShellPattern = /(?:__NEXT_DATA__|window\.__NUXT__|id=["']__next["']|id=["']root["']|data-reactroot|ng-version|app-root)/i;
const scriptTagPattern = /<script\b/gi;

async function fetchSourcePage(input: SourcePageArgs, fetchImpl: typeof fetch): Promise<SourcePageAttempt> {
  try {
    const response = await fetchImpl(input.url, {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "AiGo source checker (+https://aigo.local)"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(input.timeoutMs)
    });
    const contentType = normalizedHeader(response.headers.get("content-type"));
    const finalUrl = response.url || input.url;
    let textLength: number | null = null;
    let dynamicReason: string | undefined;

    if (looksTextContentType(contentType)) {
      const html = await response.text();
      const visibleText = extractVisibleText(html);
      textLength = visibleText.length;
      dynamicReason = detectDynamicReason(html, visibleText) ?? undefined;
    }

    return {
      method: "GET",
      status: response.status,
      ok: response.ok,
      contentType,
      finalUrl,
      textLength,
      ...(dynamicReason ? { dynamicReason } : {})
    };
  } catch (error) {
    return {
      method: "GET",
      status: null,
      ok: false,
      contentType: null,
      finalUrl: input.url,
      textLength: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function detectDynamicReason(html: string, visibleText: string) {
  if (javascriptRequiredPattern.test(html)) return "JAVASCRIPT_REQUIRED";

  const scriptCount = [...html.matchAll(scriptTagPattern)].length;
  const shellMarkers = dynamicShellPattern.test(html);
  if ((shellMarkers && visibleText.length < 500) || (scriptCount >= 5 && visibleText.length < 250)) {
    return "DYNAMIC_APP_SHELL";
  }

  return null;
}

function extractVisibleText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatSourcePageCheckReport(report: SourcePageCheckReport) {
  const lines = [
    "# Source Page Check",
    "",
    `URL: ${report.url}`,
    `Status: ${report.status ?? "unreachable"}`,
    `Content-Type: ${report.contentType ?? "unknown"}`,
    `Final URL: ${report.finalUrl ?? "none"}`,
    `Visible text length: ${report.textLength ?? "unknown"}`,
    `Reason codes: ${report.reasonCodes.join(", ") || "none"}`,
    `Recommendation: ${report.recommendation}`
  ];

  if (report.manualReview) {
    lines.push("", "Manual source checklist:");
    for (const item of report.manualReview.checklist) {
      lines.push(`- ${item}`);
    }
    lines.push("", report.manualReview.note);
  }

  return lines.join("\n");
}

function isRemoteHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function looksTextContentType(value: string | null) {
  return !value || /^(?:text\/|application\/(?:xhtml\+xml|xml|json)|.*\+xml$)/i.test(value);
}

function normalizedHeader(value: string | null) {
  return value?.split(";")[0]?.trim().toLowerCase() || null;
}

function isMain() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}
