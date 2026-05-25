import { z } from "zod";
import type postgres from "postgres";

import { pg } from "@/db/client";
import { ApiError } from "@/lib/errors";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

export const updatePlaceSaveSchema = z
  .object({
    wantToGo: z.boolean().optional(),
    hearted: z.boolean().optional()
  })
  .refine((value) => value.wantToGo !== undefined || value.hearted !== undefined, "At least one save state is required");

export const savedPlacesFilterSchema = z.enum(["all", "wantToGo", "hearted"]).default("all");

export type UpdatePlaceSaveInput = z.infer<typeof updatePlaceSaveSchema>;
export type SavedPlacesFilter = z.infer<typeof savedPlacesFilterSchema>;

type SaveStateRow = {
  placeId: string;
  wantToGo: boolean;
  hearted: boolean;
  heartCount: number | string;
  updatedAt: Date | string | null;
};

type SavedPlaceRow = SaveStateRow & {
  placeName: string;
  primaryCategory: string;
  imageUrl: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
};

export type PlaceSaveState = {
  placeId: string;
  wantToGo: boolean;
  hearted: boolean;
  heartCount: number;
  updatedAt: string | null;
};

export type SavedPlaceItem = PlaceSaveState & {
  placeName: string;
  primaryCategory: string;
  imageUrl: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
};

export async function getPlaceSaveState(placeId: string, userId: string, executor: SqlExecutor = pg) {
  await assertPlaceExists(placeId, executor);
  return { item: await placeSaveStateForUser(placeId, userId, executor) };
}

export async function updatePlaceSaveState(placeId: string, userId: string, input: UpdatePlaceSaveInput, executor: SqlExecutor = pg) {
  await assertPlaceExists(placeId, executor);
  const current = await readUserPlaceSave(placeId, userId, executor);
  const next = {
    wantToGo: input.wantToGo ?? current?.wantToGo ?? false,
    hearted: input.hearted ?? current?.hearted ?? false
  };

  if (!next.wantToGo && !next.hearted) {
    await executor`
      delete from user_place_saves
      where user_id = ${userId}
        and place_id = ${placeId}
    `;
    return { item: await placeSaveStateForUser(placeId, userId, executor) };
  }

  await executor`
    insert into user_place_saves (user_id, place_id, want_to_go, hearted)
    values (${userId}, ${placeId}, ${next.wantToGo}, ${next.hearted})
    on conflict (user_id, place_id)
    do update set
      want_to_go = excluded.want_to_go,
      hearted = excluded.hearted,
      updated_at = now()
  `;

  return { item: await placeSaveStateForUser(placeId, userId, executor) };
}

export async function listSavedPlaces(userId: string, filter: SavedPlacesFilter = "all", executor: SqlExecutor = pg) {
  const rows = await executor<SavedPlaceRow[]>`
    with heart_counts as (
      select place_id, count(*)::int as "heartCount"
      from user_place_saves
      where hearted
      group by place_id
    )
    select
      s.place_id::text as "placeId",
      s.want_to_go as "wantToGo",
      s.hearted,
      coalesce(h."heartCount", 0)::int as "heartCount",
      s.updated_at as "updatedAt",
      p.name as "placeName",
      p.primary_category as "primaryCategory",
      p.region_sido as "regionSido",
      p.region_sigungu as "regionSigungu",
      img.url as "imageUrl"
    from user_place_saves s
    join places p on p.id = s.place_id
    left join heart_counts h on h.place_id = s.place_id
    left join lateral (
      select url
      from place_images
      where place_id = p.id
        and status = 'active'
      order by is_primary desc, display_tier asc nulls last, created_at asc
      limit 1
    ) img on true
    where s.user_id = ${userId}
      and (${filter} = 'all' or (${filter} = 'wantToGo' and s.want_to_go) or (${filter} = 'hearted' and s.hearted))
    order by s.updated_at desc, s.created_at desc
  `;

  return { items: rows.map(savedPlaceItemFromRow) };
}

export function placeSaveStateFromRow(row: SaveStateRow | null | undefined, placeId: string): PlaceSaveState {
  return {
    placeId,
    wantToGo: row?.wantToGo ?? false,
    hearted: row?.hearted ?? false,
    heartCount: numberValue(row?.heartCount),
    updatedAt: row?.updatedAt ? dateTimeString(row.updatedAt) : null
  };
}

function savedPlaceItemFromRow(row: SavedPlaceRow): SavedPlaceItem {
  return {
    ...placeSaveStateFromRow(row, row.placeId),
    placeName: row.placeName,
    primaryCategory: row.primaryCategory,
    imageUrl: row.imageUrl,
    regionSido: row.regionSido,
    regionSigungu: row.regionSigungu
  };
}

async function readUserPlaceSave(placeId: string, userId: string, executor: SqlExecutor) {
  const rows = await executor<Array<{ wantToGo: boolean; hearted: boolean }>>`
    select want_to_go as "wantToGo", hearted
    from user_place_saves
    where user_id = ${userId}
      and place_id = ${placeId}
    limit 1
  `;

  return rows[0] ?? null;
}

async function placeSaveStateForUser(placeId: string, userId: string, executor: SqlExecutor) {
  const rows = await executor<SaveStateRow[]>`
    with heart_count as (
      select count(*)::int as "heartCount"
      from user_place_saves
      where place_id = ${placeId}
        and hearted
    )
    select
      ${placeId}::uuid::text as "placeId",
      coalesce(s.want_to_go, false) as "wantToGo",
      coalesce(s.hearted, false) as "hearted",
      h."heartCount",
      s.updated_at as "updatedAt"
    from heart_count h
    left join user_place_saves s on s.user_id = ${userId}
      and s.place_id = ${placeId}
  `;

  return placeSaveStateFromRow(rows[0], placeId);
}

async function assertPlaceExists(placeId: string, executor: SqlExecutor) {
  const rows = await executor<{ id: string }[]>`
    select id::text as id
    from places
    where id = ${placeId}
    limit 1
  `;
  if (!rows[0]) {
    throw new ApiError(404, "Place not found");
  }
}

function numberValue(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function dateTimeString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}
