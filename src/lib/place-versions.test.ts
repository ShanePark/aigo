import { describe, expect, it } from "vitest";

import { listPlaceVersions } from "@/lib/places";

type QueryResponse = Array<Record<string, unknown>>;

function fakeExecutor(responses: QueryResponse[]) {
  const calls: string[] = [];
  const executor = (async (strings: TemplateStringsArray) => {
    calls.push(strings.join("?").replace(/\s+/g, " ").trim());
    return responses.shift() ?? [];
  }) as never;

  return { calls, executor };
}

describe("place version listing", () => {
  const placeId = "11111111-1111-4111-8111-111111111111";

  it("returns 404 when the parent place does not exist", async () => {
    const { calls, executor } = fakeExecutor([[]]);

    await expect(listPlaceVersions(placeId, executor)).rejects.toMatchObject({
      status: 404,
      message: "Place not found"
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("select id from places");
  });

  it("keeps an empty version list distinct from a missing place", async () => {
    const { calls, executor } = fakeExecutor([[{ id: placeId }], []]);

    await expect(listPlaceVersions(placeId, executor)).resolves.toEqual({ items: [] });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("select * from place_versions");
  });

  it("maps versions after confirming the place exists", async () => {
    const createdAt = new Date("2026-05-22T13:00:00.000Z");
    const { executor } = fakeExecutor([
      [{ id: placeId }],
      [
        {
          id: "22222222-2222-4222-8222-222222222222",
          place_id: placeId,
          version_number: 2,
          action: "update",
          actor: "agent",
          change_summary: "Updated family logistics",
          snapshot: {},
          sources: [],
          created_at: createdAt
        }
      ]
    ]);

    await expect(listPlaceVersions(placeId, executor)).resolves.toEqual({
      items: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          versionNumber: 2,
          version: 2,
          action: "update",
          changeType: "update",
          actor: "agent",
          changeSummary: "Updated family logistics",
          sources: [],
          createdAt: "2026-05-22T13:00:00.000Z"
        }
      ]
    });
  });

  it("exposes stored source snapshots in version summaries", async () => {
    const createdAt = new Date("2026-06-04T04:00:00.000Z");
    const source = {
      sourceType: "official",
      title: "서울시 공공서비스 예약",
      url: "https://example.test/source",
      externalId: null,
      summary: "운영 정보 확인",
      checkedAt: "2026-06-04T00:00:00.000Z"
    };
    const { executor } = fakeExecutor([
      [{ id: placeId }],
      [
        {
          id: "33333333-3333-4333-8333-333333333333",
          place_id: placeId,
          version_number: 3,
          action: "update",
          actor: "agent",
          change_summary: "Append official source",
          snapshot: {},
          sources: [source],
          created_at: createdAt
        }
      ]
    ]);

    await expect(listPlaceVersions(placeId, executor)).resolves.toEqual({
      items: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          versionNumber: 3,
          version: 3,
          action: "update",
          changeType: "update",
          actor: "agent",
          changeSummary: "Append official source",
          sources: [source],
          createdAt: "2026-06-04T04:00:00.000Z"
        }
      ]
    });
  });
});
