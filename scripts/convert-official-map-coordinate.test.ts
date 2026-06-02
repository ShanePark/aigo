import { describe, expect, it } from "vitest";

import { buildOfficialMapCoordinateReport, convertProjectedToWgs84, parseArgs } from "./convert-official-map-coordinate";

describe("official map coordinate converter", () => {
  it("parses projected coordinate arguments", () => {
    expect(
      parseArgs([
        "--x=1075812.5248",
        "--y=1785404.349",
        "--crs=EPSG:5179",
        "--label=경상북도 칠곡군 북삼읍 인평2길 2",
        "--source-url=https://library.chilgok.go.kr/cg/html.do?menu_idx=453",
        "--json"
      ])
    ).toMatchObject({
      x: 1075812.5248,
      y: 1785404.349,
      crs: "EPSG:5179",
      label: "경상북도 칠곡군 북삼읍 인평2길 2",
      sourceUrl: "https://library.chilgok.go.kr/cg/html.do?menu_idx=453",
      json: true
    });
  });

  it("converts Chilgok official EPSG:5179 map points to WGS84", () => {
    const buksam = convertProjectedToWgs84(1075812.5248, 1785404.349, "EPSG:5179");
    const seokjeok = convertProjectedToWgs84(1081861.9046, 1786779.0166, "EPSG:5179");

    expect(buksam.lat).toBeCloseTo(36.0625978, 7);
    expect(buksam.lng).toBeCloseTo(128.341825, 7);
    expect(seokjeok.lat).toBeCloseTo(36.0744995, 7);
    expect(seokjeok.lng).toBeCloseTo(128.4091328, 7);
  });

  it("builds coordinate provenance for official embedded map points", () => {
    const report = buildOfficialMapCoordinateReport({
      x: 1075812.5248,
      y: 1785404.349,
      crs: "EPSG:5179",
      label: "경상북도 칠곡군 북삼읍 인평2길 2",
      sourceUrl: "https://library.chilgok.go.kr/cg/html.do?menu_idx=453",
      sourceTitle: "칠곡군립도서관 북삼도서관 소개",
      checkedAt: "2026-06-02T15:18:00.000Z",
      json: true
    });

    expect(report.output).toMatchObject({
      coordinateSystem: "WGS84"
    });
    expect(report.output.lat).toBeCloseTo(36.0625978, 7);
    expect(report.output.lng).toBeCloseTo(128.341825, 7);
    expect(report.coordinateProvenance).toMatchObject({
      level: "official_embedded_map",
      coordinateSystem: "WGS84",
      sourceUrl: "https://library.chilgok.go.kr/cg/html.do?menu_idx=453",
      sourceTitle: "칠곡군립도서관 북삼도서관 소개",
      addressMatched: "경상북도 칠곡군 북삼읍 인평2길 2",
      confidence: "high",
      checkedAt: "2026-06-02T15:18:00.000Z",
      rawProjectedPoint: {
        x: 1075812.5248,
        y: 1785404.349,
        crs: "EPSG:5179"
      }
    });
  });
});
