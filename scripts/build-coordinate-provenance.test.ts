import { describe, expect, it } from "vitest";

import { buildCoordinateProvenanceDraft, parseArgs } from "./build-coordinate-provenance";

describe("coordinate provenance draft helper", () => {
  it("builds a high-confidence draft when addresses normalize to the same string", () => {
    const draft = buildCoordinateProvenanceDraft({
      placeName: "테스트 장소",
      officialAddress: "서울특별시 중구 세종대로 110",
      officialSourceUrl: "https://example.com/official",
      officialSourceTitle: "Official page",
      coordinateAddress: "서울특별시 중구 세종대로 110",
      coordinateSourceUrl: "https://example.com/coords",
      coordinateSourceTitle: "Public coordinate page",
      lat: 37.5665,
      lng: 126.978,
      level: "public_address_coordinate",
      checkedAt: "2026-05-24T17:40:00.000+09:00"
    });

    expect(draft.addressMatch).toMatchObject({ matches: true, warnings: [] });
    expect(draft.externalRefs.coordinateProvenance).toMatchObject({
      level: "public_address_coordinate",
      lat: 37.5665,
      lng: 126.978,
      coordinateSystem: "WGS84",
      sourceUrl: "https://example.com/coords",
      sourceTitle: "Public coordinate page",
      officialSourceUrl: "https://example.com/official",
      confidence: "high",
      checkedAt: "2026-05-24T17:40:00.000+09:00"
    });
  });

  it("warns when official and coordinate addresses conflict", () => {
    const draft = buildCoordinateProvenanceDraft({
      officialAddress: "서울특별시 중구 세종대로 110",
      coordinateAddress: "부산광역시 해운대구 센텀남대로 35",
      coordinateSourceUrl: "https://example.com/coords",
      lat: 35.169,
      lng: 129.13,
      level: "public_dataset_exact_address",
      checkedAt: "2026-05-24T17:40:00.000+09:00"
    });

    expect(draft.addressMatch.matches).toBe(false);
    expect(draft.addressMatch.warnings).toHaveLength(1);
    expect(draft.externalRefs.coordinateProvenance.confidence).toBe("medium");
    expect(draft.externalRefs.coordinateProvenance.basis).toContain("manual identity review");
  });

  it("builds parent-building duplicate review evidence for tenant places", () => {
    const draft = buildCoordinateProvenanceDraft({
      placeName: "볼베어파크 부천점",
      officialAddress: "경기도 부천시 조마루로 2 웅진플레이도시",
      officialSourceUrl: "https://example.com/tenant",
      officialSourceTitle: "Tenant listing",
      coordinateAddress: "경기도 부천시 조마루로 2",
      coordinateSourceUrl: "https://example.com/parent-coordinates",
      coordinateSourceTitle: "Parent building coordinate page",
      parentPlaceId: "parent-place-id",
      parentPlaceName: "웅진플레이도시",
      parentSourceUrl: "https://example.com/parent",
      parentSourceTitle: "Parent building page",
      tenantSourceUrl: "https://example.com/tenant",
      tenantSourceTitle: "Tenant listing",
      duplicateRadiusMeters: 75,
      lat: 37.505,
      lng: 126.744,
      level: "parent_building_coordinate",
      checkedAt: "2026-05-24T17:40:00.000+09:00"
    });

    expect(draft.externalRefs.coordinateProvenance).toMatchObject({
      level: "parent_building_coordinate",
      sourceUrl: "https://example.com/parent-coordinates",
      officialSourceUrl: "https://example.com/tenant",
      basis: expect.stringContaining("coordinate belongs to the parent building")
    });
    expect(draft.parentBuilding).toMatchObject({
      tenantPlaceName: "볼베어파크 부천점",
      tenantSourceUrl: "https://example.com/tenant",
      parentPlaceId: "parent-place-id",
      parentPlaceName: "웅진플레이도시",
      parentSourceUrl: "https://example.com/parent",
      duplicateReview: {
        radiusMeters: 75,
        reviewLabels: ["parent_building_coordinate", "same_building_review_only"]
      },
      warnings: []
    });
    expect(draft.parentBuilding?.duplicateReview.caution).toContain("do not merge tenant and parent records");
  });

  it("parses required CLI flags with a default provenance level", () => {
    expect(
      parseArgs([
        "--official-address=서울특별시 중구 세종대로 110",
        "--coordinate-address=서울특별시 중구 세종대로 110",
        "--coordinate-source-url=https://example.com/coords",
        "--lat=37.5665",
        "--lng=126.978"
      ])
    ).toMatchObject({
      officialAddress: "서울특별시 중구 세종대로 110",
      coordinateAddress: "서울특별시 중구 세종대로 110",
      coordinateSourceUrl: "https://example.com/coords",
      lat: 37.5665,
      lng: 126.978,
      level: "public_address_coordinate"
    });
  });

  it("parses parent-building CLI flags", () => {
    expect(
      parseArgs([
        "--place-name=브루미즈키즈카페 뉴코아아울렛 평촌점",
        "--official-address=경기도 안양시 동안구 동안로 119",
        "--coordinate-address=경기도 안양시 동안구 동안로 119",
        "--coordinate-source-url=https://example.com/coords",
        "--parent-place-name=뉴코아아울렛 평촌점",
        "--parent-source-url=https://example.com/parent",
        "--tenant-source-url=https://example.com/tenant",
        "--duplicate-radius-meters=60",
        "--lat=37.389",
        "--lng=126.951",
        "--level=parent_building_coordinate"
      ])
    ).toMatchObject({
      placeName: "브루미즈키즈카페 뉴코아아울렛 평촌점",
      parentPlaceName: "뉴코아아울렛 평촌점",
      parentSourceUrl: "https://example.com/parent",
      tenantSourceUrl: "https://example.com/tenant",
      duplicateRadiusMeters: 60,
      level: "parent_building_coordinate"
    });
  });
});
