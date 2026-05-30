import { z } from "zod";

import { normalizeRegionSido, normalizeSourceType, primaryCategories, sourceTypes, taxonomyFacetFamilies } from "@/lib/taxonomy";

export const triStateSchema = z.enum(["yes", "no", "partial", "unknown"]);
export const indoorTypeSchema = z.enum(["indoor", "outdoor", "mixed", "unknown"]);
export const parkingFrictionLevelSchema = z.enum(["low", "medium", "high", "unknown"]);
export const primaryCategorySchema = z.enum(primaryCategories);
export const sourceTypeSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  return normalizeSourceType(value) ?? value.trim();
}, z.enum(sourceTypes));
export const imageDisplayTierSchema = z.enum(["official", "public_agency", "public_listing", "rights_unclear", "unknown"]);
export const imageStatusSchema = z.enum(["active", "archived"]);
export const imageReviewStatusSchema = z.enum(["pending_review", "approved", "needs_review", "rejected"]);
export const relatedPlaceRelationTypeSchema = z.enum(["nearby", "same_building", "same_site", "parent_child", "route_pair", "itinerary_cluster"]);

const nonEmptyString = z.string().trim().min(1);
const urlString = z.string().trim().url();
const zeroToTenScore = z.number().min(0).max(10);
const regionSidoSchema = z.preprocess((value) => (typeof value === "string" ? normalizeRegionSido(value) : value), z.string().trim()).optional();
const currencyCodeSchema = z.enum(["KRW", "USD", "JPY", "PHP", "VND", "SGD", "MYR", "THB", "TWD", "HKD", "AUD", "EUR", "GBP"]);
const countryCodeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.string().regex(/^[A-Z]{2}$/, "countryCode must be an ISO 3166-1 alpha-2 code").optional()
);
const taxonomyFacetSetSchema = z.object({
  familyFitGates: z.array(z.enum(taxonomyFacetFamilies.familyFitGates)).default([]),
  activityTypes: z.array(z.enum(taxonomyFacetFamilies.activityTypes)).default([]),
  visitUseCases: z.array(z.enum(taxonomyFacetFamilies.visitUseCases)).default([]),
  ageBands: z.array(z.enum(taxonomyFacetFamilies.ageBands)).default([]),
  logisticsTags: z.array(z.enum(taxonomyFacetFamilies.logisticsTags)).default([]),
  riskTags: z.array(z.enum(taxonomyFacetFamilies.riskTags)).default([])
});
const searchTaxonomySchema = z.object({
  mode: z.enum(["soft", "required"]).default("soft"),
  familyFitGates: z.array(z.enum(taxonomyFacetFamilies.familyFitGates)).max(20).optional(),
  activityTypes: z.array(z.enum(taxonomyFacetFamilies.activityTypes)).max(20).optional(),
  visitUseCases: z.array(z.enum(taxonomyFacetFamilies.visitUseCases)).max(20).optional(),
  ageBands: z.array(z.enum(taxonomyFacetFamilies.ageBands)).max(20).optional(),
  logisticsTags: z.array(z.enum(taxonomyFacetFamilies.logisticsTags)).max(20).optional(),
  riskTags: z.array(z.enum(taxonomyFacetFamilies.riskTags)).max(20).optional()
});
const emptyTaxonomyFacetSetValue = () => ({
  familyFitGates: [],
  activityTypes: [],
  visitUseCases: [],
  ageBands: [],
  logisticsTags: [],
  riskTags: []
});

export const taxonomySchema = z.object({
  schemaVersion: z.literal(1).default(1),
  sourceBacked: taxonomyFacetSetSchema.default(emptyTaxonomyFacetSetValue),
  inferred: taxonomyFacetSetSchema
    .extend({
      confidence: z.enum(["high", "medium", "low"]).optional(),
      basis: z.string().trim().max(1000).optional()
    })
    .default(emptyTaxonomyFacetSetValue),
  migration: z
    .object({
      legacyTags: z.array(nonEmptyString).max(200).default([]),
      broadMappedTags: z.array(nonEmptyString).max(200).default([]),
      unmappedTags: z.array(nonEmptyString).max(200).default([]),
      normalizedAt: z.string().datetime({ offset: true }).optional()
    })
    .default(() => ({ legacyTags: [], broadMappedTags: [], unmappedTags: [] }))
});

export const playFeaturesSchema = z
  .object({
    slide: triStateSchema.optional(),
    swing: triStateSchema.optional(),
    babySwing: triStateSchema.optional(),
    waterPlayground: triStateSchema.optional(),
    sandPlay: triStateSchema.optional(),
    climbing: triStateSchema.optional(),
    seesaw: triStateSchema.optional(),
    trampoline: triStateSchema.optional(),
    rideOnToys: triStateSchema.optional(),
    playHouse: triStateSchema.optional(),
    openLawn: triStateSchema.optional(),
    shade: triStateSchema.optional(),
    fenced: triStateSchema.optional(),
    rubberSurface: triStateSchema.optional(),
    strollerPath: triStateSchema.optional(),
    toiletNearby: triStateSchema.optional(),
    notes: z.string().trim().max(5000).optional(),
    evidence: z
      .array(
        z.object({
          feature: nonEmptyString,
          value: triStateSchema.optional(),
          basis: z.string().trim().max(1000).optional(),
          sourceUrl: urlString.optional(),
          confidence: z.enum(["official", "visual_confirmed", "user_reported", "blog_supported", "needs_check", "unknown"]).optional()
        })
      )
      .max(50)
      .optional()
  })
  .catchall(z.unknown());

export const sourceSchema = z
  .object({
    sourceType: sourceTypeSchema,
    title: z.string().trim().optional(),
    url: urlString.optional(),
    externalId: z.string().trim().optional(),
    summary: z.string().trim().max(2000).optional(),
    checkedAt: z.string().datetime({ offset: true }).optional()
  })
  .refine((source) => Boolean(source.url || source.externalId), {
    message: "source requires either url or externalId"
  });

export const placeImageInputSchema = z.object({
  url: urlString,
  sourceId: z.string().uuid().optional(),
  sourceUrl: urlString.optional(),
  sourceType: sourceTypeSchema.optional(),
  sourceTitle: z.string().trim().optional(),
  creditText: z.string().trim().max(500).optional(),
  altText: z.string().trim().max(500).optional(),
  description: z.string().trim().max(4000).optional(),
  visualFeatures: z.array(nonEmptyString).max(40).optional(),
  childSignals: z.record(z.string(), z.unknown()).optional(),
  displayTier: imageDisplayTierSchema.optional(),
  status: imageStatusSchema.optional(),
  reviewStatus: imageReviewStatusSchema.optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  checkedAt: z.string().datetime({ offset: true }).optional()
});

export const relatedPlaceInputSchema = z.object({
  placeId: z.string().uuid(),
  relationType: relatedPlaceRelationTypeSchema.default("nearby"),
  note: z.string().trim().max(1000).optional(),
  evidence: z.record(z.string(), z.unknown()).optional()
});

const routeSupportAccessAreaSchema = z.enum(["landside", "airside", "both", "not_applicable", "unknown"]);
const routeSupportSourceUrlSchema = urlString.optional();

export const routeSupportSchema = z
  .object({
    terminalType: z
      .enum(["airport", "rail_station", "bus_terminal", "ferry_terminal", "highway_rest_area", "service_area", "transit_hub", "unknown"])
      .optional(),
    routeSupportRole: z.enum(["primary_terminal", "route_break", "transfer_stop", "rest_area", "unknown"]).optional(),
    accessArea: routeSupportAccessAreaSchema.optional(),
    babyCareLocations: z
      .array(
        z.object({
          label: nonEmptyString,
          floor: z.string().trim().max(100).optional(),
          area: routeSupportAccessAreaSchema.optional(),
          gate: z.string().trim().max(100).optional(),
          directions: z.string().trim().max(1000).optional(),
          nursingRoom: triStateSchema.optional(),
          diaperChangingTable: triStateSchema.optional(),
          strollerFriendly: triStateSchema.optional(),
          sourceUrl: routeSupportSourceUrlSchema
        })
      )
      .max(30)
      .optional(),
    strollerRental: z
      .object({
        available: triStateSchema.optional(),
        locations: z.array(nonEmptyString).max(20).optional(),
        notes: z.string().trim().max(1000).optional(),
        sourceUrl: routeSupportSourceUrlSchema
      })
      .optional(),
    prioritySupport: z
      .object({
        securityFastTrack: triStateSchema.optional(),
        priorityBoarding: triStateSchema.optional(),
        notes: z.string().trim().max(1000).optional(),
        sourceUrl: routeSupportSourceUrlSchema
      })
      .optional(),
    notes: z.string().trim().max(3000).optional()
  })
  .catchall(z.unknown());

const calendarDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD")
  .refine(isCalendarDate, "date must be a valid calendar date");

export const pricingItemSchema = z.object({
  label: nonEmptyString,
  amount: z.number().int().min(0).max(100_000_000).optional(),
  currency: currencyCodeSchema.optional(),
  unit: z.string().trim().max(200).optional(),
  ageRange: z.string().trim().max(200).optional(),
  conditions: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
  sourceUrl: urlString.optional()
});

export const pricingSchema = z
  .object({
    summary: z.string().trim().max(1000).optional(),
    currency: currencyCodeSchema.optional(),
    basisDate: calendarDateString.optional(),
    checkedAt: z.string().datetime({ offset: true }).optional(),
    staleAfterDays: z.number().int().min(1).max(730).optional(),
    items: z.array(pricingItemSchema).max(50).optional(),
    sourceUrl: urlString.optional(),
    sourceTitle: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional()
  })
  .catchall(z.unknown());

export const reviewSearchEvidenceItemSchema = z.object({
  query: nonEmptyString.max(200),
  searchedAt: z.string().datetime({ offset: true }).optional(),
  sourceUrl: urlString.optional(),
  language: z.string().trim().max(50).optional(),
  countryCode: countryCodeSchema,
  city: z.string().trim().max(200).optional(),
  accessStatus: z.enum(["opened", "snippet_only", "blocked", "not_found"]).optional(),
  snippetSummary: z.string().trim().max(1000).optional(),
  confidence: z.enum(["low", "medium", "high"]).optional()
});

export const reviewSearchEvidenceSchema = z.array(reviewSearchEvidenceItemSchema).max(50);

const writablePlaceFields = {
  name: nonEmptyString.optional(),
  slug: z.string().trim().optional(),
  primaryCategory: primaryCategorySchema.optional(),
  tags: z.array(nonEmptyString).max(50).optional(),
  description: z.string().trim().max(5000).optional(),
  address: z.string().trim().optional(),
  roadAddress: z.string().trim().optional(),
  regionSido: regionSidoSchema,
  regionSigungu: z.string().trim().optional(),
  regionDong: z.string().trim().optional(),
  countryCode: countryCodeSchema,
  countryName: z.string().trim().max(200).optional(),
  city: z.string().trim().max(200).optional(),
  locality: z.string().trim().max(200).optional(),
  localCurrency: currencyCodeSchema.optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  phone: z.string().trim().optional(),
  officialUrl: urlString.optional(),
  reservationUrl: urlString.optional(),
  kakaoPlaceUrl: urlString.optional(),
  kakaoPlaceId: z.string().trim().optional(),
  externalRefs: z.record(z.string(), z.unknown()).optional(),
  playFeatures: playFeaturesSchema.optional(),
  taxonomy: taxonomySchema.optional(),
  pricing: pricingSchema.optional(),
  reviewSearchEvidence: reviewSearchEvidenceSchema.optional(),
  routeSupport: routeSupportSchema.optional(),
  imageUrls: z.array(urlString).max(20).optional(),
  images: z.array(placeImageInputSchema).max(30).optional(),
  relatedPlaces: z.array(relatedPlaceInputSchema).max(50).optional(),
  status: z.enum(["active", "temporarily_closed", "closed", "draft", "needs_review"]).optional(),
  dataConfidence: z
    .enum(["official_verified", "operator_curated", "agent_collected", "user_reported", "needs_check", "unknown"])
    .optional(),
  placeScore: zeroToTenScore.optional(),
  placeScoreRationale: z.string().trim().max(5000).optional(),
  externalRatingScore: zeroToTenScore.optional(),
  externalReviewCount: z.number().int().min(0).max(1_000_000).optional(),
  searchEvidenceScore: zeroToTenScore.optional(),
  scoreSignals: z.record(z.string(), z.unknown()).optional(),
  scoreUpdatedAt: z.string().datetime({ offset: true }).optional(),
  minRecommendedAgeMonths: z.number().int().min(0).max(240).optional(),
  maxRecommendedAgeMonths: z.number().int().min(0).max(240).optional(),
  indoorType: indoorTypeSchema.optional(),
  strollerFriendly: triStateSchema.optional(),
  parkingAvailable: triStateSchema.optional(),
  parkingFrictionLevel: parkingFrictionLevelSchema.optional(),
  peakParkingWindow: z.string().trim().max(500).optional(),
  parkingWaitNote: z.string().trim().max(1000).optional(),
  nursingRoom: triStateSchema.optional(),
  diaperChangingTable: triStateSchema.optional(),
  kidsToilet: triStateSchema.optional(),
  elevator: triStateSchema.optional(),
  babyChair: triStateSchema.optional(),
  foodAllowed: triStateSchema.optional(),
  reservationRequired: triStateSchema.optional(),
  walkInAvailable: triStateSchema.optional(),
  sessionBased: triStateSchema.optional(),
  sameDayAvailabilityKnown: triStateSchema.optional(),
  averageStayMinutes: z.number().int().min(0).max(1440).optional(),
  parentEffortLevel: z.number().int().min(1).max(5).optional(),
  childEngagementLevel: z.number().int().min(1).max(5).optional(),
  rainyDayScore: z.number().int().min(1).max(5).optional(),
  hotDayScore: z.number().int().min(1).max(5).optional(),
  coldDayScore: z.number().int().min(1).max(5).optional(),
  safetyNotes: z.string().trim().max(5000).optional(),
  parentNotes: z.string().trim().max(5000).optional(),
  openingHours: z.unknown().optional()
};

export const createPlaceSchema = z
  .object({
    ...writablePlaceFields,
    name: nonEmptyString,
    primaryCategory: primaryCategorySchema,
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    sources: z.array(sourceSchema).min(1),
    actor: z.string().trim().default("agent"),
    changeSummary: z.string().trim().max(2000).optional()
  })
  .refine((place) => Boolean(place.address || place.regionSido), {
    message: "place requires either address or regionSido"
  })
  .refine(
    (place) =>
      place.minRecommendedAgeMonths === undefined ||
      place.maxRecommendedAgeMonths === undefined ||
      place.minRecommendedAgeMonths <= place.maxRecommendedAgeMonths,
    {
      message: "minRecommendedAgeMonths must be less than or equal to maxRecommendedAgeMonths"
    }
  );

export const updatePlaceSchema = z
  .object({
    ...writablePlaceFields,
    sources: z.array(sourceSchema).min(1),
    sourceMode: z.enum(["append", "replace"]).default("append"),
    imageMode: z.enum(["append", "replace"]).default("append"),
    relatedPlaceMode: z.enum(["append", "replace"]).default("append"),
    actor: z.string().trim().default("agent"),
    changeSummary: z.string().trim().max(2000).optional()
  })
  .refine((place) => (place.lat === undefined && place.lng === undefined) || (place.lat !== undefined && place.lng !== undefined), {
    message: "lat and lng must be updated together"
  })
  .refine(
    (place) =>
      place.minRecommendedAgeMonths === undefined ||
      place.maxRecommendedAgeMonths === undefined ||
      place.minRecommendedAgeMonths <= place.maxRecommendedAgeMonths,
    {
      message: "minRecommendedAgeMonths must be less than or equal to maxRecommendedAgeMonths"
    }
  );

const viewportBoundsSchema = z
  .object({
    minLat: z.number().min(-90).max(90),
    minLng: z.number().min(-180).max(180),
    maxLat: z.number().min(-90).max(90),
    maxLng: z.number().min(-180).max(180)
  })
  .refine((bounds) => bounds.minLat <= bounds.maxLat, {
    message: "minLat must be less than or equal to maxLat",
    path: ["minLat"]
  })
  .refine((bounds) => bounds.minLng <= bounds.maxLng, {
    message: "minLng must be less than or equal to maxLng",
    path: ["minLng"]
  });

const searchPlacesBaseSchema = z.object({
  visitContext: z.enum(["afterDaycare", "nearbyNow", "rainyDay", "weekendHalfDay", "dayTrip"]).optional(),
  visitDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "visitDate must use YYYY-MM-DD")
    .refine(isCalendarDate, "visitDate must be a valid calendar date")
    .optional(),
  visitStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "visitStartTime must use HH:mm in 24-hour time")
    .optional(),
  origin: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      label: z.string().trim().optional()
    })
    .optional(),
  radiusKm: z.number().positive().max(500).default(80),
  filterByRadius: z.boolean().optional(),
  viewportBounds: viewportBoundsSchema.optional(),
  minDistanceKm: z.number().min(0).max(500).optional(),
  maxDistanceKm: z.number().positive().max(500).optional(),
  diversity: z
    .object({
      maxPerRegion: z.number().int().min(1).max(20).optional(),
      maxPerCategory: z.number().int().min(1).max(20).optional()
    })
    .refine((value) => value.maxPerRegion !== undefined || value.maxPerCategory !== undefined, {
      message: "diversity requires maxPerRegion or maxPerCategory"
    })
    .optional(),
  query: z.string().trim().min(1).optional(),
  matchMode: z.enum(["keyword", "exactName"]).optional(),
  regionSido: regionSidoSchema,
  regionSigungu: nonEmptyString.optional(),
  countryCode: countryCodeSchema,
  city: z.string().trim().min(1).max(200).optional(),
  primaryCategories: z.array(nonEmptyString).max(30).optional(),
  representativeVisit: z.boolean().optional(),
  playgroundOnly: z.boolean().optional(),
  kidsCafeOnly: z.boolean().optional(),
  tags: z.array(nonEmptyString).max(30).optional(),
  taxonomy: searchTaxonomySchema.optional(),
  childAgeMonths: z.array(z.number().int().min(0).max(240)).max(10).optional(),
  preferenceMode: z.enum(["soft", "required"]).optional(),
  preferences: z
    .object({
      indoorTypes: z.array(indoorTypeSchema).optional(),
      parkingAvailable: z.boolean().optional(),
      toiletNearby: z.boolean().optional(),
      strollerFriendly: z.boolean().optional(),
      elevator: z.boolean().optional(),
      nursingRoom: z.boolean().optional(),
      diaperChangingTable: z.boolean().optional(),
      kidsToilet: z.boolean().optional(),
      babyChair: z.boolean().optional(),
      foodAllowed: z.boolean().optional()
    })
    .optional(),
  sort: z.enum(["recommended", "distance", "rating", "updatedAt"]).default("recommended"),
  projection: z.enum(["full", "compact"]).optional(),
  coursePlan: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(1000).default(0)
})
  .refine((input) => input.visitStartTime === undefined || input.visitDate !== undefined, {
    message: "visitStartTime requires visitDate",
    path: ["visitStartTime"]
  })
  .refine((input) => input.minDistanceKm === undefined || input.maxDistanceKm === undefined || input.minDistanceKm <= input.maxDistanceKm, {
    message: "minDistanceKm must be less than or equal to maxDistanceKm",
    path: ["minDistanceKm"]
  })
  .refine((input) => input.minDistanceKm === undefined || input.origin !== undefined, {
    message: "minDistanceKm requires origin",
    path: ["minDistanceKm"]
  })
  .refine((input) => input.maxDistanceKm === undefined || input.origin !== undefined, {
    message: "maxDistanceKm requires origin",
    path: ["maxDistanceKm"]
  });

export const searchPlacesSchema = z.preprocess(normalizeSearchAliases, searchPlacesBaseSchema);

export const duplicatePlaceSchema = z
  .object({
    name: nonEmptyString,
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    address: nonEmptyString.optional(),
    roadAddress: nonEmptyString.optional(),
    regionSido: regionSidoSchema,
    regionSigungu: nonEmptyString.optional(),
    countryCode: countryCodeSchema,
    city: z.string().trim().min(1).max(200).optional(),
    aliases: z.array(nonEmptyString).max(30).optional(),
    radiusMeters: z.number().positive().max(5000).default(500),
    kakaoPlaceId: z.string().trim().optional(),
    externalRefs: z.record(z.string(), z.unknown()).optional(),
    limit: z.number().int().min(1).max(20).default(10)
  })
  .refine((input) => (input.lat === undefined && input.lng === undefined) || (input.lat !== undefined && input.lng !== undefined), {
    message: "lat and lng must be provided together"
  })
  .refine(
    (input) =>
      (input.lat !== undefined && input.lng !== undefined) ||
      input.address !== undefined ||
      input.roadAddress !== undefined ||
      input.regionSigungu !== undefined ||
      input.countryCode !== undefined ||
      input.city !== undefined ||
      input.kakaoPlaceId !== undefined ||
      (input.externalRefs !== undefined && Object.keys(input.externalRefs).length > 0),
    {
      message: "duplicate check requires coordinates, address, regionSigungu, kakaoPlaceId, or externalRefs"
    }
  );

export const deletePlaceSchema = z.object({
  confirmation: z.literal("close_place"),
  confirmName: nonEmptyString,
  sources: z.array(sourceSchema).min(1),
  actor: z.string().trim().default("agent"),
  changeSummary: z.string().trim().min(10).max(2000)
});

export const placeImageHealthQuerySchema = z.object({
  placeIds: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const ids = value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      return ids.length > 0 ? ids : undefined;
    },
    z.array(z.string().uuid()).max(200).optional()
  ),
  primaryCategory: z.string().trim().min(1).optional(),
  status: z
    .enum(["attention", "no_active_image", "rejected_only", "needs_review", "pending_review", "no_primary", "healthy", "all"])
    .default("attention"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(5000).default(0)
});

export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;
export type UpdatePlaceInput = z.infer<typeof updatePlaceSchema>;
export type SearchPlacesInput = z.infer<typeof searchPlacesSchema>;
export type DuplicatePlaceInput = z.infer<typeof duplicatePlaceSchema>;
export type DeletePlaceInput = z.infer<typeof deletePlaceSchema>;
export type PlaceImageHealthQueryInput = z.infer<typeof placeImageHealthQuerySchema>;
export type SourceInput = z.infer<typeof sourceSchema>;
export type PlaceImageInput = z.infer<typeof placeImageInputSchema>;
export type RelatedPlaceInput = z.infer<typeof relatedPlaceInputSchema>;
export type PricingInput = z.infer<typeof pricingSchema>;
export type ReviewSearchEvidenceInput = z.infer<typeof reviewSearchEvidenceSchema>;
export type PlaceTaxonomyInput = z.infer<typeof taxonomySchema>;
export type RouteSupportInput = z.infer<typeof routeSupportSchema>;
export type SearchTaxonomyInput = z.infer<typeof searchTaxonomySchema>;

function normalizeSearchAliases(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const input = { ...(value as Record<string, unknown>) };
  if (input.origin === undefined && input.location !== undefined) {
    input.origin = input.location;
  }
  if (input.childAgeMonths === undefined && input.childAgesMonths !== undefined) {
    input.childAgeMonths = input.childAgesMonths;
  }

  return input;
}

function isCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
