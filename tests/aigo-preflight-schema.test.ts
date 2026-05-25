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

  it("reports missing member, session, visit, and visit photo artifacts", () => {
    const inventory = completeInventory();
    inventory.columns = inventory.columns.filter(
      (row) =>
        !(row.tableName === "users" && row.columnName === "email") &&
        !(row.tableName === "auth_sessions" && row.columnName === "token_hash") &&
        !(row.tableName === "place_visits" && row.columnName === "rating") &&
        !(row.tableName === "place_visit_photos" && row.columnName === "storage_key")
    );
    inventory.indexes = inventory.indexes.filter(
      (row) =>
        row.name !== "users_email_unique" &&
        row.name !== "auth_sessions_token_hash_unique" &&
        row.name !== "place_visits_user_visited_on_idx" &&
        row.name !== "place_visit_photos_storage_key_unique"
    );
    inventory.constraints = inventory.constraints.filter(
      (row) =>
        row.name !== "users_role_check" &&
        row.name !== "place_visits_rating_check" &&
        row.name !== "place_visit_photos_mime_type_check"
    );

    expect(missingDatabaseSchemaArtifacts(inventory)).toEqual([
      "users.email",
      "auth_sessions.token_hash",
      "place_visits.rating",
      "place_visit_photos.storage_key",
      "index.users.users_email_unique",
      "index.auth_sessions.auth_sessions_token_hash_unique",
      "index.place_visits.place_visits_user_visited_on_idx",
      "index.place_visit_photos.place_visit_photos_storage_key_unique",
      "constraint.users.users_role_check",
      "constraint.place_visits.place_visits_rating_check",
      "constraint.place_visit_photos.place_visit_photos_mime_type_check"
    ]);
  });

  it("reports missing account personalization artifacts", () => {
    const inventory = completeInventory();
    inventory.columns = inventory.columns.filter(
      (row) =>
        !(row.tableName === "user_children" && row.columnName === "birth_year_month") &&
        !(row.tableName === "user_children" && row.columnName === "gender") &&
        !(row.tableName === "user_home_locations" && row.columnName === "lat")
    );
    inventory.indexes = inventory.indexes.filter((row) => row.name !== "user_children_user_sort_order_idx");
    inventory.constraints = inventory.constraints.filter(
      (row) =>
        row.name !== "user_children_birth_year_month_check" &&
        row.name !== "user_children_gender_check" &&
        row.name !== "user_home_locations_lat_check"
    );

    expect(missingDatabaseSchemaArtifacts(inventory)).toEqual([
      "user_children.birth_year_month",
      "user_children.gender",
      "user_home_locations.lat",
      "index.user_children.user_children_user_sort_order_idx",
      "constraint.user_children.user_children_birth_year_month_check",
      "constraint.user_children.user_children_gender_check",
      "constraint.user_home_locations.user_home_locations_lat_check"
    ]);
  });

  it("reports missing public place memo artifacts", () => {
    const inventory = completeInventory();
    inventory.columns = inventory.columns.filter((row) => !(row.tableName === "place_public_memos" && row.columnName === "body"));
    inventory.indexes = inventory.indexes.filter(
      (row) => row.name !== "place_public_memos_user_place_unique" && row.name !== "place_public_memos_place_updated_at_idx"
    );
    inventory.constraints = inventory.constraints.filter((row) => row.name !== "place_public_memos_body_length_check");

    expect(missingDatabaseSchemaArtifacts(inventory)).toEqual([
      "place_public_memos.body",
      "index.place_public_memos.place_public_memos_user_place_unique",
      "index.place_public_memos.place_public_memos_place_updated_at_idx",
      "constraint.place_public_memos.place_public_memos_body_length_check"
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
