import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlaceSaveState: vi.fn(),
  listPlaceSaveStates: vi.fn(),
  listSavedPlaces: vi.fn(),
  requireCurrentUser: vi.fn(),
  updatePlaceSaveState: vi.fn()
}));

vi.mock("@/lib/app-auth", () => ({
  requireCurrentUser: mocks.requireCurrentUser
}));

vi.mock("@/lib/user-place-saves", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/user-place-saves")>()),
  getPlaceSaveState: mocks.getPlaceSaveState,
  listPlaceSaveStates: mocks.listPlaceSaveStates,
  listSavedPlaces: mocks.listSavedPlaces,
  updatePlaceSaveState: mocks.updatePlaceSaveState
}));

import { POST as postPlaceSaveStates } from "@/app/api/places/save-states/route";
import { GET as getPlaceSave, PATCH as patchPlaceSave } from "@/app/api/places/[placeId]/saves/route";
import { GET as getSavedPlaces } from "@/app/api/saved-places/route";

const userId = "11111111-1111-4111-8111-111111111111";
const placeId = "22222222-2222-4222-8222-222222222222";
const otherPlaceId = "33333333-3333-4333-8333-333333333333";

function request(url: string, method = "GET", body?: unknown) {
  return new NextRequest(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    method
  });
}

function placeContext(id = placeId) {
  return {
    params: Promise.resolve({ placeId: id })
  } as never;
}

describe("user place save API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue({ id: userId });
  });

  it("returns the detail save state with the API heart count", async () => {
    mocks.getPlaceSaveState.mockResolvedValue({
      item: { placeId, wantToGo: true, hearted: false, heartCount: 4, updatedAt: null }
    });

    const response = await getPlaceSave(request("http://localhost/api/places/test/saves"), placeContext());

    expect(response.status).toBe(200);
    expect(mocks.getPlaceSaveState).toHaveBeenCalledWith(placeId, userId);
    await expect(response.json()).resolves.toEqual({
      item: { placeId, wantToGo: true, hearted: false, heartCount: 4, updatedAt: null }
    });
  });

  it("updates only the requested save flag so want-to-go and heart can stay independent", async () => {
    mocks.updatePlaceSaveState.mockResolvedValue({
      item: { placeId, wantToGo: true, hearted: true, heartCount: 7, updatedAt: "2026-05-25T10:00:00.000Z" }
    });

    const response = await patchPlaceSave(request("http://localhost/api/places/test/saves", "PATCH", { wantToGo: true }), placeContext());

    expect(response.status).toBe(200);
    expect(mocks.updatePlaceSaveState).toHaveBeenCalledWith(placeId, userId, { wantToGo: true });
    await expect(response.json()).resolves.toMatchObject({
      item: { placeId, wantToGo: true, hearted: true, heartCount: 7 }
    });
  });

  it("returns batched search-card save states for the requested places", async () => {
    const items = [
      { placeId, wantToGo: true, hearted: false, heartCount: 2, updatedAt: null },
      { placeId: otherPlaceId, wantToGo: false, hearted: true, heartCount: 5, updatedAt: null }
    ];
    mocks.listPlaceSaveStates.mockResolvedValue({ items });

    const response = await postPlaceSaveStates(
      request("http://localhost/api/places/save-states", "POST", {
        placeIds: [placeId, otherPlaceId]
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.listPlaceSaveStates).toHaveBeenCalledWith([placeId, otherPlaceId], userId);
    await expect(response.json()).resolves.toEqual({ items });
  });

  it("passes saved-place filters through to the listing query", async () => {
    mocks.listSavedPlaces.mockResolvedValue({
      items: [{ placeId, wantToGo: false, hearted: true, heartCount: 3, placeName: "하트 장소" }]
    });

    const response = await getSavedPlaces(request("http://localhost/api/saved-places?filter=hearted"));

    expect(response.status).toBe(200);
    expect(mocks.listSavedPlaces).toHaveBeenCalledWith(userId, "hearted");
    await expect(response.json()).resolves.toMatchObject({
      items: [{ placeId, hearted: true }]
    });
  });
});
