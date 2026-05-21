import { describe, expect, it } from "vitest";

import { scorePlace } from "@/lib/scoring";
import type { SearchPlacesInput } from "@/lib/schemas";

const baseInput: SearchPlacesInput = {
  origin: { lat: 36.3504, lng: 127.3845, label: "대전" },
  radiusKm: 80,
  childAgeMonths: [32, 7, 7],
  preferences: {
    indoorTypes: ["indoor", "mixed"],
    parkingAvailable: true,
    strollerFriendly: true,
    nursingRoom: true,
    diaperChangingTable: true,
    foodAllowed: true
  },
  sort: "recommended",
  limit: 20,
  offset: 0
};

describe("scorePlace", () => {
  it("uses age as a soft positive signal", () => {
    const result = scorePlace(
      {
        primaryCategory: "indoor_playground",
        tags: [],
        dataConfidence: "operator_curated",
        minRecommendedAgeMonths: 24,
        maxRecommendedAgeMonths: 71,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "unknown",
        diaperChangingTable: "yes",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "unknown",
        distanceKm: 3
      },
      baseInput
    );

    expect(result.reasonCodes).toContain("AGE_HINT_MATCH");
    expect(result.reasonCodes).toContain("STROLLER_PARTIAL");
    expect(result.score).toBeGreaterThan(70);
  });

  it("does not zero out places when age mismatches and facilities are unknown", () => {
    const result = scorePlace(
      {
        primaryCategory: "museum",
        tags: [],
        dataConfidence: "unknown",
        minRecommendedAgeMonths: 72,
        maxRecommendedAgeMonths: 120,
        indoorType: "unknown",
        parkingAvailable: "unknown",
        strollerFriendly: "unknown",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "unknown",
        distanceKm: 12
      },
      baseInput
    );

    expect(result.reasonCodes).toContain("AGE_HINT_MISMATCH");
    expect(result.reasonCodes).toContain("PARKING_UNKNOWN");
    expect(result.reasonCodes).toContain("FOOD_ALLOWED_UNKNOWN");
    expect(result.score).toBeGreaterThan(0);
  });

  it("boosts farther destination-style places for day trips", () => {
    const nearby = scorePlace(
      {
        primaryCategory: "library",
        tags: [],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 0,
        maxRecommendedAgeMonths: 144,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "unknown",
        distanceKm: 2
      },
      { ...baseInput, visitContext: "dayTrip" }
    );
    const destination = scorePlace(
      {
        primaryCategory: "museum",
        tags: ["세종", "주말당일"],
        dataConfidence: "official_verified",
        minRecommendedAgeMonths: 24,
        maxRecommendedAgeMonths: 144,
        indoorType: "indoor",
        parkingAvailable: "yes",
        strollerFriendly: "partial",
        nursingRoom: "unknown",
        diaperChangingTable: "unknown",
        kidsToilet: "unknown",
        elevator: "unknown",
        babyChair: "unknown",
        foodAllowed: "unknown",
        distanceKm: 25
      },
      { ...baseInput, visitContext: "dayTrip" }
    );

    expect(destination.score).toBeGreaterThan(nearby.score);
    expect(destination.reasonCodes).toContain("CONTEXT_DAY_TRIP_DISTANCE");
    expect(nearby.reasonCodes).toContain("CONTEXT_DAY_TRIP_TOO_CLOSE");
  });
});
