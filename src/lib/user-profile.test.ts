import { describe, expect, it } from "vitest";

import { getMyProfile, updateMyProfile, updateMyProfileSchema, userHomeLocationInputSchema } from "@/lib/user-profile";

type QueryResponse = Array<Record<string, unknown>>;

const userId = "11111111-1111-4111-8111-111111111111";

function fakeExecutor(responses: QueryResponse[]) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const executor = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return responses.shift() ?? [];
  }) as never;

  return { calls, executor };
}

describe("user profile schemas", () => {
  it("accepts child birth months and gender but rejects malformed values", () => {
    expect(updateMyProfileSchema.parse({ children: [{ birthYearMonth: "2024-09" }] })).toEqual({
      children: [{ birthYearMonth: "2024-09", gender: "boy" }]
    });
    expect(updateMyProfileSchema.parse({ children: [{ birthYearMonth: "2024-09", gender: "girl", name: "  첫째  " }] })).toEqual({
      children: [{ birthYearMonth: "2024-09", gender: "girl", name: "첫째" }]
    });
    expect(updateMyProfileSchema.parse({ children: [{ birthYearMonth: "2024-09", gender: "girl", name: "   " }] })).toEqual({
      children: [{ birthYearMonth: "2024-09", gender: "girl", name: null }]
    });
    expect(() => updateMyProfileSchema.parse({ children: [{ birthYearMonth: "2024-09", gender: "unknown" }] })).toThrow();
    expect(() => updateMyProfileSchema.parse({ children: [{ birthYearMonth: "2024-13" }] })).toThrow("YYYY-MM");
    expect(() => updateMyProfileSchema.parse({ children: [{ birthYearMonth: "2999-01" }] })).toThrow("future");
  });

  it("validates home coordinates and normalizes blank address text", () => {
    expect(userHomeLocationInputSchema.parse({ lat: 36.33, lng: 127.43, addressText: "   " })).toEqual({
      label: "home",
      lat: 36.33,
      lng: 127.43,
      addressText: null
    });
    expect(() => userHomeLocationInputSchema.parse({ lat: 91, lng: 127.43 })).toThrow();
    expect(() => userHomeLocationInputSchema.parse({ lat: 36.33, lng: 181 })).toThrow();
  });

  it("rejects empty profile updates", () => {
    expect(() => updateMyProfileSchema.parse({})).toThrow("At least one profile field is required");
    expect(() => updateMyProfileSchema.parse({ searchPreferences: {} })).toThrow();
  });
});

describe("user profile queries", () => {
  it("returns saved profile data", async () => {
    const { executor } = fakeExecutor([
      [{ id: "child-1", birthYearMonth: "2024-09", gender: "girl", name: "첫째", sortOrder: "0" }],
      [{ label: "home", lat: "36.33", lng: "127.43", addressText: null }]
    ]);

    await expect(getMyProfile(userId, executor)).resolves.toEqual({
      children: [{ id: "child-1", birthYearMonth: "2024-09", gender: "girl", name: "첫째", sortOrder: 0 }],
      homeLocation: { label: "home", lat: 36.33, lng: 127.43, addressText: null }
    });
  });

  it("replaces owned children and home location", async () => {
    const { calls, executor } = fakeExecutor([
      [],
      [],
      [{ id: "child-1", birthYearMonth: "2024-09", gender: "girl", name: "첫째", sortOrder: 0 }],
      [{ label: "home", lat: 36.33, lng: 127.43, addressText: "대전" }]
    ]);

    await updateMyProfile(
      userId,
      {
        children: [{ birthYearMonth: "2024-09", gender: "girl", name: "첫째" }],
        homeLocation: { label: "home", lat: 36.33, lng: 127.43, addressText: "대전" }
      },
      executor
    );

    expect(calls[0].sql).toContain("delete from user_children where user_id = ?");
    expect(calls[1].sql).toContain("insert into user_children");
    expect(calls[1].values).toContain(userId);
    expect(calls[2].sql).toContain("insert into user_home_locations");
    expect(calls[2].sql).toContain("on conflict (user_id) do update");
  });

  it("deletes nullable profile sections for the current user only", async () => {
    const { calls, executor } = fakeExecutor([[], [], [], []]);

    await updateMyProfile(userId, { children: [], homeLocation: null }, executor);

    expect(calls[0].sql).toContain("delete from user_children where user_id = ?");
    expect(calls[1].sql).toContain("delete from user_home_locations where user_id = ?");
    expect(calls[0].values).toEqual([userId]);
    expect(calls[1].values).toEqual([userId]);
  });
});
