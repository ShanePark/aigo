import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeSearchResponse, readAigoJsonReadOnly, readSearchItems, searchPlacesReadOnly, warmSearchRouteReadOnly } from "./aigo-search";

describe("AiGo search helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

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

  it("retries transient Next.js 404 HTML before reading search items", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("<!DOCTYPE html><title>404</title>", { status: 404, headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "place-1" }], meta: { total: 1 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = searchPlacesReadOnly({ projection: "compact", limit: 1 }, { retryDelayMs: 1 });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.items).toEqual([{ id: "place-1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient Next.js HTML failures for generic read-only routes", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<!DOCTYPE html><title>ENOENT .next/server/app/v1/places/route.js</title>", {
          status: 500,
          headers: { "content-type": "text/html" }
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "version-1" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = readAigoJsonReadOnly<{ items: Array<{ id: string }> }>("/v1/places/place-1/versions", { retryDelayMs: 1 });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.items).toEqual([{ id: "version-1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/v1/places/place-1/versions");
  });

  it("warms the search route with a compact one-row request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], meta: { total: 0 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await warmSearchRouteReadOnly();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      projection: "compact",
      limit: 1,
      offset: 0
    });
  });
});
