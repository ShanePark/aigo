import { describe, expect, it } from "vitest";

import {
  createPlaceVisit,
  createPlaceVisitSchema,
  groupMyVisitLogRows,
  listPlaceVisits,
  listPlaceVisitSummaries,
  placeVisitSummaryFromRow,
  placeVisitItemFromRow,
  updatePlaceVisit,
  updatePlaceVisitSchema
} from "@/lib/place-visits";

type QueryResponse = Array<Record<string, unknown>>;

const baseVisitRow = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  placeId: "33333333-3333-4333-8333-333333333333",
  visitedOn: "2026-05-24",
  rating: 5,
  reviewText: "다시 가고 싶음",
  visibility: "private" as const,
  isRevisit: true,
  createdAt: new Date("2026-05-24T01:00:00.000Z"),
  updatedAt: new Date("2026-05-24T02:00:00.000Z"),
  displayName: "Dev Parent",
  photoCount: 2
};

function fakeExecutor(responses: QueryResponse[]) {
  const calls: string[] = [];
  const executor = (async (strings: TemplateStringsArray) => {
    calls.push(strings.join("?").replace(/\s+/g, " ").trim());
    return responses.shift() ?? [];
  }) as never;

  return { calls, executor };
}

describe("place visit schemas", () => {
  it("defaults new visits to public and keeps server-owned fields out of input", () => {
    expect(createPlaceVisitSchema.parse({ rating: 4.5 })).toEqual({
      rating: 4.5,
      visibility: "public"
    });
    expect(createPlaceVisitSchema.parse({ rating: 4, visitedOn: "2026-05-01", isRevisit: true })).toEqual({
      rating: 4,
      visibility: "public"
    });
  });

  it("normalizes blank review text to null", () => {
    expect(createPlaceVisitSchema.parse({ rating: 3, reviewText: "   " }).reviewText).toBeNull();
    expect(updatePlaceVisitSchema.parse({ reviewText: "" }).reviewText).toBeNull();
  });

  it("accepts half-point ratings and rejects finer increments", () => {
    expect(createPlaceVisitSchema.parse({ rating: 0.5 })).toMatchObject({ rating: 0.5 });
    expect(updatePlaceVisitSchema.parse({ rating: 4.5 })).toMatchObject({ rating: 4.5 });
    expect(() => createPlaceVisitSchema.parse({ rating: 4.25 })).toThrow("Rating must use 0.5 point increments");
  });

  it("rejects empty visit updates", () => {
    expect(() => updatePlaceVisitSchema.parse({})).toThrow("At least one visit field is required");
    expect(() => updatePlaceVisitSchema.parse({ visitedOn: "2026-05-01", isRevisit: true })).toThrow("At least one visit field is required");
  });
});

describe("place visit creation", () => {
  it("sets revisit status from existing user-place visits", async () => {
    const { calls, executor } = fakeExecutor([
      [{ id: baseVisitRow.placeId }],
      [{ ...baseVisitRow, visibility: "public", isRevisit: true, photoCount: 0 }]
    ]);

    await expect(createPlaceVisit(baseVisitRow.placeId, baseVisitRow.userId, { rating: 5, visibility: "public" }, executor)).resolves.toMatchObject({
      item: {
        isRevisit: true,
        rating: 5
      }
    });
    expect(calls[1]).toContain("exists ( select 1 from place_visits existing");
    expect(calls[1]).toContain("where existing.user_id = ?");
    expect(calls[1]).toContain("and existing.place_id = ?");
  });
});

describe("place visit privacy formatting", () => {
  it("returns search-card-compatible aggregate summaries for place detail visits", async () => {
    const { calls, executor } = fakeExecutor([
      [{ id: baseVisitRow.placeId }],
      [
        {
          placeId: baseVisitRow.placeId,
          averageRating: "4.5000000000",
          ratingCount: "2",
          publicReviewCount: "1",
          publicPhotoCount: "3",
          latestVisitedOn: "2026-05-25"
        }
      ],
      [{ ...baseVisitRow, visibility: "public", photoCount: 3 }],
      [
        {
          id: "55555555-5555-4555-8555-555555555555",
          visitId: baseVisitRow.id,
          userId: baseVisitRow.userId,
          placeId: baseVisitRow.placeId,
          storageKey: "visit-photos/visit/photo.png",
          originalFilename: "photo.png",
          mimeType: "image/png",
          byteSize: 100,
          width: 16,
          height: 16,
          visibility: "public",
          visitVisibility: "public",
          createdAt: new Date("2026-05-25T00:00:00.000Z")
        }
      ]
    ]);

    await expect(listPlaceVisits(baseVisitRow.placeId, baseVisitRow.userId, executor)).resolves.toMatchObject({
      hasVisited: true,
      summary: {
        averageRating: 4.5,
        latestVisitedOn: "2026-05-25",
        publicPhotoCount: 3,
        publicReviewCount: 1,
        ratingCount: 2
      }
    });
    expect(calls[3]).toContain("from place_visit_photos ph");
    expect(calls[1]).toContain('"publicReviewCount"');
    expect(calls[1]).toContain('"publicPhotoCount"');
    expect(calls[1]).toContain('"latestVisitedOn"');
  });

  it("hides another user's private rating, text, display name, and photo count", () => {
    expect(placeVisitItemFromRow(baseVisitRow, "other-user")).toMatchObject({
      rating: null,
      reviewText: null,
      displayName: null,
      photoCount: 0,
      isPrivatePlaceholder: true,
      isMine: false
    });
  });

  it("shows the owner their private visit details", () => {
    expect(placeVisitItemFromRow(baseVisitRow, baseVisitRow.userId)).toMatchObject({
      rating: 5,
      reviewText: "다시 가고 싶음",
      displayName: "Dev Parent",
      photoCount: 2,
      photos: [],
      isPrivatePlaceholder: false,
      isMine: true
    });
  });

  it("groups my visit log rows by visited date", () => {
    const groups = groupMyVisitLogRows([
      { ...baseVisitRow, placeName: "첫 장소", primaryCategory: "museum" },
      {
        ...baseVisitRow,
        id: "44444444-4444-4444-8444-444444444444",
        visitedOn: "2026-05-23",
        placeName: "둘째 장소",
        primaryCategory: "kids_cafe"
      }
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      visitedOn: "2026-05-24",
      items: [{ placeName: "첫 장소", rating: 5 }]
    });
    expect(groups[1]).toMatchObject({
      visitedOn: "2026-05-23",
      items: [{ placeName: "둘째 장소", primaryCategory: "kids_cafe" }]
    });
  });

  it("formats aggregate summaries without exposing private review or photo data", () => {
    expect(
      placeVisitSummaryFromRow({
        placeId: baseVisitRow.placeId,
        averageRating: "4.6666666667",
        ratingCount: "3",
        publicReviewCount: 1,
        publicPhotoCount: "2",
        latestVisitedOn: "2026-05-24"
      })
    ).toEqual({
      averageRating: 4.67,
      ratingCount: 3,
      publicReviewCount: 1,
      publicPhotoCount: 2,
      latestVisitedOn: "2026-05-24"
    });
  });
});

describe("place visit photo privacy", () => {
  it("counts public summary photos only when the parent visit is public", async () => {
    const { calls, executor } = fakeExecutor([]);

    await listPlaceVisitSummaries([baseVisitRow.placeId], executor);

    expect(calls[0]).toContain("join place_visits v on v.id = ph.visit_id");
    expect(calls[0]).toContain("ph.visibility = 'public' and v.visibility = 'public'");
    expect(calls[0]).not.toContain("place_public_memos");
  });

  it("returns the current photo count after updating a visit", async () => {
    const { calls, executor } = fakeExecutor([
      [{ id: baseVisitRow.id, userId: baseVisitRow.userId }],
      [{ ...baseVisitRow, visibility: "public", rating: 4.5, photoCount: 0 }],
      [{ photoCount: 2 }],
      []
    ]);

    await expect(updatePlaceVisit(baseVisitRow.id, baseVisitRow.userId, { rating: 4.5 }, executor)).resolves.toMatchObject({
      item: {
        photoCount: 2,
        rating: 4.5,
        visibility: "public"
      }
    });
    expect(calls[2]).toContain('select count(*)::int as "photoCount"');
    expect(calls[2]).toContain("from place_visit_photos");
    expect(calls[3]).toContain("from place_visit_photos ph");
  });

  it("privatizes existing photos when a visit is changed to private", async () => {
    const { calls, executor } = fakeExecutor([
      [{ id: baseVisitRow.id, userId: baseVisitRow.userId }],
      [{ ...baseVisitRow, visibility: "private", photoCount: 0 }],
      [],
      [{ photoCount: 2 }],
      []
    ]);

    await expect(updatePlaceVisit(baseVisitRow.id, baseVisitRow.userId, { visibility: "private" }, executor)).resolves.toMatchObject({
      item: {
        photoCount: 2,
        visibility: "private"
      }
    });
    expect(calls[2]).toContain("update place_visit_photos");
    expect(calls[2]).toContain("set visibility = 'private'");
    expect(calls[3]).toContain('select count(*)::int as "photoCount"');
    expect(calls[4]).toContain("from place_visit_photos ph");
  });
});
