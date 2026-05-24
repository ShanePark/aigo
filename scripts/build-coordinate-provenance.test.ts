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
});
