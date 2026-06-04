import { describe, expect, it } from "vitest";

import { evaluateSmokeResponse, parseArgs } from "./smoke-retire-duplicate-route";

describe("retire duplicate route smoke", () => {
  it("parses route smoke args", () => {
    expect(parseArgs(["--api-base-url=https://example.test/", "--api-key=secret", "--timeout-ms=5000"])).toEqual({
      apiBaseUrl: "https://example.test",
      apiKey: "secret",
      timeoutMs: 5000
    });
  });

  it("accepts JSON 404 as evidence that the route is deployed", () => {
    expect(evaluateSmokeResponse("https://example.test", "/v1/places/sentinel/retire-duplicate", 404, "application/json", '{"error":"Place not found"}'))
      .toMatchObject({
        ok: true,
        status: 404
      });
  });

  it("rejects HTML 404 as an undeployed route", () => {
    expect(() =>
      evaluateSmokeResponse("https://example.test", "/v1/places/sentinel/retire-duplicate", 404, "text/html", "<!doctype html>Not found")
    ).toThrow(/not deployed/);
  });
});
