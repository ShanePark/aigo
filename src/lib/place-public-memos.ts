import { z } from "zod";
import type postgres from "postgres";

import { pg } from "@/db/client";
import { ApiError } from "@/lib/errors";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

const memoBodySchema = z.string().trim().min(1).max(1000);

export const createPlacePublicMemoSchema = z.object({
  body: memoBodySchema
});

export const updatePlacePublicMemoSchema = z.object({
  body: memoBodySchema
});

export type CreatePlacePublicMemoInput = z.infer<typeof createPlacePublicMemoSchema>;
export type UpdatePlacePublicMemoInput = z.infer<typeof updatePlacePublicMemoSchema>;

type PublicMemoRow = {
  id: string;
  userId: string;
  placeId: string;
  body: string;
  displayName: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type PlacePublicMemoItem = {
  id: string;
  userId: string;
  placeId: string;
  body: string;
  displayName: string | null;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function listPlacePublicMemos(placeId: string, viewerUserId?: string | null, executor: SqlExecutor = pg) {
  await assertPlaceExists(placeId, executor);
  const viewerId = viewerUserId ?? null;
  const rows = await executor<PublicMemoRow[]>`
    select
      m.id::text as id,
      m.user_id::text as "userId",
      m.place_id::text as "placeId",
      m.body,
      null::text as "displayName",
      m.created_at as "createdAt",
      m.updated_at as "updatedAt"
    from place_public_memos m
    where m.place_id = ${placeId}
    order by (m.user_id = ${viewerId}) desc, m.updated_at desc, m.created_at desc
  `;

  return { items: rows.map((row) => placePublicMemoItemFromRow(row, viewerUserId)) };
}

export async function upsertPlacePublicMemo(placeId: string, userId: string, input: CreatePlacePublicMemoInput, executor: SqlExecutor = pg) {
  await assertPlaceExists(placeId, executor);
  const rows = await executor<PublicMemoRow[]>`
    insert into place_public_memos (user_id, place_id, body)
    values (${userId}, ${placeId}, ${input.body})
    on conflict (user_id, place_id)
    do update set
      body = excluded.body,
      updated_at = now()
    returning
      id::text as id,
      user_id::text as "userId",
      place_id::text as "placeId",
      body,
      null::text as "displayName",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  return { item: placePublicMemoItemFromRow(rows[0], userId) };
}

export async function updatePlacePublicMemo(memoId: string, userId: string, input: UpdatePlacePublicMemoInput, executor: SqlExecutor = pg) {
  const existing = await findMemoOwner(memoId, executor);
  if (!existing) {
    throw new ApiError(404, "Place memo not found");
  }
  if (existing.userId !== userId) {
    throw new ApiError(403, "Place memo can only be updated by its owner");
  }

  const rows = await executor<PublicMemoRow[]>`
    update place_public_memos
    set
      body = ${input.body},
      updated_at = now()
    where id = ${memoId}
    returning
      id::text as id,
      user_id::text as "userId",
      place_id::text as "placeId",
      body,
      null::text as "displayName",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  return { item: placePublicMemoItemFromRow(rows[0], userId) };
}

export async function deletePlacePublicMemo(memoId: string, userId: string, executor: SqlExecutor = pg) {
  const existing = await findMemoOwner(memoId, executor);
  if (!existing) {
    throw new ApiError(404, "Place memo not found");
  }
  if (existing.userId !== userId) {
    throw new ApiError(403, "Place memo can only be deleted by its owner");
  }

  await executor`
    delete from place_public_memos
    where id = ${memoId}
  `;

  return { deleted: true };
}

export function placePublicMemoItemFromRow(row: PublicMemoRow, viewerUserId?: string | null): PlacePublicMemoItem {
  return {
    id: row.id,
    userId: row.userId,
    placeId: row.placeId,
    body: row.body,
    displayName: null,
    isMine: row.userId === viewerUserId,
    createdAt: dateTimeString(row.createdAt),
    updatedAt: dateTimeString(row.updatedAt)
  };
}

async function findMemoOwner(memoId: string, executor: SqlExecutor) {
  const rows = await executor<{ userId: string }[]>`
    select user_id::text as "userId"
    from place_public_memos
    where id = ${memoId}
    limit 1
  `;
  return rows[0] ?? null;
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

function dateTimeString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}
