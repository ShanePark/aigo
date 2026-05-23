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
      labelKo: "기저귀갈이대 있음",
      group: "preference",
      tone: "positive"
    });
  });

  it("describes taxonomy reason codes", () => {
    expect(describeReasonCodes(["TAXONOMY_ACTIVITY_MATCH", "TAXONOMY_RISK_FLAG"])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TAXONOMY_ACTIVITY_MATCH", labelKo: "활동 유형 일치", group: "match", tone: "positive" }),
        expect.objectContaining({ code: "TAXONOMY_RISK_FLAG", labelKo: "주의 요소 확인", group: "context", tone: "negative" })
      ])
    );
  });
});
