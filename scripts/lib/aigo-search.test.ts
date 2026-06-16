import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkAigoReadOnlyApiReadiness,
  exactNameSearchReadOnly,
  isTransientAigoRouteResponse,
  normalizeSearchResponse,
  readAigoJsonReadOnly,
  readSearchItems,
  searchPlacesReadOnly,
  warmSearchRouteReadOnly
} from "./aigo-search";

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

  it("classifies Next dev route artifact responses as transient", () => {
    expect(isTransientAigoRouteResponse(500, "text/html", "<!DOCTYPE html><title>ENOENT .next/server/app/v1/places/duplicates/route.js</title>")).toBe(
      true
    );
    expect(isTransientAigoRouteResponse(404, "text/html", "<!DOCTYPE html><title>404</title>")).toBe(true);
    expect(isTransientAigoRouteResponse(404, "application/json", "{\"error\":\"not found\"}")).toBe(false);
  });

  it("retries timeout failures before reading search items", async () => {
    vi.useFakeTimers();
    const timeoutError = new Error("The operation timed out");
    timeoutError.name = "TimeoutError";
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "place-1" }], meta: { total: 1 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = searchPlacesReadOnly({ projection: "compact", limit: 1 }, { retryDelayMs: 1, timeoutMs: 25 });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.items).toEqual([{ id: "place-1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports route status and timing when a read-only request times out", async () => {
    const timeoutError = new Error("The operation timed out");
    timeoutError.name = "TimeoutError";
    const fetchMock = vi.fn().mockRejectedValue(timeoutError);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      searchPlacesReadOnly({ projection: "compact", limit: 1 }, { retries: 1, retryDelayMs: 0, timeoutMs: 5 })
    ).rejects.toThrow(/AiGo POST \/v1\/places\/search failed \(attempt=2\/2, timeoutMs=5, durationMs=\d+, status=no-response\): TimeoutError/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("blocks production read-only calls before fetch when the API key is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      searchPlacesReadOnly({ projection: "compact", limit: 1 }, { apiBaseUrl: "https://aigo.o-r.kr", apiKey: "" })
    ).rejects.toThrow(/AIGO_API_KEY is required before calling the production AiGo API/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks production read-only calls before fetch when the default development key is used", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      searchPlacesReadOnly({ projection: "compact", limit: 1 }, { apiBaseUrl: "https://aigo.o-r.kr", apiKey: "change-me" })
    ).rejects.toThrow(/default development API key cannot be used against the production AiGo API/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds credential guidance to production 401 and 403 read-only failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Missing or invalid API key" }), {
        status: 401,
        statusText: "Unauthorized",
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      searchPlacesReadOnly({ projection: "compact", limit: 1 }, { apiBaseUrl: "https://aigo.o-r.kr", apiKey: "real-looking-key", retries: 0 })
    ).rejects.toThrow(/Authorization: Bearer <AIGO_API_KEY>.*do not retry unchanged credentials in a loop/);
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

  it("prints the read-only base URL and validates a known exact-name id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], meta: { total: 0 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "place-1", name: "테스트 장소" }], meta: { total: 1 } }), { status: 200 }));
    const log = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      checkAigoReadOnlyApiReadiness({
        apiBaseUrl: "http://localhost:3010/",
        exactName: "테스트 장소",
        expectedExactNamePlaceId: "place-1",
        log
      })
    ).resolves.toEqual({ apiBaseUrl: "http://localhost:3010", exactNameMatched: true });

    expect(log).toHaveBeenCalledWith("AiGo read-only API base URL: http://localhost:3010");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"matchMode":"exactName"');
  });

  it("includes temporarily closed records in read-only exact-name lookups", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], meta: { total: 0 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await exactNameSearchReadOnly("고성공룡박물관");

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      query: "고성공룡박물관",
      matchMode: "exactName",
      includeStatuses: ["active", "temporarily_closed"],
      projection: "compact"
    });
  });

  it("fails readiness when the known exact-name id is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], meta: { total: 0 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "other-place" }], meta: { total: 1 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      checkAigoReadOnlyApiReadiness({
        exactName: "테스트 장소",
        expectedExactNamePlaceId: "place-1"
      })
    ).rejects.toThrow(/expected place place-1, got other-place/);
  });
});
