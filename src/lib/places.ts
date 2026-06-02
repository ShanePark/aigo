import { pg } from "@/db/client";
import { ApiError } from "@/lib/errors";
import {
  type CreatePlaceInput,
  type DeletePlaceInput,
  type DuplicatePlaceInput,
  type PlaceImageHealthQueryInput,
  type PlaceImageInput,
  type RelatedPlaceInput,
  type SearchPlacesInput,
  type SourceInput,
  type UpdatePlaceInput,
  placeImageHealthQuerySchema
} from "@/lib/schemas";
import {
  type DuplicateCandidateRelationshipHint,
  type DuplicateCandidateSuggestedAction,
  duplicateConfidence,
  duplicateBranchSiblingReviewOnly,
  duplicateGenericBranchName,
  duplicateLocationSignals,
  duplicateLodgingClusterReviewOnly,
  duplicateOutsideRadiusReviewOnly,
  duplicatePublicSubfacilityReviewOnly,
  duplicateReasonCodes,
  duplicateRelationshipHint,
  duplicateSameBuildingReviewOnly,
  duplicateSameSidoGenericReviewOnly,
  duplicateSuggestedAction,
  duplicateWeakThematicSimilarityReviewOnly
} from "@/lib/duplicates";
import { dateFromSeoulWallClock } from "@/lib/korea-time";
import { listPlaceVisitSummaries } from "@/lib/place-visits";
import {
  shoppingMallRelatedPlaceScoreAdjustment,
  summarizeRelatedPlaceScoringRows,
  type RelatedPlaceScoringRow,
  type RelatedPlaceScoringSummary
} from "@/lib/recommendation-scoring";
import { describeReasonCodes } from "@/lib/reasons";
import { scorePlace, scorePlaceIntrinsic } from "@/lib/scoring";
import {
  emptyPlaceTaxonomy,
  inferTaxonomyFromPlace,
  inferTaxonomySearchFacets,
  normalizeLegacyTags,
  normalizePrimaryCategory,
  normalizeRegionSido,
  normalizeSourceType,
  taxonomyFacetFamilies,
  type TaxonomyFacetFamily,
  type PlaceTaxonomy
} from "@/lib/taxonomy";
import type postgres from "postgres";

type PlaceRow = {
  id: string;
  name: string;
  slug: string | null;
  primary_category: string;
  tags: string[];
  description: string | null;
  address: string | null;
  road_address: string | null;
  region_sido: string | null;
  region_sigungu: string | null;
  region_dong: string | null;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  locality: string | null;
  local_currency: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  official_url: string | null;
  reservation_url: string | null;
  kakao_place_url: string | null;
  kakao_place_id: string | null;
  external_refs: Record<string, unknown>;
  play_features: Record<string, unknown>;
  taxonomy: PlaceTaxonomy;
  pricing: Record<string, unknown>;
  review_search_evidence: Record<string, unknown>[];
  route_support: Record<string, unknown>;
  status: string;
  data_confidence: string;
  place_score: number | null;
  place_score_rationale: string | null;
  external_rating_score: number | null;
  external_review_count: number | null;
  search_evidence_score: number | null;
  score_signals: Record<string, unknown>;
  score_updated_at: Date | null;
  min_recommended_age_months: number | null;
  max_recommended_age_months: number | null;
  indoor_type: string;
  stroller_friendly: string;
  parking_available: string;
  parking_friction_level: string;
  peak_parking_window: string | null;
  parking_wait_note: string | null;
  nursing_room: string;
  diaper_changing_table: string;
  kids_toilet: string;
  elevator: string;
  baby_chair: string;
  food_allowed: string;
  reservation_required: string;
  walk_in_available: string;
  session_based: string;
  same_day_availability_known: string;
  average_stay_minutes: number | null;
  parent_effort_level: number | null;
  child_engagement_level: number | null;
  rainy_day_score: number | null;
  hot_day_score: number | null;
  cold_day_score: number | null;
  safety_notes: string | null;
  parent_notes: string | null;
  opening_hours: unknown | null;
  version: number;
  public_view_count: number;
  created_at: Date;
  updated_at: Date;
  last_verified_at: Date | null;
  distance_km?: number | null;
};

type PlaceImageRow = {
  id: string;
  place_id: string;
  url: string;
  source_id: string | null;
  source_type: string | null;
  source_title: string | null;
  source_url: string | null;
  credit_text: string | null;
  alt_text: string | null;
  description: string | null;
  visual_features: string[];
  child_signals: Record<string, unknown>;
  display_tier: string;
  status: string;
  review_status: string;
  is_primary: boolean;
  sort_order: number;
  width: number | null;
  height: number | null;
  checked_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type RelatedPlaceRow = {
  relation_id: string;
  related_place_id: string;
  relation_type: string;
  note: string | null;
  evidence: Record<string, unknown>;
  relation_created_at: Date;
  relation_updated_at: Date;
  name: string;
  primary_category: string;
  tags: string[];
  address: string | null;
  road_address: string | null;
  lat: number;
  lng: number;
  status: string;
  distance_meters: number | null;
};

type SourceRow = {
  id: string;
  place_id: string;
  source_type: string;
  title: string | null;
  url: string | null;
  external_id: string | null;
  summary: string | null;
  checked_at: Date | null;
  created_at: Date;
};

type SearchSourceSummaryRow = Pick<SourceRow, "place_id" | "source_type" | "title" | "summary" | "checked_at" | "created_at">;

type VersionRow = {
  id: string;
  place_id: string;
  version_number: number;
  action: string;
  actor: string;
  change_summary: string | null;
  snapshot: Record<string, unknown>;
  sources: unknown[];
  created_at: Date;
};

type PlaceImageHealthRow = {
  place_id: string;
  name: string;
  primary_category: string;
  tags: string[];
  address: string | null;
  road_address: string | null;
  region_sido: string | null;
  region_sigungu: string | null;
  region_dong: string | null;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  locality: string | null;
  local_currency: string | null;
  data_confidence: string;
  updated_at: Date;
  active_image_count: number;
  approved_image_count: number;
  needs_review_image_count: number;
  pending_review_image_count: number;
  rejected_image_count: number;
  archived_image_count: number;
  primary_active_image_count: number;
  primary_image_url: string | null;
  primary_review_status: string | null;
  latest_image_checked_at: Date | null;
  latest_image_updated_at: Date | null;
  health_status: string;
  priority_score: number;
};

type ImageMetadataSource = {
  id?: string | null;
  sourceType: string;
  title?: string | null;
  url?: string | null;
  externalId?: string | null;
  summary?: string | null;
  checkedAt?: string | null;
};

const columnMap = {
  name: "name",
  slug: "slug",
  primaryCategory: "primary_category",
  tags: "tags",
  description: "description",
  address: "address",
  roadAddress: "road_address",
  regionSido: "region_sido",
  regionSigungu: "region_sigungu",
  regionDong: "region_dong",
  countryCode: "country_code",
  countryName: "country_name",
  city: "city",
  locality: "locality",
  localCurrency: "local_currency",
  lat: "lat",
  lng: "lng",
  phone: "phone",
  officialUrl: "official_url",
  reservationUrl: "reservation_url",
  kakaoPlaceUrl: "kakao_place_url",
  kakaoPlaceId: "kakao_place_id",
  externalRefs: "external_refs",
  playFeatures: "play_features",
  taxonomy: "taxonomy",
  pricing: "pricing",
  reviewSearchEvidence: "review_search_evidence",
  routeSupport: "route_support",
  status: "status",
  dataConfidence: "data_confidence",
  placeScore: "place_score",
  placeScoreRationale: "place_score_rationale",
  externalRatingScore: "external_rating_score",
  externalReviewCount: "external_review_count",
  searchEvidenceScore: "search_evidence_score",
  scoreSignals: "score_signals",
  scoreUpdatedAt: "score_updated_at",
  minRecommendedAgeMonths: "min_recommended_age_months",
  maxRecommendedAgeMonths: "max_recommended_age_months",
  indoorType: "indoor_type",
  strollerFriendly: "stroller_friendly",
  parkingAvailable: "parking_available",
  parkingFrictionLevel: "parking_friction_level",
  peakParkingWindow: "peak_parking_window",
  parkingWaitNote: "parking_wait_note",
  nursingRoom: "nursing_room",
  diaperChangingTable: "diaper_changing_table",
  kidsToilet: "kids_toilet",
  elevator: "elevator",
  babyChair: "baby_chair",
  foodAllowed: "food_allowed",
  reservationRequired: "reservation_required",
  walkInAvailable: "walk_in_available",
  sessionBased: "session_based",
  sameDayAvailabilityKnown: "same_day_availability_known",
  averageStayMinutes: "average_stay_minutes",
  parentEffortLevel: "parent_effort_level",
  childEngagementLevel: "child_engagement_level",
  rainyDayScore: "rainy_day_score",
  hotDayScore: "hot_day_score",
  coldDayScore: "cold_day_score",
  safetyNotes: "safety_notes",
  parentNotes: "parent_notes",
  openingHours: "opening_hours"
} as const;

export async function createPlace(input: CreatePlaceInput) {
  const normalizedInput = normalizeCreatePlaceInput(input);
  const insert = toDbRecord(normalizedInput);
  const columns = Object.keys(insert);
  const imageInputs = normalizeImageInputs(normalizedInput.images, normalizedInput.imageUrls, normalizedInput.sources);

  return pg.begin(async (tx) => {
    const [place] = await insertPlace(tx, insert, columns);

    await insertSources(tx, place.id, normalizedInput.sources);
    await insertImages(tx, place.id, imageInputs);
    await ensurePrimaryImage(tx, place.id);
    await upsertRelatedPlaces(tx, place.id, normalizedInput.relatedPlaces ?? [], "append");
    await createVersion(tx, place.id, 1, "create", normalizedInput.actor, normalizedInput.changeSummary, normalizedInput.sources);

    return getPlaceDetail(place.id, tx);
  });
}

export async function updatePlace(placeId: string, input: UpdatePlaceInput) {
  const normalizedInput = normalizeUpdatePlaceInput(input);
  const patch = toDbRecord(normalizedInput);
  const columns = Object.keys(patch);
  const imageInputs = normalizeImageInputs(normalizedInput.images, normalizedInput.imageUrls, normalizedInput.sources, {
    assignFallbackPrimary: normalizedInput.imageMode === "replace",
    allowStructuredPrimaryOverwrite: normalizedInput.imageMode === "replace"
  });
  const hasImagePatch = normalizedInput.images !== undefined || normalizedInput.imageUrls !== undefined;
  const hasRelatedPlacePatch = normalizedInput.relatedPlaces !== undefined;

  return pg.begin(async (tx) => {
    const existing = await tx<PlaceRow[]>`select * from places where id = ${placeId}`;
    if (existing.length === 0) {
      throw new ApiError(404, "Place not found");
    }

    let updated: PlaceRow;
    if (columns.length > 0) {
      [updated] = await updatePlaceRow(tx, placeId, patch, columns);
    } else {
      [updated] = await tx<PlaceRow[]>`
        update places
        set updated_at = now(), version = version + 1
        where id = ${placeId}
        returning *
      `;
    }

    const imageSourceLinks = normalizedInput.sourceMode === "replace" ? await getImageSourceLinks(tx, updated.id) : [];
    if (normalizedInput.sourceMode === "replace") {
      await tx`delete from place_sources where place_id = ${updated.id}`;
    }
    await insertSources(tx, updated.id, normalizedInput.sources);
    await reconnectImageSources(tx, updated.id, imageSourceLinks);
    if (hasImagePatch) {
      if (normalizedInput.imageMode === "replace") {
        await tx`delete from place_images where place_id = ${updated.id}`;
      }
      await insertImages(tx, updated.id, imageInputs);
      await ensurePrimaryImage(tx, updated.id);
    }
    if (hasRelatedPlacePatch) {
      await upsertRelatedPlaces(tx, updated.id, normalizedInput.relatedPlaces ?? [], normalizedInput.relatedPlaceMode);
    }
    await createVersion(tx, updated.id, updated.version, "update", normalizedInput.actor, normalizedInput.changeSummary, normalizedInput.sources);

    return getPlaceDetail(updated.id, tx);
  });
}

export async function deletePlace(placeId: string, input: DeletePlaceInput) {
  return pg.begin(async (tx) => {
    const rows = await tx<PlaceRow[]>`select * from places where id = ${placeId}`;
    if (rows.length === 0) {
      throw new ApiError(404, "Place not found");
    }

    const existing = rows[0];
    assertDeleteConfirmationMatches(existing.name, input.confirmName);
    const [updated] = await tx<PlaceRow[]>`
      update places
      set status = 'closed', updated_at = now(), version = version + 1
      where id = ${placeId}
      returning *
    `;
    await insertSources(tx, updated.id, input.sources);
    await createVersion(tx, updated.id, updated.version, "update", input.actor, input.changeSummary, input.sources);

    return {
      id: updated.id,
      name: updated.name,
      deleted: true,
      deletionMode: "soft",
      status: updated.status,
      actor: input.actor,
      changeSummary: input.changeSummary
    };
  });
}

export function assertDeleteConfirmationMatches(placeName: string, confirmName: string) {
  if (placeName.trim() !== confirmName.trim()) {
    throw new ApiError(400, "confirmName must match the current place name before deletion");
  }
}

export async function getPlaceDetail(placeId: string, executor: SqlExecutor = pg) {
  const rows = await executor<PlaceRow[]>`select * from places where id = ${placeId}`;
  if (rows.length === 0) {
    throw new ApiError(404, "Place not found");
  }

  const sourceRows = await executor<SourceRow[]>`
    select * from place_sources
    where place_id = ${placeId}
    order by created_at desc
  `;

  const latestVersions = await executor<VersionRow[]>`
    select * from place_versions
    where place_id = ${placeId}
    order by version_number desc
    limit 10
  `;

  const sources = sourceRows.map(mapSource);
  const imageMetadata = await getPlaceImageMetadata(placeId, executor);
  const relatedPlaces = await getRelatedPlaces(placeId, executor);
  const place = mapPlace(rows[0]);
  const sourceSummary = buildSearchSourceSummary(sourceRows);
  const openingHoursSummary = buildSearchOpeningHoursSummary(buildOpeningHoursDataSignal(place.openingHours), sourceSummary, place.visit);

  return {
    ...place,
    ...imageMetadata,
    relatedPlaces,
    sourceSummary,
    structuredDataGaps: buildStructuredDataGaps(place, sourceSummary, openingHoursSummary),
    openingHoursSummary,
    sources,
    versions: latestVersions.map(mapVersionSummary)
  };
}

export async function searchPlaces(input: SearchPlacesInput) {
  const normalizedInput = normalizeSearchInput(input);
  const scoringNow = searchEvaluationDate(normalizedInput);
  const queryParts = buildSearchQuery(normalizedInput);
  const rows = await pg.unsafe<PlaceRow[]>(queryParts.sql, queryParts.params);
  const relatedPlaceSummaryMap = await getRelatedPlaceScoringSummaryMap(rows.map((row) => row.id));

  const scored = rows.map((row) => {
    const place = mapPlace(row);
    const scoringPlace = {
      primaryCategory: place.primaryCategory,
      tags: place.tags,
      dataConfidence: place.dataConfidence,
      scoring: place.scoring,
      minRecommendedAgeMonths: place.recommendedAgeMonths.min,
      maxRecommendedAgeMonths: place.recommendedAgeMonths.max,
      indoorType: place.facilities.indoorType,
      parkingAvailable: place.facilities.parkingAvailable,
      strollerFriendly: place.facilities.strollerFriendly,
      nursingRoom: place.facilities.nursingRoom,
      diaperChangingTable: place.facilities.diaperChangingTable,
      kidsToilet: place.facilities.kidsToilet,
      elevator: place.facilities.elevator,
      babyChair: place.facilities.babyChair,
      foodAllowed: place.facilities.foodAllowed,
      openingHours: place.openingHours,
      visit: place.visit,
      playFeatures: place.playFeatures,
      taxonomy: place.taxonomy,
      pricing: place.pricing,
      distanceKm: place.distanceKm
    } satisfies Parameters<typeof scorePlace>[0];
    const scoredPlace = scorePlace(scoringPlace, normalizedInput, scoringNow ? { now: scoringNow } : undefined);
    const placeQualityScore = scorePlaceIntrinsic(scoringPlace, scoringNow ? { now: scoringNow } : undefined);
    const querySignal = queryMatchSignal(place, normalizedInput.query);
    const baseScore = clampScore(applySearchEvidenceCaps(scoredPlace.score + querySignal.delta, place.scoring));
    const playgroundEvidenceCap = playgroundEvidenceScoreCap(baseScore, place, {
      ...normalizedInput,
      originalQuery: input.query
    });
    const routeBreakFitCap = routeBreakDestinationFitCap(playgroundEvidenceCap.score, place, normalizedInput);
    const relatedPlaceSignal = shoppingMallRelatedPlaceScoreAdjustment(place, relatedPlaceSummaryMap.get(place.id));
    const score = clampScore(routeBreakFitCap.score + relatedPlaceSignal.delta);
    const reasonCodes = mergeReasonCodes(
      mergeReasonCodes(
        mergeReasonCodes(
          mergeReasonCodes(scoredPlace.reasonCodes, querySignal.reasonCodes),
          playgroundEvidenceCap.reasonCodes
        ),
        routeBreakFitCap.reasonCodes
      ),
      relatedPlaceSignal.reasonCodes
    );

    return {
      id: place.id,
      placeId: place.id,
      name: place.name,
      primaryCategory: place.primaryCategory,
      tags: place.tags,
      address: place.address,
      description: place.description,
      playFeatures: place.playFeatures,
      taxonomy: place.taxonomy,
      pricing: place.pricing,
      reviewSearchEvidence: place.reviewSearchEvidence,
      routeSupport: place.routeSupport,
      region: place.region,
      regionSido: place.regionSido,
      regionSigungu: place.regionSigungu,
      countryCode: place.countryCode,
      countryName: place.countryName,
      city: place.city,
      locality: place.locality,
      localCurrency: place.localCurrency,
      lat: place.lat,
      lng: place.lng,
      distanceKm: place.distanceKm,
      score,
      placeQualityScore: {
        score: placeQualityScore.score,
        scoreBreakdown: placeQualityScore.scoreBreakdown,
        reasonCodes: placeQualityScore.reasonCodes,
        reasons: describeReasonCodes(placeQualityScore.reasonCodes),
        storedScore: place.scoring.placeScore,
        rationale: place.scoring.placeScoreRationale,
        updatedAt: place.scoring.scoreUpdatedAt
      },
      scoreBreakdown: {
        ...scoredPlace.scoreBreakdown,
        queryMatch: querySignal.delta,
        shoppingMallBase: relatedPlaceSignal.shoppingMallBase,
        relatedPlaces: relatedPlaceSignal.relatedPlaces,
        total: score
      },
      reasonCodes,
      reasons: describeReasonCodes(reasonCodes, normalizedInput),
      dataConfidence: place.dataConfidence,
      scoring: place.scoring,
      recommendedAgeMonths: place.recommendedAgeMonths,
      infantLogistics: buildInfantLogisticsSignal(place.facilities),
      openingHoursData: buildOpeningHoursDataSignal(place.openingHours),
      facilities: place.facilities,
      visit: place.visit,
      notes: place.notes,
      version: place.version,
      updatedAt: place.updatedAt
    };
  });

  scored.sort((a, b) => {
    if (input.sort === "distance") {
      return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
    }

    if (input.sort === "rating") {
      if (b.placeQualityScore.score !== a.placeQualityScore.score) return b.placeQualityScore.score - a.placeQualityScore.score;
      if (b.score !== a.score) return b.score - a.score;
      return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
    }

    if (input.sort === "updatedAt") {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }

    if (b.score !== a.score) return b.score - a.score;
    return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
  });

  const diversified = applySearchDiversity(scored, normalizedInput.diversity);
  const items = diversified.slice(input.offset, input.offset + input.limit);
  const itemPlaceIds = items.map((item) => item.placeId);
  const [imageMap, sourceSummaryMap, visitSummaryMap] = await Promise.all([
    getImageMapForPlaces(itemPlaceIds),
    getSourceSummaryMapForPlaces(itemPlaceIds),
    listPlaceVisitSummaries(itemPlaceIds)
  ]);
  const enrichedItems = items.map((item) => {
    const imageRows = imageMap.get(item.placeId) ?? [];
    const sourceSummary = sourceSummaryMap.get(item.placeId) ?? buildSearchSourceSummary([]);
    const userRatingSummary = visitSummaryMap.get(item.placeId) ?? {
      averageRating: null,
      latestVisitedOn: null,
      publicPhotoCount: 0,
      publicReviewCount: 0,
      ratingCount: 0
    };
    const { openingHoursData, ...publicItem } = item;
    const openingHoursSummary = buildSearchOpeningHoursSummary(openingHoursData, sourceSummary, item.visit);
    const imageHealth = buildSearchImageHealth(imageRows);
    const structuredDataGaps = buildStructuredDataGaps(item, sourceSummary, openingHoursSummary);
    const recommendationReadiness = buildSearchRecommendationReadiness(
      {
        ...item,
        imageHealth,
        sourceSummary,
        structuredDataGaps,
        openingHoursSummary
      },
      normalizedInput
    );
    return {
      ...publicItem,
      ...buildImageMetadataFromRows(imageRows),
      imageHealth,
      sourceSummary,
      userRatingSummary,
      structuredDataGaps,
      openingHoursSummary,
      recommendationReadiness
    };
  });

  return {
    items: enrichedItems,
    meta: {
      count: enrichedItems.length,
      total: diversified.length,
      limit: input.limit,
      offset: input.offset,
      projection: normalizedInput.projection ?? "full",
      origin: input.origin ?? null,
      coursePlan: normalizedInput.coursePlan ? buildSearchCoursePlan(enrichedItems) : null,
      search: {
        originalQuery: input.query ?? null,
        normalizedQuery: normalizedInput.query ?? null,
        locationQuery: normalizedInput.query ? locationOnlyQuery(normalizedInput.query) : null,
        temporalTerms: input.query ? inferTemporalTermsFromQuery(input.query) : [],
        suggestedExactNameQuery:
          input.matchMode === "exactName" && input.query ? suggestedExactNameQuery(input.query) : null,
        queryNormalization: buildSearchQueryNormalizationMeta(input, normalizedInput),
        appliedPreferences: normalizedInput.preferences ?? null,
        appliedTaxonomy: normalizedInput.taxonomy ?? null,
        preferenceSemantics: buildSearchPreferenceSemantics(normalizedInput.preferences),
        visitContext: normalizedInput.visitContext ?? null,
        normalized:
          input.query !== normalizedInput.query ||
          input.visitContext !== normalizedInput.visitContext ||
          JSON.stringify(input.preferences ?? null) !== JSON.stringify(normalizedInput.preferences ?? null) ||
          JSON.stringify(input.taxonomy ?? null) !== JSON.stringify(normalizedInput.taxonomy ?? null)
      }
    }
  };
}

function playgroundEvidenceScoreCap(
  score: number,
  place: ReturnType<typeof mapPlace>,
  input: Pick<SearchPlacesInput, "childAgeMonths" | "playgroundOnly" | "query"> & { originalQuery?: string }
) {
  if (!input.playgroundOnly || !["park", "playground"].includes(place.primaryCategory)) {
    return { score, reasonCodes: [] as string[] };
  }

  const reasonCodes: string[] = [];
  let cappedScore = score;
  const requestedFeatureGroups = requestedPlaygroundFeatureGroups(input.query, input.originalQuery);

  if (!hasPlaygroundFeatureEvidence(place)) {
    cappedScore = Math.min(cappedScore, 66);
    reasonCodes.push("PLAYGROUND_FEATURES_UNKNOWN");
  }
  if (requestedFeatureGroups.some((keys) => !hasPlaygroundFeatureEvidence(place, keys))) {
    cappedScore = Math.min(cappedScore, 60);
    reasonCodes.push("EQUIPMENT_EVIDENCE_MISSING");
  }

  const hasInfant = input.childAgeMonths?.some((ageMonths) => ageMonths < 18) ?? false;
  const routeUnknownCount = playgroundInfantRouteKeys.filter((key) => place.facilities[key] === "unknown").length;
  if (hasInfant && routeUnknownCount >= 2) {
    cappedScore = Math.min(cappedScore, 64);
    reasonCodes.push("PLAYGROUND_INFANT_ROUTE_UNKNOWN");
  }

  return { score: cappedScore, reasonCodes };
}

export function playgroundEvidenceScoreCapForTest(
  score: number,
  place: Parameters<typeof playgroundEvidenceScoreCap>[1],
  input: Parameters<typeof playgroundEvidenceScoreCap>[2]
) {
  return playgroundEvidenceScoreCap(score, place, input);
}

function routeBreakDestinationFitCap(score: number, place: ReturnType<typeof mapPlace>, input: Pick<SearchPlacesInput, "query">) {
  if (place.primaryCategory !== "rest_area" || !input.query || !isRouteBreakIntentQuery(input.query)) {
    return { score, reasonCodes: [] as string[] };
  }

  const destinationTerms = routeBreakDestinationTermsInQuery(input.query);
  if (destinationTerms.length === 0 || routeBreakPlaceMatchesDestination(place, destinationTerms)) {
    return { score, reasonCodes: [] as string[] };
  }

  return {
    score: Math.min(score, 38),
    reasonCodes: ["ROUTE_DESTINATION_FIT_MISSING"]
  };
}

export function routeBreakDestinationFitCapForTest(
  score: number,
  place: Parameters<typeof routeBreakDestinationFitCap>[1],
  input: Parameters<typeof routeBreakDestinationFitCap>[2]
) {
  return routeBreakDestinationFitCap(score, place, input);
}

function requestedPlaygroundFeatureGroups(query?: string, originalQuery?: string) {
  const terms = new Set(
    [query, originalQuery]
      .filter(isNonEmptyString)
      .flatMap((value) => value.trim().split(/\s+/).filter(Boolean).map(normalizeSearchText))
  );
  const groups: string[][] = [];
  for (const entry of playgroundQueryFeatureMap) {
    if (entry.terms.some((term) => terms.has(normalizeSearchText(term)))) {
      groups.push(entry.keys);
    }
  }
  return groups;
}

function hasPlaygroundFeatureEvidence(place: Pick<ReturnType<typeof mapPlace>, "playFeatures" | "taxonomy">, keys = playgroundFeatureKeys) {
  return hasPositivePlaygroundFeature(place.playFeatures, keys) || playgroundTaxonomyMatchesFeatureKeys(place.taxonomy, keys);
}

const playgroundGeneralTaxonomyActivityTypes = new Set(["outdoor_playground", "sand_play", "water_play"]);
const playgroundFeatureTaxonomyActivityTypes: Record<string, string[]> = {
  sandPlay: ["sand_play"],
  waterPlayground: ["water_play"]
};

function playgroundTaxonomyMatchesFeatureKeys(taxonomy: PlaceTaxonomy | null | undefined, keys: string[]) {
  const activityTypes = new Set<string>([...(taxonomy?.sourceBacked?.activityTypes ?? []), ...(taxonomy?.inferred?.activityTypes ?? [])]);
  if (activityTypes.size === 0) return false;
  if (keys === playgroundFeatureKeys) {
    return [...playgroundGeneralTaxonomyActivityTypes].some((type) => activityTypes.has(type));
  }
  return keys.some((key) => playgroundFeatureTaxonomyActivityTypes[key]?.some((type) => activityTypes.has(type)));
}

function routeBreakDestinationTermsInQuery(query: string) {
  return uniqueStrings(query.trim().split(/\s+/).filter((term) => routeBreakDestinationTerms.has(term)));
}

function routeBreakPlaceMatchesDestination(place: ReturnType<typeof mapPlace>, destinationTerms: string[]) {
  const text = normalizeSearchText(
    [
      place.name,
      place.description,
      place.address,
      place.roadAddress,
      ...place.tags,
      JSON.stringify(place.routeSupport ?? {})
    ]
      .filter(isNonEmptyString)
      .join(" ")
  );
  return destinationTerms.some((term) => text.includes(normalizeSearchText(term)));
}

type FullSearchResponse = Awaited<ReturnType<typeof searchPlaces>>;
type FullSearchItem = FullSearchResponse["items"][number];
type DuplicateCandidateItem = {
  place: Awaited<ReturnType<typeof getPlaceDetail>>;
  confidence: "high" | "medium" | "low";
  reasonCodes: string[];
  suggestedAction: DuplicateCandidateSuggestedAction;
  relationshipHint: DuplicateCandidateRelationshipHint;
  outsideRadiusReviewOnly: boolean;
  distanceMeters: number | null;
  nameSimilarity: number | null;
};
type SearchFacilities = ReturnType<typeof mapPlace>["facilities"];
type SearchCoursePlanItem = {
  id: string;
  name: string;
  primaryCategory: string;
  distanceKm: number | null;
  score: number;
  facilities: Pick<
    SearchFacilities,
    | "indoorType"
    | "strollerFriendly"
    | "elevator"
    | "nursingRoom"
    | "diaperChangingTable"
    | "parkingAvailable"
    | "babyChair"
    | "foodAllowed"
  >;
  visit: {
    averageStayMinutes: number | null;
    parentEffortLevel: number | null;
    childEngagementLevel: number | null;
  };
  imageHealth?: ReturnType<typeof buildSearchImageHealth>;
};

export function compactSearchPlacesResponse(response: FullSearchResponse) {
  return {
    ...response,
    items: response.items.map(compactSearchPlaceItem),
    meta: {
      ...response.meta,
      projection: "compact" as const
    }
  };
}

export function applySearchDiversity<
  T extends {
    primaryCategory: string;
    region?: { sido: string | null; sigungu: string | null } | null;
  }
>(items: T[], diversity: SearchPlacesInput["diversity"]) {
  if (!diversity?.maxPerRegion && !diversity?.maxPerCategory) {
    return items;
  }

  const regionCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const diversified: T[] = [];

  for (const item of items) {
    const regionKey = searchDiversityRegionKey(item.region);
    const categoryKey = item.primaryCategory;
    const regionCount = regionCounts.get(regionKey) ?? 0;
    const categoryCount = categoryCounts.get(categoryKey) ?? 0;

    if (diversity.maxPerRegion !== undefined && regionCount >= diversity.maxPerRegion) continue;
    if (diversity.maxPerCategory !== undefined && categoryCount >= diversity.maxPerCategory) continue;

    diversified.push(item);
    regionCounts.set(regionKey, regionCount + 1);
    categoryCounts.set(categoryKey, categoryCount + 1);
  }

  return diversified;
}

export function buildSearchCoursePlan(items: SearchCoursePlanItem[]) {
  const selected = new Set<string>();
  const pick = (predicate: (item: SearchCoursePlanItem) => boolean) => {
    const candidate = items.find((item) => !selected.has(item.id) && predicate(item));
    if (!candidate) return null;
    selected.add(candidate.id);
    return coursePlanCandidate(candidate);
  };

  const anchor = pick(isCourseAnchorCandidate) ?? pick(() => true);
  const optionalSecondStop = pick((item) => isCourseAnchorCandidate(item) || isShortSecondStopCandidate(item));
  const mealCareBase = pick(isMealCareBaseCandidate);
  const napBreak = pick(isNapBreakCandidate);
  const abortFallback = pick(isAbortFallbackCandidate);

  return {
    anchor,
    optionalSecondStop,
    mealCareBase,
    napBreak,
    abortFallback
  };
}

export function compactSearchPlaceItem(item: FullSearchItem) {
  return {
    id: item.id,
    name: item.name,
    primaryCategory: item.primaryCategory,
    tags: item.tags,
    address: item.address,
    region: item.region,
    regionSido: item.regionSido,
    regionSigungu: item.regionSigungu,
    countryCode: item.countryCode,
    countryName: item.countryName,
    city: item.city,
    locality: item.locality,
    localCurrency: item.localCurrency,
    lat: item.lat,
    lng: item.lng,
    distanceKm: item.distanceKm,
    score: item.score,
    placeQualityScore: item.placeQualityScore,
    reasonCodes: item.reasonCodes,
    reasons: item.reasons,
    dataConfidence: item.dataConfidence,
    taxonomy: item.taxonomy,
    pricing: item.pricing,
    reviewSearchEvidence: item.reviewSearchEvidence,
    routeSupport: item.routeSupport,
    recommendedAgeMonths: item.recommendedAgeMonths,
    infantLogistics: item.infantLogistics,
    structuredDataGaps: item.structuredDataGaps,
    openingHoursSummary: item.openingHoursSummary,
    recommendationReadiness: item.recommendationReadiness,
    facilities: {
      indoorType: item.facilities.indoorType,
      strollerFriendly: item.facilities.strollerFriendly,
      parkingAvailable: item.facilities.parkingAvailable,
      parkingFrictionLevel: item.facilities.parkingFrictionLevel,
      peakParkingWindow: item.facilities.peakParkingWindow,
      parkingWaitNote: item.facilities.parkingWaitNote,
      nursingRoom: item.facilities.nursingRoom,
      diaperChangingTable: item.facilities.diaperChangingTable,
      kidsToilet: item.facilities.kidsToilet,
      elevator: item.facilities.elevator,
      babyChair: item.facilities.babyChair,
      foodAllowed: item.facilities.foodAllowed
    },
    visit: {
      reservationRequired: item.visit.reservationRequired,
      walkInAvailable: item.visit.walkInAvailable,
      sessionBased: item.visit.sessionBased,
      sameDayAvailabilityKnown: item.visit.sameDayAvailabilityKnown,
      averageStayMinutes: item.visit.averageStayMinutes,
      parentEffortLevel: item.visit.parentEffortLevel,
      childEngagementLevel: item.visit.childEngagementLevel
    },
    notes: item.notes,
    primaryImageUrl: item.primaryImage?.url ?? item.imageHealth.primaryImageUrl,
    imageHealth: item.imageHealth,
    sourceSummary: item.sourceSummary,
    userRatingSummary: item.userRatingSummary
  };
}

function compactDuplicatePlaceCandidate(item: DuplicateCandidateItem) {
  return {
    place: {
      id: item.place.id,
      name: item.place.name,
      primaryCategory: item.place.primaryCategory,
      address: item.place.address,
      roadAddress: item.place.roadAddress,
      region: item.place.region,
      regionSido: item.place.regionSido,
      regionSigungu: item.place.regionSigungu,
      countryCode: item.place.countryCode,
      countryName: item.place.countryName,
      city: item.place.city,
      locality: item.place.locality,
      lat: item.place.lat,
      lng: item.place.lng,
      status: item.place.status,
      dataConfidence: item.place.dataConfidence,
      updatedAt: item.place.updatedAt
    },
    confidence: item.confidence,
    reasonCodes: item.reasonCodes,
    suggestedAction: item.suggestedAction,
    relationshipHint: item.relationshipHint,
    outsideRadiusReviewOnly: item.outsideRadiusReviewOnly,
    distanceMeters: item.distanceMeters,
    nameSimilarity: item.nameSimilarity
  };
}

export function compactDuplicatePlaceCandidateForTest(item: DuplicateCandidateItem) {
  return compactDuplicatePlaceCandidate(item);
}

function searchDiversityRegionKey(
  region:
    | {
        sido: string | null;
        sigungu: string | null;
        countryCode?: string | null;
        city?: string | null;
      }
    | null
    | undefined
) {
  const countryOrSido = region?.countryCode?.trim() || region?.sido?.trim() || "unknown_sido";
  const cityOrSigungu = region?.city?.trim() || region?.sigungu?.trim() || "unknown_sigungu";
  return [countryOrSido, cityOrSigungu].join(":");
}

function coursePlanCandidate(item: SearchCoursePlanItem) {
  return {
    id: item.id,
    name: item.name,
    primaryCategory: item.primaryCategory,
    distanceKm: item.distanceKm,
    score: item.score,
    estimatedParentEffort: estimatedCourseParentEffort(item),
    driveBurden: courseDriveBurden(item.distanceKm),
    imageHealth: item.imageHealth ?? null,
    reasonCodes: coursePlanReasonCodes(item)
  };
}

function isCourseAnchorCandidate(item: SearchCoursePlanItem) {
  return (
    [
      "kids_cafe",
      "indoor_playground",
      "playground",
      "toy_library",
      "library",
      "art_museum",
      "museum",
      "science_museum",
      "experience_center",
      "aquarium",
      "zoo",
      "park",
      "accommodation"
    ].includes(item.primaryCategory) || (item.visit.childEngagementLevel ?? 0) >= 4
  );
}

function isShortSecondStopCandidate(item: SearchCoursePlanItem) {
  return (item.visit.averageStayMinutes ?? 90) <= 90 || item.primaryCategory === "park" || item.primaryCategory === "playground" || item.primaryCategory === "shopping_mall";
}

function isMealCareBaseCandidate(item: SearchCoursePlanItem) {
  return (
    ["family_restaurant", "family_cafe", "shopping_mall", "rest_area"].includes(item.primaryCategory) ||
    positiveTriState(item.facilities.babyChair) ||
    positiveTriState(item.facilities.foodAllowed)
  );
}

function isNapBreakCandidate(item: SearchCoursePlanItem) {
  return (
    ["rest_area", "shopping_mall", "accommodation", "park", "playground"].includes(item.primaryCategory) ||
    (item.visit.parentEffortLevel !== null && item.visit.parentEffortLevel <= 2)
  );
}

function isAbortFallbackCandidate(item: SearchCoursePlanItem) {
  const facilitySignals = [
    item.facilities.strollerFriendly,
    item.facilities.elevator,
    item.facilities.nursingRoom,
    item.facilities.diaperChangingTable,
    item.facilities.parkingAvailable
  ];
  const supportCount = facilitySignals.filter(positiveTriState).length;
  return (item.facilities.indoorType === "indoor" || item.facilities.indoorType === "mixed") && supportCount >= 2;
}

function positiveTriState(value: string) {
  return value === "yes" || value === "partial";
}

function estimatedCourseParentEffort(item: SearchCoursePlanItem) {
  if (typeof item.visit.parentEffortLevel === "number") return item.visit.parentEffortLevel;
  if (item.distanceKm !== null && item.distanceKm >= 80) return 4;
  if (item.distanceKm !== null && item.distanceKm >= 35) return 3;
  if (isAbortFallbackCandidate(item) || isMealCareBaseCandidate(item)) return 2;
  return 3;
}

function courseDriveBurden(distanceKm: number | null) {
  if (distanceKm === null) return "unknown";
  if (distanceKm < 10) return "nearby";
  if (distanceKm < 35) return "easy";
  if (distanceKm < 80) return "moderate";
  return "heavy";
}

function coursePlanReasonCodes(item: SearchCoursePlanItem) {
  const codes = new Set<string>();
  if (isCourseAnchorCandidate(item)) codes.add("COURSE_ANCHOR_FIT");
  if (isMealCareBaseCandidate(item)) codes.add("COURSE_MEAL_CARE_BASE");
  if (isNapBreakCandidate(item)) codes.add("COURSE_NAP_BREAK");
  if (isAbortFallbackCandidate(item)) codes.add("COURSE_ABORT_FALLBACK");
  if (item.distanceKm !== null) codes.add(`DRIVE_${courseDriveBurden(item.distanceKm).toUpperCase()}`);
  return Array.from(codes);
}

function applySearchEvidenceCaps(value: number, scoring: ReturnType<typeof mapPlace>["scoring"]) {
  if (scoring.placeScore === null && scoring.externalRatingScore === null && scoring.searchEvidenceScore === null) return Math.min(value, 88);
  if (scoring.placeScore === null) return Math.min(value, 92);
  if (scoring.externalRatingScore === null) return Math.min(value, 96);
  return value;
}

type PlaceImageHealthHelperInput = Omit<Partial<PlaceImageHealthQueryInput>, "placeIds" | "limit" | "offset"> & {
  placeIds?: PlaceImageHealthQueryInput["placeIds"] | string | null;
  limit?: PlaceImageHealthQueryInput["limit"] | string;
  offset?: PlaceImageHealthQueryInput["offset"] | string;
};

function normalizePlaceImageHealthQuery(input: PlaceImageHealthQueryInput | PlaceImageHealthHelperInput) {
  return placeImageHealthQuerySchema.parse(input);
}

export function normalizePlaceImageHealthQueryForTest(input: PlaceImageHealthQueryInput | PlaceImageHealthHelperInput) {
  return normalizePlaceImageHealthQuery(input);
}

export async function listPlaceImageHealth(rawInput: PlaceImageHealthQueryInput | PlaceImageHealthHelperInput) {
  const input = normalizePlaceImageHealthQuery(rawInput);
  const params: SqlParam[] = [];
  const where = ["p.status = 'active'"];
  const add = (value: unknown) => {
    params.push(value as SqlParam);
    return `$${params.length}`;
  };

  if (input.primaryCategory) {
    where.push(`p.primary_category = ${add(input.primaryCategory)}`);
  }
  if (input.placeIds && input.placeIds.length > 0) {
    where.push(`p.id = any(${add(input.placeIds)}::uuid[])`);
  }

  const healthPredicate = imageHealthPredicate(input.status);
  const baseParams = [...params];
  const rows = await pg.unsafe<PlaceImageHealthRow[]>(
    `
      with image_counts as (
        select
          p.id as place_id,
          p.name,
          p.primary_category,
          p.tags,
          p.address,
          p.road_address,
          p.region_sido,
          p.region_sigungu,
          p.region_dong,
          p.country_code,
          p.country_name,
          p.city,
          p.locality,
          p.local_currency,
          p.data_confidence,
          p.updated_at,
          count(i.id) filter (where i.status = 'active' and i.review_status <> 'rejected')::int as active_image_count,
          count(i.id) filter (where i.status = 'active' and i.review_status = 'approved')::int as approved_image_count,
          count(i.id) filter (where i.status = 'active' and i.review_status = 'needs_review')::int as needs_review_image_count,
          count(i.id) filter (where i.status = 'active' and i.review_status = 'pending_review')::int as pending_review_image_count,
          count(i.id) filter (where i.review_status = 'rejected')::int as rejected_image_count,
          count(i.id) filter (where i.status = 'archived')::int as archived_image_count,
          count(i.id) filter (where i.status = 'active' and i.review_status <> 'rejected' and i.is_primary)::int as primary_active_image_count,
          (array_agg(i.url order by i.is_primary desc, i.sort_order asc, i.created_at asc)
            filter (where i.status = 'active' and i.review_status <> 'rejected'))[1] as primary_image_url,
          (array_agg(i.review_status order by i.is_primary desc, i.sort_order asc, i.created_at asc)
            filter (where i.status = 'active' and i.review_status <> 'rejected'))[1] as primary_review_status,
          max(i.checked_at) as latest_image_checked_at,
          max(i.updated_at) as latest_image_updated_at
        from places p
        left join place_images i on i.place_id = p.id
        where ${where.join(" and ")}
        group by p.id
      ),
      image_health as (
        select
          *,
          case
            when active_image_count = 0 and rejected_image_count > 0 then 'rejected_only'
            when active_image_count = 0 then 'no_active_image'
            when primary_active_image_count = 0 then 'no_primary'
            when needs_review_image_count > 0 then 'needs_review'
            when pending_review_image_count > 0 then 'pending_review'
            else 'healthy'
          end as health_status,
          (
            case when active_image_count = 0 then 100 else 0 end +
            case when active_image_count > 0 and primary_active_image_count = 0 then 35 else 0 end +
            needs_review_image_count * 12 +
            pending_review_image_count * 7 +
            rejected_image_count * 3
          )::int as priority_score
        from image_counts
      )
      select *
      from image_health
      where ${healthPredicate}
      order by priority_score desc, updated_at desc, name asc
      limit ${add(input.limit)}
      offset ${add(input.offset)}
    `,
    params
  );

  const totalRows = await pg.unsafe<{ total: number }[]>(
    `
      with image_counts as (
        select
          p.id as place_id,
          count(i.id) filter (where i.status = 'active' and i.review_status <> 'rejected')::int as active_image_count,
          count(i.id) filter (where i.status = 'active' and i.review_status = 'needs_review')::int as needs_review_image_count,
          count(i.id) filter (where i.status = 'active' and i.review_status = 'pending_review')::int as pending_review_image_count,
          count(i.id) filter (where i.review_status = 'rejected')::int as rejected_image_count,
          count(i.id) filter (where i.status = 'active' and i.review_status <> 'rejected' and i.is_primary)::int as primary_active_image_count
        from places p
        left join place_images i on i.place_id = p.id
        where ${where.join(" and ")}
        group by p.id
      ),
      image_health as (
        select
          *,
          case
            when active_image_count = 0 and rejected_image_count > 0 then 'rejected_only'
            when active_image_count = 0 then 'no_active_image'
            when primary_active_image_count = 0 then 'no_primary'
            when needs_review_image_count > 0 then 'needs_review'
            when pending_review_image_count > 0 then 'pending_review'
            else 'healthy'
          end as health_status
        from image_counts
      )
      select count(*)::int as total
      from image_health
      where ${healthPredicate}
    `,
    baseParams
  );

  return {
    items: rows.map(mapPlaceImageHealthRow),
    meta: {
      count: rows.length,
      total: totalRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
      status: input.status,
      placeIds: input.placeIds ?? null,
      primaryCategory: input.primaryCategory ?? null
    }
  };
}

async function getPlaceImageMetadata(placeId: string, executor: SqlExecutor = pg) {
  const imageRows = await executor<PlaceImageRow[]>`
    select * from place_images
    where place_id = ${placeId}
      and status = 'active'
      and review_status <> 'rejected'
    order by is_primary desc, sort_order asc, created_at asc
  `;

  return buildImageMetadataFromRows(imageRows);
}

async function getRelatedPlaces(placeId: string, executor: SqlExecutor = pg) {
  const rows = await executor<RelatedPlaceRow[]>`
    select
      r.id as relation_id,
      case when r.place_id = ${placeId} then r.related_place_id else r.place_id end as related_place_id,
      r.relation_type,
      r.note,
      r.evidence,
      r.created_at as relation_created_at,
      r.updated_at as relation_updated_at,
      related.name,
      related.primary_category,
      related.tags,
      related.address,
      related.road_address,
      related.lat,
      related.lng,
      related.status,
      ST_Distance(current_place.geo, related.geo) as distance_meters
    from place_related_places r
    join places current_place on current_place.id = ${placeId}
    join places related on related.id = case when r.place_id = ${placeId} then r.related_place_id else r.place_id end
    where r.place_id = ${placeId}
      or r.related_place_id = ${placeId}
    order by distance_meters asc nulls last, related.name asc
  `;

  return rows.map(mapRelatedPlace);
}

async function getRelatedPlaceScoringSummaryMap(placeIds: string[]) {
  const summaryMap = new Map<string, RelatedPlaceScoringSummary>();
  if (placeIds.length === 0) return summaryMap;

  const rows = await pg<
    {
      place_id: string;
      related_place_id: string;
      relation_type: string;
      related_name: string;
      related_primary_category: string;
      related_tags: string[];
    }[]
  >`
    select
      r.place_id,
      related.id as related_place_id,
      r.relation_type,
      related.name as related_name,
      related.primary_category as related_primary_category,
      related.tags as related_tags
    from place_related_places r
    join places related on related.id = r.related_place_id
    where r.place_id = any(${placeIds}::uuid[])
      and related.status = 'active'
    union all
    select
      r.related_place_id as place_id,
      related.id as related_place_id,
      r.relation_type,
      related.name as related_name,
      related.primary_category as related_primary_category,
      related.tags as related_tags
    from place_related_places r
    join places related on related.id = r.place_id
    where r.related_place_id = any(${placeIds}::uuid[])
      and related.status = 'active'
  `;

  return summarizeRelatedPlaceScoringRows(
    rows.map((row): RelatedPlaceScoringRow => ({
      placeId: row.place_id,
      relatedPlaceId: row.related_place_id,
      relationType: row.relation_type,
      relatedName: row.related_name,
      relatedPrimaryCategory: row.related_primary_category,
      relatedTags: row.related_tags
    }))
  );
}

function imageHealthPredicate(status: PlaceImageHealthQueryInput["status"]) {
  switch (status) {
    case "no_active_image":
      return "health_status = 'no_active_image'";
    case "rejected_only":
      return "health_status = 'rejected_only'";
    case "needs_review":
      return "health_status = 'needs_review'";
    case "pending_review":
      return "health_status = 'pending_review'";
    case "no_primary":
      return "health_status = 'no_primary'";
    case "healthy":
      return "health_status = 'healthy'";
    case "all":
      return "true";
    case "attention":
    default:
      return "health_status <> 'healthy'";
  }
}

function mapPlaceImageHealthRow(row: PlaceImageHealthRow) {
  const suggestedAction = imageHealthSuggestedAction(row.health_status);
  return {
    placeId: row.place_id,
    name: row.name,
    primaryCategory: row.primary_category,
    tags: row.tags,
    address: row.address,
    roadAddress: row.road_address,
    region: {
      sido: row.region_sido,
      sigungu: row.region_sigungu,
      dong: row.region_dong,
      countryCode: row.country_code,
      countryName: row.country_name,
      city: row.city,
      locality: row.locality,
      localCurrency: row.local_currency
    },
    dataConfidence: row.data_confidence,
    updatedAt: toIso(row.updated_at),
    imageHealth: {
      status: row.health_status,
      suggestedAction,
      priorityScore: row.priority_score,
      activeCount: row.active_image_count,
      approvedCount: row.approved_image_count,
      needsReviewCount: row.needs_review_image_count,
      pendingReviewCount: row.pending_review_image_count,
      rejectedCount: row.rejected_image_count,
      archivedCount: row.archived_image_count,
      hasPrimary: row.primary_active_image_count > 0,
      primaryImageUrl: row.primary_image_url,
      primaryReviewStatus: row.primary_review_status,
      latestImageCheckedAt: row.latest_image_checked_at ? toIso(row.latest_image_checked_at) : null,
      latestImageUpdatedAt: row.latest_image_updated_at ? toIso(row.latest_image_updated_at) : null
    }
  };
}

function imageHealthSuggestedAction(status: string) {
  switch (status) {
    case "rejected_only":
      return "find_replacement_image";
    case "no_active_image":
      return "find_first_image";
    case "no_primary":
      return "choose_primary_image";
    case "needs_review":
      return "review_or_replace_images";
    case "pending_review":
      return "audit_pending_images";
    default:
      return "none";
  }
}

async function getImageMapForPlaces(placeIds: string[]) {
  const imageMap = new Map<string, PlaceImageRow[]>();
  if (placeIds.length === 0) return imageMap;

  const imageRows = await pg<PlaceImageRow[]>`
    select * from place_images
    where place_id = any(${placeIds}::uuid[])
      and status = 'active'
      and review_status <> 'rejected'
    order by place_id, is_primary desc, sort_order asc, created_at asc
  `;

  for (const row of imageRows) {
    const images = imageMap.get(row.place_id) ?? [];
    images.push(row);
    imageMap.set(row.place_id, images);
  }

  return imageMap;
}

async function getSourceSummaryMapForPlaces(placeIds: string[]) {
  const sourceMap = new Map<string, SearchSourceSummaryRow[]>();
  if (placeIds.length === 0) return new Map<string, ReturnType<typeof buildSearchSourceSummary>>();

  const sourceRows = await pg<SearchSourceSummaryRow[]>`
    select place_id, source_type, title, summary, checked_at, created_at from place_sources
    where place_id = any(${placeIds}::uuid[])
    order by place_id, checked_at desc nulls last, created_at desc
  `;

  for (const row of sourceRows) {
    const sources = sourceMap.get(row.place_id) ?? [];
    sources.push(row);
    sourceMap.set(row.place_id, sources);
  }

  return new Map(Array.from(sourceMap.entries()).map(([placeId, rows]) => [placeId, buildSearchSourceSummary(rows)]));
}

export async function findDuplicatePlaces(input: DuplicatePlaceInput) {
  const containsName = `%${input.name}%`;
  const compactName = compactSearchText(input.name);
  const containsCompactName = `%${compactName}%`;
  const aliasCompacts = Array.from(new Set([input.name, ...(input.aliases ?? [])].map(compactSearchText).filter(Boolean)));
  const retailAliasCompacts = retailAliasCompactTexts(input.name);
  const genericAliasTerms = duplicateGenericAliasTerms;
  const hasCoordinates = input.lat !== undefined && input.lng !== undefined;
  const lat = input.lat ?? null;
  const lng = input.lng ?? null;
  const addressCandidates = Array.from(new Set([input.roadAddress, input.address].filter(isNonEmptyString).map(compactSearchText)));
  const compactRegionSido = input.regionSido ? compactSearchText(input.regionSido) : null;
  const compactRegionSigungu = input.regionSigungu ? compactSearchText(input.regionSigungu) : null;
  const compactCity = input.city ? compactSearchText(input.city) : null;
  const externalRefsJson =
    input.externalRefs && Object.keys(input.externalRefs).length > 0 ? JSON.stringify(input.externalRefs) : null;
  const rows = await pg<
    (PlaceRow & {
      distance_meters: number | null;
      name_similarity: number | null;
      alias_match: boolean;
      address_match: boolean;
      region_match: boolean;
      external_refs_match: boolean;
      kakao_place_id_match: boolean;
    })[]
  >`
    with scored as (
      select
        *,
        case
          when ${hasCoordinates} then least(
            ST_Distance(geo, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography),
            ST_Distance(ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography)
          )
          else null
        end as distance_meters,
        case
          when ${hasCoordinates} then (
            ST_DWithin(geo, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${input.radiusMeters})
            or ST_DWithin(
              ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
              ${input.radiusMeters}
            )
          )
          else false
        end as geo_near,
        greatest(
          similarity(name, ${input.name}),
          case when name = ${input.name} then 1 else 0 end,
          case when name ilike ${containsName} or ${input.name} ilike ('%' || name || '%') then 0.65 else 0 end,
          case
            when regexp_replace(lower(name), '\\s+', '', 'g') ilike ${containsCompactName}
              or ${compactName} ilike ('%' || regexp_replace(lower(name), '\\s+', '', 'g') || '%')
            then 0.65
            else 0
          end,
          case when regexp_replace(lower(name), '\\s+', '', 'g') = any(${retailAliasCompacts}::text[]) then 0.82 else 0 end,
          case when regexp_replace(lower(name), '\\s+', '', 'g') = any(${aliasCompacts}::text[]) then 0.9 else 0 end,
          case
            when exists (
              select 1
              from jsonb_array_elements_text(
                case when jsonb_typeof(external_refs->'aliases') = 'array' then external_refs->'aliases' else '[]'::jsonb end
                || case when jsonb_typeof(external_refs->'koreanSearchAliases') = 'array' then external_refs->'koreanSearchAliases' else '[]'::jsonb end
                || case when jsonb_typeof(external_refs->'englishName') = 'string' then jsonb_build_array(external_refs->>'englishName') else '[]'::jsonb end
                || case when jsonb_typeof(external_refs->'localName') = 'string' then jsonb_build_array(external_refs->>'localName') else '[]'::jsonb end
              ) as external_alias(value)
              where regexp_replace(lower(external_alias.value), '\\s+', '', 'g') = any(${aliasCompacts}::text[])
            )
            then 0.9
            else 0
          end,
          case
            when exists (
              select 1
              from unnest(tags) as duplicate_tag
              where char_length(regexp_replace(lower(duplicate_tag), '\\s+', '', 'g')) >= 3
                and regexp_replace(lower(duplicate_tag), '\\s+', '', 'g') <> all(${genericAliasTerms}::text[])
                and (
                  regexp_replace(lower(duplicate_tag), '\\s+', '', 'g') ilike ${containsCompactName}
                  or ${compactName} ilike ('%' || regexp_replace(lower(duplicate_tag), '\\s+', '', 'g') || '%')
                )
            )
            then 0.72
            else 0
          end,
          case when regexp_replace(lower(external_refs::text), '\\s+', '', 'g') ilike ${containsCompactName} then 0.72 else 0 end
        ) as name_similarity,
        (
          exists (
            select 1
            from unnest(tags) as duplicate_tag
            where char_length(regexp_replace(lower(duplicate_tag), '\\s+', '', 'g')) >= 3
              and regexp_replace(lower(duplicate_tag), '\\s+', '', 'g') <> all(${genericAliasTerms}::text[])
              and (
                regexp_replace(lower(duplicate_tag), '\\s+', '', 'g') ilike ${containsCompactName}
                or ${compactName} ilike ('%' || regexp_replace(lower(duplicate_tag), '\\s+', '', 'g') || '%')
              )
          )
          or regexp_replace(lower(external_refs::text), '\\s+', '', 'g') ilike ${containsCompactName}
          or regexp_replace(lower(name), '\\s+', '', 'g') = any(${retailAliasCompacts}::text[])
          or regexp_replace(lower(name), '\\s+', '', 'g') = any(${aliasCompacts}::text[])
          or exists (
            select 1
            from jsonb_array_elements_text(
              case when jsonb_typeof(external_refs->'aliases') = 'array' then external_refs->'aliases' else '[]'::jsonb end
              || case when jsonb_typeof(external_refs->'koreanSearchAliases') = 'array' then external_refs->'koreanSearchAliases' else '[]'::jsonb end
              || case when jsonb_typeof(external_refs->'englishName') = 'string' then jsonb_build_array(external_refs->>'englishName') else '[]'::jsonb end
              || case when jsonb_typeof(external_refs->'localName') = 'string' then jsonb_build_array(external_refs->>'localName') else '[]'::jsonb end
            ) as external_alias(value)
            where regexp_replace(lower(external_alias.value), '\\s+', '', 'g') = any(${aliasCompacts}::text[])
          )
        ) as alias_match,
        (
          array_length(${addressCandidates}::text[], 1) is not null
          and (
            regexp_replace(lower(coalesce(road_address, '')), '\\s+', '', 'g') = any(${addressCandidates}::text[])
            or regexp_replace(lower(coalesce(address, '')), '\\s+', '', 'g') = any(${addressCandidates}::text[])
          )
        ) as address_match,
        (
          (
            ${input.regionSigungu ?? null}::text is not null
            or ${input.regionSido ?? null}::text is not null
            or ${input.countryCode ?? null}::text is not null
            or ${input.city ?? null}::text is not null
          )
          and (
            (${input.regionSigungu ?? null}::text is not null and region_sigungu = ${input.regionSigungu ?? null})
            or (${input.regionSido ?? null}::text is not null and region_sido = ${input.regionSido ?? null})
            or (${compactRegionSigungu}::text is not null and regexp_replace(lower(coalesce(address, '')), '\\s+', '', 'g') ilike ('%' || ${compactRegionSigungu}::text || '%'))
            or (${compactRegionSigungu}::text is not null and regexp_replace(lower(coalesce(road_address, '')), '\\s+', '', 'g') ilike ('%' || ${compactRegionSigungu}::text || '%'))
            or (${compactRegionSido}::text is not null and regexp_replace(lower(coalesce(address, '')), '\\s+', '', 'g') ilike ('%' || ${compactRegionSido}::text || '%'))
            or (${compactRegionSido}::text is not null and regexp_replace(lower(coalesce(road_address, '')), '\\s+', '', 'g') ilike ('%' || ${compactRegionSido}::text || '%'))
            or (${input.countryCode ?? null}::text is not null and country_code = ${input.countryCode ?? null})
            or (${compactCity}::text is not null and regexp_replace(lower(coalesce(city, '')), '\\s+', '', 'g') = ${compactCity})
            or (${compactCity}::text is not null and regexp_replace(lower(coalesce(locality, '')), '\\s+', '', 'g') = ${compactCity})
            or (${input.countryCode ?? null}::text is not null and external_refs->>'countryCode' = ${input.countryCode ?? null})
            or (${compactCity}::text is not null and regexp_replace(lower(coalesce(external_refs->>'city', '')), '\\s+', '', 'g') = ${compactCity})
          )
        ) as region_match,
        (${externalRefsJson}::jsonb is not null and external_refs @> ${externalRefsJson}::jsonb) as external_refs_match,
        (${input.kakaoPlaceId ?? null}::text is not null and kakao_place_id = ${input.kakaoPlaceId ?? null}) as kakao_place_id_match
      from places
      where status <> 'closed'
    )
    select *
    from scored
    where
      kakao_place_id_match
      or external_refs_match
      or (geo_near and (name_similarity >= 0.25 or alias_match))
      or (address_match and (name_similarity >= 0.25 or alias_match))
      or (region_match and (name_similarity >= 0.45 or alias_match))
    order by kakao_place_id_match desc, external_refs_match desc, address_match desc, region_match desc, alias_match desc, name_similarity desc, distance_meters asc nulls last
    limit ${input.limit}
  `;

  const items: DuplicateCandidateItem[] = await Promise.all(
    rows.map(async (row) => {
      const locationSignals = duplicateLocationSignals(input, {
        address: row.address,
        addressMatch: row.address_match,
        distanceMeters: row.distance_meters,
        regionMatch: row.region_match,
        regionSido: row.region_sido,
        regionSigungu: row.region_sigungu,
        roadAddress: row.road_address
      });
      const signals = {
        aliasMatch: row.alias_match,
        addressMatch: row.address_match,
        regionMatch: row.region_match,
        branchSiblingReviewOnly: duplicateBranchSiblingReviewOnly(input.name, row.name),
        lodgingClusterReviewOnly: row.primary_category === "accommodation" && duplicateLodgingClusterReviewOnly(input.name, row.name),
        weakThematicSimilarityReviewOnly: duplicateWeakThematicSimilarityReviewOnly(input.name, row.name),
        genericBranchName: duplicateGenericBranchName(input.name, row.name),
        publicSubfacilityReviewOnly: duplicatePublicSubfacilityReviewOnly(input.name, row.name),
        sameBuildingReviewOnly: duplicateSameBuildingReviewOnly(input.name, row.name),
        ...locationSignals,
        externalRefsMatch: row.external_refs_match,
        kakaoPlaceIdMatch: row.kakao_place_id_match,
        distanceMeters: row.distance_meters,
        nameSimilarity: row.name_similarity,
        radiusMeters: hasCoordinates ? input.radiusMeters : null
      };
      const duplicateSignals = {
        ...signals,
        sameSidoGenericReviewOnly: duplicateSameSidoGenericReviewOnly(input.name, row.name, signals)
      };

      return {
        place: await getPlaceDetail(row.id),
        confidence: duplicateConfidence(duplicateSignals),
        reasonCodes: duplicateReasonCodes(duplicateSignals),
        suggestedAction: duplicateSuggestedAction(duplicateSignals),
        relationshipHint: duplicateRelationshipHint(duplicateSignals),
        outsideRadiusReviewOnly: duplicateOutsideRadiusReviewOnly(duplicateSignals),
        distanceMeters: row.distance_meters,
        nameSimilarity: row.name_similarity
      };
    })
  );

  return {
    items: input.projection === "compact" ? items.map(compactDuplicatePlaceCandidate) : items
  };
}

const duplicateGenericAliasTerms = [
  "공원",
  "놀이터",
  "어린이공원",
  "동네놀이터",
  "근린공원",
  "도시공원",
  "공공놀이터",
  "children_playground",
  "small_playground",
  "play_equipment",
  "after_daycare_backup",
  "short_stop",
  "outdoor",
  "실외",
  "동구",
  "중구",
  "서구",
  "유성구",
  "대덕구",
  "원도심",
  "가오동",
  "석교동",
  "판암동"
];

export async function listPlaceVersions(placeId: string, executor: SqlExecutor = pg) {
  await ensurePlaceExists(executor, placeId);

  const versions = await executor<VersionRow[]>`
    select * from place_versions
    where place_id = ${placeId}
    order by version_number desc
  `;

  return {
    items: versions.map(mapVersionSummary)
  };
}

async function ensurePlaceExists(executor: SqlExecutor, placeId: string) {
  const rows = await executor<{ id: string }[]>`
    select id from places
    where id = ${placeId}
    limit 1
  `;

  if (rows.length === 0) {
    throw new ApiError(404, "Place not found");
  }
}

export async function getPlaceVersion(placeId: string, versionId: string) {
  const versions = await pg<VersionRow[]>`
    select * from place_versions
    where place_id = ${placeId}
      and (id::text = ${versionId} or version_number::text = ${versionId})
    limit 1
  `;

  if (versions.length === 0) {
    throw new ApiError(404, "Place version not found");
  }

  return mapVersion(versions[0]);
}

function normalizeCreatePlaceInput(input: CreatePlaceInput): CreatePlaceInput {
  const normalized = normalizePlaceWriteInput(input);
  return {
    ...normalized,
    taxonomy: normalized.taxonomy ?? buildInitialPlaceTaxonomy(normalized)
  };
}

function normalizeUpdatePlaceInput(input: UpdatePlaceInput): UpdatePlaceInput {
  return normalizePlaceWriteInput(input);
}

function normalizePlaceWriteInput<T extends CreatePlaceInput | UpdatePlaceInput>(input: T): T {
  const tags = normalizeTags(input.tags);
  return {
    ...input,
    ...(input.primaryCategory !== undefined ? { primaryCategory: normalizePrimaryCategory(input.primaryCategory) ?? input.primaryCategory } : {}),
    ...(input.regionSido !== undefined ? { regionSido: normalizeRegionSido(input.regionSido) } : {}),
    ...(input.countryCode !== undefined ? { countryCode: normalizeUpperCode(input.countryCode) } : {}),
    ...(input.localCurrency !== undefined ? { localCurrency: normalizeUpperCode(input.localCurrency) } : {}),
    ...(tags !== undefined ? { tags } : {}),
    sources: normalizeSources(input.sources),
    ...(input.images !== undefined ? { images: normalizePlaceImages(input.images) } : {})
  };
}

function normalizeUpperCode(value: string | undefined) {
  return value?.trim().toUpperCase();
}

const REGION_SIDO_EXACT_ALIASES: Record<string, string[]> = {
  강원특별자치도: ["강원", "강원도"],
  경상남도: ["경남"],
  경상북도: ["경북"],
  광주광역시: ["광주"],
  대구광역시: ["대구"],
  대전광역시: ["대전"],
  부산광역시: ["부산"],
  서울특별시: ["서울"],
  세종특별자치시: ["세종"],
  울산광역시: ["울산"],
  인천광역시: ["인천"],
  전라남도: ["전남"],
  전북특별자치도: ["전북", "전라북도"],
  제주특별자치도: ["제주", "제주도"],
  충청남도: ["충남"],
  충청북도: ["충북"]
};

function regionSidoExactCandidates(value: string) {
  const normalized = normalizeRegionSido(value);
  return Array.from(new Set([normalized, value.trim(), ...(REGION_SIDO_EXACT_ALIASES[normalized] ?? [])]));
}

function buildInitialPlaceTaxonomy(input: CreatePlaceInput): PlaceTaxonomy {
  const tags = input.tags ?? [];
  const legacyTags = normalizeLegacyTags(tags);
  const inferred = inferTaxonomyFromPlace(input);
  const hasInferred = hasFacetValues(inferred);

  return {
    ...emptyPlaceTaxonomy(),
    inferred: {
      ...inferred,
      confidence: hasInferred ? "medium" : "low",
      basis: hasInferred
        ? "Inferred from submitted category, tags, and logistics fields."
        : "No taxonomy facets were submitted; keep facets empty until source-backed evidence is added."
    },
    migration: {
      legacyTags: tags,
      broadMappedTags: legacyTags.broadMappedTags,
      unmappedTags: legacyTags.unmappedTags
    }
  };
}

function normalizeSources(sources: SourceInput[]): SourceInput[] {
  return sources.map((source) => ({
    ...source,
    sourceType: normalizeSourceType(source.sourceType) ?? source.sourceType
  }));
}

function normalizePlaceImages(images: PlaceImageInput[]): PlaceImageInput[] {
  return images.map((image) => ({
    ...image,
    ...(image.sourceType !== undefined ? { sourceType: normalizeSourceType(image.sourceType) ?? image.sourceType } : {})
  }));
}

function normalizeTags(tags: string[] | undefined) {
  if (tags === undefined) return undefined;
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function hasFacetValues(facets: PlaceTaxonomy["sourceBacked"]) {
  return Object.values(facets).some((values) => values.length > 0);
}

function toDbRecord(input: Partial<CreatePlaceInput | UpdatePlaceInput>) {
  const record: Record<string, unknown> = {};
  for (const [apiKey, dbKey] of Object.entries(columnMap)) {
    const value = input[apiKey as keyof typeof input];
    if (value !== undefined) {
      record[dbKey] = value;
    }
  }
  return record;
}

export function placeDbRecordForTest(input: CreatePlaceInput | UpdatePlaceInput) {
  return toDbRecord(normalizePlaceWriteInput(input));
}

async function insertSources(executor: SqlExecutor, placeId: string, sources: SourceInput[]) {
  for (const source of sources) {
    await executor`
      insert into place_sources (place_id, source_type, title, url, external_id, summary, checked_at)
      values (
        ${placeId},
        ${source.sourceType},
        ${source.title ?? null},
        ${source.url ?? null},
        ${source.externalId ?? null},
        ${source.summary ?? null},
        ${source.checkedAt ?? null}
      )
    `;
  }
}

type ImageSourceLinkRow = {
  image_id: string;
  source_id: string | null;
  source_url: string | null;
  source_type: string | null;
};

async function getImageSourceLinks(executor: SqlExecutor, placeId: string) {
  return executor<ImageSourceLinkRow[]>`
    select id as image_id, source_id, source_url, source_type
    from place_images
    where place_id = ${placeId}
      and source_url is not null
      and source_type is not null
  `;
}

async function reconnectImageSources(executor: SqlExecutor, placeId: string, imageSourceLinks: ImageSourceLinkRow[]) {
  for (const link of imageSourceLinks) {
    if (!link.source_url || !link.source_type) continue;

    const canonicalSourceType = normalizeSourceType(link.source_type) ?? link.source_type;
    const [source] = await executor<{ id: string }[]>`
      select id
      from place_sources
      where place_id = ${placeId}
        and url = ${link.source_url}
        and source_type = ${canonicalSourceType}
      order by created_at desc
      limit 1
    `;
    if (!source) continue;

    await executor`
      update place_images
      set source_id = ${source.id}, updated_at = now()
      where place_id = ${placeId}
        and id = ${link.image_id}
    `;
  }
}

type NormalizedImageInput = Required<Pick<PlaceImageInput, "url" | "status" | "reviewStatus" | "displayTier" | "isPrimary" | "sortOrder">> &
  Omit<PlaceImageInput, "url" | "status" | "reviewStatus" | "displayTier" | "isPrimary" | "sortOrder"> & {
    allowConflictMetadataOverwrite: boolean;
    allowConflictPrimaryOverwrite: boolean;
    allowConflictReviewStatusOverwrite: boolean;
  };

type ImageConflictPolicy = Pick<
  NormalizedImageInput,
  "allowConflictMetadataOverwrite" | "allowConflictPrimaryOverwrite" | "allowConflictReviewStatusOverwrite"
>;

type NormalizeImageInputsOptions = {
  assignFallbackPrimary?: boolean;
  allowStructuredPrimaryOverwrite?: boolean;
};

export function imageConflictPolicyForTest(
  images: PlaceImageInput[] | undefined,
  imageUrls: string[] | undefined,
  sources: SourceInput[],
  options?: NormalizeImageInputsOptions
) {
  return normalizeImageInputs(images, imageUrls, sources, options).map((image) => ({
    url: image.url,
    metadata: image.allowConflictMetadataOverwrite,
    primary: image.allowConflictPrimaryOverwrite,
    reviewStatus: image.allowConflictReviewStatusOverwrite
  }));
}

export function normalizedImagePrimaryForTest(
  images: PlaceImageInput[] | undefined,
  imageUrls: string[] | undefined,
  sources: SourceInput[],
  options?: NormalizeImageInputsOptions
) {
  return normalizeImageInputs(images, imageUrls, sources, options).map((image) => ({
    url: image.url,
    isPrimary: image.isPrimary,
    primary: image.allowConflictPrimaryOverwrite
  }));
}

function normalizeImageInputs(
  images: PlaceImageInput[] | undefined,
  imageUrls: string[] | undefined,
  sources: SourceInput[],
  options: NormalizeImageInputsOptions = {}
) {
  const fallbackSource = sources.find(isImageLikeSource) ?? sources[0] ?? null;
  const byUrl = new Map<string, NormalizedImageInput>();
  let index = 0;
  const assignFallbackPrimary = options.assignFallbackPrimary ?? true;
  const allowStructuredPrimaryOverwrite = options.allowStructuredPrimaryOverwrite ?? true;

  for (const image of images ?? []) {
    byUrl.set(
      image.url,
      normalizeImageInput(image, index, fallbackSource, {
        allowConflictMetadataOverwrite: true,
        allowConflictPrimaryOverwrite: allowStructuredPrimaryOverwrite || image.isPrimary === true,
        allowConflictReviewStatusOverwrite: true
      })
    );
    index += 1;
  }

  for (const url of imageUrls ?? []) {
    if (byUrl.has(url)) continue;
    byUrl.set(
      url,
      normalizeImageInput(
        {
          url,
          sourceUrl: fallbackSource?.url,
          sourceType: fallbackSource?.sourceType,
          sourceTitle: fallbackSource?.title,
          creditText: imageCreditText(fallbackSource, fallbackSource ? imageDisplayTier(fallbackSource) : "unknown"),
          checkedAt: fallbackSource?.checkedAt
        },
        index,
        fallbackSource,
        {
          allowConflictMetadataOverwrite: false,
          allowConflictPrimaryOverwrite: false,
          allowConflictReviewStatusOverwrite: false
        }
      )
    );
    index += 1;
  }

  const normalized = Array.from(byUrl.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  let primaryAssigned = false;
  for (const image of normalized) {
    if (!image.isPrimary || image.status !== "active" || image.reviewStatus === "rejected") continue;
    if (!primaryAssigned) {
      primaryAssigned = true;
      continue;
    }
    image.isPrimary = false;
  }
  const firstActive = normalized.find((image) => image.status === "active" && image.reviewStatus !== "rejected");
  if (
    assignFallbackPrimary &&
    firstActive &&
    !normalized.some((image) => image.isPrimary && image.status === "active" && image.reviewStatus !== "rejected")
  ) {
    firstActive.isPrimary = true;
  }

  return normalized;
}

function normalizeImageInput(
  image: PlaceImageInput,
  index: number,
  fallbackSource: SourceInput | null,
  conflictPolicy: ImageConflictPolicy
): NormalizedImageInput {
  const sourceLike = {
    sourceType: image.sourceType ?? fallbackSource?.sourceType ?? "unknown",
    title: image.sourceTitle ?? fallbackSource?.title,
    url: image.sourceUrl ?? fallbackSource?.url,
    externalId: fallbackSource?.externalId,
    summary: fallbackSource?.summary,
    checkedAt: image.checkedAt ?? fallbackSource?.checkedAt
  };
  const displayTier = image.displayTier ?? imageDisplayTier(sourceLike);

  return {
    ...image,
    sourceUrl: image.sourceUrl ?? fallbackSource?.url,
    sourceType: image.sourceType ?? fallbackSource?.sourceType,
    sourceTitle: image.sourceTitle ?? fallbackSource?.title,
    creditText: image.creditText ?? imageCreditText(sourceLike, displayTier),
    checkedAt: image.checkedAt ?? fallbackSource?.checkedAt,
    visualFeatures: image.visualFeatures ?? [],
    childSignals: image.childSignals ?? {},
    displayTier,
    status: image.status ?? "active",
    reviewStatus: image.reviewStatus ?? "pending_review",
    isPrimary: image.isPrimary ?? false,
    sortOrder: image.sortOrder ?? index,
    ...conflictPolicy
  };
}

async function insertImages(executor: SqlExecutor, placeId: string, images: NormalizedImageInput[]) {
  if (images.length === 0) return;

  if (
    images.some(
      (image) =>
        image.allowConflictPrimaryOverwrite && image.isPrimary && image.status === "active" && image.reviewStatus !== "rejected"
    )
  ) {
    await executor`update place_images set is_primary = false, updated_at = now() where place_id = ${placeId}`;
  }

  for (const image of images) {
    const allowMetadataOverwrite = image.allowConflictMetadataOverwrite;
    const allowPrimaryOverwrite = image.allowConflictPrimaryOverwrite;
    const allowReviewStatusOverwrite = image.allowConflictReviewStatusOverwrite;

    await executor`
      insert into place_images (
        place_id,
        url,
        source_id,
        source_type,
        source_title,
        source_url,
        credit_text,
        alt_text,
        description,
        visual_features,
        child_signals,
        display_tier,
        status,
        review_status,
        is_primary,
        sort_order,
        width,
        height,
        checked_at
      )
      values (
        ${placeId},
        ${image.url},
        ${image.sourceId ?? null},
        ${image.sourceType ?? null},
        ${image.sourceTitle ?? null},
        ${image.sourceUrl ?? null},
        ${image.creditText ?? null},
        ${image.altText ?? null},
        ${image.description ?? null},
        ${image.visualFeatures ?? []},
        ${JSON.stringify(image.childSignals ?? {})}::jsonb,
        ${image.displayTier},
        ${image.status},
        ${image.reviewStatus},
        ${image.isPrimary},
        ${image.sortOrder},
        ${image.width ?? null},
        ${image.height ?? null},
        ${image.checkedAt ?? null}
      )
      on conflict (place_id, url) do update set
        source_id = case when ${allowMetadataOverwrite} then coalesce(excluded.source_id, place_images.source_id) else place_images.source_id end,
        source_type = case when ${allowMetadataOverwrite} then coalesce(nullif(excluded.source_type, 'unknown'), place_images.source_type) else place_images.source_type end,
        source_title = case when ${allowMetadataOverwrite} then coalesce(excluded.source_title, place_images.source_title) else place_images.source_title end,
        source_url = case when ${allowMetadataOverwrite} then coalesce(excluded.source_url, place_images.source_url) else place_images.source_url end,
        credit_text = case when ${allowMetadataOverwrite} then coalesce(excluded.credit_text, place_images.credit_text) else place_images.credit_text end,
        alt_text = case when ${allowMetadataOverwrite} then coalesce(excluded.alt_text, place_images.alt_text) else place_images.alt_text end,
        description = case when ${allowMetadataOverwrite} then coalesce(excluded.description, place_images.description) else place_images.description end,
        visual_features = case
          when ${allowMetadataOverwrite} and cardinality(excluded.visual_features) > 0 then excluded.visual_features
          else place_images.visual_features
        end,
        child_signals = case
          when ${allowMetadataOverwrite} and excluded.child_signals <> '{}'::jsonb then excluded.child_signals
          else place_images.child_signals
        end,
        display_tier = case when ${allowMetadataOverwrite} then coalesce(nullif(excluded.display_tier, 'unknown'), place_images.display_tier) else place_images.display_tier end,
        status = case when ${allowMetadataOverwrite} then excluded.status else place_images.status end,
        review_status = case
          when ${allowReviewStatusOverwrite} then excluded.review_status
          when excluded.review_status in ('approved', 'needs_review') then excluded.review_status
          else place_images.review_status
        end,
        is_primary = case when ${allowPrimaryOverwrite} then excluded.is_primary else place_images.is_primary end,
        sort_order = case when ${allowMetadataOverwrite} then excluded.sort_order else place_images.sort_order end,
        width = case when ${allowMetadataOverwrite} then coalesce(excluded.width, place_images.width) else place_images.width end,
        height = case when ${allowMetadataOverwrite} then coalesce(excluded.height, place_images.height) else place_images.height end,
        checked_at = case when ${allowMetadataOverwrite} then coalesce(excluded.checked_at, place_images.checked_at) else place_images.checked_at end,
        updated_at = now()
    `;
  }
}

async function ensurePrimaryImage(executor: SqlExecutor, placeId: string) {
  await executor`
    update place_images
    set is_primary = true, updated_at = now()
    where id = (
      select id
      from place_images
      where place_id = ${placeId}
        and status = 'active'
        and review_status <> 'rejected'
      order by sort_order asc, created_at asc
      limit 1
    )
      and not exists (
        select 1
        from place_images
        where place_id = ${placeId}
          and status = 'active'
          and review_status <> 'rejected'
          and is_primary
      )
  `;
}

async function upsertRelatedPlaces(
  executor: SqlExecutor,
  placeId: string,
  relatedPlaces: RelatedPlaceInput[],
  mode: "append" | "replace"
) {
  if (mode === "replace") {
    await executor`delete from place_related_places where place_id = ${placeId} or related_place_id = ${placeId}`;
  }

  if (relatedPlaces.length === 0) return;

  const targetIds = Array.from(new Set(relatedPlaces.map((relatedPlace) => relatedPlace.placeId)));
  if (targetIds.includes(placeId)) {
    throw new ApiError(400, "A place cannot be related to itself");
  }

  const existingTargets = await executor<{ id: string }[]>`
    select id from places where id = any(${targetIds}::uuid[])
  `;
  const existingIds = new Set(existingTargets.map((row) => row.id));
  const missingIds = targetIds.filter((targetId) => !existingIds.has(targetId));
  if (missingIds.length > 0) {
    throw new ApiError(400, `Related place not found: ${missingIds.join(", ")}`);
  }

  const byPair = new Map<string, RelatedPlaceInput & { leftId: string; rightId: string }>();
  for (const relatedPlace of relatedPlaces) {
    const [leftId, rightId] = relatedPlacePair(placeId, relatedPlace.placeId);
    byPair.set(`${leftId}:${rightId}`, { ...relatedPlace, leftId, rightId });
  }

  for (const relatedPlace of byPair.values()) {
    await executor`
      insert into place_related_places (place_id, related_place_id, relation_type, note, evidence)
      values (
        ${relatedPlace.leftId},
        ${relatedPlace.rightId},
        ${relatedPlace.relationType},
        ${relatedPlace.note ?? null},
        ${JSON.stringify(relatedPlace.evidence ?? {})}::jsonb
      )
      on conflict (place_id, related_place_id) do update set
        relation_type = excluded.relation_type,
        note = excluded.note,
        evidence = excluded.evidence,
        updated_at = now()
    `;
  }
}

export function relatedPlacePair(placeId: string, relatedPlaceId: string) {
  return [placeId, relatedPlaceId].sort() as [string, string];
}

async function createVersion(
  executor: SqlExecutor,
  placeId: string,
  versionNumber: number,
  action: "create" | "update",
  actor: string,
  changeSummary: string | undefined,
  sources: SourceInput[]
) {
  await executor`
    insert into place_versions (place_id, version_number, action, actor, change_summary, snapshot, sources)
    values (
      ${placeId},
      ${versionNumber},
      ${action},
      ${actor},
      ${changeSummary ?? null},
      (
        select jsonb_build_object(
          'place',
          to_jsonb(p) - 'image_urls',
          'images',
          coalesce(
            (
              select jsonb_agg(to_jsonb(i) order by i.is_primary desc, i.sort_order asc, i.created_at asc)
              from place_images i
              where i.place_id = ${placeId}
            ),
            '[]'::jsonb
          ),
          'relatedPlaces',
          coalesce(
            (
              select jsonb_agg(to_jsonb(r) order by r.created_at asc)
              from place_related_places r
              where r.place_id = ${placeId}
                or r.related_place_id = ${placeId}
            ),
            '[]'::jsonb
          )
        )
        from places p
        where p.id = ${placeId}
      ),
      ${JSON.stringify(sources)}::jsonb
    )
  `;
}

type SqlExecutor = postgres.Sql | postgres.TransactionSql;
type SqlParam = postgres.ParameterOrJSON<never>;

async function insertPlace(executor: SqlExecutor, record: Record<string, unknown>, columns: string[]) {
  const columnSql = columns.map(quoteIdentifier).join(", ");
  const placeholders = columns.map((column, index) => placeholderFor(column, index + 1)).join(", ");
  const params = columns.map((column) => toSqlParam(column, record[column]));
  return executor.unsafe<PlaceRow[]>(`insert into places (${columnSql}) values (${placeholders}) returning *`, params);
}

async function updatePlaceRow(executor: SqlExecutor, placeId: string, record: Record<string, unknown>, columns: string[]) {
  const assignments = columns.map((column, index) => `${quoteIdentifier(column)} = ${placeholderFor(column, index + 1)}`).join(", ");
  const params = columns.map((column) => toSqlParam(column, record[column]));
  params.push(placeId as SqlParam);
  return executor.unsafe<PlaceRow[]>(
    `update places set ${assignments}, updated_at = now(), version = version + 1 where id = $${params.length} returning *`,
    params
  );
}

export function buildSearchQuery(input: SearchPlacesInput) {
  const params: SqlParam[] = [];
  const add = (value: unknown) => {
    params.push(value as SqlParam);
    return `$${params.length}`;
  };
  const includeStatuses = input.includeStatuses?.length ? Array.from(new Set(input.includeStatuses)) : ["active"];
  const where =
    includeStatuses.length === 1 && includeStatuses[0] === "active"
      ? ["status = 'active'"]
      : [`status = any(${add(includeStatuses)}::text[])`];

  const distanceSql = input.origin
    ? `ST_Distance(geo, ST_SetSRID(ST_MakePoint(${add(input.origin.lng)}, ${add(input.origin.lat)}), 4326)::geography) / 1000`
    : "null::double precision";

  if (input.origin && input.filterByRadius !== false) {
    where.push(
      `ST_DWithin(geo, ST_SetSRID(ST_MakePoint(${add(input.origin.lng)}, ${add(input.origin.lat)}), 4326)::geography, ${add(
        input.radiusKm * 1000
      )})`
    );
  }

  if (input.viewportBounds) {
    where.push(`lat between ${add(input.viewportBounds.minLat)} and ${add(input.viewportBounds.maxLat)}`);
    where.push(`lng between ${add(input.viewportBounds.minLng)} and ${add(input.viewportBounds.maxLng)}`);
  }

  if (input.origin && input.minDistanceKm !== undefined) {
    where.push(
      `ST_Distance(geo, ST_SetSRID(ST_MakePoint(${add(input.origin.lng)}, ${add(input.origin.lat)}), 4326)::geography) / 1000 >= ${add(
        input.minDistanceKm
      )}`
    );
  }

  if (input.origin && input.maxDistanceKm !== undefined) {
    where.push(
      `ST_Distance(geo, ST_SetSRID(ST_MakePoint(${add(input.origin.lng)}, ${add(input.origin.lat)}), 4326)::geography) / 1000 <= ${add(
        input.maxDistanceKm
      )}`
    );
  }

  if (input.kidsCafeOnly) {
    where.push(kidsCafeEvidenceClause());
  } else if (input.primaryCategories?.length) {
    where.push(`primary_category = any(${add(input.primaryCategories)}::text[])`);
  }

  if (input.tags?.length) {
    const normalizedTags = input.tags.map((tag) => tag.trim().replace(/[-\s]+/g, "_").toLowerCase());
    where.push(
      `(exists (
          select 1
          from unnest(tags) as required_tag
          where regexp_replace(lower(required_tag), '[-[:space:]]+', '_', 'g') = any(${add(normalizedTags)}::text[])
        )
        or regexp_replace(lower(name), '[-[:space:]]+', '_', 'g') ilike any(${add(normalizedTags.map((tag) => `%${tag}%`))}::text[]))`
    );
  }

  if (input.playgroundOnly) {
    where.push(playgroundEvidenceClause());
  }

  if (input.regionSido) {
    where.push(`region_sido = any(${add(regionSidoExactCandidates(input.regionSido))}::text[])`);
  }

  if (input.regionSigungu) {
    where.push(`region_sigungu = ${add(input.regionSigungu)}`);
  }

  if (input.countryCode) {
    where.push(`(country_code = ${add(input.countryCode)} or external_refs->>'countryCode' = ${add(input.countryCode)})`);
  }

  if (input.city) {
    const compactCity = compactSearchText(input.city);
    where.push(
      `(
        regexp_replace(lower(coalesce(city, '')), '[[:space:]]+', '', 'g') = ${add(compactCity)}
        or regexp_replace(lower(coalesce(locality, '')), '[[:space:]]+', '', 'g') = ${add(compactCity)}
        or regexp_replace(lower(coalesce(external_refs->>'city', '')), '[[:space:]]+', '', 'g') = ${add(compactCity)}
      )`
    );
  }

  if (input.query) {
    if (input.matchMode === "exactName") {
      where.push(exactNameSearchClause(input.query, add));
    } else {
      const clauses = keywordSearchClauses(input.query, add);
      if (clauses.length > 0) {
        const joiner = shouldUseAnyKeywordMatch(input.query) ? " or " : " and ";
        where.push(`(${clauses.join(joiner)})`);
      }
    }
  }

  if (input.preferenceMode === "required") {
    where.push(...requiredPreferenceClauses(input.preferences, add));
  }
  if (input.taxonomy?.mode === "required") {
    where.push(...requiredTaxonomyClauses(input.taxonomy, add));
  }

  return {
    sql: `select *, ${distanceSql} as distance_km from places where ${where.join(" and ")}`,
    params
  };
}

export function searchTermPatterns(query: string) {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `%${term}%`);
}

export function normalizeSearchInput(input: SearchPlacesInput): SearchPlacesInput {
  const inferredTaxonomy =
    input.query && input.matchMode !== "exactName" ? inferTaxonomySearchFacets(input.query) : undefined;
  const taxonomy = mergeSearchTaxonomy(input.taxonomy, inferredTaxonomy);
  if (!input.query) {
    return taxonomy ? { ...input, taxonomy } : input;
  }

  const preferences = { ...(input.preferences ?? {}) };
  const visitContext = input.visitContext ?? inferVisitContextFromQuery(input.query);
  const playgroundOnly = input.matchMode === "exactName" ? input.playgroundOnly : input.playgroundOnly || hasPlaygroundIntentTerm(input.query) || undefined;
  const inferred = inferPreferencesFromQuery(input.query);
  for (const [key, value] of Object.entries(inferred.preferences)) {
    const preferenceKey = key as keyof NonNullable<SearchPlacesInput["preferences"]>;
    if (preferences[preferenceKey] === undefined) {
      preferences[preferenceKey] = value as never;
    }
  }
  if (!preferences.indoorTypes && inferred.indoorTypes.length > 0) {
    preferences.indoorTypes = inferred.indoorTypes;
  }

  if (input.matchMode === "exactName" || shouldKeepLiteralQuery(input.query)) {
    return {
      ...input,
      visitContext,
      playgroundOnly,
      taxonomy,
      preferences: Object.keys(preferences).length > 0 ? preferences : input.preferences
    };
  }

  const query = stripLocalPlaygroundIntentTerms(stripPreferenceTerms(stripTravelContextTerms(input.query) ?? ""));
  return {
    ...input,
    visitContext,
    query,
    playgroundOnly,
    taxonomy,
    preferences: Object.keys(preferences).length > 0 ? preferences : input.preferences
  };
}

export function searchQueryNormalizationMetaForTest(input: SearchPlacesInput) {
  return buildSearchQueryNormalizationMeta(input, normalizeSearchInput(input));
}

function buildSearchQueryNormalizationMeta(input: SearchPlacesInput, normalizedInput: SearchPlacesInput) {
  const originalTerms = input.query?.trim().split(/\s+/).filter(Boolean) ?? [];
  const normalizedTerms = new Set(normalizedInput.query?.trim().split(/\s+/).filter(Boolean) ?? []);
  const removedTerms = uniqueStrings(originalTerms.filter((term) => !normalizedTerms.has(term)));
  const preservedTaxonomyFacets = normalizedInput.taxonomy ? searchTaxonomyFacetSummary(normalizedInput.taxonomy) : {};

  return {
    removedTerms,
    preservedTaxonomyFacets,
    hasPreservedIntent: Object.keys(preservedTaxonomyFacets).length > 0
  };
}

function searchTaxonomyFacetSummary(taxonomy: NonNullable<SearchPlacesInput["taxonomy"]>) {
  const summary: Partial<Record<TaxonomyFacetFamily, string[]>> = {};
  for (const family of taxonomyFacetKeys) {
    const values = taxonomy[family] ?? [];
    if (values.length > 0) {
      summary[family] = values;
    }
  }
  return summary;
}

export function searchEvaluationDate(input: Pick<SearchPlacesInput, "visitDate" | "visitStartTime">) {
  if (!input.visitDate) return undefined;

  return dateFromSeoulWallClock(input.visitDate, input.visitStartTime ?? "12:00");
}

function keywordSearchClauses(query: string, add: (value: unknown) => string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);

  if (isGeneralPlaygroundIntentQuery(query)) {
    return [playgroundEvidenceClause()];
  }

  if (isBroadNatureIntentQuery(query)) {
    return [broadNatureIntentClause(add)];
  }

  if (isBroadWaterPlayIntentQuery(query)) {
    return [broadWaterPlayIntentClause(add)];
  }

  if (isRouteBreakIntentQuery(query)) {
    return [routeBreakIntentClause()];
  }

  if (isBroadParentIntentQuery(query)) {
    return [broadParentIntentClause(terms, add)];
  }

  return terms.map((term) => {
    const pattern = `%${term}%`;
    const patternParam = add(pattern);
    const columns = [
      `name ilike ${patternParam}`,
      `regexp_replace(lower(name), '[[:space:]]+', '', 'g') ilike ${patternParam}`,
      `description ilike ${patternParam}`,
      `region_sido ilike ${patternParam}`,
      `region_sigungu ilike ${patternParam}`,
      `region_dong ilike ${patternParam}`,
      `country_name ilike ${patternParam}`,
      `city ilike ${patternParam}`,
      `locality ilike ${patternParam}`,
      `exists (select 1 from unnest(tags) as keyword_tag where keyword_tag ilike ${patternParam})`,
      `exists (
        select 1
        from jsonb_array_elements_text(${externalRefsAliasJsonbExpression()}) as external_alias(value)
        where regexp_replace(lower(external_alias.value), '[[:space:]]+', '', 'g') ilike ${patternParam}
      )`,
      `play_features::text ilike ${patternParam}`,
      `route_support::text ilike ${patternParam}`,
      `taxonomy::text ilike ${patternParam}`
    ];
    const categoryClause = categoryClauseForKeywordTerm(term);
    if (categoryClause) {
      columns.push(categoryClause);
    }

    if (shouldSearchAddressForTerm(query, term)) {
      columns.push(`address ilike ${patternParam}`, `road_address ilike ${patternParam}`);
    }

    return `(${columns.join(" or ")})`;
  });
}

function exactNameSearchClause(query: string, add: (value: unknown) => string) {
  const exactParam = add(normalizeSearchText(query));
  const compactParam = add(compactSearchText(query));
  const retailAliasCompacts = retailAliasCompactTexts(query);
  const retailAliasParam = retailAliasCompacts.length > 1 ? add(retailAliasCompacts) : null;
  const retailAliasClause =
    retailAliasParam ? ` or regexp_replace(lower(name), '[[:space:]]+', '', 'g') = any(${retailAliasParam}::text[])` : "";
  const externalAliasRetailClause = retailAliasParam
    ? ` or regexp_replace(lower(external_alias.value), '[[:space:]]+', '', 'g') = any(${retailAliasParam}::text[])`
    : "";
  return `(lower(name) = ${exactParam} or regexp_replace(lower(name), '[[:space:]]+', '', 'g') = ${compactParam}${retailAliasClause} or exists (
    select 1
    from jsonb_array_elements_text(${externalRefsAliasJsonbExpression()}) as external_alias(value)
    where lower(external_alias.value) = ${exactParam}
      or regexp_replace(lower(external_alias.value), '[[:space:]]+', '', 'g') = ${compactParam}${externalAliasRetailClause}
  ))`;
}

function requiredPreferenceClauses(preferences: SearchPlacesInput["preferences"] | undefined, add: (value: unknown) => string) {
  if (!preferences) return [];

  const clauses: string[] = [];
  if (preferences.indoorTypes?.length) {
    clauses.push(`indoor_type = any(${add(preferences.indoorTypes)}::text[])`);
  }

  for (const [key, column] of Object.entries(requiredPreferenceColumnMap)) {
    if (preferences[key as keyof typeof requiredPreferenceColumnMap] === true) {
      clauses.push(`${column} in ('yes', 'partial')`);
    }
  }

  return clauses;
}

function requiredTaxonomyClauses(taxonomy: NonNullable<SearchPlacesInput["taxonomy"]>, add: (value: unknown) => string) {
  const clauses: string[] = [];

  for (const family of taxonomyFacetKeys) {
    for (const value of taxonomy[family] ?? []) {
      const sourceBackedParam = add(JSON.stringify({ sourceBacked: { [family]: [value] } }));
      const inferredParam = add(JSON.stringify({ inferred: { [family]: [value] } }));
      clauses.push(`(taxonomy @> ${sourceBackedParam}::jsonb or taxonomy @> ${inferredParam}::jsonb)`);
    }
  }

  return clauses;
}

function mergeSearchTaxonomy(
  explicit: SearchPlacesInput["taxonomy"],
  inferred: ReturnType<typeof inferTaxonomySearchFacets> | undefined
): SearchPlacesInput["taxonomy"] | undefined {
  const hasExplicitFacets = explicit ? hasSearchTaxonomyFacets(explicit) : false;
  const hasInferredFacets = inferred ? hasSearchTaxonomyFacets(inferred) : false;
  if (!explicit && !hasInferredFacets) return undefined;

  const merged: NonNullable<SearchPlacesInput["taxonomy"]> = {
    mode: explicit?.mode ?? "soft"
  };
  for (const family of taxonomyFacetKeys) {
    const explicitValues = explicit?.[family] ?? [];
    const inferredValues = explicitValues.length > 0 ? [] : inferred?.[family] ?? [];
    const values = uniqueStrings([...explicitValues, ...inferredValues]);
    if (values.length > 0) {
      merged[family] = values as never;
    }
  }

  return hasExplicitFacets || hasInferredFacets || explicit?.mode !== undefined ? merged : undefined;
}

function hasSearchTaxonomyFacets(taxonomy: Partial<Record<TaxonomyFacetFamily, readonly string[]>>) {
  return taxonomyFacetKeys.some((family) => (taxonomy[family]?.length ?? 0) > 0);
}

const requiredPreferenceColumnMap = {
  parkingAvailable: "parking_available",
  strollerFriendly: "stroller_friendly",
  elevator: "elevator",
  nursingRoom: "nursing_room",
  diaperChangingTable: "diaper_changing_table",
  kidsToilet: "kids_toilet",
  babyChair: "baby_chair",
  foodAllowed: "food_allowed"
} as const;
const taxonomyFacetKeys = Object.keys(taxonomyFacetFamilies) as TaxonomyFacetFamily[];

function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values));
}

export function shouldUseAnyKeywordMatch(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length < 2) return false;
  if (isPlayFeatureListedPlaceQuery(terms)) return true;
  const placeLikeTerms = terms.filter((term) => isLikelyPlaceNameTerm(term));
  const shortListedPlaceTerms = terms.filter((term) => isPotentialListedPlaceTerm(term));
  const alternativeTerms = terms.filter((term) => isAlternativeKeywordTerm(term) || isLikelyPlaceNameTerm(term));
  if (alternativeTerms.length === terms.length && terms.some((term) => isAlternativeKeywordTerm(term))) {
    return true;
  }
  if (placeLikeTerms.length >= 2 && placeLikeTerms.length === terms.length) {
    return true;
  }
  if (terms.length < 3) return false;
  if (shortListedPlaceTerms.length >= 3 && shortListedPlaceTerms.length === terms.length) {
    return true;
  }
  return false;
}

function isLikelyPlaceNameTerm(term: string) {
  if (isCompoundNamedFacilityTerm(term)) return true;
  return (
    term.length >= 3 &&
    !isQueryStopTerm(term) &&
    !isQueryPreferenceTerm(term) &&
    !broadParentIntentTerms.has(term) &&
    !broadPlaygroundIntentTerms.has(term) &&
    !categoryKeywordMap[term]
  );
}

function isCompoundNamedFacilityTerm(term: string) {
  return term.length >= 5 && /(박물관|과학관|미술관|체험관)$/.test(term);
}

function isAlternativeKeywordTerm(term: string) {
  return alternativeKeywordTerms.has(term);
}

function isPlayFeatureListedPlaceQuery(terms: string[]) {
  if (!terms.some((term) => specificPlayFeatureQueryTerms.has(term))) return false;
  const placeTerms = terms.filter((term) => isPotentialListedPlaceTerm(term));
  return placeTerms.length >= 2;
}

function isPotentialListedPlaceTerm(term: string) {
  return (
    term.length >= 2 &&
    !specificPlayFeatureQueryTerms.has(term) &&
    !isQueryStopTerm(term) &&
    !isQueryPreferenceTerm(term) &&
    !broadParentIntentTerms.has(term) &&
    !broadPlaygroundIntentTerms.has(term) &&
    !categoryKeywordMap[term]
  );
}

function stripLocalPlaygroundIntentTerms(query: string | undefined) {
  if (!query) return query;

  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length < 2 || !terms.some((term) => localPlaygroundSandTerms.has(term))) {
    return query;
  }

  const specificTerms = terms.filter((term) => !removableLocalPlaygroundIntentTerms.has(term));
  if (specificTerms.length === 0) {
    return query;
  }

  return specificTerms.join(" ");
}

const broadNatureIntentTerms = new Set(["공원", "자연", "숲", "산책", "야외", "나들이"]);
const broadPlaygroundIntentTerms = new Set(["놀이터", "동네놀이터", "어린이공원", "모래놀이터", "모래놀이", "모래놀이장", "모래"]);
const playgroundIntentTerms = new Set([...broadPlaygroundIntentTerms, "실내놀이터"]);
const removableLocalPlaygroundIntentTerms = new Set(["동네놀이터", "어린이공원", "모래놀이터", "모래놀이", "모래놀이장", "모래"]);
const localPlaygroundSandTerms = new Set(["모래놀이터", "모래놀이", "모래놀이장", "모래"]);
const playgroundEquipmentFeatureKeys = ["slide", "swing", "babySwing", "waterPlayground", "sandPlay", "climbing", "seesaw", "trampoline", "rideOnToys", "playHouse"];
const playgroundQueryFeatureMap: Array<{ terms: string[]; keys: string[] }> = [
  { terms: ["모래", "모래놀이터", "모래놀이", "모래놀이장"], keys: ["sandPlay"] },
  { terms: ["물놀이", "물놀이터", "수경", "분수", "바닥분수", "물놀이장", "물놀이섬"], keys: ["waterPlayground"] },
  { terms: ["화장실", "화장실근처", "화장실인근"], keys: ["toiletNearby"] },
  { terms: ["그네"], keys: ["swing", "babySwing"] },
  { terms: ["미끄럼틀"], keys: ["slide"] },
  { terms: ["시소"], keys: ["seesaw"] },
  { terms: ["암벽", "클라이밍"], keys: ["climbing"] },
  { terms: ["트램폴린"], keys: ["trampoline"] }
];
const playgroundEvidenceTags = [
  "children_playground",
  "small_playground",
  "play_equipment",
  "playground",
  "놀이터",
  "어린이놀이터",
  "유아놀이터",
  "동네놀이터",
  "어린이공원",
  "모래놀이터",
  "숲놀이터",
  "물놀이터",
  "놀이기구",
  "미끄럼틀",
  "그네",
  "시소"
];
const playgroundEvidenceNamePatterns = ["%놀이터%", "%어린이공원%", "%물놀이터%", "%숲놀이터%"];
const commercialKidsCafeIntentTerms = new Set(["키즈카페", "키카", "어린이카페", "베이비카페"]);
const commercialKidsCafeEvidenceTags = [
  "kids_cafe",
  "kidsCafe",
  "키즈카페",
  "대형키즈카페",
  "대형키즈테마파크",
  "키즈테마파크",
  "카페",
  "카페내부",
  "파티룸",
  "종일권",
  "챔피언",
  "champion",
  "플레이타임",
  "playtime",
  "월드킹",
  "worldking",
  "아틀란티스",
  "atlantis",
  "largeKidsCafe",
  "largeTrampoline",
  "partyRoom",
  "cafeInside",
  "activePlay",
  "active_play",
  "themePark"
];
const commercialKidsCafeEvidencePatterns = ["%키즈카페%", "%키즈 카페%", "%키즈테마파크%", "%키즈 테마파크%", "%점프홀릭%", "%월드킹%", "%챔피언%", "%아틀란티스%"];

const broadWaterPlayIntentTerms = new Set(["물놀이", "물놀이터", "수경", "분수", "바닥분수", "물놀이장", "물놀이섬", "워터파크"]);
const specificPlayFeatureQueryTerms = new Set([
  ...broadWaterPlayIntentTerms,
  "그네",
  "미끄럼틀",
  "모래",
  "모래놀이터",
  "모래놀이",
  "모래놀이장",
  "시소",
  "암벽",
  "클라이밍",
  "트램폴린",
  "흔들놀이"
]);

const alternativeKeywordTerms = new Set([
  "아쿠아리움",
  "수족관",
  "동물원",
  "사파리",
  "과학관",
  "체험",
  "체험관",
  "박물관",
  "미술관",
  "전시관",
  "천문대",
  "곤충",
  "생태관"
]);

const routeBreakCoreTerms = new Set(["휴게소", "쉼터", "휴식", "정차"]);

const routeBreakContextTerms = new Set([
  "가는",
  "길",
  "경로",
  "이동",
  "도중",
  "중간",
  "수유실",
  "기저귀",
  "화장실",
  "청남대",
  "대청호",
  "대청댐",
  "문의",
  "옥천",
  "청주",
  "공주"
]);

const routeBreakRouteTerms = new Set(["가는", "길", "경로", "이동", "도중", "중간"]);
const routeBreakDestinationTerms = new Set(["청남대", "대청호", "대청댐", "문의", "옥천", "청주", "공주"]);
const routeBreakLogisticsTerms = new Set(["수유실", "기저귀", "화장실", "유모차", "휴식", "쉼터", "쉬는"]);

const broadParentIntentTerms = new Set([
  ...broadNatureIntentTerms,
  "당일치기",
  "근교",
  "1시간권",
  "주말",
  "유모차",
  "주차",
  "공공시설",
  "공공",
  "국립",
  "시립",
  "반나절",
  "과학",
  "과학관",
  "박물관",
  "어린이박물관",
  "도서관",
  "장난감도서관",
  "장난감",
  "장난감가게",
  "장난감매장",
  "완구",
  "완구점",
  "완구매장",
  "토이저러스",
  "토이플러스",
  "레고스토어",
  "공동육아나눔터",
  "체험",
  "체험관",
  "어린이",
  "아이",
  "영유아",
  "영아",
  "돌쟁이",
  "실내",
  "공공실내",
  "비오는날",
  "비",
  "수유실",
  "기저귀",
  "화장실",
  "무료",
  "저렴",
  "저렴한",
  "쇼핑몰",
  "백화점",
  "아울렛",
  "베이비라운지",
  "유아휴게실",
  "푸드코트",
  "식당가",
  "유모차대여",
  "대여",
  "놀이터",
  "동네놀이터",
  "어린이공원",
  "모래놀이터",
  "모래놀이",
  "모래놀이장",
  "모래",
  "워터파크"
]);

const broadParentCoreTerms = new Set([
  ...broadNatureIntentTerms,
  "당일치기",
  "근교",
  "1시간권",
  "공공시설",
  "공공",
  "국립",
  "시립",
  "과학",
  "과학관",
  "박물관",
  "어린이박물관",
  "도서관",
  "장난감도서관",
  "장난감",
  "장난감가게",
  "장난감매장",
  "완구",
  "완구점",
  "완구매장",
  "토이저러스",
  "토이플러스",
  "레고스토어",
  "공동육아나눔터",
  "체험",
  "체험관",
  "어린이",
  "아이",
  "영유아",
  "영아",
  "돌쟁이",
  "공공실내",
  "놀이터",
  "동네놀이터",
  "어린이공원",
  "모래놀이터",
  "모래놀이",
  "모래놀이장",
  "모래",
  "워터파크",
  "쇼핑몰",
  "백화점",
  "아울렛"
]);

const queryPreferenceTerms = {
  parkingAvailable: new Set(["주차", "주차장", "parking"]),
  toiletNearby: new Set(["화장실", "화장실근처", "화장실인근", "toilet"]),
  strollerFriendly: new Set(["유모차", "쌍둥이유모차", "stroller"]),
  elevator: new Set(["엘리베이터", "승강기", "elevator"]),
  nursingRoom: new Set(["수유실", "수유", "수유공간", "베이비라운지", "베이비룸", "유아휴게실", "아기휴게실", "분유", "nursing"]),
  diaperChangingTable: new Set(["기저귀", "기저귀갈이대", "기저귀교환대", "기저귀대", "diaper"]),
  kidsToilet: new Set(["어린이화장실", "유아화장실", "아이화장실"]),
  babyChair: new Set(["아기의자", "유아의자", "하이체어", "babychair"]),
  foodAllowed: new Set(["밥", "식사", "간식", "도시락", "외부음식", "음식반입", "food"])
} satisfies Record<keyof Omit<NonNullable<SearchPlacesInput["preferences"]>, "indoorTypes">, Set<string>>;
const foodDisallowedTerms = new Set(["음식불가", "음식금지", "외부음식금지", "반입금지", "취식금지"]);

const nonFilterLogisticsTerms = new Set([
  "기저귀",
  "기저귀교환",
  "기저귀교환대",
  "기저귀갈이",
  "기저귀갈기",
  "엘리베이터",
  "승강기",
  "diaper",
  "elevator"
]);

const indoorPreferenceTerms = new Set([
  "실내",
  "비",
  "비오는날",
  "비오는",
  "비오면",
  "비올때",
  "우천",
  "장마",
  "대피",
  "피난처",
  "실내대피",
  "실내대안",
  "대안",
  "비상",
  "피할",
  "피하기",
  "실내놀이",
  "실내놀이터",
  "놀기",
  "놀수있는",
  "먹고놀기"
]);
const outdoorPreferenceTerms = new Set(["실외", "야외"]);
const twinLogisticsTerms = new Set(["쌍둥이", "쌍둥이랑", "쌍둥이유모차", "twins"]);
const literalFallbackTerms = new Set(["장난감도서관"]);
const travelContextTerms = new Set(["근교", "근처", "주변", "인근", "기준"]);
const locationOnlyTerms = new Set([
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
  "창원",
  "김해",
  "고성",
  "청주",
  "청남대",
  "우포"
]);
const temporalQueryTerms = new Set([
  "오늘",
  "내일",
  "모레",
  "이번주",
  "이번주말",
  "다음주",
  "주중",
  "평일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
  "일요일",
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
  "일",
  "오전",
  "오후",
  "아침",
  "점심",
  "저녁"
]);
const queryStopTerms = new Set([
  ...temporalQueryTerms,
  "있는",
  "가능",
  "가능한",
  "편한",
  "편하고",
  "좋은",
  "곳",
  "가볼만한곳",
  "가볼만한",
  "장소",
  "추천",
  "사진",
  "유명",
  "가족",
  "가족나들이",
  "나들이",
  "짧은",
  "짧게",
  "간단히",
  "간단하게",
  "잠깐",
  "가볍게",
  "가벼운",
  "갈만한",
  "갈",
  "가볼",
  "올",
  "있다",
  "수",
  "만한",
  "아이랑",
  "아기랑",
  "애",
  "데리고",
  "대전역",
  "원도심",
  "전국",
  "기준",
  "아이",
  "근처",
  "주변",
  "인근",
  "장난감도서관",
  "가게",
  "매장",
  "샵",
  "숍",
  "가까운",
  "쌍둥이",
  "쌍둥이랑",
  "twins",
  "하원",
  "하원하고",
  "하원후",
  "방과후",
  "어린이집",
  "끝나고",
  "후",
  "밥",
  "식사",
  "간식",
  "스낵",
  "밥먹고",
  "밥먹기",
  "먹고놀기",
  "놀기",
  "놀수있는",
  "쉴곳",
  "쉬기",
  "먹기",
  "먹을",
  "먹고",
  "먹으면서",
  "외식",
  "무료",
  "저렴",
  "저렴한",
  "화장실",
  "대여",
  "유모차대여",
  "유모차대여소",
  "푸드코트",
  "식당가",
  "놀릴",
  "한시간",
  "한두시간",
  "한두시간만",
  "두시간",
  "세시간",
  "1시간권",
  "여름",
  "시즌",
  "운영",
  "개장",
  "운영시간",
  "휴장",
  "올해",
  "최신",
  "현재",
  "지금",
  "없는",
  "날",
  "홈경기",
  "대피",
  "피난처",
  "실내대피",
  "실내대안",
  "대안",
  "비상",
  "갈기"
]);

const broadNatureExpansionTerms = [
  "공원",
  "자연",
  "숲",
  "산책",
  "수목원",
  "산림욕장",
  "자연휴양림",
  "대청호",
  "호수",
  "데크",
  "생태",
  "수변",
  "물놀이",
  "잔디",
  "피크닉",
  "황톳길",
  "모래놀이",
  "모래놀이터",
  "sandPlay"
];

const broadWaterPlayExpansionTerms = [
  "물놀이",
  "물놀이터",
  "수경",
  "분수",
  "바닥분수",
  "물놀이장",
  "물놀이섬",
  "계류",
  "워터",
  "워터파크"
];

const broadPublicExpansionTerms = [
  "공공시설",
  "공공실내",
  "국립",
  "시립",
  "과학",
  "과학관",
  "박물관",
  "어린이박물관",
  "도서관",
  "체험",
  "체험관",
  "장난감도서관",
  "공동육아나눔터",
  "육아종합지원센터",
  "영유아",
  "영아",
  "돌쟁이",
  "어린이회관",
  "꿈아띠"
];

const sharedChildcareExpansionTerms = ["공동육아나눔터", "shared_childcare_room", "shared_childcare", "돌봄품앗이", "손오공"];

const broadShoppingExpansionTerms = [
  "쇼핑몰",
  "백화점",
  "아울렛",
  "복합쇼핑몰",
  "장난감가게",
  "장난감매장",
  "완구점",
  "완구매장",
  "토이저러스",
  "토이플러스",
  "레고스토어"
];

const mealPlayMealTerms = new Set([
  "밥",
  "밥먹고",
  "밥먹기",
  "먹고놀기",
  "식사",
  "식당",
  "캠핑식당",
  "뷔페",
  "먹기",
  "먹을",
  "먹고",
  "먹으면서",
  "외식"
]);
const mealPlayActivityTerms = new Set(["놀릴", "놀기", "놀수있는", "먹고놀기", "놀이방", "키즈룸", "키즈존", "애"]);
const mealPlayContextTerms = new Set([
  "판암",
  "가오동",
  "은행동",
  "중촌동",
  "효동",
  "가양동",
  "만년동",
  "관저동",
  "도안",
  "둔산",
  "한밭수목원",
  "수통골",
  "반석",
  "유성",
  "죽동",
  "와동",
  "탑립"
]);

export function isBroadNatureIntentQuery(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  return terms.length > 0 && terms.every((term) => broadNatureIntentTerms.has(term));
}

export function isPlaygroundIntentQuery(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  return terms.length > 0 && terms.every((term) => playgroundIntentTerms.has(term));
}

function isGeneralPlaygroundIntentQuery(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  return terms.length > 0 && terms.every((term) => broadPlaygroundIntentTerms.has(term));
}

export function isBroadWaterPlayIntentQuery(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  return terms.length > 0 && terms.every((term) => broadWaterPlayIntentTerms.has(term));
}

export function isRouteBreakIntentQuery(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const hasExplicitStop = terms.some((term) => routeBreakCoreTerms.has(term)) && terms.some((term) => routeBreakContextTerms.has(term));
  const hasRouteLogistics =
    terms.some((term) => routeBreakRouteTerms.has(term)) &&
    terms.some((term) => routeBreakDestinationTerms.has(term)) &&
    terms.some((term) => routeBreakLogisticsTerms.has(term));
  return hasExplicitStop || hasRouteLogistics;
}

export function isBroadParentIntentQuery(query: string) {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((term) => Boolean(term) && !isQueryStopTerm(term));
  const hasDiscoveryPair = terms.includes("어린이박물관") || terms.includes("워터파크");
  return (
    (terms.length >= 3 || hasDiscoveryPair) &&
    terms.every((term) => broadParentIntentTerms.has(term)) &&
    terms.some((term) => broadParentCoreTerms.has(term))
  );
}

function shouldKeepLiteralQuery(query: string) {
  return (
    isPlaygroundIntentQuery(query) ||
    isBroadNatureIntentQuery(query) ||
    isBroadWaterPlayIntentQuery(query) ||
    isRouteBreakIntentQuery(query) ||
    isBroadParentIntentQuery(query)
  );
}

function hasPlaygroundIntentTerm(query: string) {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .some((term) => playgroundIntentTerms.has(term));
}

function inferPreferencesFromQuery(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const termSet = new Set(terms);
  const preferences: Partial<NonNullable<SearchPlacesInput["preferences"]>> = {};
  const indoorTypes = new Set<"indoor" | "outdoor" | "mixed">();
  const hasFoodDisallowedTerm = terms.some((term) => foodDisallowedTerms.has(term));
  const hasDayTripNatureFallbackIntent =
    (termSet.has("1시간권") || termSet.has("당일치기") || termSet.has("근교")) &&
    terms.some((term) => broadNatureIntentTerms.has(term)) &&
    terms.some((term) => ["실내대피", "실내대안", "대피", "대안", "피할", "비오면"].includes(term));

  for (const term of terms) {
    if (twinLogisticsTerms.has(term)) {
      preferences.parkingAvailable = true;
      preferences.strollerFriendly = true;
      preferences.nursingRoom = true;
    }
    for (const [key, values] of Object.entries(queryPreferenceTerms)) {
      if (key === "foodAllowed" && hasFoodDisallowedTerm) continue;
      if (values.has(term)) {
        preferences[key as keyof typeof queryPreferenceTerms] = true as never;
      }
    }
    if (indoorPreferenceTerms.has(term) && !(hasDayTripNatureFallbackIntent && term !== "실내")) {
      indoorTypes.add("indoor");
      indoorTypes.add("mixed");
    }
    if (outdoorPreferenceTerms.has(term)) {
      indoorTypes.add("outdoor");
      indoorTypes.add("mixed");
    }
  }

  return {
    preferences,
    indoorTypes: Array.from(indoorTypes)
  };
}

function inferVisitContextFromQuery(query: string): SearchPlacesInput["visitContext"] | undefined {
  const terms = new Set(query.trim().split(/\s+/).filter(Boolean));
  if (terms.has("하원") || terms.has("하원후") || terms.has("방과후")) return "afterDaycare";
  if (terms.has("하원하고") || (terms.has("어린이집") && terms.has("끝나고"))) return "afterDaycare";
  if (terms.has("당일치기") || terms.has("근교") || terms.has("1시간권") || Array.from(terms).some(isTravelDurationTerm)) return "dayTrip";
  if (["비", "비오는날", "비오는", "비오면", "비올때", "우천", "장마"].some((term) => terms.has(term))) return "rainyDay";
  if (terms.has("주말") || terms.has("이번주말") || terms.has("반나절")) return "weekendHalfDay";
  return undefined;
}

function inferTemporalTermsFromQuery(query: string) {
  return query
    .trim()
    .split(/\s+/)
    .filter((term) => temporalQueryTerms.has(term) || /^[0-9]+(?:[-~][0-9]+)?(?:시|분|시간)(?:권|만)?$/.test(term));
}

export function suggestedExactNameQueryForTest(query: string) {
  return suggestedExactNameQuery(query);
}

function suggestedExactNameQuery(query: string) {
  const stripped = stripPreferenceTerms(query);
  return stripped && stripped !== query.trim() ? stripped : null;
}

function locationOnlyQuery(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length !== 1) return null;
  const term = terms[0];
  if (!term) return null;
  const normalized = normalizeSearchText(term);
  return locationOnlyTerms.has(term) || locationOnlyTerms.has(normalized) ? term : null;
}

function stripPreferenceTerms(query: string) {
  const alias = inferLiteralQueryAlias(query);
  if (alias) return alias;

  const stripped = query
    .trim()
    .split(/\s+/)
    .filter((term) => !isQueryPreferenceTerm(term) && !isQueryStopTerm(term))
    .join(" ")
    .trim();

  if (stripped.length > 0) return stripped;

  const literalFallback = query
    .trim()
    .split(/\s+/)
    .filter((term) => literalFallbackTerms.has(term))
    .join(" ")
    .trim();

  return literalFallback.length > 0 ? literalFallback : undefined;
}

function stripTravelContextTerms(query: string | undefined) {
  if (!query) return undefined;

  const terms = query.trim().split(/\s+/).filter(Boolean);
  const hasTravelContext = terms.some((term) => travelContextTerms.has(term) || isTravelDurationTerm(term));
  if (!hasTravelContext) return query;

  const stripped = terms
    .filter((term, index) => !isTravelOriginAnchor(term, index))
    .filter((term) => !travelContextTerms.has(term))
    .filter((term) => !isTravelDurationTerm(term))
    .join(" ")
    .trim();

  return stripped.length > 0 ? stripped : undefined;
}

function isTravelOriginAnchor(term: string, index: number) {
  if (index !== 0) return false;
  return locationOnlyTerms.has(term) || locationOnlyTerms.has(normalizeSearchText(term));
}

export function categoryClauseForKeywordTerm(term: string) {
  if (commercialKidsCafeIntentTerms.has(term)) return kidsCafeEvidenceClause();
  const categories = categoryKeywordMap[term];
  if (categories) {
    if (categories.length === 1) return `primary_category = '${categories[0]}'`;
    return `primary_category = any(array[${categories.map((category) => `'${category}'`).join(",")}]::text[])`;
  }
  if (broadPlaygroundIntentTerms.has(term)) return playgroundEvidenceClause();
  return null;
}

const categoryKeywordMap: Record<string, string[]> = {
  공원: ["park"],
  키즈카페: ["kids_cafe"],
  실내놀이터: ["indoor_playground"],
  도서관: ["library", "toy_library"],
  장난감: ["toy_store", "toy_library"],
  장난감가게: ["toy_store"],
  장난감매장: ["toy_store"],
  장난감도서관: ["toy_library"],
  공동육아나눔터: ["toy_library"],
  완구: ["toy_store"],
  완구점: ["toy_store"],
  완구매장: ["toy_store"],
  토이저러스: ["toy_store"],
  토이플러스: ["toy_store"],
  레고스토어: ["toy_store"],
  과학관: ["science_museum"],
  박물관: ["museum"],
  미술관: ["art_museum"],
  어린이박물관: ["museum", "experience_center"],
  아쿠아리움: ["aquarium"],
  동물원: ["zoo"],
  워터파크: ["park", "playground", "experience_center"],
  체험관: ["experience_center"],
  수목원: ["park"],
  휴게소: ["rest_area"],
  숙소: ["accommodation"],
  호텔: ["accommodation"],
  리조트: ["accommodation"],
  펜션: ["accommodation"],
  풀빌라: ["accommodation"],
  식당: ["family_restaurant"],
  놀이방식당: ["family_restaurant"]
};

function isQueryStopTerm(term: string) {
  if (queryStopTerms.has(term)) return true;
  return /^[0-9]+(?:[-~][0-9]+)?(?:시간|분)(?:권|만)?$/.test(term);
}

function isTravelDurationTerm(term: string) {
  return /^[0-9]+(?:[-~][0-9]+)?(?:시간|분)(?:권|만)?$/.test(term);
}

function isQueryPreferenceTerm(term: string) {
  if (indoorPreferenceTerms.has(term) || outdoorPreferenceTerms.has(term)) return true;
  return nonFilterLogisticsTerms.has(term) || Object.values(queryPreferenceTerms).some((terms) => terms.has(term));
}

function inferLiteralQueryAlias(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const withRegion = (alias: string) => prependLocationAnchors(terms, alias);
  if (terms.includes("키즈") && terms.some((term) => ["카페", "까페"].includes(term))) return withRegion("키즈카페");
  if (terms.includes("장난감") && terms.includes("도서관")) return withRegion("장난감도서관");
  if (terms.includes("장난감") && terms.some((term) => ["가게", "매장", "샵", "숍"].includes(term))) return withRegion("장난감가게");
  if (terms.includes("완구") && terms.some((term) => ["가게", "매장", "샵", "숍", "점"].includes(term))) return withRegion("완구점");
  if (terms.includes("레고") && terms.some((term) => ["스토어", "가게", "매장", "샵", "숍"].includes(term))) return withRegion("레고스토어");
  const hasMealTerm = terms.some((term) => mealPlayMealTerms.has(term));
  const hasPlayTerm = terms.some((term) => mealPlayActivityTerms.has(term));
  if (hasMealTerm && hasPlayTerm) {
    const contextTerms = terms.filter((term) => mealPlayContextTerms.has(term));
    return withRegion([...contextTerms, "놀이방식당"].join(" "));
  }
  return undefined;
}

function prependLocationAnchors(terms: string[], alias: string) {
  const anchors = uniqueStrings(terms.filter(isLocationAnchorTerm));
  if (anchors.length === 0) return alias;
  const aliasTerms = new Set(alias.split(/\s+/).filter(Boolean).map(normalizeSearchText));
  return [...anchors.filter((term) => !aliasTerms.has(normalizeSearchText(term))), alias].join(" ");
}

function isLocationAnchorTerm(term: string) {
  const normalized = normalizeSearchText(term);
  return locationOnlyTerms.has(term) || locationOnlyTerms.has(normalized);
}

function playgroundEvidenceClause() {
  const tagArray = sqlTextArray(playgroundEvidenceTags);
  const namePatternArray = sqlTextArray(playgroundEvidenceNamePatterns);
  const featureClauses = playgroundEquipmentFeatureKeys.map((key) => `play_features->>'${key}' in ('yes', 'partial')`).join(" or ");

  return `(
    primary_category = 'playground'
    or
    (
      primary_category = 'indoor_playground'
      and not ${commercialIndoorPlayEvidenceClause()}
    )
    or (
      primary_category = 'park'
      and (
        exists (select 1 from unnest(tags) as playground_tag where playground_tag = any(${tagArray}) or playground_tag ilike any(${namePatternArray}))
        or name ilike any(${namePatternArray})
        or ${featureClauses}
      )
    )
  )`;
}

function kidsCafeEvidenceClause() {
  return `(
    primary_category = any(array['kids_cafe','family_cafe']::text[])
    or ${commercialIndoorPlayEvidenceClause()}
  )`;
}

function commercialIndoorPlayEvidenceClause() {
  const tagArray = sqlTextArray(commercialKidsCafeEvidenceTags);
  const patternArray = sqlTextArray(commercialKidsCafeEvidencePatterns);

  return `(
    primary_category = 'indoor_playground'
    and (
      name ilike any(${patternArray})
      or description ilike any(${patternArray})
      or parent_notes ilike any(${patternArray})
      or exists (select 1 from unnest(tags) as commercial_tag where commercial_tag = any(${tagArray}) or commercial_tag ilike any(${patternArray}))
    )
  )`;
}

function sqlTextArray(values: string[]) {
  return `array[${values.map((value) => `'${value.replace(/'/g, "''")}'`).join(",")}]::text[]`;
}

function broadNatureIntentClause(add: (value: unknown) => string) {
  const clauses = ["primary_category = any(array['park','playground']::text[])"];

  for (const term of broadNatureExpansionTerms) {
    const patternParam = add(`%${term}%`);
    clauses.push(
      `name ilike ${patternParam}`,
      `description ilike ${patternParam}`,
      `exists (select 1 from unnest(tags) as keyword_tag where keyword_tag ilike ${patternParam})`
    );
  }

  return `(${clauses.join(" or ")})`;
}

function broadWaterPlayIntentClause(add: (value: unknown) => string) {
  const clauses: string[] = [];
  addTextExpansionClauses(clauses, broadWaterPlayExpansionTerms, add);
  return `(${clauses.join(" or ")})`;
}

function routeBreakIntentClause() {
  return "(primary_category = 'rest_area')";
}

function broadParentIntentClause(terms: string[], add: (value: unknown) => string) {
  const termSet = new Set(terms);
  const clauses: string[] = [];

  if (termSet.has("공동육아나눔터")) {
    addTextExpansionClauses(clauses, sharedChildcareExpansionTerms, add);
    return `(${clauses.join(" or ")})`;
  }

  if (terms.some((term) => broadNatureIntentTerms.has(term)) || termSet.has("당일치기") || termSet.has("근교")) {
    clauses.push("primary_category = any(array['park','playground']::text[])");
    addTextExpansionClauses(clauses, broadNatureExpansionTerms, add);
  }

  if (terms.some((term) => playgroundIntentTerms.has(term))) {
    clauses.push(playgroundEvidenceClause());
  }

  if (
    termSet.has("공공시설") ||
    termSet.has("공공") ||
    termSet.has("국립") ||
    termSet.has("시립") ||
    termSet.has("과학관") ||
    termSet.has("박물관") ||
    termSet.has("도서관") ||
    termSet.has("공동육아나눔터") ||
    termSet.has("공공실내") ||
    termSet.has("영유아") ||
    termSet.has("영아") ||
    termSet.has("체험관") ||
    termSet.has("어린이")
  ) {
    clauses.push("primary_category = any(array['science_museum','art_museum','museum','experience_center','library','indoor_playground','playground','toy_library']::text[])");
    addTextExpansionClauses(clauses, broadPublicExpansionTerms, add);
  }

  if (termSet.has("쇼핑몰") || termSet.has("백화점") || termSet.has("아울렛")) {
    clauses.push("primary_category = 'shopping_mall'");
    addTextExpansionClauses(clauses, broadShoppingExpansionTerms, add);
  }

  if (
    termSet.has("장난감") ||
    termSet.has("장난감가게") ||
    termSet.has("장난감매장") ||
    termSet.has("완구") ||
    termSet.has("완구점") ||
    termSet.has("완구매장") ||
    termSet.has("토이저러스") ||
    termSet.has("토이플러스") ||
    termSet.has("레고스토어")
  ) {
    clauses.push("primary_category = 'toy_store'");
    addTextExpansionClauses(clauses, broadShoppingExpansionTerms, add);
  }

  if (clauses.length === 0) {
    addTextExpansionClauses(clauses, terms, add);
  }

  return `(${clauses.join(" or ")})`;
}

function addTextExpansionClauses(clauses: string[], terms: string[], add: (value: unknown) => string) {
  for (const term of terms) {
    const patternParam = add(`%${term}%`);
    clauses.push(
      `name ilike ${patternParam}`,
      `description ilike ${patternParam}`,
      `exists (select 1 from unnest(tags) as keyword_tag where keyword_tag ilike ${patternParam})`,
      `play_features::text ilike ${patternParam}`,
      `route_support::text ilike ${patternParam}`
    );
  }
}

export function shouldSearchAddressForTerm(query: string, term: string) {
  const normalizedQuery = query.trim();
  if (/[0-9]/.test(normalizedQuery)) return true;
  if (/로|길|번길/.test(term) && term.length >= 4) return true;
  return term.length >= 4;
}

export function queryMatchSignal(
  place: Pick<ReturnType<typeof mapPlace>, "name" | "tags" | "description" | "address" | "roadAddress"> & {
    externalRefs?: Record<string, unknown> | null;
    playFeatures?: Record<string, unknown>;
    routeSupport?: Record<string, unknown>;
  },
  query?: string
) {
  if (!query || isBroadNatureIntentQuery(query)) {
    return { delta: 0, reasonCodes: [] };
  }

  const normalizedQuery = normalizeSearchText(query);
  const locationQuery = locationOnlyQuery(query);
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeSearchText);
  if (!normalizedQuery || terms.length === 0) {
    return { delta: 0, reasonCodes: [] };
  }

  const normalizedName = normalizeSearchText(place.name);
  const compactName = compactSearchText(place.name);
  const compactQuery = compactSearchText(query);
  const retailAliasMatched = retailAliasCompactTexts(query).some((alias) => retailAliasCompactTexts(place.name).includes(alias));
  const externalAliasExactMatched = externalRefsAliasTexts(place.externalRefs).some((alias) => {
    const normalizedAlias = normalizeSearchText(alias);
    const compactAlias = compactSearchText(alias);
    return normalizedAlias === normalizedQuery || compactAlias === compactQuery;
  });
  const compactTerms = terms.map(compactSearchText);
  const reasonCodes = new Set<string>();
  let delta = 0;

  if (locationQuery) {
    const searchableText = [place.description, place.address, place.roadAddress].filter(Boolean).map((value) => normalizeSearchText(String(value)));
    const locationMatched =
      normalizedName.includes(normalizedQuery) ||
      place.tags.some((tag) => normalizeSearchText(tag).includes(normalizedQuery)) ||
      searchableText.some((value) => value.includes(normalizedQuery));

    return {
      delta: locationMatched ? 6 : 0,
      reasonCodes: locationMatched ? ["LOCATION_QUERY_MATCH"] : []
    };
  }

  const exactNameMatch = normalizedName === normalizedQuery || compactName === compactQuery || externalAliasExactMatched;
  if (exactNameMatch) {
    delta += 24;
    reasonCodes.add("QUERY_NAME_EXACT");
  } else if (retailAliasMatched) {
    delta += 20;
    reasonCodes.add("QUERY_RETAIL_ALIAS_MATCH");
  } else if (normalizedName.includes(normalizedQuery) || compactName.includes(compactQuery) || terms.every((term) => normalizedName.includes(term))) {
    delta += 14;
    reasonCodes.add("QUERY_NAME_MATCH");
  } else if (shouldUseAnyKeywordMatch(query)) {
    const matchedNameTerms = terms.filter((term, index) => normalizedName.includes(term) || compactName.includes(compactTerms[index]));
    if (matchedNameTerms.length > 0) {
      delta += Math.min(16, 10 + matchedNameTerms.length * 2);
      reasonCodes.add("QUERY_NAME_MATCH");
    }
  }

  const exactTagMatched = place.tags.some((tag) => {
    const normalizedTag = normalizeSearchText(tag);
    const compactTag = compactSearchText(tag);
    return normalizedTag === normalizedQuery || compactTag === compactQuery;
  });
  const tagMatched = exactTagMatched || place.tags.some((tag) => {
    const normalizedTag = normalizeSearchText(tag);
    const compactTag = compactSearchText(tag);
    return normalizedTag.includes(normalizedQuery) || compactTag.includes(compactQuery) || terms.some((term) => normalizedTag.includes(term));
  });
  if (tagMatched) {
    delta += exactTagMatched ? (reasonCodes.size > 0 ? 4 : 12) : reasonCodes.size > 0 ? 2 : 6;
    reasonCodes.add("QUERY_TAG_MATCH");
  }

  if (playFeaturesMatch(place.playFeatures, normalizedQuery, terms)) {
    delta += reasonCodes.size > 0 ? 2 : 7;
    reasonCodes.add("QUERY_PLAY_FEATURE_MATCH");
  }

  if (routeSupportMatch(place.routeSupport, normalizedQuery, terms)) {
    delta += reasonCodes.size > 0 ? 2 : 7;
    reasonCodes.add("QUERY_ROUTE_SUPPORT_MATCH");
  }

  const searchableText = [place.description, place.address, place.roadAddress].filter(Boolean).map((value) => normalizeSearchText(String(value)));
  if (searchableText.some((value) => value.includes(normalizedQuery))) {
    delta += reasonCodes.size > 0 ? 1 : 3;
    reasonCodes.add("QUERY_TEXT_MATCH");
  }

  return {
    delta: Math.min(delta, exactNameMatch ? 28 : 18),
    reasonCodes: Array.from(reasonCodes)
  };
}

function playFeaturesMatch(playFeatures: Record<string, unknown> | undefined, normalizedQuery: string, terms: string[]) {
  return structuredJsonMatch(playFeatures, normalizedQuery, terms);
}

function routeSupportMatch(routeSupport: Record<string, unknown> | undefined, normalizedQuery: string, terms: string[]) {
  return structuredJsonMatch(routeSupport, normalizedQuery, terms);
}

function structuredJsonMatch(value: Record<string, unknown> | undefined, normalizedQuery: string, terms: string[]) {
  if (!value) return false;
  const text = normalizeSearchText(JSON.stringify(value));
  if (!text || text === "{}") return false;
  return text.includes(normalizedQuery) || terms.some((term) => text.includes(term));
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function compactSearchText(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function externalRefsAliasTexts(externalRefs: unknown) {
  if (!isRecord(externalRefs)) return [];
  return [externalRefs.aliases, externalRefs.koreanSearchAliases, externalRefs.englishName, externalRefs.localName]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(isNonEmptyString);
}

function externalRefsAliasJsonbExpression() {
  return `(
    case when jsonb_typeof(external_refs->'aliases') = 'array' then external_refs->'aliases' else '[]'::jsonb end
    || case when jsonb_typeof(external_refs->'koreanSearchAliases') = 'array' then external_refs->'koreanSearchAliases' else '[]'::jsonb end
    || case when jsonb_typeof(external_refs->'englishName') = 'string' then jsonb_build_array(external_refs->>'englishName') else '[]'::jsonb end
    || case when jsonb_typeof(external_refs->'localName') = 'string' then jsonb_build_array(external_refs->>'localName') else '[]'::jsonb end
  )`;
}

export function retailAliasCompactTextsForTest(value: string) {
  return retailAliasCompactTexts(value);
}

function retailAliasCompactTexts(value: string) {
  const aliases = new Set<string>();
  let shouldAddBranchSuffix = false;
  const addAlias = (alias: string) => {
    const compact = compactSearchText(alias);
    if (!compact) return;
    aliases.add(compact);
    if (compact.endsWith("점")) aliases.add(compact.slice(0, -1));
    if (shouldAddBranchSuffix && !compact.endsWith("점")) aliases.add(`${compact}점`);
  };

  const compact = compactSearchText(value.replace(/ak\s*plaza/gi, "ak플라자"));
  shouldAddBranchSuffix = retailBranchAliasCandidatePattern.test(compact);
  addAlias(compact);

  const retailReplacements: Array<[RegExp, string[]]> = [
    [/롯데몰/g, ["롯데백화점", "롯데쇼핑몰", "백화점", "쇼핑몰", "롯데"]],
    [/롯데백화점/g, ["롯데몰", "롯데쇼핑몰", "백화점", "쇼핑몰", "롯데"]],
    [/백화점/g, ["롯데백화점", "롯데몰", "롯데쇼핑몰", "롯데", "쇼핑몰", ""]],
    [/쇼핑몰/g, ["롯데몰", "롯데백화점", "롯데쇼핑몰", "롯데", "백화점", ""]],
    [/롯데프리미엄아울렛/g, ["프리미엄아울렛", "롯데아울렛", "아울렛"]],
    [/프리미엄아울렛/g, ["롯데프리미엄아울렛", "롯데아울렛", "아울렛"]],
    [/ak플라자/g, ["ak", "애경백화점", "애경플라자"]],
    [/스타필드시티/g, ["스타필드", "스타필드쇼핑몰", "복합쇼핑몰"]],
    [/스타필드/g, ["스타필드시티", "스타필드쇼핑몰", "복합쇼핑몰"]]
  ];

  for (const [pattern, replacements] of retailReplacements) {
    if (!pattern.test(compact)) continue;
    pattern.lastIndex = 0;
    for (const replacement of replacements) {
      addAlias(compact.replace(pattern, replacement));
    }
  }

  if (compact.includes("롯데프리미엄아울렛의왕") || shouldExpandTimeVillasToUiwang(compact)) {
    [
      "타임빌라스",
      "의왕타임빌라스",
      "롯데프리미엄아울렛의왕점",
      "롯데프리미엄아울렛의왕",
      "롯데프리미엄아울렛타임빌라스",
      "롯데아울렛의왕점",
      "롯데아울렛타임빌라스"
    ].forEach(addAlias);
  }

  return Array.from(aliases);
}

const retailBranchAliasCandidatePattern =
  /(?:롯데몰|롯데백화점|백화점|쇼핑몰|롯데쇼핑몰|롯데프리미엄아울렛|프리미엄아울렛|롯데아울렛|아울렛|ak플라자|스타필드|스타필드시티|타임빌라스)/;

function shouldExpandTimeVillasToUiwang(compact: string) {
  if (!compact.includes("타임빌라스")) return false;
  if (compact.includes("의왕")) return true;
  return !["수원"].some((branch) => compact.includes(branch));
}

function mergeReasonCodes(first: string[], second: string[]) {
  return Array.from(new Set([...first, ...second])).sort();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z_]+$/.test(identifier)) {
    throw new ApiError(500, `Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function placeholderFor(column: string, index: number) {
  if (
    column === "external_refs" ||
    column === "opening_hours" ||
    column === "pricing" ||
    column === "review_search_evidence" ||
    column === "route_support" ||
    column === "score_signals" ||
    column === "taxonomy"
  ) {
    return `$${index}::jsonb`;
  }
  if (column === "play_features") {
    return `$${index}::jsonb`;
  }
  return `$${index}`;
}

function toSqlParam(column: string, value: unknown): SqlParam {
  if (
    column === "external_refs" ||
    column === "opening_hours" ||
    column === "play_features" ||
    column === "pricing" ||
    column === "review_search_evidence" ||
    column === "route_support" ||
    column === "score_signals" ||
    column === "taxonomy"
  ) {
    return JSON.stringify(value ?? {}) as SqlParam;
  }
  return value as SqlParam;
}

function mapPlace(row: PlaceRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    primaryCategory: row.primary_category,
    tags: row.tags,
    description: row.description,
    address: row.address,
    roadAddress: row.road_address,
    region: {
      sido: row.region_sido,
      sigungu: row.region_sigungu,
      dong: row.region_dong,
      countryCode: row.country_code,
      countryName: row.country_name,
      city: row.city,
      locality: row.locality,
      localCurrency: row.local_currency
    },
    regionSido: row.region_sido,
    regionSigungu: row.region_sigungu,
    countryCode: row.country_code,
    countryName: row.country_name,
    city: row.city,
    locality: row.locality,
    localCurrency: row.local_currency,
    lat: Number(row.lat),
    lng: Number(row.lng),
    distanceKm: row.distance_km === null || row.distance_km === undefined ? null : Number(row.distance_km),
    contact: {
      phone: row.phone,
      officialUrl: row.official_url,
      reservationUrl: row.reservation_url,
      kakaoPlaceUrl: row.kakao_place_url,
      kakaoPlaceId: row.kakao_place_id
    },
    externalRefs: row.external_refs,
    playFeatures: row.play_features ?? {},
    taxonomy: row.taxonomy ?? emptyPlaceTaxonomy(),
    pricing: row.pricing ?? {},
    reviewSearchEvidence: row.review_search_evidence ?? [],
    routeSupport: row.route_support ?? {},
    status: row.status,
    dataConfidence: row.data_confidence,
    scoring: {
      placeScore: row.place_score,
      placeScoreRationale: row.place_score_rationale,
      externalRatingScore: row.external_rating_score,
      externalReviewCount: row.external_review_count,
      searchEvidenceScore: row.search_evidence_score,
      scoreSignals: row.score_signals ?? {},
      scoreUpdatedAt: row.score_updated_at ? toIso(row.score_updated_at) : null
    },
    recommendedAgeMonths: {
      min: row.min_recommended_age_months,
      max: row.max_recommended_age_months
    },
    facilities: {
      indoorType: row.indoor_type,
      strollerFriendly: row.stroller_friendly,
      parkingAvailable: row.parking_available,
      parkingFrictionLevel: row.parking_friction_level,
      peakParkingWindow: row.peak_parking_window,
      parkingWaitNote: row.parking_wait_note,
      nursingRoom: row.nursing_room,
      diaperChangingTable: row.diaper_changing_table,
      kidsToilet: row.kids_toilet,
      elevator: row.elevator,
      babyChair: row.baby_chair,
      foodAllowed: row.food_allowed
    },
    visit: {
      reservationRequired: row.reservation_required,
      walkInAvailable: row.walk_in_available,
      sessionBased: row.session_based,
      sameDayAvailabilityKnown: row.same_day_availability_known,
      averageStayMinutes: row.average_stay_minutes,
      parentEffortLevel: row.parent_effort_level,
      childEngagementLevel: row.child_engagement_level,
      rainyDayScore: row.rainy_day_score,
      hotDayScore: row.hot_day_score,
      coldDayScore: row.cold_day_score
    },
    notes: {
      safety: row.safety_notes,
      parent: row.parent_notes
    },
    openingHours: row.opening_hours,
    version: row.version,
    publicViewCount: Number(row.public_view_count ?? 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastVerifiedAt: row.last_verified_at ? toIso(row.last_verified_at) : null
  };
}

function mapRelatedPlace(row: RelatedPlaceRow) {
  return {
    relationId: row.relation_id,
    placeId: row.related_place_id,
    name: row.name,
    primaryCategory: row.primary_category,
    tags: row.tags,
    address: row.address,
    roadAddress: row.road_address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    status: row.status,
    relationType: row.relation_type,
    note: row.note,
    evidence: row.evidence ?? {},
    distanceMeters: row.distance_meters === null || row.distance_meters === undefined ? null : Math.round(Number(row.distance_meters)),
    createdAt: toIso(row.relation_created_at),
    updatedAt: toIso(row.relation_updated_at)
  };
}

function buildImageMetadataFromRows(imageRows: PlaceImageRow[]) {
  const images = imageRows.map(mapPlaceImage);
  return {
    imageUrls: images.map((image) => image.url),
    primaryImage: images.find((image) => image.isPrimary) ?? images[0] ?? null,
    images
  };
}

export function buildSearchImageHealth(imageRows: Pick<PlaceImageRow, "url" | "is_primary" | "review_status" | "checked_at" | "updated_at">[]) {
  const activeCount = imageRows.length;
  const approvedCount = imageRows.filter((row) => row.review_status === "approved").length;
  const needsReviewCount = imageRows.filter((row) => row.review_status === "needs_review").length;
  const pendingReviewCount = imageRows.filter((row) => row.review_status === "pending_review").length;
  const primaryRow = imageRows.find((row) => row.is_primary) ?? null;
  const primaryImageUrl = primaryRow?.url ?? imageRows[0]?.url ?? null;
  const primaryReviewStatus = primaryRow?.review_status ?? imageRows[0]?.review_status ?? null;
  const hasPrimary = primaryRow !== null;
  const status = searchImageHealthStatus({ activeCount, hasPrimary, needsReviewCount, pendingReviewCount });

  return {
    status,
    suggestedAction: imageHealthSuggestedAction(status),
    priorityScore: searchImageHealthPriority(status, needsReviewCount, pendingReviewCount),
    activeCount,
    approvedCount,
    needsReviewCount,
    pendingReviewCount,
    hasPrimary,
    primaryImageUrl,
    primaryReviewStatus,
    latestImageCheckedAt: latestImageDate(imageRows.map((row) => row.checked_at)),
    latestImageUpdatedAt: latestImageDate(imageRows.map((row) => row.updated_at))
  };
}

export function buildSearchSourceSummary(
  sourceRows: Array<Pick<SourceRow, "source_type"> & Partial<Pick<SourceRow, "title" | "summary">> & { checked_at: Date | string | null; created_at: Date | string }>,
  options: { now?: Date } = {}
) {
  const normalizedSourceRows = normalizeStoredSourceRows(sourceRows);
  const sourceTypes = Array.from(new Set(normalizedSourceRows.map((row) => row.source_type))).sort(compareSourceTypes);
  const openingHoursSources = normalizedSourceRows.filter(isOpeningHoursEvidenceSource);
  const strongestSource = normalizedSourceRows
    .slice()
    .sort((a, b) => sourceTierRank(sourceTrustTier(b.source_type)) - sourceTierRank(sourceTrustTier(a.source_type)) || a.source_type.localeCompare(b.source_type))[0];
  const latestChecked = normalizedSourceRows
    .filter((row): row is typeof row & { checked_at: Date | string } => Boolean(row.checked_at))
    .sort((a, b) => dateMillis(b.checked_at) - dateMillis(a.checked_at))[0];
  const latestCreated = normalizedSourceRows.slice().sort((a, b) => dateMillis(b.created_at) - dateMillis(a.created_at))[0];

  return {
    sourceCount: normalizedSourceRows.length,
    sourceTypes,
    bestSourceType: strongestSource?.source_type ?? null,
    bestSourceTier: strongestSource ? sourceTrustTier(strongestSource.source_type) : "none",
    latestSourceType: latestChecked?.source_type ?? latestCreated?.source_type ?? null,
    latestCheckedAt: latestChecked ? toIso(latestChecked.checked_at) : null,
    latestCreatedAt: latestCreated ? toIso(latestCreated.created_at) : null,
    freshnessStatus: sourceFreshnessStatus(latestChecked?.checked_at ?? null, options.now ?? new Date()),
    openingHoursEvidence: buildOpeningHoursEvidenceSummary(openingHoursSources, options.now ?? new Date())
  };
}

function buildOpeningHoursEvidenceSummary(
  sourceRows: Array<Pick<SourceRow, "source_type"> & Partial<Pick<SourceRow, "title" | "summary">> & { checked_at: Date | string | null; created_at: Date | string }>,
  now: Date
) {
  const normalizedSourceRows = normalizeStoredSourceRows(sourceRows);
  const strongestSource = normalizedSourceRows
    .slice()
    .sort((a, b) => sourceTierRank(sourceTrustTier(b.source_type)) - sourceTierRank(sourceTrustTier(a.source_type)) || a.source_type.localeCompare(b.source_type))[0];
  const latestChecked = normalizedSourceRows
    .filter((row): row is typeof row & { checked_at: Date | string } => Boolean(row.checked_at))
    .sort((a, b) => dateMillis(b.checked_at) - dateMillis(a.checked_at))[0];

  return {
    sourceCount: normalizedSourceRows.length,
    sourceTypes: Array.from(new Set(normalizedSourceRows.map((row) => row.source_type))).sort(compareSourceTypes),
    bestSourceType: strongestSource?.source_type ?? null,
    bestSourceTier: strongestSource ? sourceTrustTier(strongestSource.source_type) : "none",
    latestCheckedAt: latestChecked ? toIso(latestChecked.checked_at) : null,
    freshnessStatus: sourceFreshnessStatus(latestChecked?.checked_at ?? null, now)
  };
}

function normalizeStoredSourceRows<T extends { source_type: string }>(sourceRows: T[]): T[] {
  return sourceRows.map((row) => {
    const sourceType = canonicalStoredSourceType(row.source_type);
    return sourceType === row.source_type ? row : { ...row, source_type: sourceType };
  });
}

function isOpeningHoursEvidenceSource(source: Pick<SourceRow, "source_type"> & Partial<Pick<SourceRow, "title" | "summary">>) {
  const text = `${source.source_type} ${source.title ?? ""} ${source.summary ?? ""}`.toLocaleLowerCase("ko-KR");
  return openingHoursEvidenceTerms.some((term) => text.includes(term));
}

const openingHoursEvidenceTerms = [
  "opening",
  "hours",
  "operating",
  "business hour",
  "reservation",
  "booking",
  "session",
  "영업시간",
  "운영시간",
  "이용시간",
  "운영",
  "영업",
  "휴무",
  "휴관",
  "예약",
  "회차",
  "세션",
  "입장"
];

type OpeningHoursDataSignal = ReturnType<typeof buildOpeningHoursDataSignal>;
type SearchSourceSummary = ReturnType<typeof buildSearchSourceSummary>;
type OpeningHoursVisitSignal = Pick<
  ReturnType<typeof mapPlace>["visit"],
  "reservationRequired" | "walkInAvailable" | "sessionBased" | "sameDayAvailabilityKnown"
>;

export function buildOpeningHoursDataSignal(openingHours: unknown) {
  if (typeof openingHours === "string" && openingHours.trim().length > 0) {
    return {
      dataStatus: "unstructured",
      hasData: true,
      hasStructuredData: false
    };
  }

  if (!isPlainRecord(openingHours) || Object.keys(openingHours).length === 0) {
    return {
      dataStatus: "missing",
      hasData: false,
      hasStructuredData: false
    };
  }

  const hasStructuredData = hasStructuredOpeningHoursData(openingHours);
  return {
    dataStatus: hasStructuredData ? "structured" : "unstructured",
    hasData: true,
    hasStructuredData
  };
}

export function buildSearchOpeningHoursSummary(
  dataSignal: OpeningHoursDataSignal,
  sourceSummary: SearchSourceSummary,
  visit?: OpeningHoursVisitSignal
) {
  const sourceEvidence = sourceSummary.openingHoursEvidence;
  const sourceBacked = sourceEvidence.sourceCount > 0;
  const confidenceLevel = openingHoursConfidenceLevel(dataSignal, sourceEvidence);

  return {
    dataStatus: dataSignal.dataStatus,
    confidenceLevel,
    sourceBacked,
    bestSourceType: sourceEvidence.bestSourceType,
    bestSourceTier: sourceEvidence.bestSourceTier,
    sourceCount: sourceEvidence.sourceCount,
    sourceTypes: sourceEvidence.sourceTypes,
    latestCheckedAt: sourceEvidence.latestCheckedAt,
    freshnessStatus: sourceEvidence.freshnessStatus,
    hasStructuredData: dataSignal.hasStructuredData,
    structuredDataGaps: sourceBacked ? openingHoursStructuredDataGaps(dataSignal, visit) : []
  };
}

function openingHoursStructuredDataGaps(dataSignal: OpeningHoursDataSignal, visit?: OpeningHoursVisitSignal) {
  const gaps: string[] = [];
  if (!dataSignal.hasStructuredData) gaps.push("openingHours");
  if (!visit) return gaps;

  for (const field of ["reservationRequired", "walkInAvailable", "sessionBased", "sameDayAvailabilityKnown"] as const) {
    if (visit[field] === "unknown") gaps.push(field);
  }

  return gaps;
}

const familyLogisticsStructuredDataGapKeys = [
  "strollerFriendly",
  "parkingAvailable",
  "nursingRoom",
  "diaperChangingTable",
  "kidsToilet",
  "elevator",
  "babyChair",
  "foodAllowed"
] as const;

const visitStructuredDataGapKeys = ["reservationRequired", "walkInAvailable", "sessionBased", "sameDayAvailabilityKnown"] as const;

type StructuredDataGapPlace = {
  facilities: Pick<SearchFacilities, (typeof familyLogisticsStructuredDataGapKeys)[number]>;
  visit: Pick<ReturnType<typeof mapPlace>["visit"], (typeof visitStructuredDataGapKeys)[number]>;
};

export function buildStructuredDataGaps(
  place: StructuredDataGapPlace,
  sourceSummary: Pick<SearchSourceSummary, "sourceCount">,
  openingHoursSummary?: Pick<ReturnType<typeof buildSearchOpeningHoursSummary>, "structuredDataGaps">
) {
  if (sourceSummary.sourceCount === 0) return [];

  const gaps = new Set<string>();

  for (const field of familyLogisticsStructuredDataGapKeys) {
    if (place.facilities[field] === "unknown") gaps.add(field);
  }

  for (const field of visitStructuredDataGapKeys) {
    if (place.visit[field] === "unknown") gaps.add(field);
  }

  for (const field of openingHoursSummary?.structuredDataGaps ?? []) {
    gaps.add(field);
  }

  return Array.from(gaps);
}

const recommendationOperationGapKeys = new Set(["openingHours", "reservationRequired", "walkInAvailable", "sessionBased", "sameDayAvailabilityKnown"]);
const recommendationInfantGapKeys = new Set(["strollerFriendly", "nursingRoom", "diaperChangingTable", "elevator"]);
const paidPlanningCategories = new Set(["kids_cafe", "indoor_playground", "family_cafe", "family_restaurant", "accommodation"]);
const playgroundInfantRouteKeys = ["strollerFriendly", "parkingAvailable", "kidsToilet"] as const;
const playgroundReadinessGapKeys = new Set([...playgroundInfantRouteKeys, "nursingRoom", "diaperChangingTable"]);
const playgroundFeatureKeys = [
  "slide",
  "swing",
  "seesaw",
  "babySwing",
  "sandPlay",
  "waterPlayground",
  "climbing",
  "openLawn",
  "shade",
  "fenced",
  "rubberSurface",
  "strollerPath",
  "toiletNearby"
];

type RecommendationReadinessMode = "familyWeekend" | "rainyDay" | "dayTrip";
type SearchRecommendationReadinessPlace = {
  primaryCategory: string;
  pricing: Record<string, unknown>;
  playFeatures?: Record<string, unknown> | null;
  structuredDataGaps: string[];
  openingHoursSummary: ReturnType<typeof buildSearchOpeningHoursSummary>;
  imageHealth: ReturnType<typeof buildSearchImageHealth>;
  sourceSummary: Pick<SearchSourceSummary, "sourceCount">;
  facilities: Pick<SearchFacilities, "indoorType">;
};

export function buildSearchRecommendationReadiness(
  place: SearchRecommendationReadinessPlace,
  input: Pick<SearchPlacesInput, "childAgeMonths" | "visitContext"> = {}
) {
  const readinessMode = recommendationReadinessMode(input.visitContext);
  const blockingGaps = new Set<string>();
  const cautionNotes: string[] = [];
  const hasInfant = input.childAgeMonths?.some((ageMonths) => ageMonths < 18) ?? false;

  if (place.sourceSummary.sourceCount === 0) {
    blockingGaps.add("sourceEvidence");
  }

  for (const gap of place.structuredDataGaps) {
    if (recommendationOperationGapKeys.has(gap)) {
      blockingGaps.add(gap);
    }
    if (hasInfant && recommendationInfantGapKeys.has(gap)) {
      blockingGaps.add(gap);
    }
  }

  if (place.primaryCategory === "park") {
    if (!hasPositivePlaygroundFeature(place.playFeatures)) {
      blockingGaps.add("playFeatures");
      cautionNotes.push("놀이기구, 그늘, 울타리, 바닥, 화장실 근접성 같은 놀이터 장비 정보가 부족해 가까운 후보라도 현장 검증이 필요합니다.");
    }
    if (hasInfant) {
      for (const gap of place.structuredDataGaps) {
        if (playgroundReadinessGapKeys.has(gap)) {
          blockingGaps.add(gap);
        }
      }
    }
  }

  if (place.imageHealth.status === "no_active_image") {
    blockingGaps.add("primaryImage");
  } else if (place.imageHealth.status !== "healthy") {
    cautionNotes.push("대표 이미지는 있지만 검토나 대표 지정 상태를 확인해야 합니다.");
  }

  if (place.openingHoursSummary.confidenceLevel === "source_backed" || place.openingHoursSummary.confidenceLevel === "low") {
    cautionNotes.push("운영시간 근거는 있지만 구조화되지 않아 출발 전 확인 문구가 필요합니다.");
  }

  if (paidPlanningCategories.has(place.primaryCategory) && !hasMeaningfulPricing(place.pricing)) {
    cautionNotes.push("유료 가능성이 높은 장소라 가격이나 회차 정보를 별도로 확인해야 합니다.");
  }

  if (readinessMode === "rainyDay" && !["indoor", "mixed"].includes(place.facilities.indoorType)) {
    cautionNotes.push("비 오는 날 후보라면 실내 이용 가능성을 다시 확인해야 합니다.");
  }

  const gapList = Array.from(blockingGaps);
  return {
    readinessMode,
    readyForWeekendRecommendation: gapList.length === 0,
    blockingGaps: gapList,
    cautionNotes,
    agentSummary:
      gapList.length === 0
        ? "운영, 예약, 이미지 핵심 신호가 갖춰져 바로 비교 후보로 사용할 수 있습니다."
        : `핵심 확인값 ${gapList.length}개가 비어 있어 검색 결과 문구에 확인 필요 사유를 함께 표시해야 합니다.`
  };
}

function recommendationReadinessMode(visitContext: SearchPlacesInput["visitContext"]): RecommendationReadinessMode {
  if (visitContext === "rainyDay") return "rainyDay";
  if (visitContext === "dayTrip") return "dayTrip";
  return "familyWeekend";
}

function hasMeaningfulPricing(pricing: Record<string, unknown>) {
  if (!isPlainRecord(pricing) || Object.keys(pricing).length === 0) return false;
  if (Array.isArray(pricing.items) && pricing.items.length > 0) return true;
  return ["summary", "basisDate", "checkedAt", "priceCheckedAt"].some((key) => typeof pricing[key] === "string" && pricing[key].trim().length > 0);
}

function hasPositivePlaygroundFeature(playFeatures: Record<string, unknown> | null | undefined, keys = playgroundFeatureKeys) {
  if (!isPlainRecord(playFeatures)) return false;
  return keys.some((key) => {
    const value = playFeatures[key];
    return value === "yes" || value === "partial" || value === true;
  });
}

function openingHoursConfidenceLevel(dataSignal: OpeningHoursDataSignal, sourceEvidence: SearchSourceSummary["openingHoursEvidence"]) {
  if (dataSignal.hasStructuredData && ["official", "public_agency", "operator"].includes(sourceEvidence.bestSourceTier)) return "high";
  if (dataSignal.hasStructuredData) return "medium";
  if (sourceEvidence.sourceCount > 0 && ["official", "public_agency", "operator"].includes(sourceEvidence.bestSourceTier)) return "source_backed";
  if (sourceEvidence.sourceCount > 0) return "low";
  return "unknown";
}

function hasStructuredOpeningHoursData(openingHours: Record<string, unknown>) {
  if (typeof openingHours.openNow === "boolean" || typeof openingHours.isOpen === "boolean") return true;
  if ([openingHours.status, openingHours.openStatus, openingHours.businessStatus].some((value) => typeof value === "string")) return true;
  if (Array.isArray(openingHours.periods) && openingHours.periods.length > 0) return true;
  if (Array.isArray(openingHours.openingHoursSpecification) && openingHours.openingHoursSpecification.length > 0) return true;
  if (isPlainRecord(openingHours.weekly) && Object.keys(openingHours.weekly).length > 0) return true;
  return false;
}

export function buildSearchPreferenceSemantics(preferences: SearchPlacesInput["preferences"] | undefined) {
  return {
    mode: "soft" as const,
    requestedKeys: searchPreferenceKeys(preferences),
    unknownValuesRemainEligible: true,
    mismatchesRemainEligible: true,
    hardFilteringSupported: false
  };
}

const infantLogisticsKeys = ["strollerFriendly", "elevator", "nursingRoom", "diaperChangingTable", "babyChair", "parkingAvailable"] as const;

export function buildInfantLogisticsSignal(facilities: Pick<SearchFacilities, (typeof infantLogisticsKeys)[number]>) {
  const positiveSignals = infantLogisticsKeys.filter((key) => facilities[key] === "yes");
  const partialSignals = infantLogisticsKeys.filter((key) => facilities[key] === "partial");
  const negativeSignals = infantLogisticsKeys.filter((key) => facilities[key] === "no");
  const missingSignals = infantLogisticsKeys.filter((key) => facilities[key] === "unknown");
  const knownCount = infantLogisticsKeys.length - missingSignals.length;
  const supportScore = Math.round(((positiveSignals.length * 2 + partialSignals.length) / (infantLogisticsKeys.length * 2)) * 100);
  const confidenceScore = Math.round((knownCount / infantLogisticsKeys.length) * 100);

  return {
    confidenceLevel: infantLogisticsConfidenceLevel(knownCount),
    confidenceScore,
    supportLevel: infantLogisticsSupportLevel(supportScore, knownCount, negativeSignals.length),
    supportScore,
    knownCount,
    unknownCount: missingSignals.length,
    positiveSignals,
    partialSignals,
    negativeSignals,
    missingSignals
  };
}

function infantLogisticsConfidenceLevel(knownCount: number) {
  if (knownCount >= 5) return "high";
  if (knownCount >= 3) return "medium";
  if (knownCount > 0) return "low";
  return "unknown";
}

function infantLogisticsSupportLevel(supportScore: number, knownCount: number, negativeCount: number) {
  if (knownCount === 0) return "unknown";
  if (supportScore >= 75 && negativeCount === 0) return "strong";
  if (supportScore >= 45) return "moderate";
  if (supportScore > 0) return "limited";
  return "poor";
}

function searchPreferenceKeys(preferences: SearchPlacesInput["preferences"] | undefined) {
  if (!preferences) return [];

  return Object.entries(preferences)
    .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value === true))
    .map(([key]) => key)
    .sort();
}

function compareSourceTypes(a: string, b: string) {
  const tierDelta = sourceTierRank(sourceTrustTier(b)) - sourceTierRank(sourceTrustTier(a));
  return tierDelta || a.localeCompare(b);
}

function sourceTrustTier(sourceType: string) {
  const normalized = sourceType.toLocaleLowerCase("en-US");
  if (normalized.includes("official")) return "official";
  if (normalized.includes("public_agency") || normalized.includes("public_tourism")) return "public_agency";
  if (normalized.includes("operator")) return "operator";
  if (normalized.includes("listing") || normalized.includes("news") || normalized.includes("blog")) return "public_listing";
  return "other";
}

function sourceTierRank(tier: string) {
  switch (tier) {
    case "official":
      return 5;
    case "public_agency":
      return 4;
    case "operator":
      return 3;
    case "public_listing":
      return 2;
    case "other":
      return 1;
    default:
      return 0;
  }
}

function sourceFreshnessStatus(latestCheckedAt: Date | string | null, now: Date) {
  if (!latestCheckedAt) return "unchecked";

  const ageDays = Math.max(0, Math.floor((now.getTime() - dateMillis(latestCheckedAt)) / (24 * 60 * 60 * 1000)));
  if (ageDays === 0) return "checked_today";
  if (ageDays <= 30) return "recent";
  if (ageDays <= 180) return "aging";
  return "stale";
}

function searchImageHealthStatus(input: { activeCount: number; hasPrimary: boolean; needsReviewCount: number; pendingReviewCount: number }) {
  if (input.activeCount === 0) return "no_active_image";
  if (!input.hasPrimary) return "no_primary";
  if (input.needsReviewCount > 0) return "needs_review";
  if (input.pendingReviewCount > 0) return "pending_review";
  return "healthy";
}

function searchImageHealthPriority(status: string, needsReviewCount: number, pendingReviewCount: number) {
  const base =
    status === "no_active_image" ? 100 : status === "no_primary" ? 35 : status === "needs_review" ? 20 : status === "pending_review" ? 10 : 0;
  return base + needsReviewCount * 12 + pendingReviewCount * 7;
}

function latestImageDate(values: Array<Date | string | null>) {
  const latest = values
    .filter((value): value is Date | string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  return latest === undefined ? null : new Date(latest).toISOString();
}

function mapPlaceImage(row: PlaceImageRow) {
  return {
    id: row.id,
    placeId: row.place_id,
    url: row.url,
    sortOrder: row.sort_order,
    isPrimary: row.is_primary,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    sourceType: canonicalStoredNullableSourceType(row.source_type),
    sourceTitle: row.source_title,
    displayTier: row.display_tier,
    creditText: row.credit_text ?? imageCreditText(imageRowSource(row), row.display_tier),
    altText: row.alt_text,
    description: row.description,
    visualFeatures: row.visual_features,
    childSignals: row.child_signals,
    width: row.width,
    height: row.height,
    checkedAt: row.checked_at ? toIso(row.checked_at) : null,
    status: row.status,
    reviewStatus: row.review_status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function imageRowSource(row: PlaceImageRow): ImageMetadataSource {
  return {
    id: row.source_id,
    sourceType: canonicalStoredNullableSourceType(row.source_type) ?? "unknown",
    title: row.source_title,
    url: row.source_url,
    checkedAt: row.checked_at ? toIso(row.checked_at) : null
  };
}

function mapSource(row: SourceRow) {
  return {
    id: row.id,
    sourceType: canonicalStoredSourceType(row.source_type),
    title: row.title,
    url: row.url,
    externalId: row.external_id,
    summary: row.summary,
    checkedAt: row.checked_at ? toIso(row.checked_at) : null,
    createdAt: toIso(row.created_at)
  };
}

function canonicalStoredSourceType(sourceType: string) {
  return normalizeSourceType(sourceType) ?? sourceType;
}

function canonicalStoredNullableSourceType(sourceType: string | null) {
  return sourceType ? canonicalStoredSourceType(sourceType) : null;
}

export function buildImageMetadata(imageUrls: string[], sources: ImageMetadataSource[] = []) {
  const imageSources = sources.filter(isImageLikeSource);
  const fallbackSource = imageSources[0] ?? sources[0] ?? null;
  const images = imageUrls.map((url, index) => {
    const source = imageSources[index] ?? fallbackSource;
    const displayTier = source ? imageDisplayTier(source) : "unknown";

    return {
      url,
      sortOrder: index,
      sourceId: source?.id ?? null,
      sourceUrl: source?.url ?? null,
      sourceType: source?.sourceType ?? null,
      sourceTitle: source?.title ?? null,
      displayTier,
      creditText: imageCreditText(source, displayTier),
      checkedAt: source?.checkedAt ?? null,
      status: "active" as const
    };
  });

  return {
    primaryImage: images[0] ?? null,
    images
  };
}

function isImageLikeSource(source: ImageMetadataSource) {
  const searchable = [source.sourceType, source.title, source.summary].filter(Boolean).join(" ").toLocaleLowerCase("ko-KR");
  return /image|visual|photo|이미지|사진|비주얼|대표/.test(searchable);
}

function imageDisplayTier(source: ImageMetadataSource) {
  const searchable = [source.sourceType, source.title, source.url, source.summary].filter(Boolean).join(" ").toLocaleLowerCase("ko-KR");

  if (/official|공식/.test(searchable)) return "official";
  if (/news|article|보도|기사/.test(searchable)) return "rights_unclear";
  if (/operator|booking|tabling|ban-life|peton|diningcode|listing|profile|udanax|mommom|운영/.test(searchable)) return "public_listing";
  if (/public_agency|public_tourism|public_open|gu_|city_|tourism|kto|visitkorea|daejeon|donggu|daedeok|seogu|yuseong|science\.go\.kr|공공|관광|구청|시청/.test(searchable)) {
    return "public_agency";
  }

  return "unknown";
}

function imageCreditText(source: ImageMetadataSource | null, displayTier: string) {
  if (source?.title) return source.title;
  if (source?.sourceType) return source.sourceType;
  const labels: Record<string, string> = {
    official: "공식 이미지",
    public_agency: "공공 이미지",
    operator: "운영자 이미지",
    public_listing: "공개 목록 이미지",
    rights_unclear: "검토 필요 이미지",
    unknown: "이미지 출처 미확인"
  };
  return labels[displayTier] ?? "이미지 출처 미확인";
}

function mapVersionSummary(row: VersionRow) {
  return {
    id: row.id,
    versionNumber: row.version_number,
    action: row.action,
    actor: row.actor,
    changeSummary: row.change_summary,
    createdAt: toIso(row.created_at)
  };
}

function mapVersion(row: VersionRow) {
  return {
    ...mapVersionSummary(row),
    snapshot: row.snapshot,
    sources: row.sources
  };
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dateMillis(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
