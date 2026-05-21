import { describe, expect, it } from "vitest";

import { describeReasonCodes } from "@/lib/reasons";
import type { SearchPlacesInput } from "@/lib/schemas";

describe("reason metadata", () => {
  it("prioritizes selected preference reasons before generic context reasons", () => {
    const input = {
      radiusKm: 20,
      sort: "recommended",
      limit: 20,
      offset: 0,
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        babyChair: true
      }
    } satisfies SearchPlacesInput;

    const reasons = describeReasonCodes(
      [
        "CONTEXT_AFTER_DAYCARE_CATEGORY",
        "DATA_CONFIDENCE_POSITIVE",
        "DISTANCE_NEAR",
        "PARKING_YES",
        "STROLLER_PARTIAL",
        "BABY_CHAIR_UNKNOWN",
        "AGE_HINT_MATCH"
      ],
      input
    );

    expect(reasons.slice(0, 3).map((reason) => reason.code)).toEqual(["PARKING_YES", "STROLLER_PARTIAL", "BABY_CHAIR_UNKNOWN"]);
  });

  it("keeps Korean labels and machine codes together for API consumers", () => {
    expect(describeReasonCodes(["DIAPER_TABLE_YES"])[0]).toMatchObject({
      code: "DIAPER_TABLE_YES",
      labelKo: "기저귀 교환 가능",
      group: "preference",
      tone: "positive"
    });
  });
});
