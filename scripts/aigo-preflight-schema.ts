export type DatabaseSchemaObject = {
  tableName: string;
  name: string;
};

export type DatabaseSchemaInventory = {
  columns: Array<{ tableName: string; columnName: string }>;
  constraints: DatabaseSchemaObject[];
  extensions: string[];
  functions: string[];
  indexes: DatabaseSchemaObject[];
  triggers: DatabaseSchemaObject[];
};

export type RequiredDatabaseSchema = {
  columns: Record<string, string[]>;
  constraints: DatabaseSchemaObject[];
  extensions: string[];
  functions: string[];
  indexes: DatabaseSchemaObject[];
  triggers: DatabaseSchemaObject[];
};

export const requiredDatabaseSchema: RequiredDatabaseSchema = {
  columns: {
    users: ["id", "email", "display_name", "role", "created_at", "updated_at"],
    auth_sessions: ["id", "user_id", "token_hash", "expires_at", "last_used_at", "created_at"],
    user_children: ["id", "user_id", "birth_year_month", "gender", "sort_order", "created_at", "updated_at"],
    user_home_locations: ["user_id", "label", "lat", "lng", "address_text", "created_at", "updated_at"],
    places: [
      "id",
      "name",
      "primary_category",
      "tags",
      "lat",
      "lng",
      "country_code",
      "country_name",
      "city",
      "locality",
      "local_currency",
      "geo",
      "external_refs",
      "play_features",
      "taxonomy",
      "pricing",
      "review_search_evidence",
      "route_support",
      "search_text",
      "opening_hours",
      "place_score",
      "place_score_rationale",
      "external_rating_score",
      "external_review_count",
      "search_evidence_score",
      "score_signals",
      "score_updated_at",
      "reservation_required",
      "walk_in_available",
      "session_based",
      "same_day_availability_known",
      "parking_friction_level"
    ],
    place_sources: ["id", "place_id", "source_type", "url", "external_id", "checked_at"],
    place_images: [
      "id",
      "place_id",
      "url",
      "source_id",
      "source_type",
      "source_title",
      "source_url",
      "display_tier",
      "status",
      "review_status",
      "is_primary",
      "checked_at"
    ],
    place_related_places: ["id", "place_id", "related_place_id", "relation_type", "note", "evidence"],
    place_visits: [
      "id",
      "user_id",
      "place_id",
      "visited_on",
      "rating",
      "review_text",
      "visibility",
      "is_revisit",
      "created_at",
      "updated_at"
    ],
    place_visit_photos: [
      "id",
      "visit_id",
      "user_id",
      "place_id",
      "storage_key",
      "original_filename",
      "mime_type",
      "byte_size",
      "width",
      "height",
      "visibility",
      "created_at"
    ],
    place_public_memos: ["id", "user_id", "place_id", "body", "created_at", "updated_at"],
    user_place_saves: ["id", "user_id", "place_id", "want_to_go", "hearted", "created_at", "updated_at"],
    place_versions: ["id", "place_id", "version_number", "snapshot", "sources"]
  },
  constraints: [
    { tableName: "users", name: "users_role_check" },
    { tableName: "user_children", name: "user_children_birth_year_month_check" },
    { tableName: "user_children", name: "user_children_gender_check" },
    { tableName: "user_children", name: "user_children_sort_order_check" },
    { tableName: "user_home_locations", name: "user_home_locations_lat_check" },
    { tableName: "user_home_locations", name: "user_home_locations_lng_check" },
    { tableName: "places", name: "places_place_score_range" },
    { tableName: "places", name: "places_external_rating_score_range" },
    { tableName: "places", name: "places_external_review_count_nonnegative" },
    { tableName: "places", name: "places_search_evidence_score_range" },
    { tableName: "place_images", name: "place_images_display_tier_check" },
    { tableName: "place_images", name: "place_images_status_check" },
    { tableName: "place_images", name: "place_images_review_status_check" },
    { tableName: "place_related_places", name: "place_related_places_distinct_check" },
    { tableName: "place_related_places", name: "place_related_places_canonical_check" },
    { tableName: "place_related_places", name: "place_related_places_relation_type_check" },
    { tableName: "place_visits", name: "place_visits_rating_check" },
    { tableName: "place_visits", name: "place_visits_visibility_check" },
    { tableName: "place_visit_photos", name: "place_visit_photos_visibility_check" },
    { tableName: "place_visit_photos", name: "place_visit_photos_mime_type_check" },
    { tableName: "place_visit_photos", name: "place_visit_photos_byte_size_check" },
    { tableName: "place_visit_photos", name: "place_visit_photos_width_check" },
    { tableName: "place_visit_photos", name: "place_visit_photos_height_check" },
    { tableName: "place_public_memos", name: "place_public_memos_body_length_check" },
    { tableName: "user_place_saves", name: "user_place_saves_active_state_check" }
  ],
  extensions: ["postgis", "pg_trgm", "pgcrypto"],
  functions: ["set_place_derived_fields"],
  indexes: [
    { tableName: "places", name: "places_geo_idx" },
    { tableName: "places", name: "places_tags_idx" },
    { tableName: "places", name: "places_name_trgm_idx" },
    { tableName: "places", name: "places_search_text_trgm_idx" },
    { tableName: "places", name: "places_play_features_gin_idx" },
    { tableName: "places", name: "places_taxonomy_gin_idx" },
    { tableName: "places", name: "places_route_support_gin_idx" },
    { tableName: "places", name: "places_place_score_idx" },
    { tableName: "places", name: "places_score_updated_at_idx" },
    { tableName: "users", name: "users_email_unique" },
    { tableName: "auth_sessions", name: "auth_sessions_user_id_idx" },
    { tableName: "auth_sessions", name: "auth_sessions_token_hash_unique" },
    { tableName: "auth_sessions", name: "auth_sessions_expires_at_idx" },
    { tableName: "user_children", name: "user_children_user_sort_order_idx" },
    { tableName: "place_images", name: "place_images_place_url_unique" },
    { tableName: "place_images", name: "place_images_one_primary_active_idx" },
    { tableName: "place_related_places", name: "place_related_places_pair_unique" },
    { tableName: "place_visits", name: "place_visits_user_visited_on_idx" },
    { tableName: "place_visits", name: "place_visits_place_id_idx" },
    { tableName: "place_visits", name: "place_visits_place_visibility_idx" },
    { tableName: "place_visit_photos", name: "place_visit_photos_visit_id_idx" },
    { tableName: "place_visit_photos", name: "place_visit_photos_user_id_idx" },
    { tableName: "place_visit_photos", name: "place_visit_photos_place_id_idx" },
    { tableName: "place_visit_photos", name: "place_visit_photos_storage_key_unique" },
    { tableName: "place_public_memos", name: "place_public_memos_user_place_unique" },
    { tableName: "place_public_memos", name: "place_public_memos_place_updated_at_idx" },
    { tableName: "place_public_memos", name: "place_public_memos_user_id_idx" },
    { tableName: "user_place_saves", name: "user_place_saves_user_place_unique" },
    { tableName: "user_place_saves", name: "user_place_saves_user_updated_at_idx" },
    { tableName: "user_place_saves", name: "user_place_saves_place_hearted_idx" }
  ],
  triggers: [{ tableName: "places", name: "places_set_derived_fields" }]
};

export function missingDatabaseSchemaArtifacts(
  inventory: DatabaseSchemaInventory,
  required: RequiredDatabaseSchema = requiredDatabaseSchema
) {
  const missing: string[] = [];
  const availableColumns = new Map<string, Set<string>>();
  for (const row of inventory.columns) {
    const tableColumns = availableColumns.get(row.tableName) ?? new Set<string>();
    tableColumns.add(row.columnName);
    availableColumns.set(row.tableName, tableColumns);
  }

  for (const [table, columns] of Object.entries(required.columns)) {
    const tableColumns = availableColumns.get(table);
    if (!tableColumns) {
      missing.push(`${table}.*`);
      continue;
    }

    for (const column of columns) {
      if (!tableColumns.has(column)) {
        missing.push(`${table}.${column}`);
      }
    }
  }

  const availableExtensions = new Set(inventory.extensions);
  for (const extension of required.extensions) {
    if (!availableExtensions.has(extension)) {
      missing.push(`extension.${extension}`);
    }
  }

  const availableFunctions = new Set(inventory.functions);
  for (const functionName of required.functions) {
    if (!availableFunctions.has(functionName)) {
      missing.push(`function.${functionName}`);
    }
  }

  collectMissingObjects(missing, "index", inventory.indexes, required.indexes);
  collectMissingObjects(missing, "constraint", inventory.constraints, required.constraints);
  collectMissingObjects(missing, "trigger", inventory.triggers, required.triggers);

  return missing;
}

function collectMissingObjects(
  missing: string[],
  artifactType: "constraint" | "index" | "trigger",
  availableObjects: DatabaseSchemaObject[],
  requiredObjects: DatabaseSchemaObject[]
) {
  const available = new Set(availableObjects.map(schemaObjectKey));
  for (const requiredObject of requiredObjects) {
    if (!available.has(schemaObjectKey(requiredObject))) {
      missing.push(`${artifactType}.${requiredObject.tableName}.${requiredObject.name}`);
    }
  }
}

function schemaObjectKey(object: DatabaseSchemaObject) {
  return `${object.tableName}.${object.name}`;
}
