import { describe, expect, it } from "vitest";

import {
  buildCandidatePatchExtraction,
  buildPlacePatchExtraction,
  formatPatchExtractionReport,
  imageGapFromDetail,
  missingUpdateFields,
  parseArgs
} from "./extract-update-ready-patches";

function completeDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "place-1",
    name: "스타필드 시티 부천",
    primaryCategory: "shopping_mall",
    address: "경기 부천시 옥길로 1",
    roadAddress: "경기 부천시 옥길로 1",
    notes: { parent: "Parent notes", safety: "Safety notes" },
    recommendedAgeMonths: { min: 0, max: 144 },
    facilities: {
      strollerFriendly: "yes",
      parkingAvailable: "yes",
      nursingRoom: "yes",
      diaperChangingTable: "yes",
      kidsToilet: "yes",
      elevator: "yes",
      babyChair: "partial",
      foodAllowed: "partial"
    },
    visit: {
      reservationRequired: "no",
      walkInAvailable: "yes",
      sessionBased: "no",
      sameDayAvailabilityKnown: "yes",
      averageStayMinutes: 120,
      parentEffortLevel: "low",
      childEngagementLevel: "medium",
      rainyDayScore: 9,
      hotDayScore: 9,
      coldDayScore: 8
    },
    openingHours: { text: "10:00-22:00" },
    pricing: { type: "free" },
    scoring: {
      placeScore: 8,
      placeScoreRationale: "Large mall fallback with family logistics.",
      scoreSignals: { facilityScale: "large" }
    },
    taxonomy: { sourceBacked: { amenities: ["nursing_room"] } },
    playFeatures: { indoorPlay: ["kids_zone"] },
    externalRefs: { subfacilitySweep: { checkedAt: "2026-05-24T00:00:00.000Z" } },
    images: [{ url: "https://example.com/image.jpg", isPrimary: true, reviewStatus: "approved" }],
    primaryImage: { url: "https://example.com/image.jpg", isPrimary: true, reviewStatus: "approved" },
    sources: [{ checkedAt: "2026-05-24T00:00:00.000Z", createdAt: "2026-05-24T00:00:00.000Z" }],
    versions: [{ versionNumber: 2, action: "update", changeSummary: "Updated", createdAt: "2026-05-24T00:00:00.000Z" }],
    ...overrides
  };
}

describe("update-ready patch extractor", () => {
  it("parses repeated and comma-separated candidates", () => {
    const args = parseArgs([
      "--candidate=롯데프리미엄아울렛 의왕점",
      "--candidates=왕송호수공원,의왕철도박물관",
      "--limit=5",
      "--stale-after-days=90",
      "--json"
    ]);

    expect(args.candidates).toEqual(["롯데프리미엄아울렛 의왕점", "왕송호수공원", "의왕철도박물관"]);
    expect(args.limit).toBe(5);
    expect(args.staleAfterDays).toBe(90);
    expect(args.json).toBe(true);
  });

  it("detects missing family fields from nested place detail", () => {
    const missing = missingUpdateFields(
      completeDetail({
        notes: { parent: "", safety: "unknown" },
        facilities: { strollerFriendly: "unknown" },
        visit: { averageStayMinutes: null },
        taxonomy: {
          schemaVersion: 1,
          sourceBacked: { amenities: [] },
          inferred: { amenities: ["parking"] },
          migration: { legacyTags: ["mall"] }
        },
        externalRefs: {}
      })
    );

    expect(missing.map((field) => field.writableField)).toEqual(
      expect.arrayContaining(["parentNotes", "safetyNotes", "strollerFriendly", "averageStayMinutes", "taxonomy", "externalRefs.subfacilitySweep"])
    );
  });

  it("flags image gaps for missing, primary-less, or unapproved image sets", () => {
    expect(imageGapFromDetail({ images: [] })?.reason).toBe("no_images");
    expect(imageGapFromDetail({ images: [{ url: "https://example.com/a.jpg", reviewStatus: "approved" }] })?.reason).toBe("no_primary_image");
    expect(
      imageGapFromDetail({
        images: [{ url: "https://example.com/a.jpg", isPrimary: true, reviewStatus: "pending_review" }],
        primaryImage: { url: "https://example.com/a.jpg", reviewStatus: "pending_review" }
      })?.reason
    ).toBe("unapproved_primary");
  });

  it("builds a patch draft when fields, sources, or images need work", () => {
    const extraction = buildPlacePatchExtraction(
      completeDetail({
        notes: { parent: null, safety: "Safety notes" },
        images: [],
        primaryImage: null,
        sources: [{ checkedAt: "2025-01-01T00:00:00.000Z", createdAt: "2025-01-01T00:00:00.000Z" }]
      }),
      new Date("2026-05-24T00:00:00.000Z"),
      180
    );

    expect(extraction.patchDraft?.route).toBe("PATCH /v1/places/place-1");
    expect(extraction.patchDraft?.status).toBe("needs_source_values");
    expect(extraction.patchDraft?.fieldInstructions.map((field) => field.writableField)).toEqual(expect.arrayContaining(["parentNotes", "images", "sources"]));
  });

  it("marks single exact matches as update-ready only when a draft exists", () => {
    const ready = buildCandidatePatchExtraction({
      query: "스타필드 시티 부천",
      exactSearchCount: 1,
      places: [
        buildPlacePatchExtraction(
          completeDetail({
            notes: { parent: null, safety: "Safety notes" }
          }),
          new Date("2026-05-24T00:00:00.000Z")
        )
      ]
    });

    const complete = buildCandidatePatchExtraction({
      query: "스타필드 시티 부천",
      exactSearchCount: 1,
      places: [buildPlacePatchExtraction(completeDetail(), new Date("2026-05-24T00:00:00.000Z"))]
    });

    expect(ready.status).toBe("update_ready");
    expect(complete.status).toBe("no_update_needed");
  });

  it("formats missing fields and patch route for handoff", () => {
    const place = buildPlacePatchExtraction(
      completeDetail({
        notes: { parent: null, safety: "Safety notes" }
      }),
      new Date("2026-05-24T00:00:00.000Z")
    );
    const report = formatPatchExtractionReport({
      generatedAt: "2026-05-24T00:00:00.000Z",
      candidates: [buildCandidatePatchExtraction({ query: "스타필드 시티 부천", exactSearchCount: 1, places: [place] })]
    });

    expect(report).toContain("parentNotes");
    expect(report).toContain("patch route: PATCH /v1/places/place-1");
  });
});
