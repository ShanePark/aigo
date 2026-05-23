import { afterEach, describe, expect, it, vi } from "vitest";

import { buildReport, imageCandidateLabels, parseArgs, probeImageCandidate } from "./check-image-candidate";

describe("image candidate helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("holds a known shared placeholder image by URL pattern and size", () => {
    const report = buildReport(
      { url: "https://example.com/rest_main_photo.jpg?rest=12345", sourceUrl: "https://example.com/place", title: "Restaurant" },
      [
        {
          method: "HEAD",
          status: 200,
          ok: true,
          contentType: "image/jpeg",
          contentLength: 11_024,
          finalUrl: "https://example.com/rest_main_photo.jpg?rest=12345",
          usedReferer: false
        }
      ]
    );

    expect(report.labels).toContain("known_placeholder_image");
    expect(report.labels).toContain("diningcode_rest_main_photo_placeholder");
    expect(report.visualRisk).toBe("high");
    expect(report.recommendation).toBe("hold");
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

  it("accepts ranged image GET after a failed HEAD probe", () => {
    const report = buildReport(
      { url: "https://example.com/fileImage.do", sourceUrl: "https://example.com/place", title: "Place" },
      [
        {
          method: "HEAD",
          status: 405,
          ok: false,
          contentType: "text/html",
          contentLength: null,
          finalUrl: "https://example.com/fileImage.do",
          usedReferer: false
        },
        {
          method: "GET_RANGE",
          status: 206,
          ok: true,
          contentType: "image/jpeg",
          contentLength: 64,
          finalUrl: "https://example.com/fileImage.do",
          usedReferer: false
        }
      ]
    );

    expect(report.status).toBe(206);
    expect(report.hotlinkRisk).toBe("low");
    expect(report.recommendation).toBe("use");
  });

  it("falls back from HEAD to ranged GET and full GET", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 405, headers: { "content-type": "text/html" } });
      }

      if (new Headers(init?.headers).has("range")) {
        return new Response(null, { status: 200, headers: { "content-type": "text/html" } });
      }

      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png", "content-length": "3" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await probeImageCandidate({
      url: "https://example.com/no-range-support",
      urls: [],
      json: true,
      timeoutMs: 1_000
    });

    expect(report.ok).toBe(true);
    expect(report.contentType).toBe("image/png");
    expect(report.attempts.map((attempt) => attempt.method)).toEqual(["HEAD", "GET_RANGE", "GET"]);
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({ range: "bytes=0-63" });
  });

  it("sniffs image bytes when the server declares a non-image content type", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 200, headers: { "content-type": "application/octer-stream" } });
      }

      return new Response(pngBytes, { status: 206, headers: { "content-type": "application/octer-stream", "content-length": String(pngBytes.byteLength) } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await probeImageCandidate({
      url: "https://example.com/file/download?id=123",
      urls: [],
      json: true,
      timeoutMs: 1_000
    });

    expect(report.ok).toBe(true);
    expect(report.contentType).toBe("image/png");
    expect(report.labels).toContain("image_content_type_sniffed");
    expect(report.recommendation).toBe("use");
    expect(report.attempts.map((attempt) => attempt.method)).toEqual(["HEAD", "GET_RANGE"]);
  });

  it("downloads a suspicious known placeholder URL when range metadata cannot prove it", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 405, headers: { "content-type": "text/html" } });
      }

      if (new Headers(init?.headers).has("range")) {
        return new Response(new Uint8Array(64), { status: 206, headers: { "content-type": "image/jpeg", "content-length": "64" } });
      }

      return new Response(new Uint8Array(11_024), { status: 200, headers: { "content-type": "image/jpeg", "content-length": "11024" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await probeImageCandidate({
      url: "https://example.com/rest_main_photo.jpg?rest=12345",
      urls: [],
      json: true,
      timeoutMs: 1_000
    });

    expect(report.labels).toContain("known_placeholder_image");
    expect(report.fullContentLength).toBe(11_024);
    expect(report.recommendation).toBe("hold");
    expect(report.attempts.map((attempt) => attempt.method)).toEqual(["HEAD", "GET_RANGE", "GET"]);
  });
});
