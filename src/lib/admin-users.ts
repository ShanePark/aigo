import type postgres from "postgres";
import { z } from "zod";

import { pg } from "@/db/client";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

export const adminUsersLimitSchema = z.coerce.number().int().min(1).max(200).default(50);
export const adminUsersOffsetSchema = z.coerce.number().int().min(0).default(0);

type AdminUserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  consents: AdminUserConsentRow[] | null;
  socialProviders: string[] | null;
  lastSessionUsedAt: Date | string | null;
  lastVisitAt: Date | string | null;
  totalEventCount: number | string | null;
  detailViewCount: number | string | null;
  searchCount: number | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type AdminUserConsentRow = {
  bodySha256?: string | null;
  bodyText?: string | null;
  consentText?: string | null;
  consentType?: string | null;
  consentedAt?: Date | string | null;
  documentEffectiveDate?: string | null;
  documentId?: string | null;
  documentTitle?: string | null;
  documentUrl?: string | null;
  ipAddress?: string | null;
  source?: string | null;
  userAgent?: string | null;
  version?: string | null;
};

type AdminUsersSummaryRow = {
  totalCount: number | string;
  adminCount: number | string;
  visitedUserCount: number | string;
};

export type AdminUserItem = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  consents: AdminUserConsentItem[];
  socialProviders: string[];
  lastSessionUsedAt: string | null;
  lastVisitAt: string | null;
  totalEventCount: number;
  detailViewCount: number;
  searchCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserConsentItem = {
  bodySha256: string | null;
  bodyText: string;
  consentText: string;
  consentType: string;
  consentedAt: string;
  documentEffectiveDate: string | null;
  documentId: string;
  documentTitle: string;
  documentUrl: string;
  ipAddress: string | null;
  source: string;
  userAgent: string | null;
  version: string;
};

export type AdminUsersSummary = {
  totalCount: number;
  adminCount: number;
  visitedUserCount: number;
};

export async function listAdminUsers(input: { limit?: number; offset?: number } = {}, executor: SqlExecutor = pg) {
  const limit = adminUsersLimitSchema.parse(input.limit);
  const offset = adminUsersOffsetSchema.parse(input.offset ?? 0);
  const rows = await executor<AdminUserRow[]>`
    select
      u.id::text as id,
      u.email,
      u.display_name as "displayName",
      u.role,
      coalesce(c.consents, '[]'::jsonb) as consents,
      coalesce(s.social_providers, '{}') as "socialProviders",
      a.last_session_used_at as "lastSessionUsedAt",
      e.last_visit_at as "lastVisitAt",
      coalesce(e.total_event_count, 0)::int as "totalEventCount",
      coalesce(e.detail_view_count, 0)::int as "detailViewCount",
      coalesce(e.search_count, 0)::int as "searchCount",
      u.created_at as "createdAt",
      u.updated_at as "updatedAt"
    from users u
    left join (
      select
        uc.user_id,
        jsonb_agg(
          jsonb_build_object(
            'bodySha256', cd.body_sha256,
            'bodyText', cd.body_text,
            'consentText', uc.consent_text,
            'consentType', uc.consent_type,
            'consentedAt', uc.consented_at,
            'documentEffectiveDate', uc.document_effective_date,
            'documentId', uc.document_id,
            'documentTitle', uc.document_title,
            'documentUrl', uc.document_url,
            'ipAddress', uc.ip_address,
            'source', uc.source,
            'userAgent', uc.user_agent,
            'version', uc.version
          )
          order by uc.consented_at desc, uc.consent_type
        ) as consents
      from user_consents uc
      left join consent_documents cd on cd.id = uc.document_id
      group by uc.user_id
    ) c on c.user_id = u.id
    left join (
      select user_id, array_remove(array_agg(distinct provider), null) as social_providers
      from user_social_accounts
      group by user_id
    ) s on s.user_id = u.id
    left join (
      select user_id, max(last_used_at) as last_session_used_at
      from auth_sessions
      group by user_id
    ) a on a.user_id = u.id
    left join (
      select
        user_id,
        max(created_at) as last_visit_at,
        count(*)::int as total_event_count,
        count(*) filter (where event_type = 'place_detail_view')::int as detail_view_count,
        count(*) filter (where event_type = 'place_search')::int as search_count
      from visit_events
      where user_id is not null
      group by user_id
    ) e on e.user_id = u.id
    order by coalesce(e.last_visit_at, a.last_session_used_at, u.updated_at, u.created_at) desc
    limit ${limit}
    offset ${offset}
  `;

  return { items: rows.map(adminUserFromRow) };
}

export async function getAdminUsersSummary(executor: SqlExecutor = pg): Promise<AdminUsersSummary> {
  const rows = await executor<AdminUsersSummaryRow[]>`
    select
      count(*)::int as "totalCount",
      count(*) filter (where role = 'admin')::int as "adminCount",
      count(*) filter (
        where exists (
          select 1
          from visit_events e
          where e.user_id = users.id
        )
      )::int as "visitedUserCount"
    from users
  `;

  return {
    adminCount: numberValue(rows[0]?.adminCount),
    totalCount: numberValue(rows[0]?.totalCount),
    visitedUserCount: numberValue(rows[0]?.visitedUserCount)
  };
}

function adminUserFromRow(row: AdminUserRow): AdminUserItem {
  return {
    id: row.id,
    email: row.email,
    consents: Array.isArray(row.consents) ? row.consents.map(adminUserConsentFromRow).filter((item) => item.documentId) : [],
    displayName: row.displayName,
    role: row.role,
    socialProviders: Array.isArray(row.socialProviders) ? row.socialProviders.filter(Boolean) : [],
    lastSessionUsedAt: row.lastSessionUsedAt ? dateTimeString(row.lastSessionUsedAt) : null,
    lastVisitAt: row.lastVisitAt ? dateTimeString(row.lastVisitAt) : null,
    totalEventCount: numberValue(row.totalEventCount),
    detailViewCount: numberValue(row.detailViewCount),
    searchCount: numberValue(row.searchCount),
    createdAt: dateTimeString(row.createdAt),
    updatedAt: dateTimeString(row.updatedAt)
  };
}

function adminUserConsentFromRow(row: AdminUserConsentRow): AdminUserConsentItem {
  return {
    bodySha256: textValue(row.bodySha256),
    bodyText: textValue(row.bodyText) ?? "",
    consentText: textValue(row.consentText) ?? "",
    consentType: textValue(row.consentType) ?? "",
    consentedAt: row.consentedAt ? dateTimeString(row.consentedAt) : "",
    documentEffectiveDate: textValue(row.documentEffectiveDate),
    documentId: textValue(row.documentId) ?? "",
    documentTitle: textValue(row.documentTitle) ?? "",
    documentUrl: textValue(row.documentUrl) ?? "",
    ipAddress: textValue(row.ipAddress),
    source: textValue(row.source) ?? "",
    userAgent: textValue(row.userAgent),
    version: textValue(row.version) ?? ""
  };
}

function dateTimeString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}
