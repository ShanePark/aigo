import { describe, expect, it } from "vitest";

import { safePlaceReturnHref } from "@/app/places/place-return-to";

describe("place detail return href", () => {
  it("preserves safe list views with query state", () => {
    expect(safePlaceReturnHref("/regions?region=seoul")).toBe("/regions?region=seoul");
    expect(safePlaceReturnHref("/saved-places?filter=wantToGo")).toBe("/saved-places?filter=wantToGo");
    expect(safePlaceReturnHref("/recent-places")).toBe("/recent-places");
    expect(safePlaceReturnHref("/visits")).toBe("/visits");
  });

  it("keeps search params for the main search page", () => {
    expect(safePlaceReturnHref("/?query=%EC%84%9C%EC%9A%B8")).toBe("/?query=%EC%84%9C%EC%9A%B8");
  });

  it("falls back to the main page for external or unsupported paths", () => {
    expect(safePlaceReturnHref("https://example.com/regions")).toBe("/");
    expect(safePlaceReturnHref("//example.com/regions")).toBe("/");
    expect(safePlaceReturnHref("/api/places")).toBe("/");
    expect(safePlaceReturnHref("/login?next=/regions")).toBe("/");
    expect(safePlaceReturnHref(undefined)).toBe("/");
  });
});
