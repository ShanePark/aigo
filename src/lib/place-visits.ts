import { z } from "zod";
import type postgres from "postgres";

import { pg } from "@/db/client";
import { ApiError } from "@/lib/errors";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

const visitVisibilitySchema = z.enum(["public", "private"]);
const visitedOnSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "visitedOn must use YYYY-MM-DD");
const reviewTextSchema = z
  .string()
  .trim()
  .max(2000)
  .transform((value) => (value.length > 0 ? value : null))
  .nullable();

export const createPlaceVisitSchema = z.object({
  visitedOn: visitedOnSchema.optional(),
  rating: z.number().int().min(1).max(5),
  reviewText: reviewTextSchema.optional(),
  visibility: visitVisibilitySchema.default("public"),
  isRevisit: z.boolean().default(false)
});

export const updatePlaceVisitSchema = z
  .object({
    visitedOn: visitedOnSchema.optional(),
    rating: z.number().int().min(1).max(5).optional(),
    reviewText: reviewTextSchema.optional(),
    visibility: visitVisibilitySchema.optional(),
    isRevisit: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one visit field is required");

export type CreatePlaceVisitInput = z.infer<typeof createPlaceVisitSchema>;
export type UpdatePlaceVisitInput = z.infer<typeof updatePlaceVisitSchema>;

type VisitRow = {
  id: string;
  userId: string;
  placeId: string;
  visitedOn: string;
  rating: number;
  reviewText: string | null;
  visibility: "public" | "private";
  isRevisit: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  displayName?: string | null;
  photoCount?: number | string | null;
};

type VisitLogRow = VisitRow & {
  placeName: string;
  primaryCategory: string;
};

export type PlaceVisitItem = {
  id: string;
  placeId: string;
  visitedOn: string;
  rating: number | null;
  reviewText: string | null;
  visibility: "public" | "private";
  isRevisit: boolean | null;
  isMine: boolean;
  isPrivatePlaceholder: boolean;
  displayName: string | null;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MyVisitLogItem = PlaceVisitItem & {
  placeName: string;
  primaryCategory: string;
};

export async function listPlaceVisits(placeId: string, viewerUserId?: string | null, executor: SqlExecutor = pg) {
  await assertPlaceExists(placeId, executor);

  const [summaryRows, visitRows] = await Promise.all([
    executor<{ ratingCount: string; averageRating: string | null }[]>`
      select count(*)::text as "ratingCount", avg(rating)::text as "averageRating"
      from place_visits
      where place_id = ${placeId}
    `,
    executor<VisitRow[]>`
      select
        v.id::text as id,
        v.user_id::text as "userId",
        v.place_id::text as "placeId",
        v.visited_on::text as "visitedOn",
        v.rating,
        v.review_text as "reviewText",
        v.visibility,
        v.is_revisit as "isRevisit",
        v.created_at as "createdAt",
        v.updated_at as "updatedAt",
        u.display_name as "displayName",
        0::int as "photoCount"
      from place_visits v
      join users u on u.id = v.user_id
      where v.place_id = ${placeId}
      order by v.visited_on desc, v.created_at desc
    `
  ]);

  const summary = summaryRows[0] ?? { ratingCount: "0", averageRating: null };
  const items = visitRows.map((row) => placeVisitItemFromRow(row, viewerUserId));
  const myVisits = viewerUserId ? items.filter((item) => item.isMine) : [];

  return {
    summary: {
      averageRating: summary.averageRating ? Number(Number(summary.averageRating).toFixed(2)) : null,
      ratingCount: Number(summary.ratingCount)
    },
    hasVisited: myVisits.length > 0,
    myVisits,
    items
  };
}

export async function createPlaceVisit(placeId: string, userId: string, input: CreatePlaceVisitInput, executor: SqlExecutor = pg) {
  await assertPlaceExists(placeId, executor);

  const reviewText = input.reviewText ?? null;
  const rows = await executor<VisitRow[]>`
    insert into place_visits (user_id, place_id, visited_on, rating, review_text, visibility, is_revisit)
    values (
      ${userId},
      ${placeId},
      ${input.visitedOn ?? todaySeoulDate()},
      ${input.rating},
      ${reviewText},
      ${input.visibility},
      ${input.isRevisit}
    )
    returning
      id::text as id,
      user_id::text as "userId",
      place_id::text as "placeId",
      visited_on::text as "visitedOn",
      rating,
      review_text as "reviewText",
      visibility,
      is_revisit as "isRevisit",
      created_at as "createdAt",
      updated_at as "updatedAt",
      0::int as "photoCount"
  `;

  return { item: placeVisitItemFromRow(rows[0], userId) };
}

export async function updatePlaceVisit(visitId: string, userId: string, input: UpdatePlaceVisitInput, executor: SqlExecutor = pg) {
  const existingRows = await executor<{ id: string; userId: string }[]>`
    select id::text as id, user_id::text as "userId"
    from place_visits
    where id = ${visitId}
    limit 1
  `;
  const existing = existingRows[0];
  if (!existing) {
    throw new ApiError(404, "Visit not found");
  }
  if (existing.userId !== userId) {
    throw new ApiError(403, "Visit can only be updated by its owner");
  }

  const rows = await executor<VisitRow[]>`
    update place_visits
    set
      visited_on = coalesce(${input.visitedOn ?? null}, visited_on),
      rating = coalesce(${input.rating ?? null}, rating),
      review_text = case when ${input.reviewText === undefined} then review_text else ${input.reviewText ?? null} end,
      visibility = coalesce(${input.visibility ?? null}, visibility),
      is_revisit = coalesce(${input.isRevisit ?? null}, is_revisit),
      updated_at = now()
    where id = ${visitId}
    returning
      id::text as id,
      user_id::text as "userId",
      place_id::text as "placeId",
      visited_on::text as "visitedOn",
      rating,
      review_text as "reviewText",
      visibility,
      is_revisit as "isRevisit",
      created_at as "createdAt",
      updated_at as "updatedAt",
      0::int as "photoCount"
  `;

  return { item: placeVisitItemFromRow(rows[0], userId) };
}

export async function listMyVisitLog(userId: string, executor: SqlExecutor = pg) {
  const rows = await executor<VisitLogRow[]>`
    select
      v.id::text as id,
      v.user_id::text as "userId",
      v.place_id::text as "placeId",
      v.visited_on::text as "visitedOn",
      v.rating,
      v.review_text as "reviewText",
      v.visibility,
      v.is_revisit as "isRevisit",
      v.created_at as "createdAt",
      v.updated_at as "updatedAt",
      p.name as "placeName",
      p.primary_category as "primaryCategory",
      0::int as "photoCount"
    from place_visits v
    join places p on p.id = v.place_id
    where v.user_id = ${userId}
    order by v.visited_on desc, v.created_at desc
  `;

  return { groups: groupMyVisitLogRows(rows) };
}

export function placeVisitItemFromRow(row: VisitRow, viewerUserId?: string | null): PlaceVisitItem {
  const isMine = row.userId === viewerUserId;
  const isPrivatePlaceholder = row.visibility === "private" && !isMine;

  return {
    id: row.id,
    placeId: row.placeId,
    visitedOn: row.visitedOn,
    rating: isPrivatePlaceholder ? null : Number(row.rating),
    reviewText: isPrivatePlaceholder ? null : row.reviewText,
    visibility: row.visibility,
    isRevisit: isPrivatePlaceholder ? null : row.isRevisit,
    isMine,
    isPrivatePlaceholder,
    displayName: isPrivatePlaceholder ? null : row.displayName ?? null,
    photoCount: isPrivatePlaceholder ? 0 : Number(row.photoCount ?? 0),
    createdAt: dateTimeString(row.createdAt),
    updatedAt: dateTimeString(row.updatedAt)
  };
}

export function groupMyVisitLogRows(rows: VisitLogRow[]) {
  const groups = new Map<string, MyVisitLogItem[]>();

  for (const row of rows) {
    const item = {
      ...placeVisitItemFromRow(row, row.userId),
      placeName: row.placeName,
      primaryCategory: row.primaryCategory
    };
    const items = groups.get(row.visitedOn) ?? [];
    items.push(item);
    groups.set(row.visitedOn, items);
  }

  return Array.from(groups.entries()).map(([visitedOn, items]) => ({ visitedOn, items }));
}

function todaySeoulDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric"
  }).format(now);
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
