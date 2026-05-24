# AiGo Facet Taxonomy V1 Implementation Notes

Updated: 2026-05-24 KST

This file records the completed taxonomy v1 implementation and the operational contract agents should follow. It is no longer a queue plan. New follow-up work belongs in `docs/aigo-improvements.md` unless it changes the taxonomy/API workflow itself.

## Goal

AiGo keeps `primaryCategory` as a closed top-level category and uses `taxonomy` for finer family-planning semantics. This keeps search, scoring, audits, and agent-created payloads consistent without overloading freeform `tags`.

## Current Model

`places.taxonomy` is a non-null JSONB column with a GIN index. The default shape is:

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

- `sourceBacked`: cited facts only.
- `inferred`: agent-derived or migration-derived planning labels with optional confidence and basis.
- `migration.legacyTags`: original tags preserved before canonical cleanup.
- `migration.broadMappedTags`: legacy tags mapped broadly for recall.
- `migration.unmappedTags`: tags retained for audit because no confident canonical mapping exists.

Canonical values are English snake_case slugs. Korean labels and aliases belong in the normalization layer, not as stored canonical values.

## Canonical Catalog

Closed `primaryCategory` values:

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

Facet families:

- `familyFitGates`: `child_primary`, `baby_logistics`, `retail_fallback`, `route_break`, `user_signal`
- `activityTypes`: `indoor_play`, `outdoor_playground`, `water_play`, `sand_play`, `nature_walk`, `reading_books`, `toy_borrowing`, `shopping_browse`, `meal_play`, `science_exhibit`, `culture_exhibit`, `hands_on_experience`, `animals_aquarium`, `lodging_play`
- `visitUseCases`: `after_daycare`, `nearby_now`, `rainy_day`, `weekend_half_day`, `day_trip`, `hot_day`, `cold_day`
- `ageBands`: `infant`, `toddler`, `preschool`, `school_age`
- `logisticsTags`: `parking`, `low_parking_friction`, `stroller`, `double_stroller`, `elevator`, `nursing_room`, `diaper_table`, `kids_toilet`, `baby_chair`, `food_support`, `reservation`, `session_based`
- `riskTags`: `water_edge`, `road_nearby`, `steep_path`, `crowding`, `fire_grill`, `current_operation_uncertain`, `seasonal_operation`, `infant_amenity_gap`

Canonical source types and region aliases live in `src/lib/taxonomy.ts`. The API normalizes common source aliases such as `official`, `official_page`, `public_data_mirror`, `blog`, and image-source variants, and normalizes Korean region aliases such as `서울`, `경기`, `부산`, `강원`, `경남`, `경북`, `전북`, `전남`, and `제주`.

## Implemented Surfaces

- `src/lib/taxonomy.ts` defines category/source/taxonomy catalogs, alias normalization, legacy tag mapping, and Korean query facet inference.
- `src/lib/schemas.ts` validates closed `primaryCategory`, canonicalized `sourceType`, write-time `taxonomy`, and search-time `taxonomy`.
- `drizzle/0011_place_taxonomy.sql` adds `places.taxonomy`, `places_taxonomy_gin_idx`, derived search text support, and trigger dependency updates.
- `src/db/schema.ts` exposes the taxonomy column and index.
- `src/lib/places.ts` maps taxonomy through create/update/detail/search responses, builds initial taxonomy for creates, merges query-inferred facets with explicit search facets, and applies required taxonomy JSONB filters.
- `src/lib/scoring.ts` treats taxonomy facets as soft match signals.
- `src/lib/reasons.ts` exposes taxonomy reason codes:
  - `TAXONOMY_ACTIVITY_MATCH`
  - `TAXONOMY_USE_CASE_MATCH`
  - `TAXONOMY_LOGISTICS_MATCH`
  - `TAXONOMY_RISK_FLAG`
  - `TAXONOMY_UNKNOWN`
- `scripts/audit-taxonomy.ts` performs read-only drift audits.
- `scripts/apply-taxonomy-migration.ts` dry-runs by default and mutates real data only through API `PATCH`.
- `docs/openapi/aigo-v1.yaml`, `README.md`, and `.codex/skills/aigo-place-api/SKILL.md` document the contract.

## Search Semantics

`taxonomy.mode` defaults to `soft`.

In soft mode, requested taxonomy facets boost ranking and produce reason-code context without excluding unknown records. In required mode, every requested facet must appear in either `sourceBacked` or `inferred` taxonomy.

Natural Korean queries are normalized into soft taxonomy facets unless explicit request facets already cover that family. Implemented examples include:

- `모래놀이`, `모래놀이터` -> `activityTypes: ["sand_play"]`
- `물놀이`, `물놀이터`, `바닥분수` -> `activityTypes: ["water_play"]`
- `쌍둥이`, `쌍둥이유모차` -> `familyFitGates: ["baby_logistics"]`, plus stroller/elevator/parking/nursing/diaper logistics
- `하원`, `하원 후`, `어린이집 끝나고` -> `visitUseCases: ["after_daycare"]`
- `비오는날`, `우천`, `장마` -> `visitUseCases: ["rainy_day"]`
- `가는 길`, `도중`, `경로` -> `familyFitGates: ["route_break"]`, `visitUseCases: ["day_trip"]`
- `놀이방 식당`, `밥 먹고 놀기` -> `activityTypes: ["meal_play"]`

## Agent Rules

- Keep `primaryCategory` broad and closed; do not invent narrower category values.
- Put broader planning semantics such as `baby_logistics`, `after_daycare`, `rainy_day`, or `route_break` in `taxonomy`.
- Put physical equipment such as slides, swings, seesaws, sand play, and water play in `playFeatures`.
- Keep `tags` concise as search/display slugs. Preserve legacy/freeform cleanup context under `taxonomy.migration`.
- Use `sourceBacked` only for source-supported facts. Use `inferred` for broad agent or migration labels.
- A taxonomy fragment with only `sourceBacked` and/or `inferred` facets is valid; the API fills omitted schema version, empty facet arrays, and empty migration arrays.

## Audit And Apply

Read-only audit:

```bash
pnpm tsx scripts/audit-taxonomy.ts --json
```

Dry-run migration planning:

```bash
pnpm tsx scripts/apply-taxonomy-migration.ts --limit=5
```

Real migration apply:

```bash
pnpm tsx scripts/apply-taxonomy-migration.ts --limit=5 --apply
```

The apply script reads place details through the API and performs real mutations only through `PATCH /v1/places/{placeId}` with `sourceMode: "replace"` and a taxonomy v1 migration audit source. It must not directly update real place rows in the database.

## Verification

Relevant checks:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm tsx scripts/audit-taxonomy.ts --json
pnpm tsx scripts/aigo-preflight.ts
pnpm tsx scripts/audit-scoring.ts --limit=5
```

Spot-check search results after data migration for:

- A park with legacy playground tags.
- A shopping mall with baby logistics.
- A kids cafe inside a parent mall.
- A rest area route-break candidate.
- A kid-primary accommodation record.

## Remaining Follow-Up Policy

If taxonomy usage reveals search, scoring, dedupe, UI, or agent-workflow friction, add an actionable `[대기]` item to `docs/aigo-improvements.md` with the source task, payload, result context, and verification path. Do not turn this file back into an active queue unless the taxonomy contract itself changes.
