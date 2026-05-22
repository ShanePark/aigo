import SwaggerParser from "@apidevtools/swagger-parser";
import { describe, expect, it } from "vitest";

import { createPlaceSchema, updatePlaceSchema } from "@/lib/schemas";

type JsonObject = Record<string, unknown>;
type ContractSchema = {
  allOf?: ContractSchema[];
  anyOf?: ContractSchema[];
  required?: string[];
  dependentRequired?: Record<string, string[]>;
  properties?: Record<string, ContractSchema>;
};

describe("OpenAPI contract", () => {
  it("is a valid OpenAPI document", async () => {
    const api = await SwaggerParser.validate("docs/openapi/aigo-v1.yaml");
    expect(api.info.title).toBe("AiGo Agent-Friendly Places API");
  });

  it("matches representative Zod create/update refinement cases", async () => {
    const api = (await SwaggerParser.validate("docs/openapi/aigo-v1.yaml")) as {
      components: { schemas: Record<string, ContractSchema> };
    };
    const createSchema = api.components.schemas.CreatePlaceRequest;
    const updateSchema = api.components.schemas.UpdatePlaceRequest;
    const baseCreate = {
      name: "테스트 장소",
      primaryCategory: "kids_cafe",
      lat: 36.35,
      lng: 127.38,
      sources: [{ sourceType: "official_site", url: "https://example.com/place" }]
    };
    const updateWithLatOnly = {
      lat: 36.36,
      sources: [{ sourceType: "official_site", url: "https://example.com/place" }]
    };
    const updateWithBothCoordinates = {
      lat: 36.36,
      lng: 127.39,
      sources: [{ sourceType: "official_site", url: "https://example.com/place" }]
    };
    const invertedAgeBounds = {
      minRecommendedAgeMonths: 72,
      maxRecommendedAgeMonths: 24,
      sources: [{ sourceType: "official_site", url: "https://example.com/place" }]
    };

    expect(createPlaceSchema.safeParse(baseCreate).success).toBe(false);
    expect(openApiAccepts(createSchema, baseCreate)).toBe(false);
    expect(createPlaceSchema.safeParse({ ...baseCreate, address: "대전광역시 중구" }).success).toBe(true);
    expect(openApiAccepts(createSchema, { ...baseCreate, address: "대전광역시 중구" })).toBe(true);
    expect(createPlaceSchema.safeParse({ ...baseCreate, regionSido: "대전" }).success).toBe(true);
    expect(openApiAccepts(createSchema, { ...baseCreate, regionSido: "대전" })).toBe(true);

    expect(updatePlaceSchema.safeParse(updateWithLatOnly).success).toBe(false);
    expect(openApiAccepts(updateSchema, updateWithLatOnly)).toBe(false);
    expect(updatePlaceSchema.safeParse(updateWithBothCoordinates).success).toBe(true);
    expect(openApiAccepts(updateSchema, updateWithBothCoordinates)).toBe(true);
    expect(updatePlaceSchema.safeParse(invertedAgeBounds).success).toBe(false);
    expect(ageBoundsDescription(updateSchema)).toContain("min must be less than or equal to max");
  });
});

function openApiAccepts(schema: ContractSchema, payload: JsonObject): boolean {
  if (schema.allOf?.some((subschema) => !openApiAccepts(subschema, payload))) return false;

  for (const key of schema.required ?? []) {
    if (payload[key] === undefined) return false;
  }

  if (schema.anyOf && !schema.anyOf.some((subschema) => openApiAccepts(subschema, payload))) {
    return false;
  }

  for (const [key, dependents] of Object.entries(schema.dependentRequired ?? {})) {
    if (payload[key] === undefined) continue;
    if (dependents.some((dependent) => payload[dependent] === undefined)) return false;
  }

  return true;
}

function ageBoundsDescription(schema: ContractSchema) {
  return JSON.stringify(schema);
}
