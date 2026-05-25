import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as getPlaceVisits, POST as postPlaceVisit } from "@/app/api/places/[placeId]/visits/route";
import { DELETE as deleteVisitPhoto, GET as getVisitPhoto } from "@/app/api/visit-photos/[photoId]/route";
import { DELETE as deleteVisit, PATCH as patchVisit } from "@/app/api/visits/[visitId]/route";
import { POST as postVisitPhoto } from "@/app/api/visits/[visitId]/photos/route";
import { VISIT_PHOTO_MAX_BYTES, VISIT_PHOTO_MAX_FILES_PER_UPLOAD } from "@/lib/visit-photos";

function request(method = "GET") {
  return new NextRequest("http://localhost/api/test", { method });
}

function requestWithHeaders(method: string, headers: HeadersInit) {
  return new NextRequest("http://localhost/api/test", { headers, method });
}

function context(paramName: string, value: string) {
  return {
    params: Promise.resolve({ [paramName]: value })
  } as never;
}

describe("visit API route params", () => {
  it.each([
    ["GET place visits", () => getPlaceVisits(request(), context("placeId", "not-a-uuid")), "placeId"],
    ["POST place visit", () => postPlaceVisit(request("POST"), context("placeId", "not-a-uuid")), "placeId"],
    ["PATCH visit", () => patchVisit(request("PATCH"), context("visitId", "not-a-uuid")), "visitId"],
    ["DELETE visit", () => deleteVisit(request("DELETE"), context("visitId", "not-a-uuid")), "visitId"],
    ["POST visit photo", () => postVisitPhoto(request("POST"), context("visitId", "not-a-uuid")), "visitId"],
    ["GET visit photo", () => getVisitPhoto(request(), context("photoId", "not-a-uuid")), "photoId"],
    ["DELETE visit photo", () => deleteVisitPhoto(request("DELETE"), context("photoId", "not-a-uuid")), "photoId"]
  ])("%s rejects malformed UUID params before handler work", async (_label, routeCall, paramName) => {
    const response = await routeCall();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: `${paramName} must be a valid UUID`
    });
  });

  it("rejects oversized visit photo requests before multipart parsing", async () => {
    const response = await postVisitPhoto(
      requestWithHeaders("POST", {
        "content-length": String(VISIT_PHOTO_MAX_BYTES * VISIT_PHOTO_MAX_FILES_PER_UPLOAD + 1)
      }),
      context("visitId", "11111111-1111-4111-8111-111111111111")
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: "Photo upload request must be 80MB or smaller"
    });
  });
});
