import { describe, expect, it } from "vitest";

import { postPlaceView } from "@/app/places/place-view-recorder";

describe("place view recording requests", () => {
  it("posts the detail view with same-origin credentials", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    await expect(postPlaceView("22222222-2222-4222-8222-222222222222", fetcher)).resolves.toBe(true);
    expect(calls).toEqual([
      [
        "/api/places/22222222-2222-4222-8222-222222222222/views",
        {
          credentials: "same-origin",
          method: "POST"
        }
      ]
    ]);
  });

  it("treats non-OK responses as unrecorded so the client can retry later", async () => {
    const fetcher = (async () => new Response(null, { status: 401 })) as typeof fetch;

    await expect(postPlaceView("22222222-2222-4222-8222-222222222222", fetcher)).resolves.toBe(false);
  });
});
