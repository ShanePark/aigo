import { afterEach, describe, expect, it } from "vitest";

import { checkPublicReadRateLimit, resetPublicReadRateLimitForTests } from "@/lib/public-rate-limit";

function headers(ip = "203.0.113.20") {
  return new Headers({
    "user-agent": "Mozilla/5.0 Rate Limit Test",
    "x-forwarded-for": ip
  });
}

describe("public read rate limiting", () => {
  afterEach(() => {
    resetPublicReadRateLimitForTests();
  });

  it("blocks repeated public reads per bucket and client", () => {
    expect(checkPublicReadRateLimit({ bucket: "place-search", headers: headers(), limit: 2, now: 1_000 })).toMatchObject({
      allowed: true,
      remaining: 1
    });
    expect(checkPublicReadRateLimit({ bucket: "place-search", headers: headers(), limit: 2, now: 1_100 })).toMatchObject({
      allowed: true,
      remaining: 0
    });
    expect(checkPublicReadRateLimit({ bucket: "place-search", headers: headers(), limit: 2, now: 1_200 })).toMatchObject({
      allowed: false,
      retryAfterSeconds: 60
    });
  });

  it("keeps API-style and page-style buckets separate", () => {
    expect(checkPublicReadRateLimit({ bucket: "place-search", headers: headers(), limit: 1, now: 1_000 })).toMatchObject({
      allowed: true
    });
    expect(checkPublicReadRateLimit({ bucket: "place-detail", headers: headers(), limit: 1, now: 1_100 })).toMatchObject({
      allowed: true
    });
  });
});
