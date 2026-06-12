import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deletePlace: vi.fn(),
  getPlaceDetail: vi.fn(),
  getPlaceVersion: vi.fn(),
  listPlaceVersions: vi.fn(),
  requireApiKey: vi.fn(),
  retireDuplicatePlace: vi.fn(),
  updatePlace: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  requireApiKey: mocks.requireApiKey
}));

vi.mock("@/lib/places", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/places")>()),
  deletePlace: mocks.deletePlace,
  getPlaceDetail: mocks.getPlaceDetail,
  getPlaceVersion: mocks.getPlaceVersion,
  listPlaceVersions: mocks.listPlaceVersions,
  retireDuplicatePlace: mocks.retireDuplicatePlace,
  updatePlace: mocks.updatePlace
}));

import { DELETE as deletePlace, GET as getPlace, PATCH as patchPlace } from "@/app/v1/places/[placeId]/route";
import { POST as postRetireDuplicate } from "@/app/v1/places/[placeId]/retire-duplicate/route";
import { GET as getPlaceVersion } from "@/app/v1/places/[placeId]/versions/[versionId]/route";
import { GET as getPlaceVersions } from "@/app/v1/places/[placeId]/versions/route";

function request(method = "GET") {
  return new NextRequest("http://localhost/v1/places/not-a-uuid", {
    headers: {
      authorization: "Bearer test-key"
    },
    method
  });
}

function context(params: Record<string, string>) {
  return {
    params: Promise.resolve(params)
  } as never;
}

describe("v1 place route params", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["GET place detail", () => getPlace(request(), context({ placeId: "not-a-uuid" }))],
    ["PATCH place", () => patchPlace(request("PATCH"), context({ placeId: "not-a-uuid" }))],
    ["DELETE place", () => deletePlace(request("DELETE"), context({ placeId: "not-a-uuid" }))],
    ["GET place versions", () => getPlaceVersions(request(), context({ placeId: "not-a-uuid" }))],
    ["GET place version", () => getPlaceVersion(request(), context({ placeId: "not-a-uuid", versionId: "11111111-1111-4111-8111-111111111111" }))],
    ["POST retire duplicate", () => postRetireDuplicate(request("POST"), context({ placeId: "not-a-uuid" }))]
  ])("%s rejects malformed placeId before handler work", async (_label, routeCall) => {
    const response = await routeCall();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "placeId must be a valid UUID"
    });
    expect(mocks.getPlaceDetail).not.toHaveBeenCalled();
    expect(mocks.updatePlace).not.toHaveBeenCalled();
    expect(mocks.deletePlace).not.toHaveBeenCalled();
    expect(mocks.listPlaceVersions).not.toHaveBeenCalled();
    expect(mocks.getPlaceVersion).not.toHaveBeenCalled();
    expect(mocks.retireDuplicatePlace).not.toHaveBeenCalled();
  });

  it("rejects malformed versionId before reading a place version", async () => {
    const response = await getPlaceVersion(
      request(),
      context({
        placeId: "11111111-1111-4111-8111-111111111111",
        versionId: "not-a-uuid"
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "versionId must be a valid UUID"
    });
    expect(mocks.getPlaceVersion).not.toHaveBeenCalled();
  });
});
