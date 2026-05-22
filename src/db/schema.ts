import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export type TriState = "yes" | "no" | "partial" | "unknown";
export type IndoorType = "indoor" | "outdoor" | "mixed" | "unknown";
export type RelatedPlaceRelationType = "nearby" | "same_building" | "same_site" | "parent_child" | "route_pair";

export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug"),
    primaryCategory: text("primary_category").notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    description: text("description"),
    address: text("address"),
    roadAddress: text("road_address"),
    regionSido: text("region_sido"),
    regionSigungu: text("region_sigungu"),
    regionDong: text("region_dong"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    phone: text("phone"),
    officialUrl: text("official_url"),
    reservationUrl: text("reservation_url"),
    kakaoPlaceUrl: text("kakao_place_url"),
    kakaoPlaceId: text("kakao_place_id"),
    externalRefs: jsonb("external_refs")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    playFeatures: jsonb("play_features")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("active"),
    dataConfidence: text("data_confidence").notNull().default("unknown"),
    placeScore: doublePrecision("place_score"),
    placeScoreRationale: text("place_score_rationale"),
    externalRatingScore: doublePrecision("external_rating_score"),
    externalReviewCount: integer("external_review_count"),
    searchEvidenceScore: doublePrecision("search_evidence_score"),
    scoreSignals: jsonb("score_signals")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    scoreUpdatedAt: timestamp("score_updated_at", { withTimezone: true }),
    minRecommendedAgeMonths: integer("min_recommended_age_months"),
    maxRecommendedAgeMonths: integer("max_recommended_age_months"),
    indoorType: text("indoor_type").notNull().default("unknown"),
    strollerFriendly: text("stroller_friendly").notNull().default("unknown"),
    parkingAvailable: text("parking_available").notNull().default("unknown"),
    nursingRoom: text("nursing_room").notNull().default("unknown"),
    diaperChangingTable: text("diaper_changing_table").notNull().default("unknown"),
    kidsToilet: text("kids_toilet").notNull().default("unknown"),
    elevator: text("elevator").notNull().default("unknown"),
    babyChair: text("baby_chair").notNull().default("unknown"),
    foodAllowed: text("food_allowed").notNull().default("unknown"),
    reservationRequired: text("reservation_required").notNull().default("unknown"),
    walkInAvailable: text("walk_in_available").notNull().default("unknown"),
    sessionBased: text("session_based").notNull().default("unknown"),
    sameDayAvailabilityKnown: text("same_day_availability_known").notNull().default("unknown"),
    averageStayMinutes: integer("average_stay_minutes"),
    parentEffortLevel: integer("parent_effort_level"),
    childEngagementLevel: integer("child_engagement_level"),
    rainyDayScore: integer("rainy_day_score"),
    hotDayScore: integer("hot_day_score"),
    coldDayScore: integer("cold_day_score"),
    safetyNotes: text("safety_notes"),
    parentNotes: text("parent_notes"),
    openingHours: jsonb("opening_hours").$type<unknown>(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true })
  },
  (table) => ({
    primaryCategoryIdx: index("places_primary_category_idx").on(table.primaryCategory),
    regionIdx: index("places_region_idx").on(table.regionSido, table.regionSigungu),
    kakaoPlaceIdUnique: uniqueIndex("places_kakao_place_id_unique").on(table.kakaoPlaceId)
  })
);

export const placeSources = pgTable(
  "place_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    title: text("title"),
    url: text("url"),
    externalId: text("external_id"),
    summary: text("summary"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    placeIdx: index("place_sources_place_id_idx").on(table.placeId)
  })
);

export const placeImages = pgTable(
  "place_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    sourceId: uuid("source_id").references(() => placeSources.id, { onDelete: "set null" }),
    sourceType: text("source_type"),
    sourceTitle: text("source_title"),
    sourceUrl: text("source_url"),
    creditText: text("credit_text"),
    altText: text("alt_text"),
    description: text("description"),
    visualFeatures: text("visual_features")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    childSignals: jsonb("child_signals")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    displayTier: text("display_tier").notNull().default("unknown"),
    status: text("status").notNull().default("active"),
    reviewStatus: text("review_status").notNull().default("pending_review"),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    placeIdx: index("place_images_place_id_idx").on(table.placeId),
    sourceIdx: index("place_images_source_id_idx").on(table.sourceId),
    reviewStatusIdx: index("place_images_review_status_idx").on(table.reviewStatus),
    placeUrlUnique: uniqueIndex("place_images_place_url_unique").on(table.placeId, table.url)
  })
);

export const placeRelatedPlaces = pgTable(
  "place_related_places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    relatedPlaceId: uuid("related_place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull().default("nearby"),
    note: text("note"),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    placeIdx: index("place_related_places_place_id_idx").on(table.placeId),
    relatedPlaceIdx: index("place_related_places_related_place_id_idx").on(table.relatedPlaceId),
    pairUnique: uniqueIndex("place_related_places_pair_unique").on(table.placeId, table.relatedPlaceId)
  })
);

export const placeVersions = pgTable(
  "place_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    action: text("action").notNull(),
    actor: text("actor").notNull().default("agent"),
    changeSummary: text("change_summary"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    sources: jsonb("sources").$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    placeIdx: index("place_versions_place_id_idx").on(table.placeId),
    placeVersionUnique: uniqueIndex("place_versions_place_version_unique").on(table.placeId, table.versionNumber)
  })
);

export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type PlaceSource = typeof placeSources.$inferSelect;
export type PlaceImage = typeof placeImages.$inferSelect;
export type PlaceRelatedPlace = typeof placeRelatedPlaces.$inferSelect;
export type PlaceVersion = typeof placeVersions.$inferSelect;
