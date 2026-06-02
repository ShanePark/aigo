import { describe, expect, it } from "vitest";

import { getAdminUsersSummary, listAdminUsers } from "@/lib/admin-users";

type QueryResponse = Array<Record<string, unknown>>;

function fakeExecutor(responses: QueryResponse[]) {
  const calls: string[] = [];
  const executor = (async (strings: TemplateStringsArray) => {
    calls.push(strings.join("?").replace(/\s+/g, " ").trim());
    return responses.shift() ?? [];
  }) as never;

  return { calls, executor };
}

describe("admin user listing", () => {
  it("returns user activity and social account context", async () => {
    const { calls, executor } = fakeExecutor([
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          email: "admin@aigo.test",
          displayName: "관리자",
          role: "admin",
          socialProviders: ["kakao"],
          lastSessionUsedAt: new Date("2026-06-02T01:00:00.000Z"),
          lastVisitAt: new Date("2026-06-02T02:00:00.000Z"),
          totalEventCount: 3,
          detailViewCount: 2,
          searchCount: 1,
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          updatedAt: new Date("2026-06-01T01:00:00.000Z")
        }
      ]
    ]);

    await expect(listAdminUsers({ limit: 10 }, executor)).resolves.toMatchObject({
      items: [
        {
          detailViewCount: 2,
          email: "admin@aigo.test",
          lastVisitAt: "2026-06-02T02:00:00.000Z",
          role: "admin",
          searchCount: 1,
          socialProviders: ["kakao"],
          totalEventCount: 3
        }
      ]
    });
    expect(calls[0]).toContain("from users u");
    expect(calls[0]).toContain("from visit_events");
    expect(calls[0]).toContain("from auth_sessions");
  });

  it("summarizes registered users for the admin screen", async () => {
    const { executor } = fakeExecutor([[{ totalCount: 4, adminCount: 1, visitedUserCount: 2 }]]);

    await expect(getAdminUsersSummary(executor)).resolves.toEqual({
      adminCount: 1,
      totalCount: 4,
      visitedUserCount: 2
    });
  });
});
