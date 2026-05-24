import { describe, expect, it, vi } from "vitest";

import { buildReport, checkSourcePage, formatSourcePageCheckReport, parseArgs } from "./check-source-page";

describe("source page checker", () => {
  it("parses a source URL and optional checklist", () => {
    const args = parseArgs([
      "--url=https://example.com/place",
      "--timeout-ms=1000",
      "--checklist=address,image,nursing room",
      "--json"
    ]);

    expect(args.url).toBe("https://example.com/place");
    expect(args.timeoutMs).toBe(1000);
    expect(args.checklist).toEqual(["address", "image", "nursing room"]);
    expect(args.json).toBe(true);
  });

  it("accepts a static HTML source page as CLI-readable", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response("<html><body><h1>Place</h1><p>Address, opening hours, nursing room, and parking details.</p></body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    });

    const report = await checkSourcePage({ url: "https://example.com/place", json: true, timeoutMs: 1_000, checklist: ["address"] }, fetchMock);

    expect(report.ok).toBe(true);
    expect(report.recommendation).toBe("use_cli_source");
    expect(report.manualReview).toBeNull();
    expect(report.reasonCodes).toEqual([]);
  });

  it("flags 406 official pages for manual Browser review", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response("<html><body>Not acceptable</body></html>", {
        status: 406,
        headers: { "content-type": "text/html" }
      });
    });

    const report = await checkSourcePage({ url: "https://playaquarium.co.kr", json: true, timeoutMs: 1_000, checklist: ["address", "image"] }, fetchMock);

    expect(report.ok).toBe(false);
    expect(report.reasonCodes).toContain("HTTP_406_NOT_ACCEPTABLE");
    expect(report.recommendation).toBe("manual_review");
    expect(report.manualReview?.tool).toBe("browser_or_manual_source");
    expect(report.manualReview?.checklist).toEqual(["address", "image"]);
  });

  it("flags TLS and certificate failures for manual review", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("self signed certificate in certificate chain");
    });

    const report = await checkSourcePage({ url: "https://bcfoodsafety.or.kr", json: true, timeoutMs: 1_000, checklist: ["operation"] }, fetchMock);

    expect(report.ok).toBe(false);
    expect(report.reasonCodes).toContain("TLS_OR_CERT_FAILURE");
    expect(report.recommendation).toBe("manual_review");
  });

  it("flags dynamic app shells that expose almost no visible source text", async () => {
    const html = `
      <html>
        <body>
          <div id="root"></div>
          <script src="/assets/a.js"></script>
          <script src="/assets/b.js"></script>
          <script src="/assets/c.js"></script>
          <script src="/assets/d.js"></script>
          <script src="/assets/e.js"></script>
        </body>
      </html>
    `;
    const fetchMock = vi.fn(async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }));

    const report = await checkSourcePage({ url: "https://example.com/app", json: true, timeoutMs: 1_000, checklist: ["address"] }, fetchMock);

    expect(report.ok).toBe(false);
    expect(report.reasonCodes).toContain("DYNAMIC_APP_SHELL");
    expect(report.manualReview?.checklist).toContain("address");
  });

  it("formats the manual checklist for research handoff", () => {
    const report = buildReport(
      { url: "https://example.com/app", checklist: ["address", "nursing room"] },
      [
        {
          method: "GET",
          status: 200,
          ok: true,
          contentType: "text/html",
          finalUrl: "https://example.com/app",
          textLength: 0,
          dynamicReason: "DYNAMIC_APP_SHELL"
        }
      ]
    );

    expect(formatSourcePageCheckReport(report)).toContain("Manual source checklist:");
    expect(formatSourcePageCheckReport(report)).toContain("- nursing room");
  });
});
