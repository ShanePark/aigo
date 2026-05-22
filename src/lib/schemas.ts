import { z } from "zod";

export const triStateSchema = z.enum(["yes", "no", "partial", "unknown"]);
export const indoorTypeSchema = z.enum(["indoor", "outdoor", "mixed", "unknown"]);
export const imageDisplayTierSchema = z.enum(["official", "public_agency", "public_listing", "rights_unclear", "unknown"]);
export const imageStatusSchema = z.enum(["active", "archived"]);
export const imageReviewStatusSchema = z.enum(["pending_review", "approved", "needs_review", "rejected"]);
export const relatedPlaceRelationTypeSchema = z.enum(["nearby", "same_building", "same_site", "parent_child", "route_pair"]);

const nonEmptyString = z.string().trim().min(1);
const urlString = z.string().trim().url();
const zeroToTenScore = z.number().min(0).max(10);

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
    sourceType: nonEmptyString,
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
  sourceType: z.string().trim().optional(),
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

const writablePlaceFields = {
  name: nonEmptyString.optional(),
  slug: z.string().trim().optional(),
  primaryCategory: nonEmptyString.optional(),
  tags: z.array(nonEmptyString).max(50).optional(),
  description: z.string().trim().max(5000).optional(),
  address: z.string().trim().optional(),
  roadAddress: z.string().trim().optional(),
  regionSido: z.string().trim().optional(),
  regionSigungu: z.string().trim().optional(),
  regionDong: z.string().trim().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  phone: z.string().trim().optional(),
  officialUrl: urlString.optional(),
  reservationUrl: urlString.optional(),
  kakaoPlaceUrl: urlString.optional(),
  kakaoPlaceId: z.string().trim().optional(),
  externalRefs: z.record(z.string(), z.unknown()).optional(),
  playFeatures: playFeaturesSchema.optional(),
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
  nursingRoom: triStateSchema.optional(),
  diaperChangingTable: triStateSchema.optional(),
  kidsToilet: triStateSchema.optional(),
  elevator: triStateSchema.optional(),
  babyChair: triStateSchema.optional(),
  foodAllowed: triStateSchema.optional(),
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
    primaryCategory: nonEmptyString,
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

const searchPlacesBaseSchema = z.object({
  visitContext: z.enum(["afterDaycare", "nearbyNow", "rainyDay", "weekendHalfDay", "dayTrip"]).optional(),
  origin: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      label: z.string().trim().optional()
    })
    .optional(),
  radiusKm: z.number().positive().max(200).default(80),
  query: z.string().trim().min(1).optional(),
  primaryCategories: z.array(nonEmptyString).max(30).optional(),
  tags: z.array(nonEmptyString).max(30).optional(),
  childAgeMonths: z.array(z.number().int().min(0).max(240)).max(10).optional(),
  preferences: z
    .object({
      indoorTypes: z.array(indoorTypeSchema).optional(),
      parkingAvailable: z.boolean().optional(),
      strollerFriendly: z.boolean().optional(),
      nursingRoom: z.boolean().optional(),
      diaperChangingTable: z.boolean().optional(),
      kidsToilet: z.boolean().optional(),
      elevator: z.boolean().optional(),
      babyChair: z.boolean().optional(),
      foodAllowed: z.boolean().optional()
    })
    .optional(),
  sort: z.enum(["recommended", "distance", "updatedAt"]).default("recommended"),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(1000).default(0)
});

export const searchPlacesSchema = z.preprocess(normalizeSearchAliases, searchPlacesBaseSchema);

export const duplicatePlaceSchema = z.object({
  name: nonEmptyString,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().positive().max(5000).default(500),
  kakaoPlaceId: z.string().trim().optional(),
  externalRefs: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().min(1).max(20).default(10)
});

export const placeImageHealthQuerySchema = z.object({
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
export type PlaceImageHealthQueryInput = z.infer<typeof placeImageHealthQuerySchema>;
export type SourceInput = z.infer<typeof sourceSchema>;
export type PlaceImageInput = z.infer<typeof placeImageInputSchema>;
export type RelatedPlaceInput = z.infer<typeof relatedPlaceInputSchema>;

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
