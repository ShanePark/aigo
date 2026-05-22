import { pg } from "@/db/client";
import { ApiError } from "@/lib/errors";
import {
  type CreatePlaceInput,
  type DuplicatePlaceInput,
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
  image_urls: string[];
  status: string;
  data_confidence: string;
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
  imageUrls: "image_urls",
  status: "status",
  dataConfidence: "data_confidence",
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

  return pg.begin(async (tx) => {
    const [place] = await insertPlace(tx, insert, columns);

    await insertSources(tx, place.id, input.sources);
    await createVersion(tx, place.id, 1, "create", input.actor, input.changeSummary, input.sources);

    return getPlaceDetail(place.id, tx);
  });
}

export async function updatePlace(placeId: string, input: UpdatePlaceInput) {
  const patch = toDbRecord(input);
  const columns = Object.keys(patch);

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
    await createVersion(tx, updated.id, updated.version, "update", input.actor, input.changeSummary, input.sources);

    return getPlaceDetail(updated.id, tx);
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

  return {
    ...mapPlace(rows[0]),
    ...buildImageMetadata(rows[0].image_urls, sources),
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
      distanceKm: place.distanceKm
    } satisfies Parameters<typeof scorePlace>[0];
    const scoredPlace = scorePlace(scoringPlace, normalizedInput);
    const querySignal = queryMatchSignal(place, normalizedInput.query);

    return {
      placeId: place.id,
      name: place.name,
      primaryCategory: place.primaryCategory,
      tags: place.tags,
      address: place.address,
      description: place.description,
      imageUrls: place.imageUrls,
      lat: place.lat,
      lng: place.lng,
      distanceKm: place.distanceKm,
      score: clampScore(scoredPlace.score + querySignal.delta),
      reasonCodes: mergeReasonCodes(scoredPlace.reasonCodes, querySignal.reasonCodes),
      reasons: describeReasonCodes(mergeReasonCodes(scoredPlace.reasonCodes, querySignal.reasonCodes), normalizedInput),
      dataConfidence: place.dataConfidence,
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
  const sourceMap = await getSourceMapForPlaces(items.map((item) => item.placeId));
  const enrichedItems = items.map((item) => ({
    ...item,
    ...buildImageMetadata(item.imageUrls, sourceMap.get(item.placeId) ?? [])
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

async function getSourceMapForPlaces(placeIds: string[]) {
  const sourceMap = new Map<string, ReturnType<typeof mapSource>[]>();
  if (placeIds.length === 0) return sourceMap;

  const sourceRows = await pg<SourceRow[]>`
    select * from place_sources
    where place_id = any(${placeIds}::uuid[])
    order by created_at desc
  `;

  for (const row of sourceRows) {
    const sources = sourceMap.get(row.place_id) ?? [];
    sources.push(mapSource(row));
    sourceMap.set(row.place_id, sources);
  }

  return sourceMap;
}

export async function findDuplicatePlaces(input: DuplicatePlaceInput) {
  const containsName = `%${input.name}%`;
  const externalRefsJson =
    input.externalRefs && Object.keys(input.externalRefs).length > 0 ? JSON.stringify(input.externalRefs) : null;
  const rows = await pg<
    (PlaceRow & {
      distance_meters: number | null;
      name_similarity: number | null;
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
        case when name ilike ${containsName} or ${input.name} ilike ('%' || name || '%') then 0.65 else 0 end
      ) as name_similarity,
      (${externalRefsJson}::jsonb is not null and external_refs @> ${externalRefsJson}::jsonb) as external_refs_match,
      (${input.kakaoPlaceId ?? null}::text is not null and kakao_place_id = ${input.kakaoPlaceId ?? null}) as kakao_place_id_match
    from places
    where
      (${input.kakaoPlaceId ?? null}::text is not null and kakao_place_id = ${input.kakaoPlaceId ?? null})
      or (${externalRefsJson}::jsonb is not null and external_refs @> ${externalRefsJson}::jsonb)
      or (
        ST_DWithin(geo, ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography, ${input.radiusMeters})
        and (
          name = ${input.name}
          or name ilike ${containsName}
          or ${input.name} ilike ('%' || name || '%')
          or similarity(name, ${input.name}) >= 0.25
        )
      )
    order by kakao_place_id_match desc, external_refs_match desc, name_similarity desc, distance_meters asc
    limit ${input.limit}
  `;

  const items = await Promise.all(
    rows.map(async (row) => {
      const signals = {
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
      (select to_jsonb(p) from places p where p.id = ${placeId}),
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
  const where = ["status = 'active'", "primary_category <> 'accommodation'"];
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
    sql: `select *, ${distanceSql} as distance_km from places where ${where.join(" and ")} order by updated_at desc limit 500`,
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
      `exists (select 1 from unnest(tags) as keyword_tag where keyword_tag ilike ${patternParam})`
    ];

    if (shouldSearchAddressForTerm(query, term)) {
      columns.push(`address ilike ${patternParam}`, `road_address ilike ${patternParam}`);
    }

    return `(${columns.join(" or ")})`;
  });
}

export function shouldUseAnyKeywordMatch(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length < 2) return false;
  const placeLikeTerms = terms.filter((term) => isLikelyPlaceNameTerm(term));
  const alternativeTerms = terms.filter((term) => isAlternativeKeywordTerm(term) || isLikelyPlaceNameTerm(term));
  if (alternativeTerms.length === terms.length && terms.some((term) => isAlternativeKeywordTerm(term))) {
    return true;
  }
  if (terms.length < 3) return false;
  return placeLikeTerms.length >= 3 && placeLikeTerms.length === terms.length;
}

function isLikelyPlaceNameTerm(term: string) {
  return (
    term.length >= 3 &&
    !isQueryStopTerm(term) &&
    !isQueryPreferenceTerm(term) &&
    !broadParentIntentTerms.has(term) &&
    !broadPlaygroundIntentTerms.has(term)
  );
}

function isAlternativeKeywordTerm(term: string) {
  return alternativeKeywordTerms.has(term);
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
  "체험관",
  "어린이",
  "아이",
  "영유아",
  "실내",
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
  "체험관",
  "어린이",
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
  "국립",
  "시립",
  "과학",
  "과학관",
  "박물관",
  "도서관",
  "체험관",
  "장난감도서관",
  "육아종합지원센터",
  "어린이회관",
  "꿈아띠"
];

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

  return stripped.length > 0 ? stripped : undefined;
}

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
      `exists (select 1 from unnest(tags) as keyword_tag where keyword_tag ilike ${patternParam})`
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
  place: Pick<ReturnType<typeof mapPlace>, "name" | "tags" | "description" | "address" | "roadAddress">,
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
  if (column === "external_refs" || column === "opening_hours") {
    return `$${index}::jsonb`;
  }
  return `$${index}`;
}

function toSqlParam(column: string, value: unknown): SqlParam {
  if (column === "external_refs" || column === "opening_hours") {
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
    imageUrls: row.image_urls,
    status: row.status,
    dataConfidence: row.data_confidence,
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
  if (/public_agency|public_tourism|public_open|gu_|city_|tourism|kto|visitkorea|daejeon|donggu|daedeok|seogu|yuseong|science\.go\.kr|공공|관광|구청|시청/.test(searchable)) {
    return "public_agency";
  }
  if (/operator|booking|tabling|ban-life|peton|diningcode|listing|profile|운영/.test(searchable)) return "public_listing";

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
