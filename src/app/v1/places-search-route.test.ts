import { describe, expect, it } from "vitest";

import { GET as getPlaceSearch } from "@/app/v1/places/search/route";

describe("v1 place search route", () => {
  it("returns a structured 405 response for GET requests", async () => {
    const response = await getPlaceSearch();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    await expect(response.json()).resolves.toMatchObject({
      error: "Method not allowed",
      details: {
        allowedMethods: ["POST"]
      }
    });
  });
});
