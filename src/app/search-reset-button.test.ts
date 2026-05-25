import { describe, expect, it } from "vitest";

import { saveResetMapViewToStorage } from "@/app/search-reset-map-view";

describe("search reset map view", () => {
  it("stores the reset map view at a neighborhood-scale zoom for the default search key", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };

    saveResetMapViewToStorage(storage, 36.3251234, 127.4219876);

    expect(JSON.parse(values.get("aigo:places-map-view:v4") ?? "{}")).toMatchObject({
      "36.5000,127.8000": {
        lat: 36.325123,
        lng: 127.421988,
        zoom: 12
      }
    });
  });
});
