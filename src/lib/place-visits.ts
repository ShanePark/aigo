import { z } from "zod";
import type postgres from "postgres";

import { pg } from "@/db/client";
import { ApiError } from "@/lib/errors";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

const visitVisibilitySchema = z.enum(["public", "private"]);
const reviewTextSchema = z
  .string()
  .trim()
  .max(2000)
  .transform((value) => (value.length > 0 ? value : null))
  .nullable();

export const createPlaceVisitSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: reviewTextSchema.optional(),
  visibility: visitVisibilitySchema.default("public")
});

export const updatePlaceVisitSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    reviewText: reviewTextSchema.optional(),
    visibility: visitVisibilitySchema.optional()
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

export type PlaceVisitSummary = {
  averageRating: number | null;
  ratingCount: number;
  publicReviewCount: number;
  publicPhotoCount: number;
  latestVisitedOn: string | null;
};

type PlaceVisitSummaryRow = {
  placeId: string;
  averageRating: string | null;
  ratingCount: number | string;
  publicReviewCount: number | string;
  publicPhotoCount: number | string;
  latestVisitedOn: string | null;
};

export async function listPlaceVisits(placeId: string, viewerUserId?: string | null, executor: SqlExecutor = pg) {
  await assertPlaceExists(placeId, executor);
  const viewerId = viewerUserId ?? null;

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
        count(ph.id)::int as "photoCount"
      from place_visits v
      join users u on u.id = v.user_id
      left join place_visit_photos ph on ph.visit_id = v.id and ((v.visibility = 'public' and ph.visibility = 'public') or ph.user_id = ${viewerId})
      where v.place_id = ${placeId}
      group by v.id, u.display_name
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

export async function listPlaceVisitSummaries(placeIds: string[], executor: SqlExecutor = pg) {
  const uniquePlaceIds = Array.from(new Set(placeIds.filter(Boolean)));
  const summaries = new Map<string, PlaceVisitSummary>();
  if (uniquePlaceIds.length === 0) return summaries;

  const rows = await executor<PlaceVisitSummaryRow[]>`
    with visit_summary as (
      select
        place_id,
        count(*)::int as "ratingCount",
        avg(rating)::text as "averageRating",
        count(*) filter (
          where visibility = 'public'
            and review_text is not null
            and length(trim(review_text)) > 0
        )::int as "publicReviewCount",
        max(visited_on)::text as "latestVisitedOn"
      from place_visits
      where place_id = any(${uniquePlaceIds}::uuid[])
      group by place_id
    ),
    photo_summary as (
      select
        ph.place_id,
        count(*) filter (where ph.visibility = 'public' and v.visibility = 'public')::int as "publicPhotoCount"
      from place_visit_photos ph
      join place_visits v on v.id = ph.visit_id
      where ph.place_id = any(${uniquePlaceIds}::uuid[])
      group by ph.place_id
    )
    select
      v.place_id::text as "placeId",
      v."averageRating",
      v."ratingCount",
      v."publicReviewCount",
      coalesce(p."publicPhotoCount", 0)::int as "publicPhotoCount",
      v."latestVisitedOn"
    from visit_summary v
    left join photo_summary p on p.place_id = v.place_id
  `;

  for (const row of rows) {
    summaries.set(row.placeId, placeVisitSummaryFromRow(row));
  }

  return summaries;
}

export async function createPlaceVisit(placeId: string, userId: string, input: CreatePlaceVisitInput, executor: SqlExecutor = pg) {
  await assertPlaceExists(placeId, executor);

  const reviewText = input.reviewText ?? null;
  const rows = await executor<VisitRow[]>`
    insert into place_visits (user_id, place_id, visited_on, rating, review_text, visibility, is_revisit)
    values (
      ${userId},
      ${placeId},
      ${todaySeoulDate()},
      ${input.rating},
      ${reviewText},
      ${input.visibility},
      exists (
        select 1
        from place_visits existing
        where existing.user_id = ${userId}
          and existing.place_id = ${placeId}
      )
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
      rating = coalesce(${input.rating ?? null}, rating),
      review_text = case when ${input.reviewText === undefined} then review_text else ${input.reviewText ?? null} end,
      visibility = coalesce(${input.visibility ?? null}, visibility),
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

  if (input.visibility === "private") {
    await executor`
      update place_visit_photos
      set visibility = 'private'
      where visit_id = ${visitId}
        and visibility <> 'private'
    `;
  }

  const photoCountRows = await executor<{ photoCount: number | string }[]>`
    select count(*)::int as "photoCount"
    from place_visit_photos
    where visit_id = ${visitId}
  `;

  return { item: placeVisitItemFromRow({ ...rows[0], photoCount: photoCountRows[0]?.photoCount ?? 0 }, userId) };
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
      count(ph.id)::int as "photoCount"
    from place_visits v
    join places p on p.id = v.place_id
    left join place_visit_photos ph on ph.visit_id = v.id
    where v.user_id = ${userId}
    group by v.id, p.name, p.primary_category
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

export function placeVisitSummaryFromRow(row: PlaceVisitSummaryRow): PlaceVisitSummary {
  return {
    averageRating: row.averageRating ? Number(Number(row.averageRating).toFixed(2)) : null,
    ratingCount: Number(row.ratingCount),
    publicReviewCount: Number(row.publicReviewCount),
    publicPhotoCount: Number(row.publicPhotoCount),
    latestVisitedOn: row.latestVisitedOn
  };
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
