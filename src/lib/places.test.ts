import { describe, expect, it } from "vitest";

import {
  applySearchDiversity,
  assertDeleteConfirmationMatches,
  buildInfantLogisticsSignal,
  buildImageMetadata,
  buildOpeningHoursDataSignal,
  buildSearchOpeningHoursSummary,
  buildSearchQuery,
  buildSearchImageHealth,
  buildSearchCoursePlan,
  buildSearchPreferenceSemantics,
  buildSearchRecommendationReadiness,
  buildSearchSourceSummary,
  buildStructuredDataGaps,
  categoryClauseForKeywordTerm,
  compactSearchPlaceItem,
  imageConflictPolicyForTest,
  isBroadNatureIntentQuery,
  isBroadParentIntentQuery,
  isBroadWaterPlayIntentQuery,
  isPlaygroundIntentQuery,
  isRouteBreakIntentQuery,
  placeDbRecordForTest,
  normalizeSearchInput,
  normalizePlaceImageHealthQueryForTest,
  normalizedImagePrimaryForTest,
  playgroundEvidenceScoreCapForTest,
  queryMatchSignal,
  relatedPlacePair,
  retailAliasCompactTextsForTest,
  routeBreakDestinationFitCapForTest,
  searchEvaluationDate,
  searchQueryNormalizationMetaForTest,
  searchTermPatterns,
  suggestedExactNameQueryForTest,
  shouldUseAnyKeywordMatch,
  shouldSearchAddressForTerm
} from "@/lib/places";
import { emptyPlaceTaxonomy } from "@/lib/taxonomy";

type CoursePlanTestItem = Parameters<typeof buildSearchCoursePlan>[0][number];

function courseItem(
  overrides: {
    id: string;
    name: string;
    primaryCategory: string;
    distanceKm: number | null;
    score: number;
    averageStayMinutes?: number | null;
    parentEffortLevel?: number | null;
    childEngagementLevel?: number | null;
    indoorType?: string;
    strollerFriendly?: string;
    elevator?: string;
    nursingRoom?: string;
    diaperChangingTable?: string;
    parkingAvailable?: string;
    babyChair?: string;
    foodAllowed?: string;
    imageHealth?: ReturnType<typeof buildSearchImageHealth>;
  }
) {
  return {
    ...overrides,
    visit: {
      averageStayMinutes: overrides.averageStayMinutes ?? 90,
      parentEffortLevel: overrides.parentEffortLevel ?? null,
      childEngagementLevel: overrides.childEngagementLevel ?? null
    },
    facilities: {
      indoorType: overrides.indoorType ?? "unknown",
      strollerFriendly: overrides.strollerFriendly ?? "unknown",
      elevator: overrides.elevator ?? "unknown",
      nursingRoom: overrides.nursingRoom ?? "unknown",
      diaperChangingTable: overrides.diaperChangingTable ?? "unknown",
      parkingAvailable: overrides.parkingAvailable ?? "unknown",
      babyChair: overrides.babyChair ?? "unknown",
      foodAllowed: overrides.foodAllowed ?? "unknown"
    },
    imageHealth: overrides.imageHealth
  } as unknown as CoursePlanTestItem;
}

describe("place search helpers", () => {
  const baseSearchInput = { radiusKm: 80, sort: "recommended" as const, limit: 20, offset: 0 };
  const officialSource = { sourceType: "official_site" as const, url: "https://example.com/place" };

  it("maps create and update region fields to persisted DB columns", () => {
    const createRecord = placeDbRecordForTest({
      name: "한들근린공원 어린이놀이터",
      primaryCategory: "park",
      lat: 35.244,
      lng: 128.66,
      regionSido: "경남",
      regionSigungu: "창원시 의창구",
      regionDong: "봉림동",
      sources: [officialSource],
      actor: "agent"
    });
    const updateRecord = placeDbRecordForTest({
      regionSido: "경상남도",
      regionSigungu: "창원시 의창구",
      regionDong: "봉림동",
      sources: [officialSource],
      sourceMode: "append",
      imageMode: "append",
      relatedPlaceMode: "append",
      actor: "agent"
    });

    expect(createRecord).toMatchObject({
      region_sido: "경상남도",
      region_sigungu: "창원시 의창구",
      region_dong: "봉림동"
    });
    expect(updateRecord).toMatchObject({
      region_sido: "경상남도",
      region_sigungu: "창원시 의창구",
      region_dong: "봉림동"
    });
  });

  it("splits spaced Korean queries into AND-able ilike patterns", () => {
    expect(searchTermPatterns("보문산 전망대")).toEqual(["%보문산%", "%전망대%"]);
  });

  it("can calculate distance without applying the radius filter for wider day-trip planning", () => {
    const constrained = buildSearchQuery({
      ...baseSearchInput,
      origin: { lat: 36.3317, lng: 127.4348 },
      radiusKm: 80
    });
    const unconstrained = buildSearchQuery({
      ...baseSearchInput,
      origin: { lat: 36.3317, lng: 127.4348 },
      radiusKm: 80,
      filterByRadius: false
    });

    expect(constrained.sql).toContain("ST_DWithin");
    expect(constrained.sql).toContain("ST_Distance");
    expect(unconstrained.sql).not.toContain("ST_DWithin");
    expect(unconstrained.sql).toContain("ST_Distance");
    expect(unconstrained.params).toEqual([127.4348, 36.3317]);
  });

  it("filters search candidates by visible map viewport bounds", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      origin: { lat: 36.35, lng: 127.38 },
      filterByRadius: false,
      viewportBounds: {
        minLat: 36.3,
        minLng: 127.3,
        maxLat: 36.4,
        maxLng: 127.5
      }
    });

    expect(query.sql).not.toContain("ST_DWithin");
    expect(query.sql).toContain("lat between $3 and $4");
    expect(query.sql).toContain("lng between $5 and $6");
    expect(query.params).toEqual([127.38, 36.35, 36.3, 36.4, 127.3, 127.5]);
  });

  it("search candidates exclude soft-deleted closed places", () => {
    const query = buildSearchQuery(baseSearchInput);

    expect(query.sql).toContain("where status = 'active'");
  });

  it("does not cap SQL candidates before runtime scoring and pagination", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      limit: 20,
      offset: 800,
      query: "키즈카페"
    });

    expect(query.sql).not.toContain("limit 750");
    expect(query.sql).not.toContain("offset");
    expect(query.sql).not.toContain("limit $");
  });

  it("keeps region anchors when category aliases are searched", () => {
    const normalized = normalizeSearchInput({
      ...baseSearchInput,
      query: "창원 장난감 가게"
    });
    const query = buildSearchQuery(normalized);

    expect(normalized.query).toBe("창원 장난감가게");
    expect(query.sql).toContain("primary_category = 'toy_store'");
    expect(query.params).toEqual(["%창원%", "%장난감가게%"]);
  });

  it("caps playground results when requested equipment evidence is missing", () => {
    const place = {
      primaryCategory: "park",
      playFeatures: { slide: "yes", toiletNearby: "unknown" },
      facilities: { strollerFriendly: "yes", parkingAvailable: "yes", kidsToilet: "yes" }
    };

    const capped = playgroundEvidenceScoreCapForTest(88, place as never, {
      playgroundOnly: true,
      query: "모래놀이터",
      originalQuery: "모래놀이터 유모차 화장실"
    });
    const missingToilet = playgroundEvidenceScoreCapForTest(88, { ...place, playFeatures: { sandPlay: "yes", toiletNearby: "unknown" } } as never, {
      playgroundOnly: true,
      query: "모래놀이터",
      originalQuery: "모래놀이터 유모차 화장실"
    });
    const supported = playgroundEvidenceScoreCapForTest(88, { ...place, playFeatures: { sandPlay: "partial", toiletNearby: "yes" } } as never, {
      playgroundOnly: true,
      query: "모래놀이터",
      originalQuery: "모래놀이터 유모차 화장실"
    });
    const taxonomySupported = playgroundEvidenceScoreCapForTest(
      88,
      {
        ...place,
        playFeatures: {},
        taxonomy: {
          ...emptyPlaceTaxonomy(),
          sourceBacked: {
            ...emptyPlaceTaxonomy().sourceBacked,
            activityTypes: ["sand_play"]
          }
        }
      } as never,
      {
        playgroundOnly: true,
        query: "모래놀이터",
        originalQuery: "대전 모래놀이 놀이터"
      }
    );

    expect(capped.score).toBe(60);
    expect(capped.reasonCodes).toContain("EQUIPMENT_EVIDENCE_MISSING");
    expect(capped.reasonCodes).not.toContain("PLAYGROUND_FEATURES_UNKNOWN");
    expect(missingToilet.score).toBe(60);
    expect(missingToilet.reasonCodes).toContain("EQUIPMENT_EVIDENCE_MISSING");
    expect(supported.score).toBe(88);
    expect(supported.reasonCodes).not.toContain("EQUIPMENT_EVIDENCE_MISSING");
    expect(taxonomySupported.score).toBe(88);
    expect(taxonomySupported.reasonCodes).not.toContain("PLAYGROUND_FEATURES_UNKNOWN");
    expect(taxonomySupported.reasonCodes).not.toContain("EQUIPMENT_EVIDENCE_MISSING");
  });

  it("caps route-break candidates without requested destination evidence", () => {
    const airport = {
      primaryCategory: "rest_area",
      name: "청주국제공항 유아휴게실",
      description: null,
      address: "충청북도 청주시 청원구",
      roadAddress: null,
      tags: ["route_break", "airport", "nursing_room"],
      routeSupport: { routeSupportRole: "route_break" }
    };
    const cheongnamdaeRoute = {
      ...airport,
      name: "문의청남대휴게소 청주방향",
      tags: ["routeBreak", "청남대경로", "nursingRoom"]
    };

    const capped = routeBreakDestinationFitCapForTest(43, airport as never, {
      query: "청남대 가는 길 수유실 기저귀 휴게소"
    });
    const matched = routeBreakDestinationFitCapForTest(43, cheongnamdaeRoute as never, {
      query: "청남대 가는 길 수유실 기저귀 휴게소"
    });

    expect(capped.score).toBe(38);
    expect(capped.reasonCodes).toContain("ROUTE_DESTINATION_FIT_MISSING");
    expect(matched.score).toBe(43);
    expect(matched.reasonCodes).not.toContain("ROUTE_DESTINATION_FIT_MISSING");
  });

  it("can restrict playground searches to actual playground evidence", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      primaryCategories: ["park", "indoor_playground"],
      playgroundOnly: true
    });

    expect(query.sql).toContain("primary_category = any($1::text[])");
    expect(query.sql).toContain("primary_category = 'indoor_playground'");
    expect(query.sql).toContain("primary_category = 'park'");
    expect(query.sql).toContain("play_features->>'slide' in ('yes', 'partial')");
    expect(query.sql).toContain("playground_tag");
    expect(query.sql).toContain("not (");
    expect(query.sql).toContain("commercial_tag");
    expect(query.sql).not.toContain("primary_category = any(array['kids_cafe','family_cafe']::text[])");
    expect(query.params).toEqual([["park", "indoor_playground"]]);
  });

  it("can include commercial indoor play records in kids cafe searches", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      primaryCategories: ["kids_cafe", "family_cafe"],
      kidsCafeOnly: true
    });

    expect(query.sql).toContain("primary_category = any(array['kids_cafe','family_cafe']::text[])");
    expect(query.sql).toContain("primary_category = 'indoor_playground'");
    expect(query.sql).toContain("commercial_tag");
    expect(query.sql).toContain("%키즈카페%");
    expect(query.params).toEqual([]);
  });

  it("keeps indoor playground keyword searches separate from outdoor parks", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      query: "실내놀이터"
    });

    expect(query.sql).toContain("primary_category = 'indoor_playground'");
    expect(query.sql).not.toContain("playground_tag");
    expect(query.sql).not.toContain("kids_cafe");
  });

  it("applies hard distance bands for outside-city day-trip searches", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      origin: { lat: 36.3317, lng: 127.4348 },
      minDistanceKm: 25,
      maxDistanceKm: 120,
      filterByRadius: false
    });

    expect(query.sql).not.toContain("ST_DWithin");
    expect(query.sql).toContain(" / 1000 >= ");
    expect(query.sql).toContain(" / 1000 <= ");
    expect(query.params).toEqual([127.4348, 36.3317, 127.4348, 36.3317, 25, 127.4348, 36.3317, 120]);
  });

  it("limits sorted search candidates by region and category diversity caps", () => {
    const items = [
      { name: "A", primaryCategory: "museum", region: { sido: "충남", sigungu: "부여군" } },
      { name: "B", primaryCategory: "museum", region: { sido: "충남", sigungu: "부여군" } },
      { name: "C", primaryCategory: "museum", region: { sido: "세종", sigungu: "세종시" } },
      { name: "D", primaryCategory: "park", region: { sido: "세종", sigungu: "세종시" } },
      { name: "E", primaryCategory: "park", region: { sido: "대전", sigungu: "동구" } }
    ];

    expect(applySearchDiversity(items, { maxPerRegion: 1 }).map((item) => item.name)).toEqual(["A", "C", "E"]);
    expect(applySearchDiversity(items, { maxPerCategory: 1 }).map((item) => item.name)).toEqual(["A", "D"]);
    expect(applySearchDiversity(items, { maxPerRegion: 1, maxPerCategory: 1 }).map((item) => item.name)).toEqual(["A", "D"]);
  });

  it("canonicalizes related-place pairs so the relation is bidirectional", () => {
    expect(relatedPlacePair("b0000000-0000-0000-0000-000000000000", "a0000000-0000-0000-0000-000000000000")).toEqual([
      "a0000000-0000-0000-0000-000000000000",
      "b0000000-0000-0000-0000-000000000000"
    ]);
  });

  it("requires the delete confirmation name to match the current place name", () => {
    expect(() => assertDeleteConfirmationMatches("대전 어린이 시설", "대전 어린이 시설")).not.toThrow();
    expect(() => assertDeleteConfirmationMatches("대전 어린이 시설", "다른 시설")).toThrow("confirmName must match");
  });

  it("collapses repeated whitespace in keyword queries", () => {
    expect(searchTermPatterns("  대청호   명상정원  ")).toEqual(["%대청호%", "%명상정원%"]);
  });

  it("can restrict a place query to exact compact name matches", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      query: "국립부여박물관 어린이박물관",
      matchMode: "exactName"
    });

    expect(query.sql).toContain("lower(name) = ");
    expect(query.sql).toContain("regexp_replace(lower(name), '[[:space:]]+', '', 'g')");
    expect(query.sql).toContain("external_refs->'aliases'");
    expect(query.sql).not.toContain("description ilike");
    expect(query.sql).not.toContain("exists (select 1 from unnest(tags)");
    expect(query.params).toEqual(["국립부여박물관 어린이박물관", "국립부여박물관어린이박물관"]);
  });

  it("can restrict exact-name lookup to external reference aliases", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      query: "국립세종어린이박물관",
      matchMode: "exactName"
    });

    expect(query.sql).toContain("jsonb_array_elements_text");
    expect(query.sql).toContain("where lower(external_alias.value) = $1");
    expect(query.sql).toContain("regexp_replace(lower(external_alias.value), '[[:space:]]+', '', 'g') = $2");
    expect(query.params).toEqual(["국립세종어린이박물관", "국립세종어린이박물관"]);
  });

  it("includes Korean search aliases in exact-name lookup", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      query: "괌 PIC",
      matchMode: "exactName"
    });

    expect(query.sql).toContain("external_refs->'koreanSearchAliases'");
    expect(query.params).toEqual(["괌 pic", "괌pic"]);
  });

  it("includes overseas English and local names in exact-name lookup", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      query: "Jpark Island Resort & Waterpark Cebu",
      matchMode: "exactName"
    });

    expect(query.sql).toContain("external_refs->'aliases'");
    expect(query.sql).toContain("external_refs->'koreanSearchAliases'");
    expect(query.sql).toContain("external_refs->'englishName'");
    expect(query.sql).toContain("external_refs->'localName'");
    expect(query.params).toEqual(["jpark island resort & waterpark cebu", "jparkislandresort&waterparkcebu"]);
  });

  it("uses overseas English names as exact query-match aliases", () => {
    const signal = queryMatchSignal(
      {
        name: "세부 제이파크 아일랜드 리조트 앤 워터파크",
        tags: [],
        description: null,
        address: null,
        roadAddress: null,
        externalRefs: {
          englishName: "Jpark Island Resort & Waterpark Cebu",
          localName: "JPark Island Resort and Waterpark"
        }
      },
      "Jpark Island Resort & Waterpark Cebu"
    );

    expect(signal.reasonCodes).toContain("QUERY_NAME_EXACT");
    expect(signal.delta).toBeGreaterThanOrEqual(24);
  });

  it("filters overseas search candidates by country and city scope", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      countryCode: "PH",
      city: "Lapu-Lapu"
    });

    expect(query.sql).toContain("country_code");
    expect(query.sql).toContain("external_refs->>'countryCode'");
    expect(query.sql).toContain("coalesce(city");
    expect(query.sql).toContain("coalesce(locality");
    expect(query.params).toEqual(["PH", "PH", "lapu-lapu", "lapu-lapu", "lapu-lapu"]);
  });

  it("expands exact-name retail branch aliases for mall and outlet names", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      query: "롯데몰 김포공항",
      matchMode: "exactName"
    });

    expect(retailAliasCompactTextsForTest("백화점 김포공항점")).toContain("롯데몰김포공항점");
    expect(retailAliasCompactTextsForTest("롯데프리미엄아울렛 의왕점")).toContain("타임빌라스");
    expect(retailAliasCompactTextsForTest("스타필드시티 부천")).toEqual(
      expect.arrayContaining(["스타필드시티부천점", "스타필드부천점"])
    );
    expect(query.sql).toContain("= any(");
    expect(query.params).toEqual([
      "롯데몰 김포공항",
      "롯데몰김포공항",
      expect.arrayContaining(["롯데백화점김포공항", "롯데백화점김포공항점", "백화점김포공항", "쇼핑몰김포공항"])
    ]);
  });

  it("expands Starfield City exact-name lookup across spacing and branch suffix variants", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      query: "스타필드시티 부천",
      matchMode: "exactName"
    });

    expect(query.sql).toContain("= any(");
    expect(query.params).toEqual([
      "스타필드시티 부천",
      "스타필드시티부천",
      expect.arrayContaining(["스타필드시티부천점", "스타필드부천", "스타필드부천점"])
    ]);
  });

  it("does not expand Time Villas aliases across conflicting branch names", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      query: "타임빌라스 수원",
      matchMode: "exactName"
    });

    expect(retailAliasCompactTextsForTest("타임빌라스")).toContain("롯데프리미엄아울렛의왕점");
    expect(retailAliasCompactTextsForTest("타임빌라스 의왕")).toContain("롯데프리미엄아울렛의왕점");
    expect(retailAliasCompactTextsForTest("타임빌라스 수원")).not.toContain("롯데프리미엄아울렛의왕점");
    expect(retailAliasCompactTextsForTest("너티월드 타임빌라스 수원점")).not.toContain("롯데프리미엄아울렛의왕점");
    expect(query.params).toEqual([
      "타임빌라스 수원",
      "타임빌라스수원",
      expect.arrayContaining(["타임빌라스수원점"])
    ]);
    expect(query.params[2]).not.toContain("롯데프리미엄아울렛의왕점");
  });

  it("preserves literal exact-name queries during preference inference", () => {
    expect(normalizeSearchInput({ ...baseSearchInput, query: "실내 어린이 도서관", matchMode: "exactName" })).toMatchObject({
      query: "실내 어린이 도서관",
      matchMode: "exactName",
      preferences: { indoorTypes: ["indoor", "mixed"] }
    });
  });

  it("suggests a stripped exact-name query when amenity words are included", () => {
    expect(suggestedExactNameQueryForTest("갤러리아 타임월드 수유실")).toBe("갤러리아 타임월드");
    expect(suggestedExactNameQueryForTest("국립중앙과학관")).toBeNull();
  });

  it("can require source-backed preference matches instead of soft ranking", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      preferenceMode: "required",
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        babyChair: true,
        nursingRoom: true,
        parkingAvailable: false
      }
    });

    expect(query.sql).toContain("indoor_type = any($1::text[])");
    expect(query.sql).toContain("baby_chair in ('yes', 'partial')");
    expect(query.sql).toContain("nursing_room in ('yes', 'partial')");
    expect(query.sql).not.toContain("parking_available in ('yes', 'partial')");
    expect(query.params).toEqual([["indoor", "mixed"]]);
  });

  it("can require taxonomy facets through JSONB containment", () => {
    const query = buildSearchQuery({
      ...baseSearchInput,
      taxonomy: {
        mode: "required",
        activityTypes: ["sand_play"],
        logisticsTags: ["stroller"]
      }
    });

    expect(query.sql).toContain("taxonomy @> $1::jsonb");
    expect(query.sql).toContain("taxonomy @> $2::jsonb");
    expect(query.sql).toContain("taxonomy @> $3::jsonb");
    expect(query.sql).toContain("taxonomy @> $4::jsonb");
    expect(query.params).toEqual([
      JSON.stringify({ sourceBacked: { activityTypes: ["sand_play"] } }),
      JSON.stringify({ inferred: { activityTypes: ["sand_play"] } }),
      JSON.stringify({ sourceBacked: { logisticsTags: ["stroller"] } }),
      JSON.stringify({ inferred: { logisticsTags: ["stroller"] } })
    ]);
  });

  it("builds planned visit wall-clock dates for opening-hours scoring", () => {
    const planned = searchEvaluationDate({ visitDate: "2026-05-23", visitStartTime: "10:30" });
    const defaultNoon = searchEvaluationDate({ visitDate: "2026-05-23" });

    expect(planned?.toISOString()).toBe("2026-05-23T01:30:00.000Z");
    expect(defaultNoon?.toISOString()).toBe("2026-05-23T03:00:00.000Z");
  });

  it("recognizes broad nature intent queries", () => {
    expect(isBroadNatureIntentQuery("공원 자연")).toBe(true);
    expect(isBroadNatureIntentQuery("숲 산책")).toBe(true);
    expect(isBroadNatureIntentQuery("동네놀이터 어린이공원")).toBe(false);
    expect(isBroadNatureIntentQuery("대청호 자연")).toBe(false);
  });

  it("recognizes playground intent separately from broad park searches", () => {
    expect(isPlaygroundIntentQuery("동네놀이터 어린이공원")).toBe(true);
    expect(isPlaygroundIntentQuery("동네놀이터 어린이공원 모래놀이터")).toBe(true);
    expect(isPlaygroundIntentQuery("실내놀이터")).toBe(true);
    expect(isPlaygroundIntentQuery("공원 자연")).toBe(false);
  });

  it("recognizes water-play synonym queries that should not require every token", () => {
    expect(isBroadWaterPlayIntentQuery("물놀이 물놀이터 수경")).toBe(true);
    expect(isBroadWaterPlayIntentQuery("물놀이 바닥분수")).toBe(true);
    expect(isBroadWaterPlayIntentQuery("물놀이 유모차")).toBe(false);
  });

  it("recognizes route-break searches for rest areas and nursing stops", () => {
    expect(isRouteBreakIntentQuery("청남대 가는 길 수유실 휴게소")).toBe(true);
    expect(isRouteBreakIntentQuery("청남대 가는 길 수유실")).toBe(true);
    expect(isRouteBreakIntentQuery("대청호 휴게소")).toBe(true);
    expect(isRouteBreakIntentQuery("청남대 수유실")).toBe(false);
  });

  it("recognizes broad parent intent queries that should not require every token", () => {
    expect(isBroadParentIntentQuery("공원 자연 당일치기 유모차 주차")).toBe(true);
    expect(isBroadParentIntentQuery("공공시설 반나절 과학관 도서관 어린이")).toBe(true);
    expect(isBroadParentIntentQuery("영아 실내 공공시설")).toBe(true);
    expect(isBroadParentIntentQuery("공동육아나눔터 영유아 실내")).toBe(true);
    expect(isBroadParentIntentQuery("계룡산 유모차 주차")).toBe(false);
  });

  it("widens alternative attraction keyword searches without widening local category searches", () => {
    expect(shouldUseAnyKeywordMatch("아쿠아리움 동물원")).toBe(true);
    expect(shouldUseAnyKeywordMatch("과학관 체험 창의나래 넥스페리움")).toBe(true);
    expect(shouldUseAnyKeywordMatch("물놀이터 용수골 동산 판암")).toBe(true);
    expect(shouldUseAnyKeywordMatch("미끄럼틀 가오솔 범골 가오들")).toBe(true);
    expect(shouldUseAnyKeywordMatch("가팔 진등 용전 매봉 성남 선암 대동")).toBe(true);
    expect(shouldUseAnyKeywordMatch("점프홀릭 챔피언")).toBe(true);
    expect(shouldUseAnyKeywordMatch("오월드 장태산")).toBe(true);
    expect(shouldUseAnyKeywordMatch("대전 키즈카페")).toBe(false);
    expect(shouldUseAnyKeywordMatch("대전 서구 키즈카페")).toBe(false);
    expect(shouldUseAnyKeywordMatch("판암 동네놀이터")).toBe(false);
  });

  it("maps common Korean category terms to primary category clauses", () => {
    expect(categoryClauseForKeywordTerm("공원")).toBe("primary_category = 'park'");
    expect(categoryClauseForKeywordTerm("놀이터")).toContain("primary_category = 'indoor_playground'");
    expect(categoryClauseForKeywordTerm("놀이터")).toContain("play_features->>'slide' in ('yes', 'partial')");
    expect(categoryClauseForKeywordTerm("놀이터")).not.toContain("primary_category = any(array['kids_cafe','family_cafe']::text[])");
    expect(categoryClauseForKeywordTerm("키즈카페")).toContain("commercial_tag");
    expect(categoryClauseForKeywordTerm("실내놀이터")).toBe("primary_category = 'indoor_playground'");
    expect(categoryClauseForKeywordTerm("공동육아나눔터")).toBe("primary_category = 'toy_library'");
    expect(categoryClauseForKeywordTerm("장난감")).toBe("primary_category = any(array['toy_store','toy_library']::text[])");
    expect(categoryClauseForKeywordTerm("완구점")).toBe("primary_category = 'toy_store'");
    expect(categoryClauseForKeywordTerm("미끄럼틀")).toBeNull();
  });

  it("builds image metadata with source provenance and display tiers", () => {
    const official = buildImageMetadata(["https://example.go.kr/place.jpg"], [
      {
        id: "source-1",
        sourceType: "official_library_image_source",
        title: "공식 도서관 대표 사진",
        url: "https://example.go.kr/source",
        summary: "Official page exposes a representative image.",
        checkedAt: "2026-05-22T00:00:00.000Z"
      }
    ]);
    const listing = buildImageMetadata(["https://cdn.example.com/restaurant.webp"], [
      {
        id: "source-2",
        sourceType: "public_listing_image_source",
        title: "DiningCode - 대전 지점 사진",
        url: "https://place.udanax.org/p/1173497/%EB%8C%80%EC%A0%84",
        summary: "Public listing image candidate.",
        checkedAt: "2026-05-22T00:00:00.000Z"
      }
    ]);
    const news = buildImageMetadata(["https://daejeon.example.com/news-place.jpg"], [
      {
        id: "source-3",
        sourceType: "public_news_image_source",
        title: "지역 기사 사진",
        url: "https://daejeon.example.com/article/123",
        summary: "Public news article image candidate.",
        checkedAt: "2026-05-22T00:00:00.000Z"
      }
    ]);

    expect(official.primaryImage).toMatchObject({
      url: "https://example.go.kr/place.jpg",
      sourceId: "source-1",
      sourceUrl: "https://example.go.kr/source",
      displayTier: "official",
      creditText: "공식 도서관 대표 사진",
      status: "active"
    });
    expect(listing.primaryImage).toMatchObject({
      sourceId: "source-2",
      displayTier: "public_listing",
      creditText: "DiningCode - 대전 지점 사진"
    });
    expect(news.primaryImage).toMatchObject({
      sourceId: "source-3",
      displayTier: "rights_unclear",
      creditText: "지역 기사 사진"
    });
  });

  it("does not let imageUrls shorthand downgrade existing image provenance on conflict", () => {
    const sources = [
      {
        sourceType: "official_image_source" as const,
        title: "공식 이미지 출처",
        url: "https://example.go.kr/place",
        checkedAt: "2026-05-22T00:00:00.000Z"
      }
    ];
    const shorthand = imageConflictPolicyForTest(undefined, ["https://example.go.kr/place.jpg"], sources);
    const structured = imageConflictPolicyForTest(
      [
        {
          url: "https://example.go.kr/place.jpg",
          sourceUrl: "https://example.go.kr/place",
          reviewStatus: "pending_review",
          isPrimary: true
        }
      ],
      undefined,
      sources
    );

    expect(shorthand).toEqual([
      {
        url: "https://example.go.kr/place.jpg",
        metadata: false,
        primary: false,
        reviewStatus: false
      }
    ]);
    expect(structured).toEqual([
      {
        url: "https://example.go.kr/place.jpg",
        metadata: true,
        primary: true,
        reviewStatus: true
      }
    ]);
  });

  it("keeps append-only structured images secondary unless primary is explicit", () => {
    const sources = [
      {
        sourceType: "official_image_source" as const,
        title: "공식 이미지 출처",
        url: "https://example.go.kr/place",
        checkedAt: "2026-05-22T00:00:00.000Z"
      }
    ];
    const appendSecondary = normalizedImagePrimaryForTest(
      [
        {
          url: "https://example.go.kr/secondary.jpg",
          reviewStatus: "approved",
          isPrimary: false
        }
      ],
      undefined,
      sources,
      {
        assignFallbackPrimary: false,
        allowStructuredPrimaryOverwrite: false
      }
    );
    const appendExplicitPrimary = normalizedImagePrimaryForTest(
      [
        {
          url: "https://example.go.kr/new-primary.jpg",
          reviewStatus: "approved",
          isPrimary: true
        }
      ],
      undefined,
      sources,
      {
        assignFallbackPrimary: false,
        allowStructuredPrimaryOverwrite: false
      }
    );
    const replaceFallbackPrimary = normalizedImagePrimaryForTest(
      [
        {
          url: "https://example.go.kr/replacement.jpg",
          reviewStatus: "approved",
          isPrimary: false
        }
      ],
      undefined,
      sources,
      {
        assignFallbackPrimary: true,
        allowStructuredPrimaryOverwrite: true
      }
    );

    expect(appendSecondary).toEqual([
      {
        url: "https://example.go.kr/secondary.jpg",
        isPrimary: false,
        primary: false
      }
    ]);
    expect(appendExplicitPrimary).toEqual([
      {
        url: "https://example.go.kr/new-primary.jpg",
        isPrimary: true,
        primary: true
      }
    ]);
    expect(replaceFallbackPrimary).toEqual([
      {
        url: "https://example.go.kr/replacement.jpg",
        isPrimary: true,
        primary: true
      }
    ]);
  });

  it("summarizes search image health from active image rows", () => {
    const checkedAt = new Date("2026-05-22T02:00:00.000Z");
    const updatedAt = new Date("2026-05-22T03:00:00.000Z");

    expect(buildSearchImageHealth([])).toMatchObject({
      status: "no_active_image",
      suggestedAction: "find_first_image",
      priorityScore: 100,
      hasPrimary: false,
      primaryImageUrl: null
    });
    expect(
      buildSearchImageHealth([
        {
          url: "https://example.com/place.jpg",
          is_primary: false,
          review_status: "needs_review",
          checked_at: checkedAt,
          updated_at: updatedAt
        }
      ])
    ).toMatchObject({
      status: "no_primary",
      suggestedAction: "choose_primary_image",
      activeCount: 1,
      needsReviewCount: 1,
      primaryImageUrl: "https://example.com/place.jpg",
      latestImageCheckedAt: "2026-05-22T02:00:00.000Z",
      latestImageUpdatedAt: "2026-05-22T03:00:00.000Z"
    });
    expect(
      buildSearchImageHealth([
        {
          url: "https://example.com/place.jpg",
          is_primary: true,
          review_status: "approved",
          checked_at: checkedAt,
          updated_at: updatedAt
        }
      ])
    ).toMatchObject({
      status: "healthy",
      suggestedAction: "none",
      hasPrimary: true,
      approvedCount: 1
    });
  });

  it("normalizes direct image health helper placeIds like API query params", () => {
    const singleId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";

    expect(
      normalizePlaceImageHealthQueryForTest({
        status: "attention",
        placeIds: `${singleId}, ${secondId}`,
        limit: "100"
      })
    ).toEqual({
      placeIds: [singleId, secondId],
      status: "attention",
      limit: 100,
      offset: 0
    });
    expect(
      normalizePlaceImageHealthQueryForTest({
        status: "healthy",
        placeIds: [singleId],
        limit: 25,
        offset: 10
      })
    ).toEqual({
      placeIds: [singleId],
      status: "healthy",
      limit: 25,
      offset: 10
    });
  });

  it("summarizes source freshness and provenance for search results", () => {
    const now = new Date("2026-05-22T07:00:00.000Z");

    expect(buildSearchSourceSummary([], { now })).toMatchObject({
      sourceCount: 0,
      sourceTypes: [],
      bestSourceType: null,
      bestSourceTier: "none",
      latestSourceType: null,
      latestCheckedAt: null,
      freshnessStatus: "unchecked"
    });

    expect(
      buildSearchSourceSummary(
        [
          {
            source_type: "public_listing",
            checked_at: new Date("2026-01-10T00:00:00.000Z"),
            created_at: new Date("2026-01-10T00:00:00.000Z")
          },
          {
            source_type: "official_site",
            checked_at: new Date("2026-05-22T06:30:00.000Z"),
            created_at: new Date("2026-05-22T06:45:00.000Z")
          }
        ],
        { now }
      )
    ).toMatchObject({
      sourceCount: 2,
      sourceTypes: ["official_site", "public_listing"],
      bestSourceType: "official_site",
      bestSourceTier: "official",
      latestSourceType: "official_site",
      latestCheckedAt: "2026-05-22T06:30:00.000Z",
      latestCreatedAt: "2026-05-22T06:45:00.000Z",
      freshnessStatus: "checked_today"
    });

    expect(
      buildSearchSourceSummary(
        [
          {
            source_type: "public_data",
            checked_at: new Date("2026-05-20T00:00:00.000Z"),
            created_at: new Date("2026-05-20T00:00:00.000Z")
          },
          {
            source_type: "news",
            checked_at: new Date("2026-05-21T00:00:00.000Z"),
            created_at: new Date("2026-05-21T00:00:00.000Z")
          },
          {
            source_type: "official",
            title: "Official opening hours",
            summary: "Official page confirms operating hours.",
            checked_at: new Date("2026-05-22T06:00:00.000Z"),
            created_at: new Date("2026-05-22T06:00:00.000Z")
          }
        ],
        { now }
      )
    ).toMatchObject({
      sourceCount: 3,
      sourceTypes: ["official_site", "public_agency", "public_news"],
      bestSourceType: "official_site",
      bestSourceTier: "official",
      latestSourceType: "official_site",
      openingHoursEvidence: {
        sourceTypes: ["official_site"],
        bestSourceType: "official_site"
      }
    });

    expect(
      buildSearchSourceSummary(
        [
          {
            source_type: "operator_page",
            title: "Operator opening hours",
            summary: "Operator page confirms opening hours.",
            checked_at: "2026-05-21T07:00:00.000Z",
            created_at: "2026-05-20T07:00:00.000Z"
          }
        ],
        { now }
      )
    ).toMatchObject({
      sourceCount: 1,
      bestSourceType: "operator_page",
      latestCheckedAt: "2026-05-21T07:00:00.000Z",
      freshnessStatus: "recent",
      openingHoursEvidence: {
        sourceCount: 1,
        bestSourceTier: "operator",
        latestCheckedAt: "2026-05-21T07:00:00.000Z",
        freshnessStatus: "recent"
      }
    });
  });

  it("separates opening-hours source confidence from runtime open status", () => {
    const sourceSummary = buildSearchSourceSummary(
      [
        {
          source_type: "official_site",
          title: "대전신세계 공식 영업시간",
          summary: "Official page confirms operating hours.",
          checked_at: new Date("2026-05-22T06:30:00.000Z"),
          created_at: new Date("2026-05-22T06:45:00.000Z")
        }
      ],
      { now: new Date("2026-05-22T07:00:00.000Z") }
    );
    const visit = {
      reservationRequired: "unknown",
      walkInAvailable: "unknown",
      sessionBased: "yes",
      sameDayAvailabilityKnown: "unknown"
    };

    expect(buildOpeningHoursDataSignal({ note: "공식 페이지 확인 필요" })).toEqual({
      dataStatus: "unstructured",
      hasData: true,
      hasStructuredData: false
    });
    expect(buildOpeningHoursDataSignal("월-토 10:00-17:00")).toEqual({
      dataStatus: "unstructured",
      hasData: true,
      hasStructuredData: false
    });
    expect(buildSearchOpeningHoursSummary(buildOpeningHoursDataSignal(null), sourceSummary, visit)).toMatchObject({
      dataStatus: "missing",
      confidenceLevel: "source_backed",
      sourceBacked: true,
      bestSourceTier: "official",
      latestCheckedAt: "2026-05-22T06:30:00.000Z",
      hasStructuredData: false,
      structuredDataGaps: ["openingHours", "reservationRequired", "walkInAvailable", "sameDayAvailabilityKnown"]
    });
    expect(buildSearchOpeningHoursSummary(buildOpeningHoursDataSignal({ openNow: true }), sourceSummary)).toMatchObject({
      dataStatus: "structured",
      confidenceLevel: "high",
      hasStructuredData: true,
      structuredDataGaps: []
    });
  });

  it("treats reservation and session sources as operational evidence", () => {
    const sourceSummary = buildSearchSourceSummary([
      {
        source_type: "official_site",
        title: "공식 예약 안내",
        summary: "회차별 입장 예약과 현장 입장 가능 여부를 안내한다.",
        checked_at: "2026-05-22T06:30:00.000Z",
        created_at: "2026-05-22T06:45:00.000Z"
      }
    ]);

    expect(sourceSummary.openingHoursEvidence).toMatchObject({
      sourceCount: 1,
      bestSourceTier: "official"
    });
    expect(
      buildSearchOpeningHoursSummary(buildOpeningHoursDataSignal(null), sourceSummary, {
        reservationRequired: "unknown",
        walkInAvailable: "unknown",
        sessionBased: "unknown",
        sameDayAvailabilityKnown: "unknown"
      })
    ).toMatchObject({
      sourceBacked: true,
      structuredDataGaps: ["openingHours", "reservationRequired", "walkInAvailable", "sessionBased", "sameDayAvailabilityKnown"]
    });
  });

  it("summarizes source-backed family logistics data gaps", () => {
    const sourceSummary = buildSearchSourceSummary([
      {
        source_type: "official_site",
        title: "공식 운영 및 편의시설 안내",
        summary: "공식 페이지가 운영시간, 수유실, 유모차 동선, 예약 정보를 안내한다.",
        checked_at: "2026-05-22T06:30:00.000Z",
        created_at: "2026-05-22T06:45:00.000Z"
      }
    ]);
    const visit = {
      reservationRequired: "unknown",
      walkInAvailable: "yes",
      sessionBased: "no",
      sameDayAvailabilityKnown: "unknown"
    } as const;

    expect(
      buildStructuredDataGaps(
        {
          facilities: {
            strollerFriendly: "unknown",
            parkingAvailable: "partial",
            nursingRoom: "unknown",
            diaperChangingTable: "unknown",
            kidsToilet: "unknown",
            elevator: "yes",
            babyChair: "unknown",
            foodAllowed: "no"
          },
          visit
        },
        sourceSummary,
        buildSearchOpeningHoursSummary(buildOpeningHoursDataSignal(null), sourceSummary, visit)
      )
    ).toEqual([
      "strollerFriendly",
      "nursingRoom",
      "diaperChangingTable",
      "kidsToilet",
      "babyChair",
      "reservationRequired",
      "sameDayAvailabilityKnown",
      "openingHours"
    ]);

    expect(
      buildStructuredDataGaps(
        {
          facilities: {
            strollerFriendly: "unknown",
            parkingAvailable: "unknown",
            nursingRoom: "unknown",
            diaperChangingTable: "unknown",
            kidsToilet: "unknown",
            elevator: "unknown",
            babyChair: "unknown",
            foodAllowed: "unknown"
          },
          visit: {
            reservationRequired: "unknown",
            walkInAvailable: "unknown",
            sessionBased: "unknown",
            sameDayAvailabilityKnown: "unknown"
          }
        },
        buildSearchSourceSummary([])
      )
    ).toEqual([]);
  });

  it("summarizes weekend recommendation readiness gaps for agents", () => {
    const sourceSummary = buildSearchSourceSummary([
      {
        source_type: "official_site",
        title: "공식 예약 및 운영 안내",
        summary: "공식 페이지가 운영시간과 예약, 회차 정보를 안내한다.",
        checked_at: "2026-05-22T06:30:00.000Z",
        created_at: "2026-05-22T06:45:00.000Z"
      }
    ]);
    const visit = {
      reservationRequired: "unknown",
      walkInAvailable: "unknown",
      sessionBased: "unknown",
      sameDayAvailabilityKnown: "unknown"
    } as const;
    const openingHoursSummary = buildSearchOpeningHoursSummary(buildOpeningHoursDataSignal(null), sourceSummary, visit);
    const readiness = buildSearchRecommendationReadiness(
      {
        primaryCategory: "kids_cafe",
        pricing: {},
        structuredDataGaps: buildStructuredDataGaps(
          {
            facilities: {
              strollerFriendly: "yes",
              parkingAvailable: "yes",
              nursingRoom: "unknown",
              diaperChangingTable: "unknown",
              kidsToilet: "unknown",
              elevator: "yes",
              babyChair: "unknown",
              foodAllowed: "unknown"
            },
            visit
          },
          sourceSummary,
          openingHoursSummary
        ),
        openingHoursSummary,
        imageHealth: buildSearchImageHealth([]),
        sourceSummary,
        facilities: { indoorType: "indoor" }
      },
      { visitContext: "weekendHalfDay", childAgeMonths: [32, 7, 7] }
    );

    expect(readiness).toMatchObject({
      readinessMode: "familyWeekend",
      readyForWeekendRecommendation: false,
      blockingGaps: expect.arrayContaining([
        "openingHours",
        "reservationRequired",
        "walkInAvailable",
        "sessionBased",
        "sameDayAvailabilityKnown",
        "nursingRoom",
        "diaperChangingTable",
        "primaryImage"
      ]),
      cautionNotes: expect.arrayContaining([expect.stringContaining("가격")])
    });
  });

  it("marks weak playground evidence as not ready for infant family recommendations", () => {
    const sourceSummary = buildSearchSourceSummary([
      {
        source_type: "public_agency",
        title: "공원 시설 안내",
        summary: "공공 페이지가 주소와 공원 이용 정보를 안내하지만 놀이기구와 영아 동선 세부 정보는 없다.",
        checked_at: "2026-05-23T00:00:00.000Z",
        created_at: "2026-05-23T00:00:00.000Z"
      }
    ]);
    const visit = {
      reservationRequired: "no",
      walkInAvailable: "yes",
      sessionBased: "no",
      sameDayAvailabilityKnown: "yes"
    } as const;
    const openingHoursSummary = buildSearchOpeningHoursSummary(buildOpeningHoursDataSignal({ openNow: true }), sourceSummary, visit);
    const readiness = buildSearchRecommendationReadiness(
      {
        primaryCategory: "park",
        pricing: {},
        playFeatures: {},
        structuredDataGaps: ["strollerFriendly", "parkingAvailable", "kidsToilet"],
        openingHoursSummary,
        imageHealth: buildSearchImageHealth([]),
        sourceSummary,
        facilities: { indoorType: "outdoor" }
      },
      { visitContext: "weekendHalfDay", childAgeMonths: [32, 7, 7] }
    );

    expect(readiness).toMatchObject({
      readyForWeekendRecommendation: false,
      blockingGaps: expect.arrayContaining(["playFeatures", "strollerFriendly", "parkingAvailable", "kidsToilet", "primaryImage"]),
      cautionNotes: expect.arrayContaining([expect.stringContaining("놀이터 장비 정보")])
    });
  });

  it("describes search preferences as soft ranking signals", () => {
    expect(
      buildSearchPreferenceSemantics({
        babyChair: true,
        nursingRoom: true,
        parkingAvailable: false,
        indoorTypes: ["indoor", "mixed"]
      })
    ).toEqual({
      mode: "soft",
      requestedKeys: ["babyChair", "indoorTypes", "nursingRoom"],
      unknownValuesRemainEligible: true,
      mismatchesRemainEligible: true,
      hardFilteringSupported: true
    });
    expect(buildSearchPreferenceSemantics({ babyChair: true }, "required")).toEqual({
      mode: "required",
      requestedKeys: ["babyChair"],
      unknownValuesRemainEligible: false,
      mismatchesRemainEligible: false,
      hardFilteringSupported: true
    });
  });

  it("summarizes infant logistics separately from child engagement", () => {
    expect(
      buildInfantLogisticsSignal({
        strollerFriendly: "yes",
        elevator: "yes",
        nursingRoom: "partial",
        diaperChangingTable: "unknown",
        babyChair: "no",
        parkingAvailable: "yes"
      })
    ).toEqual({
      confidenceLevel: "high",
      confidenceScore: 83,
      supportLevel: "moderate",
      supportScore: 58,
      knownCount: 5,
      unknownCount: 1,
      positiveSignals: ["strollerFriendly", "elevator", "parkingAvailable"],
      partialSignals: ["nursingRoom"],
      negativeSignals: ["babyChair"],
      missingSignals: ["diaperChangingTable"]
    });
  });

  it("builds compact search items without full image and scoring payloads", () => {
    const compact = compactSearchPlaceItem({
      id: "place-1",
      name: "대전 어린이 시설",
      primaryCategory: "museum",
      tags: ["어린이", "공공"],
      address: "대전광역시 중구",
      lat: 36.33,
      lng: 127.43,
      distanceKm: 2.4,
      score: 82,
      placeQualityScore: {
        score: 79,
        scoreBreakdown: {
          baseline: 24,
          placeQuality: 8,
          externalEvidence: 4,
          distance: 0,
          context: 0,
          match: 0,
          age: 0,
          preferences: 6,
          openingHours: 0,
          visitFit: 3,
          confidence: 1,
          total: 79
        },
        reasonCodes: ["PLACE_SCORE_HIGH", "PARKING_YES"],
        reasons: [],
        storedScore: 8.4,
        rationale: "공식 출처와 가족 편의 근거가 강한 장소.",
        updatedAt: "2026-05-22T00:00:00.000Z"
      },
      reasonCodes: ["DIAPER_TABLE_UNKNOWN"],
      reasons: [],
      dataConfidence: "agent_collected",
      taxonomy: {
        ...emptyPlaceTaxonomy(),
        inferred: {
          ...emptyPlaceTaxonomy().inferred,
          activityTypes: ["science_exhibit"],
          confidence: "medium"
        }
      },
      pricing: {
        summary: "어린이 2시간 15,000원",
        currency: "KRW",
        basisDate: "2026-05-22"
      },
      routeSupport: {
        terminalType: "airport",
        routeSupportRole: "route_break",
        babyCareLocations: [{ label: "국내선 유아휴게실", nursingRoom: "yes" }]
      },
      recommendedAgeMonths: { min: 24, max: 96 },
      infantLogistics: {
        confidenceLevel: "medium",
        confidenceScore: 50,
        supportLevel: "moderate",
        supportScore: 50,
        knownCount: 3,
        unknownCount: 3,
        positiveSignals: ["strollerFriendly", "elevator"],
        partialSignals: ["parkingAvailable"],
        negativeSignals: [],
        missingSignals: ["nursingRoom", "diaperChangingTable", "babyChair"]
      },
      structuredDataGaps: ["nursingRoom", "diaperChangingTable"],
      openingHoursSummary: {
        dataStatus: "structured",
        confidenceLevel: "high",
        sourceBacked: true,
        bestSourceType: "official_site",
        bestSourceTier: "official",
        sourceCount: 1,
        sourceTypes: ["official_site"],
        latestCheckedAt: "2026-05-22T00:00:00.000Z",
        freshnessStatus: "checked_today",
        hasStructuredData: true,
        structuredDataGaps: []
      },
      facilities: {
        indoorType: "indoor",
        strollerFriendly: "yes",
        parkingAvailable: "yes",
        parkingFrictionLevel: "high",
        peakParkingWindow: "Weekend late mornings",
        parkingWaitNote: "Main lot can back up during public programs.",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "yes",
        babyChair: "unknown",
        foodAllowed: "unknown"
      },
      visit: {
        reservationRequired: "yes",
        walkInAvailable: "partial",
        sessionBased: "yes",
        sameDayAvailabilityKnown: "unknown",
        averageStayMinutes: 90,
        parentEffortLevel: 2,
        childEngagementLevel: 4,
        rainyDayScore: 4,
        hotDayScore: 3,
        coldDayScore: 4
      },
      notes: { safety: null, parent: "시설 확인 필요" },
      primaryImage: { url: "https://example.com/place.jpg" },
      imageHealth: {
        primaryImageUrl: "https://example.com/fallback.jpg",
        status: "healthy",
        suggestedAction: "none",
        priorityScore: 0,
        activeCount: 1,
        approvedCount: 1,
        needsReviewCount: 0,
        pendingReviewCount: 0,
        hasPrimary: true,
        primaryReviewStatus: "approved",
        latestImageCheckedAt: null,
        latestImageUpdatedAt: null
      },
      recommendationReadiness: {
        readinessMode: "familyWeekend",
        readyForWeekendRecommendation: true,
        blockingGaps: [],
        cautionNotes: [],
        agentSummary: "운영, 예약, 이미지 핵심 신호가 갖춰져 바로 비교 후보로 사용할 수 있습니다."
      },
      sourceSummary: {
        sourceCount: 1,
        sourceTypes: ["official_site"],
        bestSourceType: "official_site",
        bestSourceTier: "official",
        latestSourceType: "official_site",
        latestCheckedAt: "2026-05-22T00:00:00.000Z",
        latestCreatedAt: "2026-05-22T00:00:00.000Z",
        freshnessStatus: "checked_today"
      }
    } as unknown as Parameters<typeof compactSearchPlaceItem>[0]);

    expect(compact).toMatchObject({
      id: "place-1",
      name: "대전 어린이 시설",
      primaryImageUrl: "https://example.com/place.jpg",
      placeQualityScore: {
        score: 79,
        storedScore: 8.4,
        rationale: "공식 출처와 가족 편의 근거가 강한 장소."
      },
      infantLogistics: {
        supportLevel: "moderate"
      },
      structuredDataGaps: ["nursingRoom", "diaperChangingTable"],
      openingHoursSummary: {
        confidenceLevel: "high"
      },
      recommendationReadiness: {
        readyForWeekendRecommendation: true
      },
      pricing: {
        summary: "어린이 2시간 15,000원",
        basisDate: "2026-05-22"
      },
      routeSupport: {
        terminalType: "airport",
        routeSupportRole: "route_break"
      },
      taxonomy: {
        inferred: {
          activityTypes: ["science_exhibit"]
        }
      },
      facilities: {
        parkingFrictionLevel: "high",
        peakParkingWindow: "Weekend late mornings",
        parkingWaitNote: "Main lot can back up during public programs."
      },
      visit: {
        reservationRequired: "yes",
        walkInAvailable: "partial",
        sessionBased: "yes",
        sameDayAvailabilityKnown: "unknown",
        averageStayMinutes: 90,
        parentEffortLevel: 2,
        childEngagementLevel: 4
      }
    });
    expect(compact).not.toHaveProperty("images");
    expect(compact).not.toHaveProperty("playFeatures");
    expect(compact).not.toHaveProperty("scoring");
  });

  it("groups ranked search items into a practical course plan", () => {
    const plan = buildSearchCoursePlan([
      courseItem({
        id: "anchor",
        name: "어린이 과학관",
        primaryCategory: "science_museum",
        distanceKm: 42,
        score: 91,
        childEngagementLevel: 5,
        parentEffortLevel: 3,
        imageHealth: buildSearchImageHealth([])
      }),
      courseItem({
        id: "second",
        name: "근처 숲 놀이터",
        primaryCategory: "park",
        distanceKm: 44,
        score: 83,
        averageStayMinutes: 60
      }),
      courseItem({
        id: "meal",
        name: "놀이방 식당",
        primaryCategory: "family_restaurant",
        distanceKm: 45,
        score: 78,
        babyChair: "yes",
        foodAllowed: "yes"
      }),
      courseItem({
        id: "nap",
        name: "귀가길 휴게소",
        primaryCategory: "rest_area",
        distanceKm: 75,
        score: 72,
        parentEffortLevel: 1
      }),
      courseItem({
        id: "fallback",
        name: "실내 쇼핑몰",
        primaryCategory: "shopping_mall",
        distanceKm: 8,
        score: 70,
        indoorType: "indoor",
        strollerFriendly: "yes",
        elevator: "yes",
        nursingRoom: "partial"
      })
    ]);

    expect(plan.anchor).toMatchObject({
      id: "anchor",
      driveBurden: "moderate",
      estimatedParentEffort: 3,
      imageHealth: { status: "no_active_image", suggestedAction: "find_first_image" }
    });
    expect(plan.optionalSecondStop).toMatchObject({ id: "second" });
    expect(plan.mealCareBase).toMatchObject({ id: "meal", reasonCodes: expect.arrayContaining(["COURSE_MEAL_CARE_BASE"]) });
    expect(plan.napBreak).toMatchObject({ id: "nap", reasonCodes: expect.arrayContaining(["COURSE_NAP_BREAK"]) });
    expect(plan.abortFallback).toMatchObject({ id: "fallback", reasonCodes: expect.arrayContaining(["COURSE_ABORT_FALLBACK"]) });
  });

  it("turns facility words in ordinary keyword queries into soft preferences", () => {
    expect(
      normalizeSearchInput({
        ...baseSearchInput,
        query: "쌍둥이 유모차 비오는날 모래놀이터",
        taxonomy: {
          mode: "required",
          activityTypes: ["water_play"]
        }
      }).taxonomy
    ).toMatchObject({
      mode: "required",
      activityTypes: ["water_play"],
      familyFitGates: ["baby_logistics"],
      visitUseCases: ["rainy_day"],
      logisticsTags: expect.arrayContaining(["double_stroller", "stroller", "nursing_room", "diaper_table"])
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "키즈카페 수유실 기저귀 유모차" })).toMatchObject({
      query: "키즈카페",
      preferences: {
        nursingRoom: true,
        strollerFriendly: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "키즈 카페 주차" })).toMatchObject({
      query: "키즈카페",
      preferences: {
        parkingAvailable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 키즈카페 주차" })).toMatchObject({
      query: "판암 키즈카페",
      preferences: {
        parkingAvailable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 짧은 야외 놀이터" })).toMatchObject({
      query: "판암 놀이터",
      playgroundOnly: true,
      preferences: {
        indoorTypes: ["outdoor", "mixed"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 동네놀이터 장난감도서관 근처" })).toMatchObject({
      query: "판암 동네놀이터",
      playgroundOnly: true
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "실내놀이터" })).toMatchObject({
      query: "실내놀이터",
      playgroundOnly: true
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "장난감도서관" })).toMatchObject({
      query: "장난감도서관"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 장난감도서관 근처" })).toMatchObject({
      query: "장난감도서관"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 장난감 가게 근처" })).toMatchObject({
      query: "장난감가게"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "레고 스토어 주차" })).toMatchObject({
      query: "레고스토어",
      preferences: {
        parkingAvailable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 동네놀이터 모래놀이" })).toMatchObject({
      query: "판암",
      playgroundOnly: true
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "범골 어린이공원 모래놀이터" })).toMatchObject({
      query: "범골",
      playgroundOnly: true
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "오월드 장태산 한밭수목원 대청호 사진 있는 가족 나들이" })).toMatchObject({
      query: "오월드 장태산 한밭수목원 대청호"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "하원 후 1-2시간 키즈카페 실내 주차 유모차 수유실 기저귀" })).toMatchObject({
      visitContext: "afterDaycare",
      query: "키즈카페",
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "비오는날 쌍둥이 유모차" })).toMatchObject({
      visitContext: "rainyDay",
      query: undefined,
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 30분 키즈카페 수유실" })).toMatchObject({
      query: "키즈카페",
      preferences: {
        nursingRoom: true
      }
    });
    expect(
      normalizeSearchInput({
        ...baseSearchInput,
        query: "월요일 실내 키즈카페 수유실",
        visitDate: "2026-05-25",
        visitStartTime: "10:30"
      })
    ).toMatchObject({
      query: "키즈카페",
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        nursingRoom: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "홈경기 없는 날 키벤저스 주차 실내놀이" })).toMatchObject({
      query: "키벤저스",
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        parkingAvailable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "물놀이 물놀이터 수경 여름 운영 주차 유모차" })).toMatchObject({
      query: "물놀이 물놀이터 수경",
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "아이랑 밥 놀이방 식당 아기의자 주차 유모차" })).toMatchObject({
      query: "놀이방식당",
      preferences: {
        babyChair: true,
        parkingAvailable: true,
        strollerFriendly: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 장난감도서관 근처 놀이방 식당 아기의자 주차" })).toMatchObject({
      query: "판암 놀이방식당",
      preferences: {
        babyChair: true,
        parkingAvailable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "한밭수목원 근처 키즈룸 식당 엘리베이터" })).toMatchObject({
      query: "한밭수목원 놀이방식당"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "수통골 놀이방 식당 아기의자 주차" })).toMatchObject({
      query: "수통골 놀이방식당"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "반석 캠핑식당 놀이방 아기의자 주차" })).toMatchObject({
      query: "반석 놀이방식당"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "자연 실내 대피" })).toMatchObject({
      query: "자연",
      preferences: {
        indoorTypes: ["indoor", "mixed"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "비오면 자연 실내대안" })).toMatchObject({
      visitContext: "rainyDay",
      query: "자연",
      preferences: {
        indoorTypes: ["indoor", "mixed"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "하원하고 한두시간만 있다 올 곳" })).toMatchObject({
      visitContext: "afterDaycare",
      query: undefined
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "아기랑 비올때 베이비라운지 있는 곳" })).toMatchObject({
      visitContext: "rainyDay",
      query: undefined,
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        nursingRoom: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "쌍둥이 유모차 수유실 기저귀 갈기 편한 곳" })).toMatchObject({
      query: undefined,
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "비오는날 아이랑 실내 가볼만한곳 유모차 수유실 기저귀" })).toMatchObject({
      visitContext: "rainyDay",
      query: undefined,
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        strollerFriendly: true,
        nursingRoom: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "밥 먹으면서 애 놀릴 수 있는 곳" })).toMatchObject({
      query: "놀이방식당"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "서구 어린이도서관 간식 음식불가 그림책방" })).toMatchObject({
      query: "서구 어린이도서관 음식불가 그림책방"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "창원 장난감 가게" })).toMatchObject({
      query: "창원 장난감가게"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "김해 놀이방 식당" })).toMatchObject({
      query: "김해 놀이방식당"
    });
  });

  it("recognizes broad public and day-trip fallback parent queries", () => {
    expect(normalizeSearchInput({ ...baseSearchInput, query: "주말 반나절 공공시설 과학 도서관 어린이" })).toMatchObject({
      visitContext: "weekendHalfDay",
      query: "주말 반나절 공공시설 과학 도서관 어린이"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "주말 반나절 공공시설 과학관 도서관 어린이 무료 저렴 실내" })).toMatchObject({
      visitContext: "weekendHalfDay",
      query: "주말 반나절 공공시설 과학관 도서관 어린이 무료 저렴 실내",
      preferences: {
        indoorTypes: ["indoor", "mixed"]
      }
    });
    expect(isBroadParentIntentQuery("공공 어린이 체험 박물관 과학관")).toBe(true);
    expect(normalizeSearchInput({ ...baseSearchInput, query: "공공 어린이 체험 박물관 과학관" })).toMatchObject({
      query: "공공 어린이 체험 박물관 과학관"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 영아 실내 공공시설" })).toMatchObject({
      query: "대전역 영아 실내 공공시설",
      preferences: {
        indoorTypes: ["indoor", "mixed"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "공동육아나눔터 영유아 실내" })).toMatchObject({
      query: "공동육아나눔터 영유아 실내",
      preferences: {
        indoorTypes: ["indoor", "mixed"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "서울 아이랑 실내 유명" })).toMatchObject({
      query: "서울",
      taxonomy: {
        mode: "soft",
        familyFitGates: ["child_primary"],
        activityTypes: ["indoor_play"]
      },
      preferences: {
        indoorTypes: ["indoor", "mixed"]
      }
    });
    expect(searchQueryNormalizationMetaForTest({ ...baseSearchInput, query: "서울 아이랑 실내 유명" })).toMatchObject({
      removedTerms: ["아이랑", "실내", "유명"],
      preservedTaxonomyFacets: {
        familyFitGates: ["child_primary"],
        activityTypes: ["indoor_play"]
      },
      hasPreservedIntent: true
    });
    expect(isBroadParentIntentQuery("전국 아이랑 과학관 어린이박물관")).toBe(true);
    expect(normalizeSearchInput({ ...baseSearchInput, query: "전국 아이랑 과학관 어린이박물관" })).toMatchObject({
      query: "전국 아이랑 과학관 어린이박물관",
      taxonomy: {
        mode: "soft",
        familyFitGates: ["child_primary"],
        activityTypes: ["science_exhibit", "culture_exhibit"]
      }
    });
    expect(buildSearchQuery(normalizeSearchInput({ ...baseSearchInput, query: "전국 아이랑 과학관 어린이박물관" })).sql).toContain(
      "primary_category = any(array['science_museum','museum','experience_center','library','indoor_playground','toy_library']::text[])"
    );
    expect(normalizeSearchInput({ ...baseSearchInput, query: "워터파크 물놀이 아이랑" })).toMatchObject({
      query: "워터파크 물놀이",
      taxonomy: {
        mode: "soft",
        familyFitGates: ["child_primary"],
        activityTypes: ["water_play"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "무료 실내 공공 아이랑 밥먹고 놀기 수유실 주차" })).toMatchObject({
      query: "무료 실내 공공 아이랑 밥먹고 놀기 수유실 주차",
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        nursingRoom: true,
        parkingAvailable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "쇼핑몰 베이비라운지 수유실 기저귀 유모차 대여 푸드코트 주차" })).toMatchObject({
      query: "쇼핑몰 베이비라운지 수유실 기저귀 유모차 대여 푸드코트 주차",
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 기준 1시간권 자연 실내대피 비오면 피할 곳" })).toMatchObject({
      visitContext: "dayTrip",
      query: "자연"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "창원 근교 공룡 아이" })).toMatchObject({
      visitContext: "dayTrip",
      query: "공룡"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "창원 1시간 우포 아이 자연" })).toMatchObject({
      visitContext: "dayTrip",
      query: "우포 자연"
    });
  });

  it("keeps special intent queries literal while still inferring preferences", () => {
    expect(normalizeSearchInput({ ...baseSearchInput, query: "청남대 가는 길 수유실 휴게소" })).toMatchObject({
      query: "청남대 가는 길 수유실 휴게소",
      preferences: {
        nursingRoom: true
      }
    });
  });

  it("does not use short region-like terms against address text", () => {
    expect(shouldSearchAddressForTerm("계룡", "계룡")).toBe(false);
  });

  it("uses address text for address-shaped queries", () => {
    expect(shouldSearchAddressForTerm("계룡로 598", "계룡로")).toBe(true);
    expect(shouldSearchAddressForTerm("대전로", "대전로")).toBe(false);
    expect(shouldSearchAddressForTerm("대전광역시", "대전광역시")).toBe(true);
  });

  it("boosts direct place-name keyword matches over tag-only matches", () => {
    const nameMatch = queryMatchSignal(
      {
        name: "공주산림휴양마을 목재문화체험장",
        tags: ["woodcraft"],
        description: null,
        address: null,
        roadAddress: null
      },
      "목재문화체험장"
    );
    const tagMatch = queryMatchSignal(
      {
        name: "금산산림문화타운",
        tags: ["목재문화체험장"],
        description: null,
        address: null,
        roadAddress: null
      },
      "목재문화체험장"
    );

    expect(nameMatch.delta).toBeGreaterThan(tagMatch.delta);
    expect(nameMatch.reasonCodes).toContain("QUERY_NAME_MATCH");
    expect(tagMatch.reasonCodes).toContain("QUERY_TAG_MATCH");
  });

  it("treats Korean external search aliases as exact query matches", () => {
    const signal = queryMatchSignal(
      {
        name: "Pacific Islands Club Guam",
        tags: [],
        description: null,
        address: null,
        roadAddress: null,
        externalRefs: { koreanSearchAliases: ["PIC 괌", "괌 PIC"] }
      },
      "괌 PIC"
    );

    expect(signal.reasonCodes).toContain("QUERY_NAME_EXACT");
    expect(signal.delta).toBeGreaterThan(0);
  });

  it("uses a distinct reason for location-only query matches", () => {
    const signal = queryMatchSignal(
      {
        name: "대전오월드",
        tags: ["대전"],
        description: "대전 가족 나들이 장소",
        address: "대전광역시 중구 사정공원로 70",
        roadAddress: null
      },
      "대전"
    );

    expect(signal.delta).toBeGreaterThan(0);
    expect(signal.reasonCodes).toContain("LOCATION_QUERY_MATCH");
    expect(signal.reasonCodes).not.toContain("QUERY_NAME_MATCH");
    expect(signal.reasonCodes).not.toContain("QUERY_TAG_MATCH");
    expect(signal.reasonCodes).not.toContain("QUERY_TEXT_MATCH");
  });

  it("boosts name matches in listed-place queries over tag-only matches", () => {
    const nameMatch = queryMatchSignal(
      {
        name: "대전오월드",
        tags: [],
        description: null,
        address: null,
        roadAddress: null
      },
      "오월드 장태산 한밭수목원 대청호"
    );
    const tagMatch = queryMatchSignal(
      {
        name: "근처 가족 쉼터",
        tags: ["오월드"],
        description: null,
        address: null,
        roadAddress: null
      },
      "오월드 장태산 한밭수목원 대청호"
    );

    expect(nameMatch.delta).toBeGreaterThan(tagMatch.delta);
    expect(nameMatch.reasonCodes).toContain("QUERY_NAME_MATCH");
    expect(tagMatch.reasonCodes).toContain("QUERY_TAG_MATCH");
  });

  it("boosts exact place-name matches over partial museum-name matches", () => {
    const exactBuyeo = queryMatchSignal(
      {
        name: "국립부여박물관 어린이박물관",
        tags: ["어린이박물관"],
        description: null,
        address: null,
        roadAddress: null
      },
      "국립부여박물관 어린이박물관"
    );
    const partialSejong = queryMatchSignal(
      {
        name: "세종 국립어린이박물관",
        tags: ["어린이박물관"],
        description: null,
        address: null,
        roadAddress: null
      },
      "국립부여박물관 어린이박물관"
    );

    expect(exactBuyeo.delta).toBeGreaterThanOrEqual(partialSejong.delta + 8);
    expect(exactBuyeo.reasonCodes).toContain("QUERY_NAME_EXACT");
    expect(partialSejong.reasonCodes).toContain("QUERY_NAME_MATCH");
  });

  it("boosts exact external reference aliases like exact place-name matches", () => {
    const signal = queryMatchSignal(
      {
        name: "세종 국립어린이박물관",
        tags: ["어린이박물관"],
        description: null,
        address: null,
        roadAddress: null,
        externalRefs: {
          aliases: ["국립세종어린이박물관", "국립박물관단지 국립어린이박물관"]
        }
      },
      "국립세종어린이박물관"
    );

    expect(signal.delta).toBeGreaterThanOrEqual(24);
    expect(signal.reasonCodes).toContain("QUERY_NAME_EXACT");
  });

  it("boosts retail alias name matches across chain naming variants", () => {
    const signal = queryMatchSignal(
      {
        name: "롯데백화점 김포공항점",
        tags: [],
        description: null,
        address: null,
        roadAddress: null
      },
      "롯데몰 김포공항"
    );

    expect(signal.delta).toBeGreaterThanOrEqual(18);
    expect(signal.reasonCodes).toContain("QUERY_RETAIL_ALIAS_MATCH");
  });

  it("does not boost retail aliases when Time Villas branch names conflict", () => {
    const signal = queryMatchSignal(
      {
        name: "롯데프리미엄아울렛 의왕점",
        tags: [],
        description: null,
        address: "경기도 의왕시",
        roadAddress: "경기도 의왕시 바라산로 1"
      },
      "타임빌라스 수원"
    );

    expect(signal.reasonCodes).not.toContain("QUERY_RETAIL_ALIAS_MATCH");
  });

  it("does not add literal query boosts for broad nature intent queries", () => {
    const signal = queryMatchSignal(
      {
        name: "세종호수공원",
        tags: ["공원", "자연"],
        description: "넓은 자연 산책 공원",
        address: null,
        roadAddress: null
      },
      "공원 자연"
    );

    expect(signal.delta).toBe(0);
    expect(signal.reasonCodes).toEqual([]);
  });

  it("adds query match signals for place-level playground features", () => {
    const signal = queryMatchSignal(
      {
        name: "가오근린공원",
        tags: ["공원"],
        description: null,
        address: null,
        roadAddress: null,
        playFeatures: {
          slide: "yes",
          swing: "no",
          waterPlayground: "yes",
          notes: "미끄럼틀과 물놀이터 관찰 기록"
        }
      },
      "미끄럼틀 물놀이터"
    );

    expect(signal.delta).toBeGreaterThan(0);
    expect(signal.reasonCodes).toContain("QUERY_PLAY_FEATURE_MATCH");
  });

  it("adds query match signals for route-support metadata", () => {
    const signal = queryMatchSignal(
      {
        name: "청주국제공항",
        tags: ["route_break"],
        description: null,
        address: null,
        roadAddress: null,
        routeSupport: {
          terminalType: "airport",
          routeSupportRole: "route_break",
          babyCareLocations: [
            {
              label: "국내선 1층 유아휴게실",
              area: "landside",
              nursingRoom: "yes",
              diaperChangingTable: "yes"
            }
          ],
          prioritySupport: {
            securityFastTrack: "partial",
            notes: "유아 동반 보안검색 지원 여부 확인 필요"
          }
        }
      },
      "공항 유아휴게실 보안검색"
    );

    expect(signal.delta).toBeGreaterThan(0);
    expect(signal.reasonCodes).toContain("QUERY_ROUTE_SUPPORT_MATCH");
  });
});
