import { z } from "zod";
import type postgres from "postgres";

import { pg } from "@/db/client";
import { ApiError } from "@/lib/errors";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

export const recentPlacesLimitSchema = z.coerce.number().int().min(1).max(100).default(30);

type PlaceViewRow = {
  placeId: string;
  lastViewedAt: Date | string;
  viewCount: number | string;
};

type RecentPlaceRow = PlaceViewRow & {
  placeName: string;
  primaryCategory: string;
  imageUrl: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
};

export type PlaceViewState = {
  placeId: string;
  lastViewedAt: string;
  viewCount: number;
};

export type RecentPlaceItem = PlaceViewState & {
  placeName: string;
  primaryCategory: string;
  imageUrl: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
};

export async function recordPlaceView(placeId: string, userId: string, executor: SqlExecutor = pg) {
  await assertActivePlaceExists(placeId, executor);
  const rows = await executor<PlaceViewRow[]>`
    insert into user_place_views (user_id, place_id)
    values (${userId}, ${placeId})
    on conflict (user_id, place_id)
    do update set
      last_viewed_at = now(),
      view_count = user_place_views.view_count + 1,
      updated_at = now()
    returning
      place_id::text as "placeId",
      last_viewed_at as "lastViewedAt",
      view_count as "viewCount"
  `;

  return { item: placeViewStateFromRow(rows[0]) };
}

export async function listRecentPlaces(userId: string, limit = 30, executor: SqlExecutor = pg) {
  const safeLimit = recentPlacesLimitSchema.parse(limit);
  const rows = await executor<RecentPlaceRow[]>`
    select
      v.place_id::text as "placeId",
      v.last_viewed_at as "lastViewedAt",
      v.view_count as "viewCount",
      p.name as "placeName",
      p.primary_category as "primaryCategory",
      p.region_sido as "regionSido",
      p.region_sigungu as "regionSigungu",
      img.url as "imageUrl"
    from user_place_views v
    join places p on p.id = v.place_id
      and p.status = 'active'
    left join lateral (
      select url
      from place_images
      where place_id = p.id
        and status = 'active'
      order by is_primary desc, display_tier asc nulls last, created_at asc
      limit 1
    ) img on true
    where v.user_id = ${userId}
    order by v.last_viewed_at desc, v.created_at desc
    limit ${safeLimit}
  `;

  return { items: rows.map(recentPlaceItemFromRow) };
}

export function placeViewStateFromRow(row: PlaceViewRow): PlaceViewState {
  return {
    placeId: row.placeId,
    lastViewedAt: dateTimeString(row.lastViewedAt),
    viewCount: numberValue(row.viewCount)
  };
}

function recentPlaceItemFromRow(row: RecentPlaceRow): RecentPlaceItem {
  return {
    ...placeViewStateFromRow(row),
    placeName: row.placeName,
    primaryCategory: row.primaryCategory,
    imageUrl: row.imageUrl,
    regionSido: row.regionSido,
    regionSigungu: row.regionSigungu
  };
}

async function assertActivePlaceExists(placeId: string, executor: SqlExecutor) {
  const rows = await executor<{ id: string }[]>`
    select id::text as id
    from places
    where id = ${placeId}
      and status = 'active'
    limit 1
  `;
  if (!rows[0]) {
    throw new ApiError(404, "Place not found");
  }
}

function numberValue(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function dateTimeString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}
