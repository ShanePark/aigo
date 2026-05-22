import { describe, expect, it } from "vitest";

import {
  missingDatabaseSchemaArtifacts,
  requiredDatabaseSchema,
  type DatabaseSchemaInventory
} from "../scripts/aigo-preflight-schema";

describe("AiGo preflight schema inventory", () => {
  it("accepts the required migration-backed schema artifacts", () => {
    expect(missingDatabaseSchemaArtifacts(completeInventory())).toEqual([]);
  });

  it("reports derived columns, custom indexes, constraints, triggers, functions, and extensions", () => {
    const inventory = completeInventory();
    inventory.columns = inventory.columns.filter((row) => !(row.tableName === "places" && row.columnName === "search_text"));
    inventory.extensions = inventory.extensions.filter((extension) => extension !== "pg_trgm");
    inventory.functions = inventory.functions.filter((functionName) => functionName !== "set_place_derived_fields");
    inventory.indexes = inventory.indexes.filter((row) => row.name !== "place_images_one_primary_active_idx");
    inventory.constraints = inventory.constraints.filter((row) => row.name !== "place_related_places_canonical_check");
    inventory.triggers = inventory.triggers.filter((row) => row.name !== "places_set_derived_fields");

    expect(missingDatabaseSchemaArtifacts(inventory)).toEqual([
      "places.search_text",
      "extension.pg_trgm",
      "function.set_place_derived_fields",
      "index.place_images.place_images_one_primary_active_idx",
      "constraint.place_related_places.place_related_places_canonical_check",
      "trigger.places.places_set_derived_fields"
    ]);
  });
});

function completeInventory(): DatabaseSchemaInventory {
  return {
    columns: Object.entries(requiredDatabaseSchema.columns).flatMap(([tableName, columns]) =>
      columns.map((columnName) => ({ tableName, columnName }))
    ),
    constraints: [...requiredDatabaseSchema.constraints],
    extensions: [...requiredDatabaseSchema.extensions],
    functions: [...requiredDatabaseSchema.functions],
    indexes: [...requiredDatabaseSchema.indexes],
    triggers: [...requiredDatabaseSchema.triggers]
  };
}
