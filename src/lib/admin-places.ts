import type postgres from "postgres";
import { z } from "zod";

import { pg } from "@/db/client";
import { scorePlaceIntrinsic } from "@/lib/scoring";
import { emptyPlaceTaxonomy, type PlaceTaxonomy } from "@/lib/taxonomy";

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
  babyChair: string;
  childEngagementLevel: number | string | null;
  coldDayScore: number | string | null;
  dataConfidence: string;
  description: string | null;
  diaperChangingTable: string;
  elevator: string;
  externalRatingScore: number | string | null;
  externalReviewCount: number | string | null;
  foodAllowed: string;
  hotDayScore: number | string | null;
  id: string;
  indoorType: string;
  kidsToilet: string;
  maxRecommendedAgeMonths: number | string | null;
  minRecommendedAgeMonths: number | string | null;
  name: string;
  nursingRoom: string;
  openingHours: unknown | null;
  parentNotes: string | null;
  parentEffortLevel: number | string | null;
  parkingAvailable: string;
  primaryCategory: string;
  pricing: Record<string, unknown> | null;
  playFeatures: Record<string, unknown> | null;
  rainyDayScore: number | string | null;
  safetyNotes: string | null;
  scoreSignals: Record<string, unknown> | null;
  scoreUpdatedAt: Date | string | null;
  searchEvidenceScore: number | string | null;
  strollerFriendly: string;
  tags: string[] | null;
  placeScore: number | string | null;
  placeScoreRationale: string | null;
  taxonomy: PlaceTaxonomy | null;
  averageStayMinutes: number | string | null;
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
  description: string | null;
  id: string;
  name: string;
  parentNotes: string | null;
  primaryCategory: string;
  safetyNotes: string | null;
  tags: string[];
  placeScore: number | null;
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
      p.primary_category as "primaryCategory",
      p.tags,
      p.description,
      p.parent_notes as "parentNotes",
      p.safety_notes as "safetyNotes",
      p.place_score as "placeScore",
      p.place_score_rationale as "placeScoreRationale",
      p.external_rating_score as "externalRatingScore",
      p.external_review_count as "externalReviewCount",
      p.search_evidence_score as "searchEvidenceScore",
      p.score_signals as "scoreSignals",
      p.score_updated_at as "scoreUpdatedAt",
      p.data_confidence as "dataConfidence",
      p.min_recommended_age_months as "minRecommendedAgeMonths",
      p.max_recommended_age_months as "maxRecommendedAgeMonths",
      p.indoor_type as "indoorType",
      p.stroller_friendly as "strollerFriendly",
      p.parking_available as "parkingAvailable",
      p.nursing_room as "nursingRoom",
      p.diaper_changing_table as "diaperChangingTable",
      p.kids_toilet as "kidsToilet",
      p.elevator,
      p.baby_chair as "babyChair",
      p.food_allowed as "foodAllowed",
      p.opening_hours as "openingHours",
      p.average_stay_minutes as "averageStayMinutes",
      p.parent_effort_level as "parentEffortLevel",
      p.child_engagement_level as "childEngagementLevel",
      p.rainy_day_score as "rainyDayScore",
      p.hot_day_score as "hotDayScore",
      p.cold_day_score as "coldDayScore",
      p.play_features as "playFeatures",
      p.taxonomy,
      p.pricing,
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
  const placeScore = scorePlaceIntrinsic({
    primaryCategory: row.primaryCategory,
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
    dataConfidence: row.dataConfidence,
    minRecommendedAgeMonths: nullableNumberValue(row.minRecommendedAgeMonths),
    maxRecommendedAgeMonths: nullableNumberValue(row.maxRecommendedAgeMonths),
    indoorType: row.indoorType,
    parkingAvailable: row.parkingAvailable,
    strollerFriendly: row.strollerFriendly,
    nursingRoom: row.nursingRoom,
    diaperChangingTable: row.diaperChangingTable,
    kidsToilet: row.kidsToilet,
    elevator: row.elevator,
    babyChair: row.babyChair,
    foodAllowed: row.foodAllowed,
    openingHours: row.openingHours,
    pricing: row.pricing ?? {},
    playFeatures: row.playFeatures ?? {},
    taxonomy: row.taxonomy ?? emptyPlaceTaxonomy(),
    scoring: {
      placeScore: nullableNumberValue(row.placeScore),
      placeScoreRationale: row.placeScoreRationale,
      externalRatingScore: nullableNumberValue(row.externalRatingScore),
      externalReviewCount: nullableNumberValue(row.externalReviewCount),
      searchEvidenceScore: nullableNumberValue(row.searchEvidenceScore),
      scoreSignals: row.scoreSignals ?? {},
      scoreUpdatedAt: row.scoreUpdatedAt ? dateTimeString(row.scoreUpdatedAt) : null
    },
    visit: {
      averageStayMinutes: nullableNumberValue(row.averageStayMinutes),
      parentEffortLevel: nullableNumberValue(row.parentEffortLevel),
      childEngagementLevel: nullableNumberValue(row.childEngagementLevel),
      rainyDayScore: nullableNumberValue(row.rainyDayScore),
      hotDayScore: nullableNumberValue(row.hotDayScore),
      coldDayScore: nullableNumberValue(row.coldDayScore)
    }
  }).score;

  return {
    description: row.description,
    id: row.id,
    name: row.name,
    parentNotes: row.parentNotes,
    primaryCategory: row.primaryCategory,
    safetyNotes: row.safetyNotes,
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
    placeScore,
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

function nullableNumberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
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
