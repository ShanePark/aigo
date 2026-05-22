# AiGo Facet Taxonomy V1 Queue Plan

Queued: 2026-05-22 KST

This file is the implementation handoff for the AiGo Facet Taxonomy V1 work. Work this item sequentially from the improvement queue, not in parallel with unrelated frontend/search/backlog edits. Before starting each phase, run `git status --short` and avoid touching files that are already being actively edited by another heartbeat/task unless the task is explicitly resumed for this item.

## Goal

Stabilize AiGo's place classification for LLM agent collection. Keep the existing 16 `primaryCategory` values as the closed top-level category set, and move finer meaning into controlled facet taxonomy data that can drive research, filtering, search recall, scoring, and audits.

Current problem snapshot:

- `primaryCategory` has 16 de facto values but is currently an unconstrained string in API/DB validation.
- `tags` has thousands of mixed values: Korean/English aliases, region names, feature labels, source/provider markers, and collection batch tags.
- `sourceType` and `regionSido` also have alias drift, such as `official` vs `official_site`, and `대전` vs `대전광역시`.
- Agents need one canonical place-data vocabulary so future research files and API mutations are consistent.

Progress:

- Phase 1 catalog/input validation has been implemented. Continue from Phase 2.

## Queue Guardrails

- Do not revive the partial implementation that was interrupted before this file was created; start from the current repository state.
- Do not implement this in parallel with active search UI/filter/theme work. This task touches shared schemas, search, docs, migrations, and tests.
- Preserve unrelated user/heartbeat edits. If a file in this plan already has active unrelated changes, inspect and work with them instead of reverting.
- Use API paths for real place data mutation. Do not directly update real place rows outside migration scripts except for read-only audits.
- Keep `agent-research/` ignored and do not commit research staging files.
- After changing API schemas, OpenAPI, source/image rules, categories, tag/search semantics, or place workflow guidance, update `.codex/skills/aigo-place-api/SKILL.md` in the same commit.

## Target Model

Add a new `places.taxonomy` JSONB field with a GIN index.

Shape:

```json
{
  "schemaVersion": 1,
  "sourceBacked": {
    "familyFitGates": [],
    "activityTypes": [],
    "visitUseCases": [],
    "ageBands": [],
    "logisticsTags": [],
    "riskTags": []
  },
  "inferred": {
    "familyFitGates": [],
    "activityTypes": [],
    "visitUseCases": [],
    "ageBands": [],
    "logisticsTags": [],
    "riskTags": [],
    "confidence": "high|medium|low",
    "basis": "short explanation"
  },
  "migration": {
    "legacyTags": [],
    "broadMappedTags": [],
    "unmappedTags": [],
    "normalizedAt": "ISO datetime"
  }
}
```

Semantics:

- `sourceBacked`: source-supported facts only.
- `inferred`: agent-derived parent-planning labels; broad mappings are allowed but must carry low/medium confidence.
- `migration.legacyTags`: preserve all original tags before canonical rewrite.
- `migration.broadMappedTags`: legacy tags mapped broadly for recall.
- `migration.unmappedTags`: tags retained for audit because no confident canonical mapping exists.

Canonical values are English snake_case slugs. Korean labels and aliases belong in a central mapping layer, not as canonical values.

## Phase 1: Taxonomy Catalog And Validation

Create `src/lib/taxonomy.ts` with:

- `primaryCategories` closed set:
  - `kids_cafe`
  - `indoor_playground`
  - `toy_store`
  - `toy_library`
  - `library`
  - `museum`
  - `science_museum`
  - `experience_center`
  - `aquarium_zoo`
  - `park`
  - `family_cafe`
  - `family_restaurant`
  - `sports_venue`
  - `shopping_mall`
  - `rest_area`
  - `accommodation`
- Canonical source type set with aliases mapping existing values such as `official`, `official_page`, `public_data_mirror`, `blog`, `geocode`, and image-source variants into stable values.
- Region alias normalization, at minimum:
  - `대전` -> `대전광역시`
  - `충남` -> `충청남도`
  - `충북` -> `충청북도`
  - `세종` -> `세종특별자치시`
  - `강원` -> `강원특별자치도`
  - `경남` -> `경상남도`
  - `경북` -> `경상북도`
  - `전북` -> `전북특별자치도`
  - `전남` -> `전라남도`
  - `제주` -> `제주특별자치도`
- Facet families:
  - `familyFitGates`: `child_primary`, `baby_logistics`, `retail_fallback`, `route_break`, `user_signal`.
  - `activityTypes`: `indoor_play`, `outdoor_playground`, `water_play`, `sand_play`, `nature_walk`, `reading_books`, `toy_borrowing`, `shopping_browse`, `meal_play`, `science_exhibit`, `culture_exhibit`, `hands_on_experience`, `animals_aquarium`, `lodging_play`.
  - `visitUseCases`: `after_daycare`, `nearby_now`, `rainy_day`, `weekend_half_day`, `day_trip`, `hot_day`, `cold_day`.
  - `ageBands`: `infant`, `toddler`, `preschool`, `school_age`.
  - `logisticsTags`: `parking`, `low_parking_friction`, `stroller`, `double_stroller`, `elevator`, `nursing_room`, `diaper_table`, `kids_toilet`, `baby_chair`, `food_support`, `reservation`, `session_based`.
  - `riskTags`: `water_edge`, `road_nearby`, `steep_path`, `crowding`, `fire_grill`, `current_operation_uncertain`, `seasonal_operation`, `infant_amenity_gap`.
- Functions to normalize category/source/region, infer taxonomy from current place fields, normalize legacy tags, and infer taxonomy search facets from natural Korean parent queries.

Update `src/lib/schemas.ts`:

- Add `primaryCategorySchema`, `sourceTypeSchema`, and `taxonomySchema`.
- Use `primaryCategorySchema` in create/update inputs.
- Use `sourceTypeSchema` in sources and image source metadata where appropriate.
- Add `taxonomy` to writable place fields.
- Add optional search input:
  - `taxonomy: { mode?: "soft" | "required", familyFitGates?: string[], activityTypes?: string[], visitUseCases?: string[], ageBands?: string[], logisticsTags?: string[], riskTags?: string[] }`

## Phase 2: Database And API Wiring

Add a new Drizzle migration:

- `places.taxonomy jsonb not null default <empty taxonomy>`
- `places_taxonomy_gin_idx` using GIN.
- Update `set_place_derived_fields()` so `search_text` includes canonical taxonomy facet terms.
- Update the trigger dependency list to include `taxonomy`.

Update `src/db/schema.ts` and `scripts/aigo-preflight-schema.ts` for the new column and index.

Update `src/lib/places.ts`:

- Add `taxonomy` to `PlaceRow`, `columnMap`, `placeholderFor`, `toSqlParam`, `mapPlace`, search result items, compact projection if applicable, and detail responses.
- Normalize create/update inputs before writing:
  - `primaryCategory`
  - `sources[].sourceType`
  - `images[].sourceType`
  - `regionSido`
  - `tags`
  - `taxonomy`
- Preserve `playFeatures`; physical equipment stays there, broader place-planning classification goes in `taxonomy`.

Source replace safety:

- When `sourceMode: "replace"` is used, preserve image source linkage.
- Before deleting source rows, record current image `source_id`, `source_url`, and `source_type`.
- Insert canonicalized sources.
- Reconnect `place_images.source_id` by matching `source_url` plus canonical `source_type` when possible.
- Leave `source_url`/`source_type` metadata intact if no new source row matches.

## Phase 3: Search And Reason Codes

Search behavior:

- `taxonomy.mode` defaults to `soft`.
- In required mode, add SQL JSONB containment clauses so requested facets must appear in either `sourceBacked` or `inferred`.
- In soft mode, do not exclude; score matches in application scoring.
- Merge query-inferred taxonomy with explicit search taxonomy without overriding explicit request values.

Natural query intent:

- Map at least these natural inputs:
  - `모래놀이`, `모래놀이터` -> `activityTypes: ["sand_play"]`
  - `물놀이`, `물놀이터`, `바닥분수` -> `activityTypes: ["water_play"]`
  - `쌍둥이`, `쌍둥이유모차` -> `familyFitGates: ["baby_logistics"]`, `logisticsTags: ["double_stroller", "stroller", "elevator", "parking", "nursing_room", "diaper_table"]`
  - `하원`, `하원 후`, `어린이집 끝나고` -> `visitUseCases: ["after_daycare"]`
  - `비오는날`, `우천`, `장마` -> `visitUseCases: ["rainy_day"]`
  - `가는 길`, `도중`, `경로` -> `familyFitGates: ["route_break"]`, `visitUseCases: ["day_trip"]`
  - `놀이방 식당`, `밥 먹고 놀기` -> `activityTypes: ["meal_play"]`

Reason codes:

- `TAXONOMY_ACTIVITY_MATCH`
- `TAXONOMY_USE_CASE_MATCH`
- `TAXONOMY_LOGISTICS_MATCH`
- `TAXONOMY_RISK_FLAG`
- `TAXONOMY_UNKNOWN`

Update `src/lib/reasons.ts` with Korean labels and priorities.

## Phase 4: Audit And Apply Scripts

Add `scripts/audit-taxonomy.ts`.

Requirements:

- Read-only DB scan.
- Supports `--json` and `--category=<id>`.
- Reports:
  - primary category distribution and invalid categories.
  - unique tag count, singleton count, process-like tag count.
  - source type aliases and unknown source types.
  - region aliases and unknown region names.
  - taxonomy inferred/sourceBacked counts by facet.
  - unmapped/broadMapped examples.

Add `scripts/apply-taxonomy-migration.ts`.

Requirements:

- Dry-run by default.
- `--apply` performs API PATCH calls only, never direct DB updates for place data.
- Uses `AIGO_API_BASE_URL` or `http://localhost:3000`, and `AIGO_API_KEY` or default dev key.
- For each active/non-active place:
  - read current place detail.
  - canonicalize existing sources.
  - compute canonical `tags`, `taxonomy`, and normalized `regionSido`.
  - PATCH with `sourceMode: "replace"`.
  - include a migration audit source.
  - `changeSummary`: `Normalize taxonomy, tags, region, and source types for taxonomy v1.`
- Print a summary of updated/skipped/failed rows and a sample of failures.

## Phase 5: Documentation

Update `docs/openapi/aigo-v1.yaml`:

- Add `PlaceTaxonomy`, `TaxonomyFacetSet`, `SearchTaxonomyRequest` schemas.
- Add enum values for `PrimaryCategory` and canonical source types.
- Add `taxonomy` to writable fields, search request, search item, compact search item, and place detail.

Update `.codex/skills/aigo-place-api/SKILL.md`:

- Explain canonical primary categories.
- Explain taxonomy facets and when to use `sourceBacked` vs `inferred`.
- Explain that `tags` should be canonical/search/display slugs only, while legacy/freeform values belong in taxonomy migration metadata during cleanup.
- Explain source type and region canonicalization.
- Explain audit/apply scripts and verification commands.

Update `README.md` only if the public API/search overview needs a short taxonomy mention.

## Test Plan

Add or update unit tests:

- `primaryCategorySchema` rejects unknown categories.
- `sourceTypeSchema` canonicalizes aliases.
- `taxonomySchema` accepts the V1 shape and rejects invalid confidence/mode values.
- Korean/freeform aliases map to canonical facets.
- Broad/unmapped legacy tag preservation works.
- Region aliases normalize.
- `sourceMode: "replace"` preserves or reconnects image source linkage.
- Natural query intent expands into taxonomy search facets.
- Required taxonomy search adds filtering while soft taxonomy search only affects scoring.

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm tsx scripts/audit-taxonomy.ts --json
pnpm tsx scripts/aigo-preflight.ts
pnpm tsx scripts/audit-scoring.ts --limit=5
```

After data migration apply, also spot-check:

- A park with legacy playground tags.
- A shopping mall with baby logistics.
- A kids cafe inside a parent mall.
- A rest area route-break candidate.
- A lodging record.

## Acceptance Criteria

- No open-ended `primaryCategory` values can be created through the API.
- New source inputs are stored as canonical source types.
- New place writes can include `taxonomy`, and responses return it.
- Search accepts taxonomy facets and emits taxonomy reason codes.
- Audit script reports current taxonomy readiness without mutating data.
- Apply script dry-run is safe and explicit; `--apply` uses API PATCH with version history.
- Existing legacy tags are preserved under `taxonomy.migration.legacyTags` before canonical `tags` are rewritten.
- OpenAPI, skill guidance, schema, and tests agree.
