import { pg } from "@/db/client";
import { ApiError } from "@/lib/errors";
import {
  type CreatePlaceInput,
  type DuplicatePlaceInput,
  type PlaceImageHealthQueryInput,
  type PlaceImageInput,
  type SearchPlacesInput,
  type SourceInput,
  type UpdatePlaceInput
} from "@/lib/schemas";
import { duplicateConfidence, duplicateReasonCodes } from "@/lib/duplicates";
import { describeReasonCodes } from "@/lib/reasons";
import { scorePlace } from "@/lib/scoring";
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
  lat: number;
  lng: number;
  phone: string | null;
  official_url: string | null;
  reservation_url: string | null;
  kakao_place_url: string | null;
  kakao_place_id: string | null;
  external_refs: Record<string, unknown>;
  play_features: Record<string, unknown>;
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
  nursing_room: string;
  diaper_changing_table: string;
  kids_toilet: string;
  elevator: string;
  baby_chair: string;
  food_allowed: string;
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
  lat: "lat",
  lng: "lng",
  phone: "phone",
  officialUrl: "official_url",
  reservationUrl: "reservation_url",
  kakaoPlaceUrl: "kakao_place_url",
  kakaoPlaceId: "kakao_place_id",
  externalRefs: "external_refs",
  playFeatures: "play_features",
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
  nursingRoom: "nursing_room",
  diaperChangingTable: "diaper_changing_table",
  kidsToilet: "kids_toilet",
  elevator: "elevator",
  babyChair: "baby_chair",
  foodAllowed: "food_allowed",
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
  const insert = toDbRecord(input);
  const columns = Object.keys(insert);
  const imageInputs = normalizeImageInputs(input.images, input.imageUrls, input.sources);

  return pg.begin(async (tx) => {
    const [place] = await insertPlace(tx, insert, columns);

    await insertSources(tx, place.id, input.sources);
    await insertImages(tx, place.id, imageInputs);
    await ensurePrimaryImage(tx, place.id);
    await createVersion(tx, place.id, 1, "create", input.actor, input.changeSummary, input.sources);

    return getPlaceDetail(place.id, tx);
  });
}

export async function updatePlace(placeId: string, input: UpdatePlaceInput) {
  const patch = toDbRecord(input);
  const columns = Object.keys(patch);
  const imageInputs = normalizeImageInputs(input.images, input.imageUrls, input.sources);
  const hasImagePatch = input.images !== undefined || input.imageUrls !== undefined;

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

    if (input.sourceMode === "replace") {
      await tx`delete from place_sources where place_id = ${updated.id}`;
    }
    await insertSources(tx, updated.id, input.sources);
    if (hasImagePatch) {
      if (input.imageMode === "replace") {
        await tx`delete from place_images where place_id = ${updated.id}`;
      }
      await insertImages(tx, updated.id, imageInputs);
      await ensurePrimaryImage(tx, updated.id);
    }
    await createVersion(tx, updated.id, updated.version, "update", input.actor, input.changeSummary, input.sources);

    return getPlaceDetail(updated.id, tx);
  });
}

export async function deletePlace(placeId: string) {
  return pg.begin(async (tx) => {
    const rows = await tx<PlaceRow[]>`select * from places where id = ${placeId}`;
    if (rows.length === 0) {
      throw new ApiError(404, "Place not found");
    }

    await tx`delete from places where id = ${placeId}`;

    return {
      id: rows[0].id,
      name: rows[0].name,
      deleted: true
    };
  });
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

  return {
    ...mapPlace(rows[0]),
    ...imageMetadata,
    sources,
    versions: latestVersions.map(mapVersionSummary)
  };
}

export async function searchPlaces(input: SearchPlacesInput) {
  const normalizedInput = normalizeSearchInput(input);
  const queryParts = buildSearchQuery(normalizedInput);
  const rows = await pg.unsafe<PlaceRow[]>(queryParts.sql, queryParts.params);

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
      distanceKm: place.distanceKm
    } satisfies Parameters<typeof scorePlace>[0];
    const scoredPlace = scorePlace(scoringPlace, normalizedInput);
    const querySignal = queryMatchSignal(place, normalizedInput.query);
    const score = clampScore(applySearchEvidenceCaps(scoredPlace.score + querySignal.delta, place.scoring));

    return {
      placeId: place.id,
      name: place.name,
      primaryCategory: place.primaryCategory,
      tags: place.tags,
      address: place.address,
      description: place.description,
      playFeatures: place.playFeatures,
      lat: place.lat,
      lng: place.lng,
      distanceKm: place.distanceKm,
      score,
      scoreBreakdown: {
        ...scoredPlace.scoreBreakdown,
        queryMatch: querySignal.delta,
        total: score
      },
      reasonCodes: mergeReasonCodes(scoredPlace.reasonCodes, querySignal.reasonCodes),
      reasons: describeReasonCodes(mergeReasonCodes(scoredPlace.reasonCodes, querySignal.reasonCodes), normalizedInput),
      dataConfidence: place.dataConfidence,
      scoring: place.scoring,
      recommendedAgeMonths: place.recommendedAgeMonths,
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

    if (input.sort === "updatedAt") {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }

    if (b.score !== a.score) return b.score - a.score;
    return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
  });

  const items = scored.slice(input.offset, input.offset + input.limit);
  const imageMap = await getImageMapForPlaces(items.map((item) => item.placeId));
  const enrichedItems = items.map((item) => ({
    ...item,
    ...buildImageMetadataFromRows(imageMap.get(item.placeId) ?? [])
  }));

  return {
    items: enrichedItems,
    meta: {
      count: enrichedItems.length,
      total: scored.length,
      limit: input.limit,
      offset: input.offset,
      origin: input.origin ?? null,
      search: {
        originalQuery: input.query ?? null,
        normalizedQuery: normalizedInput.query ?? null,
        appliedPreferences: normalizedInput.preferences ?? null,
        visitContext: normalizedInput.visitContext ?? null,
        normalized:
          input.query !== normalizedInput.query ||
          input.visitContext !== normalizedInput.visitContext ||
          JSON.stringify(input.preferences ?? null) !== JSON.stringify(normalizedInput.preferences ?? null)
      }
    }
  };
}

function applySearchEvidenceCaps(value: number, scoring: ReturnType<typeof mapPlace>["scoring"]) {
  if (scoring.placeScore === null && scoring.externalRatingScore === null && scoring.searchEvidenceScore === null) return Math.min(value, 88);
  if (scoring.placeScore === null) return Math.min(value, 92);
  if (scoring.externalRatingScore === null) return Math.min(value, 96);
  return value;
}

export async function listPlaceImageHealth(input: PlaceImageHealthQueryInput) {
  const params: SqlParam[] = [];
  const where = ["p.status = 'active'"];
  const add = (value: unknown) => {
    params.push(value as SqlParam);
    return `$${params.length}`;
  };

  if (input.primaryCategory) {
    where.push(`p.primary_category = ${add(input.primaryCategory)}`);
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
      dong: row.region_dong
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

export async function findDuplicatePlaces(input: DuplicatePlaceInput) {
  const containsName = `%${input.name}%`;
  const compactName = compactSearchText(input.name);
  const containsCompactName = `%${compactName}%`;
  const genericAliasTerms = duplicateGenericAliasTerms;
  const externalRefsJson =
    input.externalRefs && Object.keys(input.externalRefs).length > 0 ? JSON.stringify(input.externalRefs) : null;
  const rows = await pg<
    (PlaceRow & {
      distance_meters: number | null;
      name_similarity: number | null;
      alias_match: boolean;
      external_refs_match: boolean;
      kakao_place_id_match: boolean;
    })[]
  >`
    select
      *,
      ST_Distance(geo, ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography) as distance_meters,
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
      ) as alias_match,
      (${externalRefsJson}::jsonb is not null and external_refs @> ${externalRefsJson}::jsonb) as external_refs_match,
      (${input.kakaoPlaceId ?? null}::text is not null and kakao_place_id = ${input.kakaoPlaceId ?? null}) as kakao_place_id_match
    from places
    where
      status <> 'closed'
      and (
        (${input.kakaoPlaceId ?? null}::text is not null and kakao_place_id = ${input.kakaoPlaceId ?? null})
        or (${externalRefsJson}::jsonb is not null and external_refs @> ${externalRefsJson}::jsonb)
        or (
          ST_DWithin(geo, ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography, ${input.radiusMeters})
          and (
            name = ${input.name}
            or name ilike ${containsName}
            or ${input.name} ilike ('%' || name || '%')
            or similarity(name, ${input.name}) >= 0.25
            or regexp_replace(lower(name), '\\s+', '', 'g') ilike ${containsCompactName}
            or exists (
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
          )
        )
      )
    order by kakao_place_id_match desc, external_refs_match desc, alias_match desc, name_similarity desc, distance_meters asc
    limit ${input.limit}
  `;

  const items = await Promise.all(
    rows.map(async (row) => {
      const signals = {
        aliasMatch: row.alias_match,
        externalRefsMatch: row.external_refs_match,
        kakaoPlaceIdMatch: row.kakao_place_id_match,
        distanceMeters: row.distance_meters,
        nameSimilarity: row.name_similarity
      };

      return {
        place: await getPlaceDetail(row.id),
        confidence: duplicateConfidence(signals),
        reasonCodes: duplicateReasonCodes(signals),
        distanceMeters: row.distance_meters,
        nameSimilarity: row.name_similarity
      };
    })
  );

  return {
    items
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

export async function listPlaceVersions(placeId: string) {
  const versions = await pg<VersionRow[]>`
    select * from place_versions
    where place_id = ${placeId}
    order by version_number desc
  `;

  return {
    items: versions.map(mapVersionSummary)
  };
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

type NormalizedImageInput = Required<Pick<PlaceImageInput, "url" | "status" | "reviewStatus" | "displayTier" | "isPrimary" | "sortOrder">> &
  Omit<PlaceImageInput, "url" | "status" | "reviewStatus" | "displayTier" | "isPrimary" | "sortOrder">;

function normalizeImageInputs(images: PlaceImageInput[] | undefined, imageUrls: string[] | undefined, sources: SourceInput[]) {
  const fallbackSource = sources.find(isImageLikeSource) ?? sources[0] ?? null;
  const byUrl = new Map<string, NormalizedImageInput>();
  let index = 0;

  for (const image of images ?? []) {
    byUrl.set(image.url, normalizeImageInput(image, index, fallbackSource));
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
        fallbackSource
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
  if (firstActive && !normalized.some((image) => image.isPrimary && image.status === "active" && image.reviewStatus !== "rejected")) {
    firstActive.isPrimary = true;
  }

  return normalized;
}

function normalizeImageInput(image: PlaceImageInput, index: number, fallbackSource: SourceInput | null): NormalizedImageInput {
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
    sortOrder: image.sortOrder ?? index
  };
}

async function insertImages(executor: SqlExecutor, placeId: string, images: NormalizedImageInput[]) {
  if (images.length === 0) return;

  if (images.some((image) => image.isPrimary && image.status === "active" && image.reviewStatus !== "rejected")) {
    await executor`update place_images set is_primary = false, updated_at = now() where place_id = ${placeId}`;
  }

  for (const image of images) {
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
        source_id = excluded.source_id,
        source_type = excluded.source_type,
        source_title = excluded.source_title,
        source_url = excluded.source_url,
        credit_text = excluded.credit_text,
        alt_text = excluded.alt_text,
        description = excluded.description,
        visual_features = excluded.visual_features,
        child_signals = excluded.child_signals,
        display_tier = excluded.display_tier,
        status = excluded.status,
        review_status = excluded.review_status,
        is_primary = excluded.is_primary,
        sort_order = excluded.sort_order,
        width = excluded.width,
        height = excluded.height,
        checked_at = excluded.checked_at,
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

function buildSearchQuery(input: SearchPlacesInput) {
  const params: SqlParam[] = [];
  const where = ["status = 'active'"];
  const add = (value: unknown) => {
    params.push(value as SqlParam);
    return `$${params.length}`;
  };

  const distanceSql = input.origin
    ? `ST_Distance(geo, ST_SetSRID(ST_MakePoint(${add(input.origin.lng)}, ${add(input.origin.lat)}), 4326)::geography) / 1000`
    : "null::double precision";

  if (input.origin) {
    where.push(
      `ST_DWithin(geo, ST_SetSRID(ST_MakePoint(${add(input.origin.lng)}, ${add(input.origin.lat)}), 4326)::geography, ${add(
        input.radiusKm * 1000
      )})`
    );
  }

  if (input.primaryCategories?.length) {
    where.push(`primary_category = any(${add(input.primaryCategories)}::text[])`);
  }

  if (input.query) {
    const clauses = keywordSearchClauses(input.query, add);
    if (clauses.length > 0) {
      const joiner = shouldUseAnyKeywordMatch(input.query) ? " or " : " and ";
      where.push(`(${clauses.join(joiner)})`);
    }
  }

  return {
    sql: `select *, ${distanceSql} as distance_km from places where ${where.join(" and ")} order by coalesce(place_score, 5) desc, updated_at desc limit 750`,
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
  if (!input.query) return input;

  const preferences = { ...(input.preferences ?? {}) };
  const visitContext = input.visitContext ?? inferVisitContextFromQuery(input.query);
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

  if (shouldKeepLiteralQuery(input.query)) {
    return {
      ...input,
      visitContext,
      preferences: Object.keys(preferences).length > 0 ? preferences : input.preferences
    };
  }

  const query = stripLocalPlaygroundIntentTerms(stripPreferenceTerms(input.query));
  return {
    ...input,
    visitContext,
    query,
    preferences: Object.keys(preferences).length > 0 ? preferences : input.preferences
  };
}

function keywordSearchClauses(query: string, add: (value: unknown) => string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);

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
      `description ilike ${patternParam}`,
      `region_sido ilike ${patternParam}`,
      `region_sigungu ilike ${patternParam}`,
      `region_dong ilike ${patternParam}`,
      `exists (select 1 from unnest(tags) as keyword_tag where keyword_tag ilike ${patternParam})`,
      `play_features::text ilike ${patternParam}`
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
  return (
    term.length >= 3 &&
    !isQueryStopTerm(term) &&
    !isQueryPreferenceTerm(term) &&
    !broadParentIntentTerms.has(term) &&
    !broadPlaygroundIntentTerms.has(term) &&
    !categoryKeywordMap[term]
  );
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

const broadNatureIntentTerms = new Set(["공원", "자연", "숲", "산책", "야외", "나들이", "놀이터", "동네놀이터", "어린이공원"]);
const broadPlaygroundIntentTerms = new Set(["놀이터", "동네놀이터", "어린이공원", "모래놀이터", "모래놀이", "모래놀이장", "모래"]);
const removableLocalPlaygroundIntentTerms = new Set(["동네놀이터", "어린이공원", "모래놀이터", "모래놀이", "모래놀이장", "모래"]);
const localPlaygroundSandTerms = new Set(["모래놀이터", "모래놀이", "모래놀이장", "모래"]);

const broadWaterPlayIntentTerms = new Set(["물놀이", "물놀이터", "수경", "분수", "바닥분수", "물놀이장", "물놀이섬"]);
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
  "도서관",
  "장난감도서관",
  "공동육아나눔터",
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
  "모래"
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
  "도서관",
  "장난감도서관",
  "공동육아나눔터",
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
  "쇼핑몰",
  "백화점",
  "아울렛"
]);

const queryPreferenceTerms = {
  parkingAvailable: new Set(["주차", "주차장", "parking"]),
  strollerFriendly: new Set(["유모차", "쌍둥이유모차", "stroller"]),
  nursingRoom: new Set(["수유실", "수유", "수유공간", "베이비라운지", "베이비룸", "유아휴게실", "아기휴게실", "분유", "nursing"]),
  diaperChangingTable: new Set([
    "기저귀",
    "기저귀교환",
    "기저귀교환대",
    "기저귀갈이",
    "기저귀갈기",
    "베이비라운지",
    "베이비룸",
    "유아휴게실",
    "아기휴게실",
    "diaper"
  ]),
  kidsToilet: new Set(["어린이화장실", "유아화장실", "아이화장실"]),
  elevator: new Set(["엘리베이터", "승강기", "elevator"]),
  babyChair: new Set(["아기의자", "유아의자", "하이체어", "babychair"])
} satisfies Record<keyof Omit<NonNullable<SearchPlacesInput["preferences"]>, "indoorTypes" | "foodAllowed">, Set<string>>;

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
const queryStopTerms = new Set([
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
  "기준",
  "아이",
  "근처",
  "주변",
  "인근",
  "장난감도서관",
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
  "워터"
];

const broadPublicExpansionTerms = [
  "공공시설",
  "공공실내",
  "국립",
  "시립",
  "과학",
  "과학관",
  "박물관",
  "도서관",
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
  "복합쇼핑몰"
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
  return terms.length > 0 && terms.every((term) => broadNatureIntentTerms.has(term) || broadPlaygroundIntentTerms.has(term));
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
  return terms.length >= 3 && terms.every((term) => broadParentIntentTerms.has(term)) && terms.some((term) => broadParentCoreTerms.has(term));
}

function shouldKeepLiteralQuery(query: string) {
  return (
    isBroadNatureIntentQuery(query) ||
    isBroadWaterPlayIntentQuery(query) ||
    isRouteBreakIntentQuery(query) ||
    isBroadParentIntentQuery(query)
  );
}

function inferPreferencesFromQuery(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const termSet = new Set(terms);
  const preferences: Partial<NonNullable<SearchPlacesInput["preferences"]>> = {};
  const indoorTypes = new Set<"indoor" | "outdoor" | "mixed">();
  const hasDayTripNatureFallbackIntent =
    (termSet.has("1시간권") || termSet.has("당일치기") || termSet.has("근교")) &&
    terms.some((term) => broadNatureIntentTerms.has(term)) &&
    terms.some((term) => ["실내대피", "실내대안", "대피", "대안", "피할", "비오면"].includes(term));

  for (const term of terms) {
    if (twinLogisticsTerms.has(term)) {
      preferences.parkingAvailable = true;
      preferences.strollerFriendly = true;
      preferences.nursingRoom = true;
      preferences.diaperChangingTable = true;
      preferences.elevator = true;
    }
    for (const [key, values] of Object.entries(queryPreferenceTerms)) {
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
  if (terms.has("당일치기") || terms.has("근교") || terms.has("1시간권")) return "dayTrip";
  if (["비", "비오는날", "비오는", "비오면", "비올때", "우천", "장마"].some((term) => terms.has(term))) return "rainyDay";
  if (terms.has("주말") || terms.has("반나절")) return "weekendHalfDay";
  return undefined;
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

export function categoryClauseForKeywordTerm(term: string) {
  const categories = categoryKeywordMap[term];
  if (!categories) return null;
  if (categories.length === 1) return `primary_category = '${categories[0]}'`;
  return `primary_category = any(array[${categories.map((category) => `'${category}'`).join(",")}]::text[])`;
}

const categoryKeywordMap: Record<string, string[]> = {
  공원: ["park"],
  놀이터: ["park", "indoor_playground", "kids_cafe"],
  키즈카페: ["kids_cafe"],
  실내놀이터: ["indoor_playground", "kids_cafe"],
  도서관: ["library", "toy_library"],
  장난감도서관: ["toy_library"],
  공동육아나눔터: ["toy_library"],
  과학관: ["science_museum"],
  박물관: ["museum"],
  체험관: ["experience_center"],
  수목원: ["park"],
  휴게소: ["rest_area"],
  숙소: ["accommodation"],
  키즈숙소: ["accommodation"],
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

function isQueryPreferenceTerm(term: string) {
  if (indoorPreferenceTerms.has(term) || outdoorPreferenceTerms.has(term)) return true;
  return Object.values(queryPreferenceTerms).some((terms) => terms.has(term));
}

function inferLiteralQueryAlias(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const hasMealTerm = terms.some((term) => mealPlayMealTerms.has(term));
  const hasPlayTerm = terms.some((term) => mealPlayActivityTerms.has(term));
  if (hasMealTerm && hasPlayTerm) {
    const contextTerms = terms.filter((term) => mealPlayContextTerms.has(term));
    return [...contextTerms, "놀이방식당"].join(" ");
  }
  return undefined;
}

function broadNatureIntentClause(add: (value: unknown) => string) {
  const clauses = ["primary_category = 'park'"];

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
    clauses.push("primary_category = 'park'");
    addTextExpansionClauses(clauses, broadNatureExpansionTerms, add);
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
    clauses.push("primary_category = any(array['science_museum','museum','experience_center','library','indoor_playground','toy_library']::text[])");
    addTextExpansionClauses(clauses, broadPublicExpansionTerms, add);
  }

  if (termSet.has("쇼핑몰") || termSet.has("백화점") || termSet.has("아울렛")) {
    clauses.push("primary_category = 'shopping_mall'");
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
      `play_features::text ilike ${patternParam}`
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
    playFeatures?: Record<string, unknown>;
  },
  query?: string
) {
  if (!query || isBroadNatureIntentQuery(query)) {
    return { delta: 0, reasonCodes: [] };
  }

  const normalizedQuery = normalizeSearchText(query);
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
  const compactTerms = terms.map(compactSearchText);
  const reasonCodes = new Set<string>();
  let delta = 0;

  if (normalizedName === normalizedQuery || compactName === compactQuery) {
    delta += 14;
    reasonCodes.add("QUERY_NAME_EXACT");
  } else if (normalizedName.includes(normalizedQuery) || compactName.includes(compactQuery) || terms.every((term) => normalizedName.includes(term))) {
    delta += 10;
    reasonCodes.add("QUERY_NAME_MATCH");
  } else if (shouldUseAnyKeywordMatch(query)) {
    const matchedNameTerms = terms.filter((term, index) => normalizedName.includes(term) || compactName.includes(compactTerms[index]));
    if (matchedNameTerms.length > 0) {
      delta += Math.min(14, 10 + matchedNameTerms.length * 2);
      reasonCodes.add("QUERY_NAME_MATCH");
    }
  }

  const tagMatched = place.tags.some((tag) => {
    const normalizedTag = normalizeSearchText(tag);
    const compactTag = compactSearchText(tag);
    return normalizedTag.includes(normalizedQuery) || compactTag.includes(compactQuery) || terms.some((term) => normalizedTag.includes(term));
  });
  if (tagMatched) {
    delta += reasonCodes.size > 0 ? 2 : 6;
    reasonCodes.add("QUERY_TAG_MATCH");
  }

  if (playFeaturesMatch(place.playFeatures, normalizedQuery, terms)) {
    delta += reasonCodes.size > 0 ? 2 : 7;
    reasonCodes.add("QUERY_PLAY_FEATURE_MATCH");
  }

  const searchableText = [place.description, place.address, place.roadAddress].filter(Boolean).map((value) => normalizeSearchText(String(value)));
  if (searchableText.some((value) => value.includes(normalizedQuery))) {
    delta += reasonCodes.size > 0 ? 1 : 3;
    reasonCodes.add("QUERY_TEXT_MATCH");
  }

  return {
    delta: Math.min(delta, 16),
    reasonCodes: Array.from(reasonCodes)
  };
}

function playFeaturesMatch(playFeatures: Record<string, unknown> | undefined, normalizedQuery: string, terms: string[]) {
  if (!playFeatures) return false;
  const text = normalizeSearchText(JSON.stringify(playFeatures));
  if (!text || text === "{}") return false;
  return text.includes(normalizedQuery) || terms.some((term) => text.includes(term));
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function compactSearchText(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "");
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
  if (column === "external_refs" || column === "opening_hours" || column === "score_signals") {
    return `$${index}::jsonb`;
  }
  if (column === "play_features") {
    return `$${index}::jsonb`;
  }
  return `$${index}`;
}

function toSqlParam(column: string, value: unknown): SqlParam {
  if (column === "external_refs" || column === "opening_hours" || column === "play_features" || column === "score_signals") {
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
      dong: row.region_dong
    },
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
      nursingRoom: row.nursing_room,
      diaperChangingTable: row.diaper_changing_table,
      kidsToilet: row.kids_toilet,
      elevator: row.elevator,
      babyChair: row.baby_chair,
      foodAllowed: row.food_allowed
    },
    visit: {
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
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastVerifiedAt: row.last_verified_at ? toIso(row.last_verified_at) : null
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

function mapPlaceImage(row: PlaceImageRow) {
  return {
    id: row.id,
    placeId: row.place_id,
    url: row.url,
    sortOrder: row.sort_order,
    isPrimary: row.is_primary,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
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
    sourceType: row.source_type ?? "unknown",
    title: row.source_title,
    url: row.source_url,
    checkedAt: row.checked_at ? toIso(row.checked_at) : null
  };
}

function mapSource(row: SourceRow) {
  return {
    id: row.id,
    sourceType: row.source_type,
    title: row.title,
    url: row.url,
    externalId: row.external_id,
    summary: row.summary,
    checkedAt: row.checked_at ? toIso(row.checked_at) : null,
    createdAt: toIso(row.created_at)
  };
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
