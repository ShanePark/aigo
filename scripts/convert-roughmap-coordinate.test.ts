import { describe, expect, it, vi } from "vitest";

import { buildRoughmapCoordinateReport, convertWcongnamulToWgs84, parseArgs } from "./convert-roughmap-coordinate";

describe("roughmap coordinate converter", () => {
  it("parses roughmap URL and manual coordinate arguments", () => {
    expect(parseArgs(["--url=https://t1.kakaocdn.net/roughmap/2aux9.json", "--json"])).toMatchObject({
      url: "https://t1.kakaocdn.net/roughmap/2aux9.json",
      json: true
    });

    expect(parseArgs(["--x=882319.0", "--y=654581.0", "--label=대구 수성구 시지로 11"])).toMatchObject({
      x: 882319,
      y: 654581,
      label: "대구 수성구 시지로 11",
      json: false
    });
  });

  it("converts the Suseong roughmap WCONGNAMUL regression example to WGS84", () => {
    const coordinate = convertWcongnamulToWgs84(882319.0, 654581.0);

    expect(coordinate.lat).toBeCloseTo(35.84473798085345, 12);
    expect(coordinate.lng).toBeCloseTo(128.69351384347198, 12);
  });

  it("extracts WCONGNAMUL coordinates from a roughmap callback payload", async () => {
    const encoded = encodeURIComponent(
      JSON.stringify({
        name: "대구 수성구 시지로 11",
        placeX: "882319.0",
        placeY: "654581.0",
        markerData: {
          label: "대구 수성구 시지로 11",
          x: "882319.0",
          y: "654581.0"
        }
      })
    );
    const fetchMock = vi.fn(async () => new Response(`daum.roughmap.onDataLoad("${encoded}");`, { status: 200 }));

    const report = await buildRoughmapCoordinateReport(
      {
        url: "https://t1.kakaocdn.net/roughmap/2aux9.json",
        json: true,
        checkedAt: "2026-06-02T00:00:00.000Z"
      },
      fetchMock
    );

    expect(report.input).toMatchObject({
      coordinateSystem: "WCONGNAMUL",
      x: 882319,
      y: 654581,
      label: "대구 수성구 시지로 11"
    });
    expect(report.output.lat).toBeCloseTo(35.84473798085345, 12);
    expect(report.output.lng).toBeCloseTo(128.69351384347198, 12);
    expect(report.coordinateProvenance).toMatchObject({
      level: "official_embedded_map",
      coordinateSystem: "WGS84",
      sourceUrl: "https://t1.kakaocdn.net/roughmap/2aux9.json",
      addressMatched: "대구 수성구 시지로 11",
      checkedAt: "2026-06-02T00:00:00.000Z"
    });
  });
});
