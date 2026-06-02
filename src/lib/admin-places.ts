import type postgres from "postgres";
import { z } from "zod";

import { pg } from "@/db/client";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

export const adminPlacesLimitSchema = z.coerce.number().int().min(1).max(200).default(50);
export const adminPlacesOffsetSchema = z.coerce.number().int().min(0).default(0);
export const adminPlacesDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .default(null);
export const adminPlacesMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .nullable()
  .default(null);
export const adminPlacesSortSchema = z.enum(["created", "updated"]).default("created");
export type AdminPlacesSort = z.infer<typeof adminPlacesSortSchema>;

type AdminPlaceRow = {
  id: string;
  name: string;
  imageAltText: string | null;
  imageUrl: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  totalCount: number | string;
};

type AdminPlaceDayRow = {
  date: string;
  count: number | string;
};

type AdminPlacesSummaryRow = {
  totalCount: number | string;
  activeCount: number | string;
  temporaryClosedCount: number | string;
  sourceBackedCount: number | string;
};

type AdminPlacesTotalRow = {
  totalCount: number | string;
};

export type AdminPlaceItem = {
  id: string;
  name: string;
  imageAltText: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminPlaceDayCount = {
  date: string;
  count: number;
};

export type AdminPlacesSummary = {
  totalCount: number;
  activeCount: number;
  temporaryClosedCount: number;
  sourceBackedCount: number;
};

export async function listAdminPlaces(input: { date?: string | null; limit?: number; offset?: number; sort?: AdminPlacesSort } = {}, executor: SqlExecutor = pg) {
  const date = adminPlacesDateSchema.parse(input.date ?? null);
  const limit = adminPlacesLimitSchema.parse(input.limit);
  const offset = adminPlacesOffsetSchema.parse(input.offset ?? 0);
  const sort = adminPlacesSortSchema.parse(input.sort ?? "created");
  const rows = await executor<AdminPlaceRow[]>`
    select
      p.id::text as id,
      p.name,
      i.image_url as "imageUrl",
      i.image_alt_text as "imageAltText",
      p.created_at as "createdAt",
      p.updated_at as "updatedAt",
      count(*) over()::int as "totalCount"
    from places p
    left join lateral (
      select
        (array_agg(url order by is_primary desc, sort_order asc, created_at asc))[1] as image_url,
        (array_agg(alt_text order by is_primary desc, sort_order asc, created_at asc))[1] as image_alt_text
      from place_images
      where place_id = p.id
        and status = 'active'
    ) i on true
    where (${date}::date is null or (p.created_at at time zone 'Asia/Seoul')::date = ${date}::date)
    order by
      case when ${sort} = 'updated' then p.updated_at else p.created_at end desc,
      p.id desc
    limit ${limit}
    offset ${offset}
  `;

  return { items: rows.map(adminPlaceFromRow), totalCount: numberValue(rows[0]?.totalCount) };
}

export async function getAdminPlacesTotalCount(executor: SqlExecutor = pg) {
  const rows = await executor<AdminPlacesTotalRow[]>`
    select count(*)::int as "totalCount"
    from places
  `;

  return { totalCount: numberValue(rows[0]?.totalCount) };
}

export async function listAdminPlaceDayCounts(input: { month?: string | null } = {}, executor: SqlExecutor = pg) {
  const month = adminPlacesMonthSchema.parse(input.month ?? null) ?? currentKoreaMonth();
  const rows = await executor<AdminPlaceDayRow[]>`
    select
      (created_at at time zone 'Asia/Seoul')::date::text as date,
      count(*)::int as count
    from places
    where date_trunc('month', created_at at time zone 'Asia/Seoul')::date = ${`${month}-01`}::date
    group by date
    order by date asc
  `;

  return { items: rows.map((row) => ({ count: numberValue(row.count), date: row.date })) };
}

export async function getAdminPlacesSummary(executor: SqlExecutor = pg): Promise<AdminPlacesSummary> {
  const rows = await executor<AdminPlacesSummaryRow[]>`
    select
      count(*)::int as "totalCount",
      count(*) filter (where status = 'active')::int as "activeCount",
      count(*) filter (where status = 'temporarily_closed')::int as "temporaryClosedCount",
      count(*) filter (
        where exists (
          select 1
          from place_sources s
          where s.place_id = places.id
        )
      )::int as "sourceBackedCount"
    from places
  `;

  return {
    activeCount: numberValue(rows[0]?.activeCount),
    sourceBackedCount: numberValue(rows[0]?.sourceBackedCount),
    temporaryClosedCount: numberValue(rows[0]?.temporaryClosedCount),
    totalCount: numberValue(rows[0]?.totalCount)
  };
}

function adminPlaceFromRow(row: AdminPlaceRow): AdminPlaceItem {
  return {
    id: row.id,
    name: row.name,
    imageAltText: row.imageAltText,
    imageUrl: row.imageUrl,
    createdAt: dateTimeString(row.createdAt),
    updatedAt: dateTimeString(row.updatedAt)
  };
}

function dateTimeString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function numberValue(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

function currentKoreaMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric"
  })
    .format(new Date())
    .slice(0, 7);
}
