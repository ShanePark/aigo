import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type postgres from "postgres";

import { pg } from "@/db/client";
import type { AppUser } from "@/lib/app-auth";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

export const visitEventsLimitSchema = z.coerce.number().int().min(1).max(200).default(50);
export const visitEventsTypeSchema = z.enum(["all", "place_detail_view", "place_search"]).default("all");

export type VisitEventType = z.infer<typeof visitEventsTypeSchema>;
export type VisitEventKind = Exclude<VisitEventType, "all">;
export type VisitEventSource = "app" | "v1";

type VisitEventRow = {
  id: string;
  eventType: VisitEventKind;
  eventSource: VisitEventSource;
  userId: string | null;
  userEmail: string | null;
  userDisplayName: string | null;
  placeId: string | null;
  placeName: string | null;
  requestPath: string | null;
  httpMethod: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceKeyHash: string | null;
  searchInput: Record<string, unknown>;
  searchResultCount: number | string | null;
  searchResultTotal: number | string | null;
  eventMeta: Record<string, unknown>;
  userAgentAnalysis: Record<string, unknown>;
  uaProcessed: boolean;
  uaProcessedAt: Date | string | null;
  createdAt: Date | string;
};

type VisitEventSummaryRow = {
  totalCount: number | string;
  detailViewCount: number | string;
  searchCount: number | string;
  processedUaCount: number | string;
  unprocessedUaCount: number | string;
};

export type VisitEventRequestContext = {
  deviceKey?: string | null;
  eventSource?: VisitEventSource;
  eventType: VisitEventKind;
  placeId?: string | null;
  request: NextRequest;
  searchInput?: Record<string, unknown>;
  searchResultCount?: number | null;
  searchResultTotal?: number | null;
  user?: Pick<AppUser, "id"> | null;
  meta?: Record<string, unknown>;
};

export type VisitEventItem = {
  id: string;
  eventType: VisitEventKind;
  eventSource: VisitEventSource;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
  } | null;
  place: {
    id: string;
    name: string | null;
  } | null;
  requestPath: string | null;
  httpMethod: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceKeyHash: string | null;
  searchInput: Record<string, unknown>;
  searchResultCount: number | null;
  searchResultTotal: number | null;
  eventMeta: Record<string, unknown>;
  userAgentAnalysis: Record<string, unknown>;
  uaProcessed: boolean;
  uaProcessedAt: string | null;
  createdAt: string;
};

export type VisitEventsSummary = {
  detailViewCount: number;
  processedUaCount: number;
  searchCount: number;
  totalCount: number;
  unprocessedUaCount: number;
};

export async function recordVisitEvent(input: VisitEventRequestContext, executor: SqlExecutor = pg) {
  const requestInfo = visitEventRequestInfo(input.request);
  const deviceKeyHash = input.deviceKey ? hashVisitEventDeviceKey(input.deviceKey) : null;
  const userAgentAnalysis = analyzeUserAgent(requestInfo.userAgent);

  const rows = await executor<Array<{ id: string }>>`
    insert into visit_events (
      event_type,
      event_source,
      user_id,
      place_id,
      request_path,
      http_method,
      ip_address,
      user_agent,
      device_key_hash,
      search_input,
      search_result_count,
      search_result_total,
      event_meta,
      user_agent_analysis,
      ua_processed,
      ua_processed_at
    )
    values (
      ${input.eventType},
      ${input.eventSource ?? "app"},
      ${input.user?.id ?? null},
      ${input.placeId ?? null},
      ${requestInfo.requestPath},
      ${requestInfo.httpMethod},
      ${requestInfo.ipAddress},
      ${requestInfo.userAgent},
      ${deviceKeyHash},
      ${JSON.stringify(input.searchInput ?? {})}::jsonb,
      ${input.searchResultCount ?? null},
      ${input.searchResultTotal ?? null},
      ${JSON.stringify(input.meta ?? {})}::jsonb,
      ${JSON.stringify(userAgentAnalysis)}::jsonb,
      true,
      now()
    )
    returning id::text as id
  `;

  return { id: rows[0]?.id ?? null };
}

export function recordVisitEventLater(input: VisitEventRequestContext) {
  void recordVisitEvent(input).catch((error) => {
    console.warn("Failed to record visit event", error);
  });
}

export async function listVisitEvents(input: { eventType?: VisitEventType; limit?: number } = {}, executor: SqlExecutor = pg) {
  const eventType = visitEventsTypeSchema.parse(input.eventType ?? "all");
  const limit = visitEventsLimitSchema.parse(input.limit);
  const rows = await executor<VisitEventRow[]>`
    select
      e.id::text as id,
      e.event_type as "eventType",
      e.event_source as "eventSource",
      e.user_id::text as "userId",
      u.email as "userEmail",
      u.display_name as "userDisplayName",
      e.place_id::text as "placeId",
      p.name as "placeName",
      e.request_path as "requestPath",
      e.http_method as "httpMethod",
      e.ip_address as "ipAddress",
      e.user_agent as "userAgent",
      e.device_key_hash as "deviceKeyHash",
      e.search_input as "searchInput",
      e.search_result_count as "searchResultCount",
      e.search_result_total as "searchResultTotal",
      e.event_meta as "eventMeta",
      e.user_agent_analysis as "userAgentAnalysis",
      e.ua_processed as "uaProcessed",
      e.ua_processed_at as "uaProcessedAt",
      e.created_at as "createdAt"
    from visit_events e
    left join users u on u.id = e.user_id
    left join places p on p.id = e.place_id
    where ${eventType} = 'all' or e.event_type = ${eventType}
    order by e.created_at desc
    limit ${limit}
  `;

  return { items: rows.map(visitEventFromRow) };
}

export async function getVisitEventsSummary(executor: SqlExecutor = pg): Promise<VisitEventsSummary> {
  const rows = await executor<VisitEventSummaryRow[]>`
    select
      count(*)::int as "totalCount",
      count(*) filter (where event_type = 'place_detail_view')::int as "detailViewCount",
      count(*) filter (where event_type = 'place_search')::int as "searchCount",
      count(*) filter (where ua_processed)::int as "processedUaCount",
      count(*) filter (where not ua_processed)::int as "unprocessedUaCount"
    from visit_events
  `;

  return {
    detailViewCount: numberValue(rows[0]?.detailViewCount),
    processedUaCount: numberValue(rows[0]?.processedUaCount),
    searchCount: numberValue(rows[0]?.searchCount),
    totalCount: numberValue(rows[0]?.totalCount),
    unprocessedUaCount: numberValue(rows[0]?.unprocessedUaCount)
  };
}

export function analyzeUserAgent(userAgent: string | null | undefined) {
  const ua = userAgent ?? "";
  const lower = ua.toLowerCase();
  const isBot = /bot|crawler|spider|slurp|bingpreview|headless|preview|monitor/.test(lower);
  const deviceType = /ipad|tablet/.test(lower) ? "tablet" : /mobile|iphone|android/.test(lower) ? "mobile" : "desktop";
  const os = detectOperatingSystem(ua);
  const browser = detectBrowser(ua);

  return {
    browser,
    deviceType,
    isBot,
    os,
    rawLength: ua.length,
    summary: [deviceType, os.name, browser.name].filter((part) => part && part !== "unknown").join(" · ") || "unknown"
  };
}

export function visitEventRequestInfo(request: NextRequest) {
  return {
    httpMethod: request.method,
    ipAddress: clientIp(request),
    requestPath: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent")?.trim() || null
  };
}

export function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || request.headers.get("cf-connecting-ip")?.trim() || null;
}

function visitEventFromRow(row: VisitEventRow): VisitEventItem {
  return {
    id: row.id,
    eventType: row.eventType,
    eventSource: row.eventSource,
    user: row.userId
      ? {
          id: row.userId,
          displayName: row.userDisplayName,
          email: row.userEmail
        }
      : null,
    place: row.placeId
      ? {
          id: row.placeId,
          name: row.placeName
        }
      : null,
    requestPath: row.requestPath,
    httpMethod: row.httpMethod,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    deviceKeyHash: row.deviceKeyHash,
    searchInput: row.searchInput ?? {},
    searchResultCount: numberOrNull(row.searchResultCount),
    searchResultTotal: numberOrNull(row.searchResultTotal),
    eventMeta: row.eventMeta ?? {},
    userAgentAnalysis: row.userAgentAnalysis ?? {},
    uaProcessed: row.uaProcessed,
    uaProcessedAt: row.uaProcessedAt ? dateTimeString(row.uaProcessedAt) : null,
    createdAt: dateTimeString(row.createdAt)
  };
}

function hashVisitEventDeviceKey(deviceKey: string) {
  return createHash("sha256").update(process.env.AIGO_VIEW_DEDUPE_SALT ?? "aigo-visit-event-device").update(":").update(deviceKey).digest("hex");
}

function detectOperatingSystem(userAgent: string) {
  if (/iPhone|iPad|iPod/.test(userAgent)) return { name: "iOS" };
  if (/Android/.test(userAgent)) return { name: "Android" };
  if (/Windows NT/.test(userAgent)) return { name: "Windows" };
  if (/Mac OS X|Macintosh/.test(userAgent)) return { name: "macOS" };
  if (/Linux/.test(userAgent)) return { name: "Linux" };
  return { name: "unknown" };
}

function detectBrowser(userAgent: string) {
  if (/Edg\//.test(userAgent)) return { name: "Edge" };
  if (/OPR\//.test(userAgent)) return { name: "Opera" };
  if (/Chrome\//.test(userAgent) && !/Chromium/.test(userAgent)) return { name: "Chrome" };
  if (/Safari\//.test(userAgent) && /Version\//.test(userAgent)) return { name: "Safari" };
  if (/Firefox\//.test(userAgent)) return { name: "Firefox" };
  return { name: "unknown" };
}

function numberValue(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function numberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  return numberValue(value);
}

function dateTimeString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}
