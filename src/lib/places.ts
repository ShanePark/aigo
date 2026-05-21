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

  return {
    ...mapPlace(rows[0]),
    sources: sourceRows.map(mapSource),
    versions: latestVersions.map(mapVersionSummary)
  };
}

export async function searchPlaces(input: SearchPlacesInput) {
  const queryParts = buildSearchQuery(input);
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
    const scoredPlace = scorePlace(scoringPlace, input);

    return {
      placeId: place.id,
      name: place.name,
      primaryCategory: place.primaryCategory,
      tags: place.tags,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      distanceKm: place.distanceKm,
      score: scoredPlace.score,
      reasonCodes: scoredPlace.reasonCodes,
      reasons: describeReasonCodes(scoredPlace.reasonCodes, input),
      dataConfidence: place.dataConfidence,
      recommendedAgeMonths: place.recommendedAgeMonths,
      facilities: place.facilities,
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

  return {
    items,
    meta: {
      count: items.length,
      total: scored.length,
      limit: input.limit,
      offset: input.offset,
      origin: input.origin ?? null
    }
  };
}

export async function findDuplicatePlaces(input: DuplicatePlaceInput) {
  const containsName = `%${input.name}%`;
  const rows = await pg<
    (PlaceRow & {
      distance_meters: number | null;
      name_similarity: number | null;
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
      (${input.kakaoPlaceId ?? null}::text is not null and kakao_place_id = ${input.kakaoPlaceId ?? null}) as kakao_place_id_match
    from places
    where
      (${input.kakaoPlaceId ?? null}::text is not null and kakao_place_id = ${input.kakaoPlaceId ?? null})
      or (
        ST_DWithin(geo, ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography, ${input.radiusMeters})
        and (
          name = ${input.name}
          or name ilike ${containsName}
          or ${input.name} ilike ('%' || name || '%')
          or similarity(name, ${input.name}) >= 0.25
        )
      )
    order by kakao_place_id_match desc, name_similarity desc, distance_meters asc
    limit ${input.limit}
  `;

  return {
    items: rows.map((row) => {
      const signals = {
        kakaoPlaceIdMatch: row.kakao_place_id_match,
        distanceMeters: row.distance_meters,
        nameSimilarity: row.name_similarity
      };

      return {
        place: mapPlace(row),
        confidence: duplicateConfidence(signals),
        reasonCodes: duplicateReasonCodes(signals),
        distanceMeters: row.distance_meters,
        nameSimilarity: row.name_similarity
      };
    })
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
      where.push(`(${clauses.join(" and ")})`);
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

function keywordSearchClauses(query: string, add: (value: unknown) => string) {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => {
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

export function shouldSearchAddressForTerm(query: string, term: string) {
  const normalizedQuery = query.trim();
  if (/[0-9]/.test(normalizedQuery)) return true;
  if (/로|길|번길/.test(term) && term.length >= 4) return true;
  return term.length >= 4;
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
