import { describe, expect, it } from "vitest";

import {
  buildImageMetadata,
  categoryClauseForKeywordTerm,
  isBroadNatureIntentQuery,
  isBroadParentIntentQuery,
  isBroadWaterPlayIntentQuery,
  isRouteBreakIntentQuery,
  normalizeSearchInput,
  queryMatchSignal,
  searchTermPatterns,
  shouldUseAnyKeywordMatch,
  shouldSearchAddressForTerm
} from "@/lib/places";

describe("place search helpers", () => {
  const baseSearchInput = { radiusKm: 80, sort: "recommended" as const, limit: 20, offset: 0 };

  it("splits spaced Korean queries into AND-able ilike patterns", () => {
    expect(searchTermPatterns("보문산 전망대")).toEqual(["%보문산%", "%전망대%"]);
  });

  it("collapses repeated whitespace in keyword queries", () => {
    expect(searchTermPatterns("  대청호   명상정원  ")).toEqual(["%대청호%", "%명상정원%"]);
  });

  it("recognizes broad nature intent queries", () => {
    expect(isBroadNatureIntentQuery("공원 자연")).toBe(true);
    expect(isBroadNatureIntentQuery("숲 산책")).toBe(true);
    expect(isBroadNatureIntentQuery("동네놀이터 어린이공원")).toBe(true);
    expect(isBroadNatureIntentQuery("동네놀이터 어린이공원 모래놀이터")).toBe(true);
    expect(isBroadNatureIntentQuery("대청호 자연")).toBe(false);
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
    expect(isBroadParentIntentQuery("계룡산 유모차 주차")).toBe(false);
  });

  it("widens alternative attraction keyword searches without widening local category searches", () => {
    expect(shouldUseAnyKeywordMatch("아쿠아리움 동물원")).toBe(true);
    expect(shouldUseAnyKeywordMatch("과학관 체험 창의나래 넥스페리움")).toBe(true);
    expect(shouldUseAnyKeywordMatch("대전 키즈카페")).toBe(false);
    expect(shouldUseAnyKeywordMatch("판암 동네놀이터")).toBe(false);
  });

  it("maps common Korean category terms to primary category clauses", () => {
    expect(categoryClauseForKeywordTerm("공원")).toBe("primary_category = 'park'");
    expect(categoryClauseForKeywordTerm("놀이터")).toBe("primary_category = any(array['park','indoor_playground','kids_cafe']::text[])");
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

  it("turns facility words in ordinary keyword queries into soft preferences", () => {
    expect(normalizeSearchInput({ ...baseSearchInput, query: "키즈카페 수유실 기저귀 유모차" })).toMatchObject({
      query: "키즈카페",
      preferences: {
        nursingRoom: true,
        diaperChangingTable: true,
        strollerFriendly: true
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
      preferences: {
        indoorTypes: ["outdoor", "mixed"]
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 동네놀이터 장난감도서관 근처" })).toMatchObject({
      query: "판암 동네놀이터"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "장난감도서관" })).toMatchObject({
      query: "장난감도서관"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 장난감도서관 근처" })).toMatchObject({
      query: "장난감도서관"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "판암 동네놀이터 모래놀이" })).toMatchObject({
      query: "판암"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "범골 어린이공원 모래놀이터" })).toMatchObject({
      query: "범골"
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
        nursingRoom: true,
        diaperChangingTable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "비오는날 쌍둥이 유모차" })).toMatchObject({
      visitContext: "rainyDay",
      query: undefined,
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true,
        diaperChangingTable: true,
        elevator: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 30분 키즈카페 수유실" })).toMatchObject({
      query: "키즈카페",
      preferences: {
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
      query: "한밭수목원 놀이방식당",
      preferences: {
        elevator: true
      }
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
        nursingRoom: true,
        diaperChangingTable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "쌍둥이 유모차 수유실 기저귀 갈기 편한 곳" })).toMatchObject({
      query: undefined,
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true,
        diaperChangingTable: true,
        elevator: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "비오는날 아이랑 실내 가볼만한곳 유모차 수유실 기저귀" })).toMatchObject({
      visitContext: "rainyDay",
      query: undefined,
      preferences: {
        indoorTypes: ["indoor", "mixed"],
        strollerFriendly: true,
        nursingRoom: true,
        diaperChangingTable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "밥 먹으면서 애 놀릴 수 있는 곳" })).toMatchObject({
      query: "놀이방식당"
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "서구 어린이도서관 간식 음식불가 그림책방" })).toMatchObject({
      query: "서구 어린이도서관 음식불가 그림책방"
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
        nursingRoom: true,
        diaperChangingTable: true
      }
    });
    expect(normalizeSearchInput({ ...baseSearchInput, query: "대전역 기준 1시간권 자연 실내대피 비오면 피할 곳" })).toMatchObject({
      visitContext: "dayTrip",
      query: "자연"
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
});
