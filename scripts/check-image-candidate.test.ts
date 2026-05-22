import { describe, expect, it } from "vitest";

import { buildReport, imageCandidateLabels, parseArgs } from "./check-image-candidate";

describe("image candidate helper", () => {
  it("parses repeated candidate urls", () => {
    const args = parseArgs([
      "--url=https://example.com/a.jpg",
      "--url=https://example.com/b.png",
      "--source-url=https://example.com/page",
      "--title=Example",
      "--json"
    ]);

    expect(args.urls).toEqual(["https://example.com/a.jpg", "https://example.com/b.png"]);
    expect(args.sourceUrl).toBe("https://example.com/page");
    expect(args.title).toBe("Example");
    expect(args.json).toBe(true);
  });

  it("holds data URLs because AiGo stores remote image URLs only", () => {
    const report = buildReport({ url: "data:image/png;base64,iVBORw0KGgo=", title: "유아휴게실" }, []);

    expect(report.isRemoteHttpUrl).toBe(false);
    expect(report.contentType).toBe("image/png");
    expect(report.labels).toContain("data_url_not_remote");
    expect(report.recommendation).toBe("hold");
  });

  it("flags likely logos and generic placeholders", () => {
    expect(imageCandidateLabels("https://example.com/logo.png", undefined, "image/png")).toContain("logo_or_icon_risk");
    expect(imageCandidateLabels("https://example.com/default-thumbnail.jpg", undefined, "image/jpeg")).toContain("generic_or_placeholder_risk");
  });

  it("uses a clean image response when it is remote and image typed", () => {
    const report = buildReport(
      { url: "https://example.com/place.jpg", sourceUrl: "https://example.com/place", title: "Place hero" },
      [
        {
          method: "HEAD",
          status: 200,
          ok: true,
          contentType: "image/jpeg",
          contentLength: 12345,
          finalUrl: "https://example.com/place.jpg",
          usedReferer: false
        }
      ]
    );

    expect(report.hotlinkRisk).toBe("low");
    expect(report.visualRisk).toBe("low");
    expect(report.recommendation).toBe("use");
  });

  it("raises hotlink risk when a referer was required", () => {
    const report = buildReport(
      { url: "https://example.com/fileImage.do", sourceUrl: "https://example.com/place", title: "Place" },
      [
        {
          method: "GET_RANGE",
          status: 200,
          ok: true,
          contentType: "image/jpeg",
          contentLength: 12345,
          finalUrl: "https://example.com/fileImage.do",
          usedReferer: true
        }
      ]
    );

    expect(report.hotlinkRisk).toBe("high");
    expect(report.recommendation).toBe("hold");
  });
});
