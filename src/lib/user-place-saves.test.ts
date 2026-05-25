import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/errors";
import {
  getPlaceSaveState,
  listPlaceSaveStates,
  listSavedPlaces,
  placeSaveStateFromRow,
  placeSaveStatesRequestSchema,
  savedPlacesFilterSchema,
  updatePlaceSaveSchema,
  updatePlaceSaveState
} from "@/lib/user-place-saves";

type QueryResponse = Array<Record<string, unknown>>;

const userId = "11111111-1111-4111-8111-111111111111";
const placeId = "22222222-2222-4222-8222-222222222222";
const otherPlaceId = "33333333-3333-4333-8333-333333333333";

function fakeExecutor(responses: QueryResponse[]) {
  const calls: string[] = [];
  const executor = (async (strings: TemplateStringsArray) => {
    calls.push(strings.join("?").replace(/\s+/g, " ").trim());
    return responses.shift() ?? [];
  }) as never;

  return { calls, executor };
}

describe("user place save schemas", () => {
  it("accepts independent save states and filters", () => {
    expect(updatePlaceSaveSchema.parse({ wantToGo: true })).toEqual({ wantToGo: true });
    expect(updatePlaceSaveSchema.parse({ hearted: false })).toEqual({ hearted: false });
    expect(placeSaveStatesRequestSchema.parse({ placeIds: [placeId] })).toEqual({ placeIds: [placeId] });
    expect(savedPlacesFilterSchema.parse(undefined)).toBe("all");
    expect(savedPlacesFilterSchema.parse("hearted")).toBe("hearted");
    expect(() => updatePlaceSaveSchema.parse({})).toThrow("At least one save state is required");
    expect(() => placeSaveStatesRequestSchema.parse({ placeIds: [] })).toThrow();
    expect(() => savedPlacesFilterSchema.parse("planned")).toThrow();
  });
});

describe("user place save state", () => {
  it("returns the current user state with aggregate heart count", async () => {
    const { calls, executor } = fakeExecutor([
      [{ id: placeId }],
      [{ placeId, wantToGo: true, hearted: false, heartCount: 3, updatedAt: new Date("2026-05-25T01:00:00.000Z") }]
    ]);

    await expect(getPlaceSaveState(placeId, userId, executor)).resolves.toEqual({
      item: {
        placeId,
        wantToGo: true,
        hearted: false,
        heartCount: 3,
        updatedAt: "2026-05-25T01:00:00.000Z"
      }
    });
    expect(calls[1]).toContain("with heart_count as");
    expect(calls[1]).toContain("left join user_place_saves s");
  });

  it("uses an empty state when the user has not saved the place", () => {
    expect(placeSaveStateFromRow({ placeId, wantToGo: false, hearted: false, heartCount: "2", updatedAt: null }, placeId)).toEqual({
      placeId,
      wantToGo: false,
      hearted: false,
      heartCount: 2,
      updatedAt: null
    });
  });

  it("lists multiple requested place states in request order without duplicate rows", async () => {
    const { calls, executor } = fakeExecutor([
      [
        { placeId, wantToGo: true, hearted: false, heartCount: "2", updatedAt: new Date("2026-05-25T04:00:00.000Z") },
        { placeId: otherPlaceId, wantToGo: false, hearted: true, heartCount: 5, updatedAt: null }
      ]
    ]);

    await expect(listPlaceSaveStates([placeId, otherPlaceId, placeId], userId, executor)).resolves.toEqual({
      items: [
        {
          placeId,
          wantToGo: true,
          hearted: false,
          heartCount: 2,
          updatedAt: "2026-05-25T04:00:00.000Z"
        },
        {
          placeId: otherPlaceId,
          wantToGo: false,
          hearted: true,
          heartCount: 5,
          updatedAt: null
        }
      ]
    });
    expect(calls[0]).toContain("with requested as");
    expect(calls[0]).toContain("left join user_place_saves s");
    expect(calls[0]).toContain("left join heart_counts h");
  });

  it("rejects unknown places", async () => {
    const { executor } = fakeExecutor([[]]);

    await expect(getPlaceSaveState(placeId, userId, executor)).rejects.toMatchObject({
      status: 404
    } satisfies Partial<ApiError>);
  });
});

describe("user place save mutation", () => {
  it("upserts want-to-go and heart independently", async () => {
    const { calls, executor } = fakeExecutor([
      [{ id: placeId }],
      [{ wantToGo: false, hearted: true }],
      [],
      [{ placeId, wantToGo: true, hearted: true, heartCount: 4, updatedAt: new Date("2026-05-25T02:00:00.000Z") }]
    ]);

    await expect(updatePlaceSaveState(placeId, userId, { wantToGo: true }, executor)).resolves.toMatchObject({
      item: {
        wantToGo: true,
        hearted: true,
        heartCount: 4
      }
    });
    expect(calls[2]).toContain("on conflict (user_id, place_id)");
    expect(calls[2]).toContain("want_to_go = excluded.want_to_go");
    expect(calls[2]).toContain("hearted = excluded.hearted");
  });

  it("deletes the row when both states are false", async () => {
    const { calls, executor } = fakeExecutor([
      [{ id: placeId }],
      [{ wantToGo: false, hearted: true }],
      [],
      [{ placeId, wantToGo: false, hearted: false, heartCount: 0, updatedAt: null }]
    ]);

    await expect(updatePlaceSaveState(placeId, userId, { hearted: false }, executor)).resolves.toMatchObject({
      item: {
        wantToGo: false,
        hearted: false,
        heartCount: 0
      }
    });
    expect(calls[2]).toContain("delete from user_place_saves");
  });
});

describe("saved place listing", () => {
  it("lists saved places with status filters and heart counts", async () => {
    const { calls, executor } = fakeExecutor([
      [
        {
          placeId,
          wantToGo: true,
          hearted: true,
          heartCount: 8,
          updatedAt: new Date("2026-05-25T03:00:00.000Z"),
          placeName: "아이랑 공원",
          primaryCategory: "park",
          imageUrl: "https://example.test/park.jpg",
          regionSido: "대전",
          regionSigungu: "중구"
        }
      ]
    ]);

    await expect(listSavedPlaces(userId, "hearted", executor)).resolves.toMatchObject({
      items: [
        {
          placeId,
          wantToGo: true,
          hearted: true,
          heartCount: 8,
          placeName: "아이랑 공원",
          primaryCategory: "park",
          imageUrl: "https://example.test/park.jpg"
        }
      ]
    });
    expect(calls[0]).toContain("where s.user_id = ?");
    expect(calls[0]).toContain("? = 'hearted' and s.hearted");
    expect(calls[0]).toContain("order by s.updated_at desc");
  });
});
