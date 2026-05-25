import { describe, expect, it } from "vitest";

import {
  distanceSignalForPlace,
  shoppingMallRelatedPlaceScoreAdjustment,
  summarizeRelatedPlaceScoringRows,
  type RelatedPlaceScoringRow
} from "@/lib/recommendation-scoring";

describe("recommendation scoring policy", () => {
  const inputWithOrigin = {
    origin: { lat: 36.3504, lng: 127.3845, label: "대전" },
    radiusKm: 80,
    sort: "recommended" as const,
    limit: 20,
    offset: 0
  };

  it("uses a steep distance curve for playground searches", () => {
    const input = { ...inputWithOrigin, playgroundOnly: true, primaryCategories: ["park", "indoor_playground"], query: "놀이터" };
    const nearby = distanceSignalForPlace({ primaryCategory: "indoor_playground", tags: [], distanceKm: 2 }, input);
    const far = distanceSignalForPlace({ primaryCategory: "indoor_playground", tags: [], distanceKm: 12 }, input);

    expect(nearby).toMatchObject({ delta: 13, reasonCode: "DISTANCE_NEAR", profileId: "nearbyPlayground" });
    expect(far).toMatchObject({ delta: -12, reasonCode: "DISTANCE_FAR", profileId: "nearbyPlayground" });
  });

  it("keeps shopping mall searches tolerant up to a short drive and harsh past about an hour", () => {
    const input = { ...inputWithOrigin, primaryCategories: ["shopping_mall"], query: "쇼핑몰" };
    const shortDrive = distanceSignalForPlace({ primaryCategory: "shopping_mall", tags: [], distanceKm: 25 }, input);
    const tooFar = distanceSignalForPlace({ primaryCategory: "shopping_mall", tags: [], distanceKm: 70 }, input);

    expect(shortDrive).toMatchObject({ delta: 3, reasonCode: "DISTANCE_REASONABLE", profileId: "shoppingMallDrive" });
    expect(tooFar).toMatchObject({ delta: -20, reasonCode: "DISTANCE_FAR", profileId: "shoppingMallDrive" });
  });

  it("keeps visit and lodging destination searches open to two-hour-plus candidates", () => {
    const visitInput = { ...inputWithOrigin, primaryCategories: ["science_museum", "art_museum", "museum", "experience_center", "aquarium", "zoo"] };
    const stayInput = { ...inputWithOrigin, primaryCategories: ["accommodation"] };
    const visit = distanceSignalForPlace({ primaryCategory: "museum", tags: [], distanceKm: 180 }, visitInput);
    const zoo = distanceSignalForPlace({ primaryCategory: "zoo", tags: [], distanceKm: 180 }, visitInput);
    const stay = distanceSignalForPlace({ primaryCategory: "accommodation", tags: [], distanceKm: 220 }, stayInput);

    expect(visit).toMatchObject({ delta: 2, reasonCode: "DISTANCE_DAY_TRIP", profileId: "visitDestination" });
    expect(zoo).toMatchObject({ delta: 2, reasonCode: "DISTANCE_DAY_TRIP", profileId: "visitDestination" });
    expect(stay).toMatchObject({ delta: 2, reasonCode: "DISTANCE_DAY_TRIP", profileId: "stayDestination" });
  });

  it("de-emphasizes generic shopping malls unless related places add destination value", () => {
    const genericMall = { name: "이마트 대전터미널점", primaryCategory: "shopping_mall", tags: ["마트"] };
    const outletMall = { name: "현대프리미엄아울렛 대전점", primaryCategory: "shopping_mall", tags: ["아울렛"] };
    const noRelated = shoppingMallRelatedPlaceScoreAdjustment(genericMall);
    const childDestination = shoppingMallRelatedPlaceScoreAdjustment(genericMall, {
      childDestinationWeight: 1,
      supportDestinationWeight: 0,
      meaningfulCount: 1,
      relationTypes: ["same_building"],
      categories: ["kids_cafe"]
    });
    const clusterDestination = shoppingMallRelatedPlaceScoreAdjustment(genericMall, {
      childDestinationWeight: 2,
      supportDestinationWeight: 1.4,
      meaningfulCount: 3,
      relationTypes: ["same_building", "same_site", "parent_child"],
      categories: ["kids_cafe", "indoor_playground", "family_restaurant"]
    });
    const outletNoRelated = shoppingMallRelatedPlaceScoreAdjustment(outletMall);

    expect(noRelated).toMatchObject({
      delta: -10,
      shoppingMallBase: -10,
      relatedPlaces: 0,
      reasonCodes: expect.arrayContaining(["SHOPPING_MALL_BASE_DEEMPHASIZED"])
    });
    expect(childDestination.delta).toBeGreaterThan(noRelated.delta);
    expect(childDestination.reasonCodes).toContain("RELATED_CHILD_DESTINATION_BOOST");
    expect(clusterDestination.delta).toBeGreaterThan(childDestination.delta);
    expect(clusterDestination.reasonCodes).toContain("RELATED_PLACE_CLUSTER_BOOST");
    expect(outletNoRelated.delta).toBeGreaterThan(noRelated.delta);
  });

  it("summarizes related child and support destinations by relation strength", () => {
    const rows: RelatedPlaceScoringRow[] = [
      relatedRow({ relationType: "same_building", relatedPrimaryCategory: "kids_cafe" }),
      relatedRow({ relationType: "same_site", relatedPrimaryCategory: "family_restaurant", relatedTags: ["놀이방식당"] }),
      relatedRow({ relationType: "nearby", relatedPrimaryCategory: "indoor_playground" }),
      relatedRow({ relationType: "route_pair", relatedPrimaryCategory: "kids_cafe" })
    ];

    const summary = summarizeRelatedPlaceScoringRows(rows).get("mall")!;

    expect(summary.meaningfulCount).toBe(3);
    expect(summary.childDestinationWeight).toBe(1.45);
    expect(summary.supportDestinationWeight).toBeCloseTo(0.7);
    expect(summary.relationTypes).toEqual(["same_building", "same_site", "nearby", "route_pair"]);
  });
});

function relatedRow(overrides: Partial<RelatedPlaceScoringRow>): RelatedPlaceScoringRow {
  return {
    placeId: "mall",
    relatedPlaceId: "related",
    relationType: "same_building",
    relatedName: "관련 장소",
    relatedPrimaryCategory: "kids_cafe",
    relatedTags: [],
    ...overrides
  };
}
