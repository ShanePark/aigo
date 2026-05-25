import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/errors";
import {
  createPlacePublicMemoSchema,
  deletePlacePublicMemo,
  listPlacePublicMemos,
  placePublicMemoItemFromRow,
  updatePlacePublicMemo,
  updatePlacePublicMemoSchema,
  upsertPlacePublicMemo
} from "@/lib/place-public-memos";

type QueryResponse = Array<Record<string, unknown>>;

const baseMemoRow = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  placeId: "33333333-3333-4333-8333-333333333333",
  body: "유모차는 정문 엘리베이터가 편해요.",
  displayName: "Dev Parent",
  createdAt: new Date("2026-05-24T01:00:00.000Z"),
  updatedAt: new Date("2026-05-24T02:00:00.000Z")
};

function fakeExecutor(responses: QueryResponse[]) {
  const calls: string[] = [];
  const executor = (async (strings: TemplateStringsArray) => {
    calls.push(strings.join("?").replace(/\s+/g, " ").trim());
    return responses.shift() ?? [];
  }) as never;

  return { calls, executor };
}

describe("place public memo schemas", () => {
  it("trims memo text and rejects blank or too long text", () => {
    expect(createPlacePublicMemoSchema.parse({ body: "  주차장은 지하 2층이 가까웠어요. " })).toEqual({
      body: "주차장은 지하 2층이 가까웠어요."
    });
    expect(updatePlacePublicMemoSchema.parse({ body: "팁" })).toEqual({ body: "팁" });
    expect(() => createPlacePublicMemoSchema.parse({ body: "   " })).toThrow();
    expect(() => updatePlacePublicMemoSchema.parse({ body: "a".repeat(1001) })).toThrow();
  });
});

describe("place public memo listing", () => {
  it("lists public memos with the viewer memo first", async () => {
    const { calls, executor } = fakeExecutor([[{ id: baseMemoRow.placeId }], [baseMemoRow]]);

    await expect(listPlacePublicMemos(baseMemoRow.placeId, baseMemoRow.userId, executor)).resolves.toMatchObject({
      items: [
        {
          body: baseMemoRow.body,
          displayName: "Dev Parent",
          isMine: true
        }
      ]
    });
    expect(calls[1]).toContain("from place_public_memos m");
    expect(calls[1]).toContain("order by (m.user_id = ?) desc, m.updated_at desc");
  });

  it("formats memo rows without privacy placeholders because memos are public-only", () => {
    expect(placePublicMemoItemFromRow(baseMemoRow, "other-user")).toMatchObject({
      body: baseMemoRow.body,
      displayName: "Dev Parent",
      isMine: false
    });
  });
});

describe("place public memo mutation", () => {
  it("upserts one memo per user and place", async () => {
    const { calls, executor } = fakeExecutor([[{ id: baseMemoRow.placeId }], [baseMemoRow]]);

    await expect(upsertPlacePublicMemo(baseMemoRow.placeId, baseMemoRow.userId, { body: baseMemoRow.body }, executor)).resolves.toMatchObject({
      item: {
        body: baseMemoRow.body,
        isMine: true
      }
    });
    expect(calls[1]).toContain("on conflict (user_id, place_id)");
    expect(calls[1]).toContain("do update set");
  });

  it("allows only the owner to update a memo", async () => {
    const { executor } = fakeExecutor([[{ userId: "other-user" }]]);

    await expect(updatePlacePublicMemo(baseMemoRow.id, baseMemoRow.userId, { body: "새 팁" }, executor)).rejects.toMatchObject({
      status: 403
    } satisfies Partial<ApiError>);
  });

  it("updates the owner's memo in place", async () => {
    const { calls, executor } = fakeExecutor([
      [{ userId: baseMemoRow.userId }],
      [{ ...baseMemoRow, body: "주말에는 지하 2층 주차가 덜 붐볐어요." }]
    ]);

    await expect(
      updatePlacePublicMemo(baseMemoRow.id, baseMemoRow.userId, { body: "주말에는 지하 2층 주차가 덜 붐볐어요." }, executor)
    ).resolves.toMatchObject({
      item: {
        body: "주말에는 지하 2층 주차가 덜 붐볐어요.",
        isMine: true
      }
    });
    expect(calls[1]).toContain("update place_public_memos");
    expect(calls[1]).toContain("set body = ?");
  });

  it("allows only the owner to delete a memo", async () => {
    const { calls, executor } = fakeExecutor([[{ userId: baseMemoRow.userId }], []]);

    await expect(deletePlacePublicMemo(baseMemoRow.id, baseMemoRow.userId, executor)).resolves.toEqual({ deleted: true });
    expect(calls[1]).toContain("delete from place_public_memos");
  });
});
