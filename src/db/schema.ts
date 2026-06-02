import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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
export type RelatedPlaceRelationType = "nearby" | "same_building" | "same_site" | "parent_child" | "route_pair" | "itinerary_cluster";
export type UserChildGender = "boy" | "girl";
export type UserRole = "user" | "admin";
export type VisitVisibility = "public" | "private";
export type SavedPlaceFilter = "all" | "wantToGo" | "hearted";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    roleCheck: check("users_role_check", sql`${table.role} in ('user', 'admin')`)
  })
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: index("auth_sessions_user_id_idx").on(table.userId),
    tokenHashUnique: uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
    expiresAtIdx: index("auth_sessions_expires_at_idx").on(table.expiresAt)
  })
);

export const userSocialAccounts = pgTable(
  "user_social_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    providerEmail: text("provider_email"),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    providerCheck: check("user_social_accounts_provider_check", sql`${table.provider} in ('kakao', 'naver')`),
    providerUserUnique: uniqueIndex("user_social_accounts_provider_user_unique").on(table.provider, table.providerUserId),
    userProviderUnique: uniqueIndex("user_social_accounts_user_provider_unique").on(table.userId, table.provider),
    userIdx: index("user_social_accounts_user_id_idx").on(table.userId)
  })
);

export const userChildren = pgTable(
  "user_children",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    birthYearMonth: text("birth_year_month").notNull(),
    gender: text("gender").notNull().default("boy"),
    name: text("name"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userSortOrderIdx: index("user_children_user_sort_order_idx").on(table.userId, table.sortOrder),
    birthYearMonthCheck: check("user_children_birth_year_month_check", sql`${table.birthYearMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    genderCheck: check("user_children_gender_check", sql`${table.gender} in ('boy', 'girl')`),
    sortOrderCheck: check("user_children_sort_order_check", sql`${table.sortOrder} >= 0`)
  })
);

export const userHomeLocations = pgTable(
  "user_home_locations",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("home"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    addressText: text("address_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    latCheck: check("user_home_locations_lat_check", sql`${table.lat} between -90 and 90`),
    lngCheck: check("user_home_locations_lng_check", sql`${table.lng} between -180 and 180`)
  })
);

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
    countryCode: text("country_code"),
    countryName: text("country_name"),
    city: text("city"),
    locality: text("locality"),
    localCurrency: text("local_currency"),
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
    taxonomy: jsonb("taxonomy")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(
        sql`'{"schemaVersion":1,"sourceBacked":{"familyFitGates":[],"activityTypes":[],"visitUseCases":[],"ageBands":[],"accessTags":[],"logisticsTags":[],"riskTags":[]},"inferred":{"familyFitGates":[],"activityTypes":[],"visitUseCases":[],"ageBands":[],"accessTags":[],"logisticsTags":[],"riskTags":[]},"migration":{"legacyTags":[],"broadMappedTags":[],"unmappedTags":[]}}'::jsonb`
      ),
    pricing: jsonb("pricing")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    reviewSearchEvidence: jsonb("review_search_evidence")
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    routeSupport: jsonb("route_support")
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
    parkingFrictionLevel: text("parking_friction_level").notNull().default("unknown"),
    peakParkingWindow: text("peak_parking_window"),
    parkingWaitNote: text("parking_wait_note"),
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
    publicViewCount: integer("public_view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true })
  },
  (table) => ({
    primaryCategoryIdx: index("places_primary_category_idx").on(table.primaryCategory),
    taxonomyIdx: index("places_taxonomy_gin_idx").using("gin", table.taxonomy),
    routeSupportIdx: index("places_route_support_gin_idx").using("gin", table.routeSupport),
    regionIdx: index("places_region_idx").on(table.regionSido, table.regionSigungu),
    publicViewCountIdx: index("places_public_view_count_idx").on(table.publicViewCount),
    kakaoPlaceIdUnique: uniqueIndex("places_kakao_place_id_unique").on(table.kakaoPlaceId)
  })
);

export const placeViewDedupes = pgTable(
  "place_view_dedupes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    dedupeKind: text("dedupe_kind").notNull(),
    dedupeKeyHash: text("dedupe_key_hash").notNull(),
    lastCountedAt: timestamp("last_counted_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    kindCheck: check("place_view_dedupes_kind_check", sql`${table.dedupeKind} in ('user', 'device', 'ip')`),
    placeKeyUnique: uniqueIndex("place_view_dedupes_place_key_unique").on(table.placeId, table.dedupeKeyHash),
    placeExpiresAtIdx: index("place_view_dedupes_place_expires_at_idx").on(table.placeId, table.expiresAt)
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

export const placeVisits = pgTable(
  "place_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    visitedOn: date("visited_on").notNull(),
    rating: doublePrecision("rating").notNull(),
    reviewText: text("review_text"),
    visibility: text("visibility").notNull().default("public"),
    isRevisit: boolean("is_revisit").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userVisitedOnIdx: index("place_visits_user_visited_on_idx").on(table.userId, table.visitedOn),
    placeIdx: index("place_visits_place_id_idx").on(table.placeId),
    placeVisibilityIdx: index("place_visits_place_visibility_idx").on(table.placeId, table.visibility),
    ratingCheck: check("place_visits_rating_check", sql`${table.rating} between 0.5 and 5 and (${table.rating} * 2) = floor(${table.rating} * 2)`),
    visibilityCheck: check("place_visits_visibility_check", sql`${table.visibility} in ('public', 'private')`)
  })
);

export const placeVisitPhotos = pgTable(
  "place_visit_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id")
      .notNull()
      .references(() => placeVisits.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    visibility: text("visibility").notNull().default("public"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    visitIdx: index("place_visit_photos_visit_id_idx").on(table.visitId),
    userIdx: index("place_visit_photos_user_id_idx").on(table.userId),
    placeIdx: index("place_visit_photos_place_id_idx").on(table.placeId),
    storageKeyUnique: uniqueIndex("place_visit_photos_storage_key_unique").on(table.storageKey),
    visibilityCheck: check("place_visit_photos_visibility_check", sql`${table.visibility} in ('public', 'private')`),
    mimeTypeCheck: check("place_visit_photos_mime_type_check", sql`${table.mimeType} in ('image/jpeg', 'image/png', 'image/webp')`),
    byteSizeCheck: check("place_visit_photos_byte_size_check", sql`${table.byteSize} > 0 and ${table.byteSize} <= 10485760`),
    widthCheck: check("place_visit_photos_width_check", sql`${table.width} is null or ${table.width} > 0`),
    heightCheck: check("place_visit_photos_height_check", sql`${table.height} is null or ${table.height} > 0`)
  })
);

export const placePublicMemos = pgTable(
  "place_public_memos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userPlaceUnique: uniqueIndex("place_public_memos_user_place_unique").on(table.userId, table.placeId),
    placeUpdatedAtIdx: index("place_public_memos_place_updated_at_idx").on(table.placeId, table.updatedAt),
    userIdx: index("place_public_memos_user_id_idx").on(table.userId),
    bodyLengthCheck: check("place_public_memos_body_length_check", sql`length(trim(${table.body})) between 1 and 1000`)
  })
);

export const userPlaceSaves = pgTable(
  "user_place_saves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    wantToGo: boolean("want_to_go").notNull().default(false),
    hearted: boolean("hearted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userPlaceUnique: uniqueIndex("user_place_saves_user_place_unique").on(table.userId, table.placeId),
    userUpdatedAtIdx: index("user_place_saves_user_updated_at_idx").on(table.userId, table.updatedAt),
    placeHeartedIdx: index("user_place_saves_place_hearted_idx").on(table.placeId),
    activeStateCheck: check("user_place_saves_active_state_check", sql`${table.wantToGo} or ${table.hearted}`)
  })
);

export const userPlaceViews = pgTable(
  "user_place_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }).notNull().defaultNow(),
    viewCount: integer("view_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userPlaceUnique: uniqueIndex("user_place_views_user_place_unique").on(table.userId, table.placeId),
    userLastViewedAtIdx: index("user_place_views_user_last_viewed_at_idx").on(table.userId, table.lastViewedAt),
    placeIdx: index("user_place_views_place_id_idx").on(table.placeId),
    viewCountCheck: check("user_place_views_view_count_check", sql`${table.viewCount} > 0`)
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
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
export type UserSocialAccount = typeof userSocialAccounts.$inferSelect;
export type NewUserSocialAccount = typeof userSocialAccounts.$inferInsert;
export type UserChild = typeof userChildren.$inferSelect;
export type NewUserChild = typeof userChildren.$inferInsert;
export type UserHomeLocation = typeof userHomeLocations.$inferSelect;
export type NewUserHomeLocation = typeof userHomeLocations.$inferInsert;
export type PlaceSource = typeof placeSources.$inferSelect;
export type PlaceImage = typeof placeImages.$inferSelect;
export type PlaceRelatedPlace = typeof placeRelatedPlaces.$inferSelect;
export type PlaceVisit = typeof placeVisits.$inferSelect;
export type NewPlaceVisit = typeof placeVisits.$inferInsert;
export type PlaceVisitPhoto = typeof placeVisitPhotos.$inferSelect;
export type NewPlaceVisitPhoto = typeof placeVisitPhotos.$inferInsert;
export type PlaceVersion = typeof placeVersions.$inferSelect;
