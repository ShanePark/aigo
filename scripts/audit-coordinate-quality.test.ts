import { describe, expect, it } from "vitest";

import {
  coordinateAuditWarnings,
  coordinateDistanceMeters,
  isUsableCoordinateSourceUrl,
  parseArgs,
  parseOfficialCoordinateSpec
} from "./audit-coordinate-quality";

describe("coordinate quality audit", () => {
  it("parses official coordinate candidate specs", () => {
    expect(
      parseOfficialCoordinateSpec("옥토끼어린이공원|36.323|127.454|https://www.donggu.go.kr/parks|대전 동구 공원 목록")
    ).toEqual({
      name: "옥토끼어린이공원",
      lat: 36.323,
      lng: 127.454,
      sourceUrl: "https://www.donggu.go.kr/parks",
      sourceTitle: "대전 동구 공원 목록"
    });
  });

  it("rejects malformed candidate specs", () => {
    expect(() => parseOfficialCoordinateSpec("옥토끼어린이공원|36.323|127.454")).toThrow(/candidate/);
  });

  it("parses CLI options with multiple candidates", () => {
    const args = parseArgs([
      "--skip-healthcheck",
      "--json",
      "--threshold-meters=250",
      "--candidate=옥토끼어린이공원|36.323|127.454|https://example.test/park|공원 목록",
      "--candidate=도리공원|36.31|127.44|https://example.test/dori"
    ]);

    expect(args.skipHealthcheck).toBe(true);
    expect(args.json).toBe(true);
    expect(args.thresholdMeters).toBe(250);
    expect(args.candidates.map((candidate) => candidate.name)).toEqual(["옥토끼어린이공원", "도리공원"]);
  });

  it("excludes Kakao itemId links that do not expose coordinate params", () => {
    expect(isUsableCoordinateSourceUrl("https://map.kakao.com/link/map/123456")).toBe(false);
    expect(isUsableCoordinateSourceUrl("https://map.kakao.com/link/to/123456")).toBe(false);
    expect(isUsableCoordinateSourceUrl("https://map.kakao.com/?urlX=127.454&urlY=36.323")).toBe(true);
    expect(isUsableCoordinateSourceUrl("https://www.donggu.go.kr/park-list")).toBe(true);
  });

  it("calculates meter-level coordinate differences", () => {
    expect(coordinateDistanceMeters({ lat: 36.323, lng: 127.454 }, { lat: 36.323, lng: 127.454 })).toBe(0);
    expect(coordinateDistanceMeters({ lat: 36.323, lng: 127.454 }, { lat: 36.324, lng: 127.454 })).toBeGreaterThan(100);
  });

  it("summarizes low-trust provenance and distance warnings", () => {
    expect(
      coordinateAuditWarnings({
        coordinateSourceUsable: false,
        coordinateProvenanceLevel: "public_dataset_centroid",
        distanceMeters: 420,
        thresholdMeters: 100
      })
    ).toEqual(["coordinate_source_unusable", "low_trust_existing_provenance", "coordinate_distance_exceeds_threshold"]);
  });
});
