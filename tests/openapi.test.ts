import SwaggerParser from "@apidevtools/swagger-parser";
import { describe, expect, it } from "vitest";

describe("OpenAPI contract", () => {
  it("is a valid OpenAPI document", async () => {
    const api = await SwaggerParser.validate("docs/openapi/aigo-v1.yaml");
    expect(api.info.title).toBe("AiGo Agent-Friendly Places API");
  });
});

