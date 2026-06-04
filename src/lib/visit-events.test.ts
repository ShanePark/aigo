import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { analyzeUserAgent, getVisitEventsSummary, listVisitEvents, recordVisitEvent } from "@/lib/visit-events";

type QueryResponse = Array<Record<string, unknown>>;

function fakeExecutor(responses: QueryResponse[]) {
  const calls: string[] = [];
  const executor = (async (strings: TemplateStringsArray) => {
    calls.push(strings.join("?").replace(/\s+/g, " ").trim());
    return responses.shift() ?? [];
  }) as never;

  return { calls, executor };
}

function request() {
  return new NextRequest("http://localhost/places/search", {
    headers: {
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1",
      "x-forwarded-for": "203.0.113.2, 10.0.0.1"
    },
    method: "POST"
  });
}

describe("visit event recording", () => {
  it("stores common request metadata for analytics", async () => {
    const { calls, executor } = fakeExecutor([[{ id: "event-1" }]]);

    await expect(
      recordVisitEvent(
        {
          deviceKey: "device-1",
          eventType: "place_search",
          request: request(),
          searchInput: { query: "키즈카페" },
          searchResultCount: 2,
          searchResultTotal: 10,
          user: { id: "11111111-1111-4111-8111-111111111111" }
        },
        executor
      )
    ).resolves.toEqual({ id: "event-1" });

    expect(calls[0]).toContain("insert into visit_events");
    expect(calls[0]).toContain("ip_address");
    expect(calls[0]).toContain("search_input");
    expect(calls[0]).toContain("user_agent_analysis");
    expect(calls[0]).not.toContain("user_agent,");
    expect(calls[0]).not.toContain("ua_processed");
  });
});

describe("visit event listing", () => {
  it("returns joined user and place context for admin screens", async () => {
    const { calls, executor } = fakeExecutor([
      [
        {
          id: "event-1",
          eventType: "place_detail_view",
          eventSource: "app",
          userId: null,
          userEmail: null,
          userDisplayName: null,
          placeId: "22222222-2222-4222-8222-222222222222",
          placeName: "아이랑 공원",
          requestPath: "/api/places/test/views",
          httpMethod: "POST",
          ipAddress: "203.0.113.2",
          deviceKeyHash: "hash",
          searchInput: {},
          searchResultCount: null,
          searchResultTotal: null,
          eventMeta: { counted: true },
          userAgentAnalysis: { summary: "mobile · iOS · Safari" },
          createdAt: new Date("2026-06-02T00:00:00.000Z")
        }
      ]
    ]);

    await expect(listVisitEvents({ eventType: "place_detail_view", limit: 10 }, executor)).resolves.toMatchObject({
      items: [
        {
          eventType: "place_detail_view",
          place: { name: "아이랑 공원" },
          userAgentAnalysis: { summary: "mobile · iOS · Safari" }
        }
      ]
    });
    expect(calls[0]).toContain("left join users");
    expect(calls[0]).toContain("left join places");
  });

  it("summarizes direct app visits separately from v1 API requests", async () => {
    const { calls, executor } = fakeExecutor([
      [
        {
          appCount: 7,
          apiCount: 3,
          detailViewCount: 4,
          searchCount: 6,
          totalCount: 10
        }
      ]
    ]);

    await expect(getVisitEventsSummary(executor)).resolves.toEqual({
      appCount: 7,
      apiCount: 3,
      detailViewCount: 4,
      searchCount: 6,
      totalCount: 10
    });
    expect(calls[0]).toContain("event_source = 'app'");
    expect(calls[0]).toContain("event_source = 'v1'");
  });
});

describe("user-agent analysis", () => {
  it("parses common browser signals", () => {
    expect(analyzeUserAgent(request().headers.get("user-agent"))).toMatchObject({
      browser: { name: "Safari", version: "17.0" },
      isBot: false,
      os: { name: "iOS", version: "17.0" },
      platform: { model: "iPhone", type: "mobile", vendor: "Apple" }
    });
  });
});
