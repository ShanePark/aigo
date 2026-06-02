import { createHash } from "node:crypto";
import { z } from "zod";
import type postgres from "postgres";

import { pg } from "@/db/client";
import { ApiError } from "@/lib/errors";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;
type PublicPlaceViewDedupeKind = "user" | "device" | "ip";

const PUBLIC_PLACE_VIEW_DEDUPE_SECONDS = 60 * 60 * 24;
const publicPlaceViewDedupeSalt = process.env.AIGO_VIEW_DEDUPE_SALT ?? "aigo-public-place-view-dedupe";

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

type PublicPlaceViewCountRow = {
  publicViewCount: number | string;
};

export type PlaceViewState = {
  placeId: string;
  lastViewedAt: string;
  viewCount: number;
};

export type PublicPlaceViewKey = {
  kind: PublicPlaceViewDedupeKind;
  value: string;
};

export type PublicPlaceViewState = {
  counted: boolean;
  placeId: string;
  publicViewCount: number;
};

export type RecentPlaceItem = PlaceViewState & {
  placeName: string;
  primaryCategory: string;
  imageUrl: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
};

export async function recordPublicPlaceView(placeId: string, keys: PublicPlaceViewKey[], executor: SqlExecutor = pg): Promise<{ item: PublicPlaceViewState }> {
  await assertActivePlaceExists(placeId, executor);
  const dedupeKeys = uniquePublicPlaceViewKeys(keys);

  if (dedupeKeys.length === 0) {
    return {
      item: {
        counted: false,
        placeId,
        publicViewCount: await readPublicPlaceViewCount(placeId, executor)
      }
    };
  }

  const kinds = dedupeKeys.map((key) => key.kind);
  const hashes = dedupeKeys.map((key) => publicPlaceViewKeyHash(key));
  const upsertRows = await executor<Array<{ upsertedCount: number | string }>>`
    with incoming as (
      select *
      from unnest(${kinds}::text[], ${hashes}::text[]) as t(dedupe_kind, dedupe_key_hash)
    ),
    upserted as (
      insert into place_view_dedupes (place_id, dedupe_kind, dedupe_key_hash, last_counted_at, expires_at)
      select
        ${placeId},
        incoming.dedupe_kind,
        incoming.dedupe_key_hash,
        now(),
        now() + make_interval(secs => ${PUBLIC_PLACE_VIEW_DEDUPE_SECONDS})
      from incoming
      on conflict (place_id, dedupe_key_hash)
      do update set
        dedupe_kind = excluded.dedupe_kind,
        last_counted_at = excluded.last_counted_at,
        expires_at = excluded.expires_at,
        updated_at = now()
      where place_view_dedupes.expires_at <= now()
      returning id
    )
    select count(*)::int as "upsertedCount"
    from upserted
  `;
  const counted = numberValue(upsertRows[0]?.upsertedCount ?? 0) === dedupeKeys.length;

  if (!counted) {
    return {
      item: {
        counted: false,
        placeId,
        publicViewCount: await readPublicPlaceViewCount(placeId, executor)
      }
    };
  }

  const rows = await executor<PublicPlaceViewCountRow[]>`
    update places
    set public_view_count = public_view_count + 1
    where id = ${placeId}
      and status = 'active'
    returning public_view_count as "publicViewCount"
  `;

  return {
    item: {
      counted: true,
      placeId,
      publicViewCount: numberValue(rows[0]?.publicViewCount ?? 0)
    }
  };
}

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

export async function readPublicPlaceViewCount(placeId: string, executor: SqlExecutor = pg) {
  const rows = await executor<PublicPlaceViewCountRow[]>`
    select public_view_count as "publicViewCount"
    from places
    where id = ${placeId}
      and status = 'active'
    limit 1
  `;
  if (!rows[0]) {
    throw new ApiError(404, "Place not found");
  }

  return numberValue(rows[0].publicViewCount);
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

function uniquePublicPlaceViewKeys(keys: PublicPlaceViewKey[]) {
  const uniqueKeys = new Map<string, PublicPlaceViewKey>();
  for (const key of keys) {
    const value = key.value.trim();
    if (!value) continue;
    uniqueKeys.set(`${key.kind}:${value}`, { kind: key.kind, value });
  }
  return Array.from(uniqueKeys.values());
}

function publicPlaceViewKeyHash(key: PublicPlaceViewKey) {
  return createHash("sha256").update(publicPlaceViewDedupeSalt).update(":").update(key.kind).update(":").update(key.value).digest("hex");
}
