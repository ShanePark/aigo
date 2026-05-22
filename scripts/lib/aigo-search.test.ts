import { describe, expect, it } from "vitest";

import { normalizeSearchResponse, readSearchItems } from "./aigo-search";

describe("AiGo search helper", () => {
  it("reads current top-level items", () => {
    const items = readSearchItems({ items: [{ id: "place-1" }], meta: { count: 1 } });

    expect(items).toEqual([{ id: "place-1" }]);
  });

  it("prefers current items over legacy results", () => {
    const response = normalizeSearchResponse({
      items: [{ id: "current" }],
      results: [{ id: "legacy" }],
      meta: { count: 1 }
    });

    expect(response.items).toEqual([{ id: "current" }]);
    expect(response.meta).toEqual({ count: 1 });
  });

  it("accepts legacy results only when items is absent", () => {
    const items = readSearchItems({ results: [{ id: "legacy" }] });

    expect(items).toEqual([{ id: "legacy" }]);
  });

  it("throws when items is present but not an array", () => {
    expect(() => readSearchItems({ items: null, results: [] })).toThrow(/items.*not an array/);
  });
});
