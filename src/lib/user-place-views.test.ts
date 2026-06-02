import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/errors";
import { listRecentPlaces, placeViewStateFromRow, recentPlacesLimitSchema, recordPlaceView, recordPublicPlaceView } from "@/lib/user-place-views";

type QueryResponse = Array<Record<string, unknown>>;

const userId = "11111111-1111-4111-8111-111111111111";
const placeId = "22222222-2222-4222-8222-222222222222";

function fakeExecutor(responses: QueryResponse[]) {
  const calls: string[] = [];
  const executor = (async (strings: TemplateStringsArray) => {
    calls.push(strings.join("?").replace(/\s+/g, " ").trim());
    return responses.shift() ?? [];
  }) as never;

  return { calls, executor };
}

describe("recent place view schemas", () => {
  it("limits list size to a small bounded range", () => {
    expect(recentPlacesLimitSchema.parse(undefined)).toBe(30);
    expect(recentPlacesLimitSchema.parse("12")).toBe(12);
    expect(() => recentPlacesLimitSchema.parse(0)).toThrow();
    expect(() => recentPlacesLimitSchema.parse(101)).toThrow();
  });
});

describe("recent place view recording", () => {
  it("upserts a place view and increments the existing count", async () => {
    const { calls, executor } = fakeExecutor([
      [{ id: placeId }],
      [{ placeId, lastViewedAt: new Date("2026-05-25T04:00:00.000Z"), viewCount: 3 }]
    ]);

    await expect(recordPlaceView(placeId, userId, executor)).resolves.toEqual({
      item: {
        placeId,
        lastViewedAt: "2026-05-25T04:00:00.000Z",
        viewCount: 3
      }
    });
    expect(calls[0]).toContain("and status = 'active'");
    expect(calls[1]).toContain("insert into user_place_views");
    expect(calls[1]).toContain("on conflict (user_id, place_id)");
    expect(calls[1]).toContain("view_count = user_place_views.view_count + 1");
  });

  it("rejects missing or inactive places", async () => {
    const { executor } = fakeExecutor([[]]);

    await expect(recordPlaceView(placeId, userId, executor)).rejects.toMatchObject({
      status: 404
    } satisfies Partial<ApiError>);
  });
});

describe("public place view recording", () => {
  it("increments the public count only when all dedupe keys are countable", async () => {
    const { calls, executor } = fakeExecutor([
      [{ id: placeId }],
      [{ upsertedCount: 2 }],
      [{ publicViewCount: 12 }]
    ]);

    await expect(
      recordPublicPlaceView(
        placeId,
        [
          { kind: "device", value: "device-1" },
          { kind: "ip", value: "203.0.113.1" }
        ],
        executor
      )
    ).resolves.toEqual({
      item: {
        counted: true,
        placeId,
        publicViewCount: 12
      }
    });

    expect(calls[1]).toContain("insert into place_view_dedupes");
    expect(calls[1]).toContain("where place_view_dedupes.expires_at <= now()");
    expect(calls[2]).toContain("public_view_count = public_view_count + 1");
  });

  it("does not increment when a dedupe key is still inside the server window", async () => {
    const { calls, executor } = fakeExecutor([
      [{ id: placeId }],
      [{ upsertedCount: 1 }],
      [{ publicViewCount: 12 }]
    ]);

    await expect(
      recordPublicPlaceView(
        placeId,
        [
          { kind: "device", value: "device-1" },
          { kind: "ip", value: "203.0.113.1" }
        ],
        executor
      )
    ).resolves.toEqual({
      item: {
        counted: false,
        placeId,
        publicViewCount: 12
      }
    });

    expect(calls[2]).toContain("select public_view_count");
    expect(calls.join(" ")).not.toContain("public_view_count = public_view_count + 1");
  });
});

describe("recent place listing", () => {
  it("lists active places by latest view with representative image", async () => {
    const { calls, executor } = fakeExecutor([
      [
        {
          placeId,
          lastViewedAt: new Date("2026-05-25T05:00:00.000Z"),
          viewCount: "4",
          placeName: "아이랑 공원",
          primaryCategory: "park",
          imageUrl: "https://example.test/park.jpg",
          regionSido: "대전",
          regionSigungu: "중구"
        }
      ]
    ]);

    await expect(listRecentPlaces(userId, 10, executor)).resolves.toMatchObject({
      items: [
        {
          placeId,
          lastViewedAt: "2026-05-25T05:00:00.000Z",
          viewCount: 4,
          placeName: "아이랑 공원",
          primaryCategory: "park",
          imageUrl: "https://example.test/park.jpg",
          regionSido: "대전",
          regionSigungu: "중구"
        }
      ]
    });
    expect(calls[0]).toContain("from user_place_views v");
    expect(calls[0]).toContain("and p.status = 'active'");
    expect(calls[0]).toContain("order by v.last_viewed_at desc");
    expect(calls[0]).toContain("limit ?");
  });
});

describe("place view state formatting", () => {
  it("normalizes database values", () => {
    expect(placeViewStateFromRow({ placeId, lastViewedAt: "2026-05-25T06:00:00.000Z", viewCount: "7" })).toEqual({
      placeId,
      lastViewedAt: "2026-05-25T06:00:00.000Z",
      viewCount: 7
    });
  });
});
