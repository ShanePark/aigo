import { createHash } from "node:crypto";
import Bowser from "bowser";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type postgres from "postgres";

import { pg } from "@/db/client";
import type { AppUser } from "@/lib/app-auth";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

export const visitEventsLimitSchema = z.coerce.number().int().min(1).max(200).default(50);
export const visitEventsOffsetSchema = z.coerce.number().int().min(0).default(0);
export const visitEventsSourceSchema = z.enum(["all", "app", "v1"]).default("all");
export const visitEventsTypeSchema = z.enum(["all", "place_detail_view", "place_search"]).default("all");

export type VisitEventsSourceFilter = z.infer<typeof visitEventsSourceSchema>;
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
  deviceKeyHash: string | null;
  searchInput: Record<string, unknown>;
  searchResultCount: number | string | null;
  searchResultTotal: number | string | null;
  eventMeta: Record<string, unknown>;
  userAgentAnalysis: Record<string, unknown>;
  createdAt: Date | string;
  totalCount: number | string;
};

type VisitEventSummaryRow = {
  totalCount: number | string;
  detailViewCount: number | string;
  searchCount: number | string;
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
  deviceKeyHash: string | null;
  searchInput: Record<string, unknown>;
  searchResultCount: number | null;
  searchResultTotal: number | null;
  eventMeta: Record<string, unknown>;
  userAgentAnalysis: Record<string, unknown>;
  createdAt: string;
};

export type VisitEventsSummary = {
  detailViewCount: number;
  searchCount: number;
  totalCount: number;
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
      device_key_hash,
      search_input,
      search_result_count,
      search_result_total,
      event_meta,
      user_agent_analysis
    )
    values (
      ${input.eventType},
      ${input.eventSource ?? "app"},
      ${input.user?.id ?? null},
      ${input.placeId ?? null},
      ${requestInfo.requestPath},
      ${requestInfo.httpMethod},
      ${requestInfo.ipAddress},
      ${deviceKeyHash},
      ${JSON.stringify(input.searchInput ?? {})}::jsonb,
      ${input.searchResultCount ?? null},
      ${input.searchResultTotal ?? null},
      ${JSON.stringify(input.meta ?? {})}::jsonb,
      ${JSON.stringify(userAgentAnalysis)}::jsonb
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

export async function listVisitEvents(
  input: { eventSource?: VisitEventsSourceFilter; eventType?: VisitEventType; ipAddress?: string | null; limit?: number; offset?: number; userId?: string | null } = {},
  executor: SqlExecutor = pg
) {
  const eventType = visitEventsTypeSchema.parse(input.eventType ?? "all");
  const eventSource = visitEventsSourceSchema.parse(input.eventSource ?? "all");
  const ipAddress = nonEmptyFilter(input.ipAddress);
  const userId = nonEmptyFilter(input.userId);
  const limit = visitEventsLimitSchema.parse(input.limit);
  const offset = visitEventsOffsetSchema.parse(input.offset ?? 0);
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
      e.device_key_hash as "deviceKeyHash",
      e.search_input as "searchInput",
      e.search_result_count as "searchResultCount",
      e.search_result_total as "searchResultTotal",
      e.event_meta as "eventMeta",
      e.user_agent_analysis as "userAgentAnalysis",
      e.created_at as "createdAt",
      count(*) over()::int as "totalCount"
    from visit_events e
    left join users u on u.id = e.user_id
    left join places p on p.id = e.place_id
    where (${eventType} = 'all' or e.event_type = ${eventType})
      and (${eventSource} = 'all' or e.event_source = ${eventSource})
      and (${ipAddress}::text is null or e.ip_address = ${ipAddress})
      and (${userId}::uuid is null or e.user_id = ${userId}::uuid)
    order by e.created_at desc
    limit ${limit}
    offset ${offset}
  `;

  return { items: rows.map(visitEventFromRow), totalCount: numberValue(rows[0]?.totalCount) };
}

export async function getVisitEventsSummary(executor: SqlExecutor = pg): Promise<VisitEventsSummary> {
  const rows = await executor<VisitEventSummaryRow[]>`
    select
      count(*)::int as "totalCount",
      count(*) filter (where event_type = 'place_detail_view')::int as "detailViewCount",
      count(*) filter (where event_type = 'place_search')::int as "searchCount"
    from visit_events
  `;

  return {
    detailViewCount: numberValue(rows[0]?.detailViewCount),
    searchCount: numberValue(rows[0]?.searchCount),
    totalCount: numberValue(rows[0]?.totalCount)
  };
}

function nonEmptyFilter(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function analyzeUserAgent(userAgent: string | null | undefined) {
  const ua = userAgent ?? "";
  if (!ua) {
    return {
      browser: {},
      engine: {},
      isBot: false,
      os: {},
      platform: {},
      summary: "unknown"
    };
  }

  const parsed = Bowser.parse(ua);
  const platformType = parsed.platform.type ?? "unknown";

  return {
    browser: compactObject(parsed.browser),
    engine: compactObject(parsed.engine),
    isBot: platformType === "bot",
    os: compactObject(parsed.os),
    platform: compactObject(parsed.platform),
    summary:
      [
        platformType,
        parsed.platform.vendor,
        parsed.platform.model,
        parsed.os.name,
        parsed.os.version,
        parsed.browser.name,
        parsed.browser.version
      ]
        .filter(Boolean)
        .join(" · ") || "unknown"
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
    deviceKeyHash: row.deviceKeyHash,
    searchInput: row.searchInput ?? {},
    searchResultCount: numberOrNull(row.searchResultCount),
    searchResultTotal: numberOrNull(row.searchResultTotal),
    eventMeta: row.eventMeta ?? {},
    userAgentAnalysis: row.userAgentAnalysis ?? {},
    createdAt: dateTimeString(row.createdAt)
  };
}

function hashVisitEventDeviceKey(deviceKey: string) {
  return createHash("sha256").update(process.env.AIGO_VIEW_DEDUPE_SALT ?? "aigo-visit-event-device").update(":").update(deviceKey).digest("hex");
}

function compactObject(input: object | undefined) {
  return Object.fromEntries(Object.entries(input ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== ""));
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
