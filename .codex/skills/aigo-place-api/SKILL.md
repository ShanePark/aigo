---
name: aigo-place-api
description: Use when researching, deduplicating, creating, updating, enriching, or verifying AiGo place data through the /v1/places API, including source-backed family outing data across Korea, agent-research staging notes, image URL provenance, duplicate checks, and version-history verification.
---

# AiGo Place API

## Use This Skill When

Use this skill for any AiGo task that researches, creates, updates, enriches, reviews, or verifies real place data. This includes new place discovery, user-visited reference places, duplicate resolution, image URL enrichment, source cleanup, and API mutation planning.

Do not use direct database writes for real place data. Real mutations go through the AiGo API.

## Ground Rules

- Treat source evidence as part of the data, not an afterthought. Every create/update requires at least one `sources` item.
- Treat image evidence as required metadata for this workflow. For user-requested AiGo registrations, every create/update that registers or enriches a place through the API must include at least one citeable, place-specific structured `images` item unless the user explicitly overrides the requirement for that single operation.
- Unknown is acceptable. Do not invent amenities, ages, coordinates, opening hours, or image provenance.
- Prefer broad public internet research: official facility/operator pages, public agency pages, library/tourism/mall pages, and public local listings or blogs only as support.
- Avoid high-volume map/vendor automation. Do not run repeated Kakao Map/API loops. If a map URL is used, keep it sparse and manual-style, and store only URL/external ID/summary.
- Never log in, create accounts, bypass access controls, or send private user data to third-party sites.
- Subagents may research and write `agent-research/*.md`; they must not mutate data. For broad discovery work, assigned subagents may use read-only AiGo API checks such as `POST /v1/places/search`, `POST /v1/places/duplicates`, and `GET /v1/places/{placeId}` before deep research so they do not spend tokens on already-registered places. The main agent, or one explicitly assigned API mutation agent, consolidates findings and calls create/update/delete APIs to avoid conflicting writes.
- For user-requested registrations, create/update directly as searchable data. Use `status: "active"` and `dataConfidence: "agent_collected"` or `"user_reported"`; do not use `status: "needs_review"`, `dataConfidence: "needs_check"`, or image `reviewStatus: "needs_review"` in API payloads. Capture uncertainty with `unknown` fields, conservative scores, `parentNotes`, and `safetyNotes` instead of hiding the place from search.
- During place research, data collection, or API registration waves, do not stop to fix product/API/schema/tooling issues discovered along the way. Add an actionable `[대기]` proposal to `docs/aigo-improvements.md` with enough context for the separate improvement automation to pick it up later.

## Family-Fit Gate

Before recommending `create` for a real place, explicitly record why it belongs in a toddler plus twin-infant family outing database. A place should normally pass at least one of these gates:

- Child-primary destination: kids cafe, indoor playground, children's museum, toy library, children's room/library, playground, water/sand/sensory play, or an official child/family program.
- Baby-logistics destination: source-backed nursing room, diaper-changing table, stroller/elevator route, baby chair, food/snack handling, or a mall/public facility where first-child activity and infant care can be solved together.
- User-requested short retail fallback: toy stores or character stores can be registered under `toy_store` when they are source-backed and useful for child-focused shopping, rainy-day browsing, or a practical stop inside a mall/outlet with family logistics. Keep play value and stay duration conservative unless sources show real play/experience zones.
- Route-break utility: highway rest area, public facility, or route stop with source-backed toilets, nursing/diaper support, parking, and a clear route context such as family travel routes, regional day trips, or long-distance kid-friendly itineraries.
- User-signal exception: the user explicitly mentioned or visited the place, but weak family fit must still be documented with cautionary notes and conservative scores.

Do not create or keep an active recommendation just because a place is indoor, free, official, close to a base area, or has tourism/culture value. Tourist information centers, travel lounges, adult-oriented galleries, generic historic exhibits, scenic viewpoints, large cafes, and general rest spaces should be skipped or held in research notes unless they pass one of the gates above or the user explicitly asks to register them.

Do not force a weak candidate into `family_cafe` only because no better category exists. Use `family_cafe` for a cafe/restaurant-style place with source-backed family logistics or child value. Use `rest_area` only for route-break stops, and make the route-break purpose explicit in tags and `parentNotes`; it is not a standalone outing destination.

When a candidate is useful only as a short add-on or fallback, encode that honestly:

- Set `childEngagementLevel` low and `averageStayMinutes` short.
- Use conservative `minRecommendedAgeMonths` and avoid broad `0-144` ranges unless all ages are genuinely supported.
- Add `parentNotes` that say it is not a primary kids play venue.
- For user-requested registrations, keep `status: "active"` and use `dataConfidence: "agent_collected"` or `dataConfidence: "user_reported"`; put current-operation, baby-logistics, or child-value caveats in notes.

## Workflow

1. Scope the research slice.
   - For broad expansion, collect family-useful places nationwide across Korea. Daejeon Station / old downtown, Daejeon, and roughly one-hour driving range remain important personalization anchors and prior-coverage references, but they are not geographic limits.
   - Split nationwide work into region blocks so coverage grows evenly: Seoul/Incheon/Gyeonggi, Gangwon, Chungcheong, Jeolla/Gwangju, Gyeongsang/Busan/Daegu/Ulsan, and Jeju. Within each block, prioritize major cities, tourism corridors, and family-travel routes before smaller long-tail areas.
   - Favor family-fit leads: indoor fallback, kids cafes, public child-friendly facilities, stroller logistics, nursing/diaper support, parking, snacks/meals, short outdoor sensory play, and practical day trips.
   - Apply the Family-Fit Gate before staging a create candidate. If the only positive evidence is "official/indoor/free/nearby/tourism", stage as `skip` or hold it in research notes, not `create`, unless the user explicitly asked to register it.

2. Delegate independent research.
   - Split nationwide collection by region block and category so reports stay comparable and dedupe-friendly. Useful region slices include Seoul/Incheon/Gyeonggi; Busan/Ulsan/Gyeongnam; Daegu/Gyeongbuk; Gwangju/Jeonnam/Jeonbuk; Gangwon; Chungcheong/Daejeon/Sejong; and Jeju.
   - Split category work within those areas when the scope is large: kids cafes and indoor playgrounds; outdoor playgrounds, parks, water/sand play, and forest play; public child-friendly facilities such as libraries, toy libraries, museums, science/experience centers, sports venues, and municipal facilities; shopping malls and department/outlet fallback destinations; family restaurants and playroom cafes; family-friendly lodging/resorts; route-break rest areas and travel support stops.
   - Give each subagent clear ownership of one district/category slice, concrete search terms, and a unique report filename under `agent-research/`.
   - Tell subagents not to mutate data. For broad candidate discovery, have them do a cheap read-only dedupe pass before opening many source pages: use exact-name `/v1/places/search` when coordinates are unknown, `/v1/places/duplicates` when name and coordinates are known, and `GET /v1/places/{placeId}` only for likely matches that need comparison. Their deliverable is a structured Markdown file under `agent-research/`.
   - Use only one API mutation executor after research reports are available. That executor performs duplicate checks, compares existing records, creates missing places, patches enrichments, and verifies versions.

3. Run shallow discovery before deep research.
   - Start with search-result snippets, official directory/list pages, public facility lists, or category roundup pages to collect only place names, branch names, rough area, and one likely source URL.
   - Before opening many pages for a candidate, query AiGo for duplicates and exact-name matches. If a strong existing record is found, stage it as `update` only when the shallow source shows a real data gap; otherwise record `skip_existing`.
   - Deep-dive only candidates that are likely missing, likely stale, or have high-value missing family logistics. Deep research should collect address, coordinates, family signals, source summaries, and image provenance.
   - Maintain a visited-page ledger in the active `agent-research/` context or slice file. Record source URLs and search queries already used so later agents avoid repeating the same page unless they are resolving a specific conflict or checking freshness.

4. Research with source notes.
   - Use one staging file per slice: `agent-research/<topic>-YYYYMMDD-HHMM.md`.
   - For each place, record suggested action (`create`, `update`, `skip_existing`, `skip`, or `hold_for_later`), family signals, source URLs with short summaries, confidence, open questions, and a possible API payload fragment using camelCase fields. `needs_review` is not a registration status for user-requested API writes.
   - For weak-fit candidates, record the failed gate explicitly, such as "tourist information/lounge only; no baby logistics; no child-primary activity."
   - For image work, record `images` candidates and provenance. If no citeable image is found, hold the candidate in research notes instead of creating/updating it, unless the user explicitly approves a no-image exception for that place.
   - When API, product, schema, search, dedupe, or tooling usage reveals friction, bugs, unclear behavior, or future improvements during place collection/registration, do not fix it directly in that wave. Add or update an actionable `[대기]` proposal in `docs/aigo-improvements.md`, including the source task/research file and enough payload/result context for a later automation to reproduce it.

5. Check duplicates before mutation.
   - Call `POST /v1/places/duplicates` with `name`, `lat`, `lng`, optional `kakaoPlaceId`, optional `externalRefs`, and a reasonable `radiusMeters`.
   - If a likely candidate exists, call `GET /v1/places/{placeId}`, compare current data, and usually `PATCH`.
   - If no meaningful candidate exists, `POST /v1/places`.
   - If evidence is weak or identity is uncertain for a user-requested registration, still keep the place searchable with `status: "active"` and `dataConfidence: "agent_collected"` or `"user_reported"`; make the uncertainty explicit in `parentNotes`, `safetyNotes`, tags, or structured `unknown` fields.
   - If an existing active record fails the Family-Fit Gate, do not enrich it as if it were a good recommendation. Prefer a source-backed `PATCH` with cautionary notes, or propose deletion/closure only after confirming it has no route-break, baby-logistics, child-primary, or user-signal value.

6. Mutate through the API.
   - Use `Authorization: Bearer <AIGO_API_KEY>`.
   - The default development key `change-me` is local-only. When `NODE_ENV=production` or `AIGO_REQUIRE_STRONG_API_KEY=true`, configure a non-default `AIGO_API_KEY` before calling the API.
   - Base URL is normally `http://localhost:3000`.
   - Creates use `POST /v1/places`.
   - Updates use `PATCH /v1/places/{placeId}`.
   - Deletes use `DELETE /v1/places/{placeId}` only after an explicit user removal request or deliberate audit decision. The endpoint performs a source-backed soft delete by setting `status: "closed"` and preserving sources, images, and version history. Requests must include `confirmation: "close_place"`, the exact `confirmName`, at least one source, and a `changeSummary`.
   - Keep `sourceMode: "append"` and `imageMode: "append"` unless correcting contamination after a deliberate audit.

7. Verify after meaningful changes.
   - Call `GET /v1/places/{placeId}`.
   - Call `GET /v1/places/{placeId}/versions` and confirm a new version exists with the expected source list. A 404 means the parent place id is invalid; an empty version list should only be treated as "no versions yet" after the place itself exists.
   - For soft deletes, confirm `GET /v1/places/{placeId}` returns the place with `status: "closed"`, exact-name search no longer returns it, and `GET /v1/places/{placeId}/versions` includes the delete audit `changeSummary`.
   - For image work, optionally call `GET /v1/places/image-health?status=attention`.
   - For search relevance, call `POST /v1/places/search` with the intended visit context and family preferences.
   - Search results include compact `imageHealth` so agents can notice missing primary images or review-needed images before recommending cards; use `/v1/places/image-health` for the full audit queue.
   - Search results include compact `sourceSummary` so agents and clients can distinguish official/public-agency sources, public-listing-backed records, and recently checked records without fetching each detail page. Search cards display source tier and freshness badges from this summary.
   - Search results include `infantLogistics`, a separate evidence/support signal for twin-infant practical logistics; use it alongside, not as a replacement for, toddler-oriented `childEngagementLevel`.
   - Search and detail responses include `openingHoursSummary` so source-backed operating-hours, reservation, walk-in, and session evidence remains visible even when runtime scoring cannot evaluate `OPEN_NOW` from structured hours. When `structuredDataGaps` is non-empty, patch the source-backed facts into `openingHours` and booking fields instead of leaving them only in source summaries.
   - Search response meta includes `search.preferenceSemantics` to make clear whether search filter preferences are soft ranking signals or required filters. By default, unknown or mismatched records can still appear with reason codes explaining the tradeoff; send `preferenceMode: "required"` when indoor type, parking, stroller, nursing room, kids toilet, or baby-chair requirements should exclude unknown/mismatched records.
   - For planning or agent calls that do not need full card payloads, send `projection: "compact"` to `/v1/places/search`; compact results keep ids, score/reasons, family logistics, notes, image health, and source summary while omitting full image rows, play feature JSON, scoring payloads, and version metadata.
   - For role-based itinerary scaffolding, send `coursePlan: true` to include `meta.coursePlan` roles: `anchor`, `optionalSecondStop`, `mealCareBase`, `napBreak`, and `abortFallback`, with parent-effort, drive-burden, and image-health signals.
   - For outside-city or farther day-trip planning, include `origin` with `minDistanceKm` and/or `maxDistanceKm` so distance bands are applied server-side; pair with `filterByRadius: false` when the explicit band should replace the default radius filter.
   - For broader planning lists that should not over-concentrate in one area or category, include `diversity: { maxPerRegion, maxPerCategory }`; diversity caps are applied after ranking and before pagination.
   - For future planning, include `visitDate` and optional `visitStartTime` so opening-hours scoring evaluates the planned Asia/Seoul wall-clock time instead of the current moment. Weekly opening-hours keys may use English weekday names, numeric days, or Korean weekday keys such as `월` and `월요일`; public-holiday keys such as `공휴일` are preserved as special-day notes and are not used as normal weekday schedules.
   - For deterministic place lookup by full name, send `matchMode: "exactName"` with `query`; this restricts candidates to exact or whitespace-compacted name matches instead of broad keyword/tag matches.
   - For controlled facet search, send `taxonomy` with canonical facet arrays. `taxonomy.mode` defaults to `soft`, which boosts matching records without excluding unknowns; use `taxonomy.mode: "required"` when every requested taxonomy facet must appear in either `sourceBacked` or `inferred` taxonomy. Natural Korean queries such as `모래놀이터`, `비오는날`, `쌍둥이 유모차`, `가는 길`, and `놀이방 식당` are also normalized into soft taxonomy facets unless explicit request facets already cover that family.
   - In search results, prefer `item.id` as the canonical place id. `item.placeId` remains a backward-compatible alias; detail responses use `id`, and duplicate candidates expose the nested candidate as `place.id`.

## API Payload Rules

OpenAPI is the contract: `docs/openapi/aigo-v1.yaml`. Zod validation lives in `src/lib/schemas.ts`.

Create requires:

- `name`
- `primaryCategory`
- `lat`
- `lng`
- `address` or `regionSido`
- `sources` with at least one source

Images are optional by the raw API contract, but required by this skill for user-requested place registration:

- Include structured `images` with at least one citeable, place-specific image.
- Use source-backed `sourceUrl`, `sourceType`, `sourceTitle`, `displayTier`, `reviewStatus: "approved"`, and useful `altText` or `description`.
- If no usable image can be found after reasonable searching, keep the candidate in `agent-research/` as `hold_for_later` with `noImageFoundReason`; do not create/update it unless the user explicitly approves a no-image exception.

Update requires:

- `sources` with at least one source
- Any writable fields that actually changed

Image enrichment updates require:

- `images` with at least one source-backed image when adding or replacing images.
- For user-requested registration/enrichment work, include at least one source-backed `images` item in the same API mutation. If no usable image is found, hold the candidate in research notes unless the user explicitly approves a no-image exception.
- Re-sending an existing URL through `imageUrls` is a safe shorthand append: it should not downgrade existing source linkage, display tier, review status, or primary-image selection on URL conflict. Use structured `images` when intentionally changing image metadata or review status, and use `imageMode: "replace"` only after a deliberate visual audit.

Source objects:

```json
{
  "sourceType": "official_site",
  "title": "Facility official page",
  "url": "https://example.go.kr/place",
  "summary": "Official page confirms address, operating status, parking, and baby lounge.",
  "checkedAt": "<ISO datetime with timezone>"
}
```

Rules for `sources`:

- `sourceType` is required.
- Either `url` or `externalId` is required.
- `summary` must be the agent's own concise summary, not copied source text.
- Use source types that explain provenance, such as `official_site`, `public_agency`, `public_tourism`, `operator_page`, `public_listing`, `public_blog`, `user_observation`, `official_image_source`, or `public_listing_image_source`.

Common writable fields:

- Identity/location: `name`, `primaryCategory`, `tags`, `description`, `address`, `roadAddress`, `regionSido`, `regionSigungu`, `regionDong`, `lat`, `lng`, `phone`, `officialUrl`, `reservationUrl`, `kakaoPlaceUrl`, `kakaoPlaceId`, `externalRefs`.
- Family logistics: `indoorType`, `strollerFriendly`, `parkingAvailable`, `parkingFrictionLevel`, `peakParkingWindow`, `parkingWaitNote`, `nursingRoom`, `diaperChangingTable`, `kidsToilet`, `elevator`, `babyChair`, `foodAllowed`.
- Visit fit: `minRecommendedAgeMonths`, `maxRecommendedAgeMonths`, `reservationRequired`, `walkInAvailable`, `sessionBased`, `sameDayAvailabilityKnown`, `averageStayMinutes`, `parentEffortLevel`, `childEngagementLevel`, `rainyDayScore`, `hotDayScore`, `coldDayScore`.
- Scoring: `placeScore`, `placeScoreRationale`, `externalRatingScore`, `externalReviewCount`, `searchEvidenceScore`, `scoreSignals`, `scoreUpdatedAt`.
- Notes/status: `safetyNotes`, `parentNotes`, `openingHours`, `pricing`, `status`, `dataConfidence`.
- Related places: `relatedPlaces` accepts existing place IDs with `relationType`, `note`, and optional `evidence`; use `relatedPlaceMode: "append"` by default or `"replace"` only when deliberately rewriting the current relation set.
- Classification/play/image data: `taxonomy`, `playFeatures`, `images`.

`taxonomy` is AiGo's controlled facet layer for parent-planning semantics. Keep `sourceBacked` limited to source-supported facts, use `inferred` for agent-derived broad planning labels, and preserve legacy/freeform cleanup context under `migration.legacyTags`, `migration.broadMappedTags`, and `migration.unmappedTags`. `tags` should remain concise search/display slugs; physical equipment such as slides, swings, seesaws, sand play, and water play belongs in `playFeatures`, while broader planning labels such as `baby_logistics`, `after_daycare`, `rainy_day`, or `route_break` belong in `taxonomy`.

Search taxonomy facets use the same canonical families: `familyFitGates`, `activityTypes`, `visitUseCases`, `ageBands`, `logisticsTags`, and `riskTags`. Prefer `soft` mode for planning and discovery so unknown records remain eligible with `TAXONOMY_UNKNOWN`; use `required` only when the caller truly wants a hard facet gate.

For taxonomy cleanup, run `pnpm tsx scripts/audit-taxonomy.ts --json` for a read-only DB scan of category, tag, source-type, region, and taxonomy facet drift. Run `pnpm tsx scripts/apply-taxonomy-migration.ts --limit=<n>` first for dry-run planning; only add `--apply` after reviewing the planned changes. The apply script reads place details through the API and performs real mutations only through `PATCH /v1/places/{placeId}` with `sourceMode: "replace"` and the taxonomy v1 migration audit source; it must not directly update real place rows in the database.

Use these enum values:

- Tri-state fields: `yes`, `no`, `partial`, `unknown`.
- `indoorType`: `indoor`, `outdoor`, `mixed`, `unknown`.
- `parkingFrictionLevel`: `low`, `medium`, `high`, `unknown`.
- `status`: API accepts `active`, `temporarily_closed`, `closed`, `draft`, `needs_review`; user-requested registrations from this skill should use `active`.
- `dataConfidence`: API accepts `official_verified`, `operator_curated`, `agent_collected`, `user_reported`, `needs_check`, `unknown`; user-requested registrations from this skill should use `agent_collected`, `user_reported`, or `official_verified`.
- Related-place `relationType`: use `same_building` for branches inside the same mall/building, `same_site` for campus/resort/public-facility subvenues, `nearby` for very close practical companions, `parent_child` for explicit parent/subfacility relationships, `route_pair` for route-break pairings, and `itinerary_cluster` for day-trip clusters that share drive burden, meal/rest fallback, and parent-effort planning.

## Related Places

Use related-place relationships when two already registered places should be shown together because a parent would naturally compare or combine them: a kids cafe inside a mall, a child facility inside a museum/science center campus, a resort subfacility, or a named playground attached to a larger destination.

Mutation rules:

- Mutate related places through `PATCH /v1/places/{placeId}` with `relatedPlaces`, not direct DB writes.
- Keep relationships source-backed like other updates: include at least one `sources` item, plus `evidence` such as stored coordinate distance, same-address match, official/public source URL, or audit batch ID.
- Relationships are bidirectional in the API response even though the DB stores each pair once. One PATCH from either place is enough.
- Prefer conservative relation types. Use `nearby` when the evidence only supports close coordinates; use `same_building` or `same_site` only when address/name/source evidence supports it.
- For `itinerary_cluster` relations, include structured `evidence` such as `clusterName`, `sharedDriveBurden`, `mealRestFallback`, `parentEffortNotes`, and source URLs so agents can explain why the places should be planned together.
- Do not use related places to hide likely duplicates. Stage likely duplicates separately for duplicate review instead of linking them as recommendations.

Common `primaryCategory` values used by the UI/search:

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

`primaryCategory` is a closed top-level set. Do not invent new category values for narrower meanings; use canonical tags and taxonomy facets instead. Source inputs are also canonicalized: use source types such as `official_site`, `public_agency`, `public_tourism`, `operator_page`, `public_listing`, `public_blog`, `user_observation`, `agent_observation`, `official_image_source`, `public_listing_image_source`, `public_news_image_source`, `map_service`, or `geocode`. Region aliases such as `대전`, `충남`, `충북`, and `세종` are normalized by the API to full province/city names.

Playground search semantics:

- Treat `park` and `playground` as different intents. A general park can be useful without being a real playground, but `놀이터` searches and the playground UI group should mean an indoor playground or a park record with playground evidence.
- Use operating model as the main split between `kids_cafe` and playground categories. Private or corporate paid play venues opened for commercial revenue belong under `kids_cafe`, even when they contain trampolines, slides, climbing frames, or other indoor play equipment. National, municipal, public-agency, library, family-center, or other public/very-low-cost play facilities belong under `indoor_playground` or `park` depending on indoor/outdoor context.
- User classification signal, recorded 2026-05-23 KST: "놀이터(실내/실외) 키즈카페의 가장 핵심적인 기준은 운영 주체인거 같아. 수익을 위해 개인이나 법인이 연거는 키즈카페, 국가나 시, 관공서 등이 열어서 무료 혹은 굉장히 저렴한 가격에 제공하는 곳은 실내/실외 놀이터."
- Apply that signal before using equipment as the category driver. Slides, swings, seesaws, trampolines, ball pits, climbing frames, and similar play equipment describe `playFeatures`; they do not by themselves make a commercial venue an `indoor_playground`.
- When classifying or correcting data, record the evidence that supports the operating model: public agency/operator identity, official/public-agency page, operator page, pricing/free-entry signal, reservation or ticketing model, and whether the venue is a public service or a commercial business.
- If the operating model is unclear, keep the current category conservative, add `unknown` or a parent note about the uncertainty, and prefer staging a follow-up verification over guessing from play equipment alone.
- For outdoor playground candidates, record source-backed `playFeatures` such as `slide`, `swing`, `seesaw`, `sandPlay`, `climbing`, `waterPlayground`, `rubberSurface`, `fenced`, and `toiletNearby` whenever evidence exists. Use `unknown` rather than guessing.
- Use tags such as `children_playground`, `small_playground`, `play_equipment`, `놀이터`, `어린이놀이터`, `동네놀이터`, `물놀이터`, `미끄럼틀`, `그네`, or `시소` only when the place-specific evidence supports actual play equipment or a named playground.

Use `accommodation` for kid-primary lodging such as hotels, resorts, pensions, pool villas, or family suites where children's rooms, play rooms, water play, kids programs, or child-centered facilities are a core reason to visit. Do not register ordinary kid-friendly lodging unless the user explicitly asks or the child-primary evidence is strong.

Tags are soft matching signals. Use them for secondary intent and geography, not as a replacement for structured fields. Useful existing signals include `children_museum`, `children_experience`, `children_playground`, `toy_library`, `toy_store`, `kids`, `어린이`, `장난감가게`, `완구점`, `놀이방식당`, `주말당일`, `세종`, `청주`, and `공주`.

Do not put `needs_check` into tri-state fields. Use `unknown` for missing evidence and `partial` for limited or conditional availability. For user-requested registrations, do not use `needs_check` in `dataConfidence`; use `agent_collected` or `user_reported` and describe weak freshness/provenance in notes.

## Source-Backed Scoring

AiGo has two score layers:

- Stored objective place score: `placeScore` is a 0-10 agent-assigned family outing quality score. It is not an AiGo user rating.
- Runtime search score: `/v1/places/search` combines stored score fields with distance, query match, child ages, preferences, visit context, opening hours, visit-fit fields, and data confidence to produce a 0-100 `score` plus `scoreBreakdown` and `reasonCodes`.
- Runtime distance scoring is category and intent sensitive: nearby playground searches should be strongly proximity-weighted, playroom restaurants should still favor easy meal logistics, kids cafes should be moderate, and lodging or destination visits should let stored quality/content evidence outweigh raw proximity.
- For lodging or other broad destination searches, agents may send `origin` with `filterByRadius: false` so results still expose `distanceKm` and distance-aware scoring without hiding far-but-relevant places behind the radius filter. For outside-Daejeon day-trip requests, add `minDistanceKm` and/or `maxDistanceKm` to apply a hard distance band from that origin.
- Search filter preferences default to soft scoring; use search `preferenceMode: "required"` when the planning context needs hard gates such as indoor type, parking, stroller, nursing room, kids toilet, or baby-chair evidence. Other logistics fields such as diaper table, elevator, and snack/food handling remain available as card/detail evidence and infant-logistics signals, but they are not standalone search preference filters.
- Lodging/accommodation results are capped when infant-logistics evidence is sparse, even if child engagement or public popularity looks strong. Source-backed parking, stroller route, nursing/diaper support, elevator, baby chair, and food handling let strong lodging candidates score higher.
- Use optional `diversity.maxPerRegion` and `diversity.maxPerCategory` when a planning answer needs a mix of regions or categories instead of a single concentrated ranked list.
- Use `coursePlan: true` when a ranked list should also be grouped into practical course roles; each role candidate includes `imageHealth` so missing, pending, or review-needed images remain visible. Treat the returned roles as a starting scaffold and still inspect sources, opening-hours confidence, and parent notes before presenting a final itinerary.
- Broad public-child-facility Korean queries such as `공공 어린이 체험 박물관 과학관` should expand to public categories instead of requiring every literal token to match one row.
- Exact compact name matches should receive a stronger query boost than partial name or tag-only matches so a full place-name query ranks the intended record above similarly named alternatives.
- When a user or agent needs a deterministic exact-place lookup, use search `matchMode: "exactName"` rather than relying on ranking alone.

When creating or meaningfully refreshing a place, score it when the evidence is strong enough:

- `placeScore`: 0-10, one decimal is enough. Keep weak/uncertain places conservative instead of guessing high.
- `placeScoreRationale`: short original explanation for the score, including family fit, logistics, safety, source freshness, and known caveats.
- `externalRatingScore`: normalized 0-10 public rating/review signal when a citeable listing or official review aggregate exists.
- `externalReviewCount`: approximate public review count used only as confidence weight.
- `searchEvidenceScore`: normalized 0-10 public search/prominence signal from official pages, public listings, public articles/blogs, and corroboration quality.
- `scoreSignals`: structured evidence such as provider, rating, review count, observed search/listing position, source URLs, conflicts, caps, and freshness notes.
- `scoreUpdatedAt`: ISO datetime with timezone for the last score review.

Suggested `placeScore` rubric for the current family context:

- Family purpose and child value: child-primary, baby-logistics, route-break utility, or explicit user signal.
- Age fit: toddler engagement plus infant-safe logistics; partial age fit should not be treated as a full match.
- Practical logistics: stroller, elevator, parking, nursing room, diaper table, kids toilet, baby chair, food/snack handling.
- Parent effort and safety: line-of-sight, water/road/fire/steepness risk, crowding, floor changes, shade/toilets.
- Operating reliability: active status, structured hours, recent hours/source check, special-day caveats.
- Source confidence: official/public/operator sources, corroboration, freshness, and no unresolved source conflicts.
- External/public evidence: review rating/count and public search/listing prominence, capped so popularity cannot overpower family fit.

Apply caps before assigning a high score: closed places should stay very low; temporarily closed places should stay conservative; places that fail the Family-Fit Gate should not score high unless the user-signal exception is explicit; severe unresolved safety concerns should cap the score even when reviews are positive.

After changing scoring logic or scoring data, run `pnpm tsx scripts/audit-scoring.ts --limit=5`. Compare the ranked places, `scoreBreakdown`, and `Gaps` column against the intended family scenario. If many unscored places saturate near the top, tune weights or add source-backed `placeScore` evidence before treating the score as reliable.

## Review Link Enrichment

For every active place, make sure parents have at least one reliable page they can open for more details. Prefer `officialUrl`, `reservationUrl`, or `kakaoPlaceUrl` when they are source-backed. When the best parent-facing page does not fit those first-class fields, store it in `externalRefs.infoLinks` as an array of public link objects:

```json
{
  "provider": "Official site",
  "label": "Facility information page",
  "url": "https://example.go.kr/place",
  "note": "Public page parents can open for address, hours, fees, or reservation details."
}
```

Fallback links can point to public agency, tourism, mall/library/operator pages, or public listings/search pages. Do not use private/login-only pages. The detail UI also derives a user-facing information link from source URLs and, if none are linkable, a public search fallback.

For lodging and other review-sensitive categories, collect public review entry points that parents can click from the detail page. Store them in `externalRefs.reviewLinks` as an array of objects:

```json
{
  "provider": "Naver Blog",
  "label": "Naver Blog search for Example Kids Pension reviews",
  "url": "https://search.naver.com/...",
  "note": "Public blog-search landing page for parent visit reviews."
}
```

Use provider labels such as `Naver`, `Naver Blog`, `Kakao`, `Google`, `Tripadvisor`, `Booking`, `Agoda`, `Yanolja`, `Yeogi`, or the operator/listing name. Review links should be public landing/listing/search pages, not private/login-only pages. Do not scrape private content or copy review text into AiGo; summarize only the evidence type and why the link helps a parent inspect reviews. Also add review/listing sources or `scoreSignals.reviewEvidence` when ratings, counts, or public review prominence are citeable.

## Family Data Checklist

Capture the practical parent tradeoffs in structured fields and notes:

- Fit for current family: toddler born 2023-09 plus twin infants born 2025-10.
- Stroller route/elevator/floor changes, nursing room, diaper table, kids toilet, baby chair.
- Parking entry friction, validation, elevator connection, and whether one building solves food/rest/play.
- Reservation/session friction, same-day availability, walk-in fallback, and whether parent timing must be planned before departure.
- Snack/meal handling: outside food, food court, cafe, family restaurant playroom, baby chair.
- Paid-entry details: use structured `pricing` only when source-backed. Include a compact `summary`, `basisDate` or `checkedAt`, optional `staleAfterDays`, item rows for child/guardian/time/reservation/free conditions, and a source URL. Do not estimate unknown prices.
- Stay duration, parent effort level, child engagement level, rainy/hot/cold day suitability.
- Safety notes: water edge, roads, steep paths, grill/fire, crowded playrooms, line-of-sight, age separation.
- Day-trip fallback: toilets, shade, feeding/change fallback, route/time burden, rest areas.

Use `parentNotes` for practical advice and uncertainty. Use `safetyNotes` for hazards. Do not hide user-requested registrations behind `needs_check`; when important operation or amenity evidence is weak, keep structured fields `unknown` and write the caution in notes.

## Play Features

Use `playFeatures` for place-level physical play signals:

```json
{
  "slide": "yes",
  "swing": "unknown",
  "waterPlayground": "no",
  "sandPlay": "partial",
  "strollerPath": "partial",
  "toiletNearby": "yes",
  "notes": "Source-backed summary of equipment and unresolved questions.",
  "evidence": [
    {
      "feature": "slide",
      "value": "yes",
      "basis": "Official facility page and public photos show a low slide.",
      "sourceUrl": "https://example.go.kr/place",
      "confidence": "official"
    }
  ]
}
```

Known fields include `slide`, `swing`, `babySwing`, `waterPlayground`, `sandPlay`, `climbing`, `seesaw`, `trampoline`, `rideOnToys`, `playHouse`, `openLawn`, `shade`, `fenced`, `rubberSurface`, `strollerPath`, and `toiletNearby`.

Evidence confidence values: `official`, `visual_confirmed`, `user_reported`, `blog_supported`, `needs_check`, `unknown`.

## Image URL Enrichment

Store remote image URLs only when they help identify or compare the exact place and the source page is citeable.

Prefer official/operator/public-agency images. Public listing images are acceptable only when they clearly match the exact branch/place and better sources are unavailable. Avoid logos, favicons, generic share thumbnails, tiny icons, unrelated multi-branch graphics, and personal blog/SNS photos unless clearly labeled low confidence.

Images are a hard prerequisite for user-requested place registration in this workflow. Make a serious attempt to find place-specific official, public-agency, operator, tourism, or public-listing images; if none is citeable, hold the candidate in `agent-research/` for a later image pass instead of creating or updating it.

Use `images`, not deprecated `imageUrls`, for new work:

```json
{
  "url": "https://example.go.kr/images/place.jpg",
  "sourceUrl": "https://example.go.kr/place",
  "sourceType": "official_image_source",
  "sourceTitle": "Official representative image",
  "altText": "Indoor toddler play area with low slide",
  "description": "Indoor toddler play area with low slide and seating visible.",
  "visualFeatures": ["indoor_play", "slide", "parent_seating"],
  "childSignals": { "slide": true, "strollerPath": "unknown" },
  "displayTier": "official",
  "reviewStatus": "approved",
  "isPrimary": true,
  "checkedAt": "<ISO datetime with timezone>"
}
```

Image display tiers: `official`, `public_agency`, `public_listing`, `rights_unclear`, `unknown`.

Image review statuses accepted by the API are `pending_review`, `approved`, `needs_review`, and `rejected`; user-requested registrations from this skill should use `approved`.

If only logos, favicons, generic thumbnails, unrelated branch images, or rights-unclear personal photos are available, hold the candidate in research notes and explain the rejected candidates. Do not set user-requested registrations to review/check states solely because image or amenity evidence is incomplete.

## Curl Patterns

Duplicate check:

```bash
curl -sS http://localhost:3000/v1/places/duplicates \
  -H "Authorization: Bearer $AIGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example Kids Cafe Daejeon",
    "lat": 36.3504,
    "lng": 127.3845,
    "radiusMeters": 800,
    "limit": 10
  }'
```

Create:

```bash
curl -sS http://localhost:3000/v1/places \
  -H "Authorization: Bearer $AIGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example Kids Cafe Daejeon",
    "primaryCategory": "kids_cafe",
    "tags": ["indoor", "after_daycare", "parking"],
    "address": "Daejeon ...",
    "regionSido": "Daejeon",
    "regionSigungu": "Dong-gu",
    "lat": 36.3504,
    "lng": 127.3845,
    "indoorType": "indoor",
    "strollerFriendly": "partial",
    "parkingAvailable": "yes",
    "nursingRoom": "unknown",
    "diaperChangingTable": "unknown",
    "parentNotes": "Source-backed parent logistics and unresolved checks.",
    "dataConfidence": "agent_collected",
    "actor": "codex:aigo-place-api",
    "changeSummary": "Create source-backed family outing place.",
    "sources": [
      {
        "sourceType": "official_site",
        "url": "https://example.com/place",
        "summary": "Official page confirms address and parking.",
        "checkedAt": "<ISO datetime with timezone>"
      }
    ],
    "images": [
      {
        "url": "https://example.com/images/place-representative.jpg",
        "sourceUrl": "https://example.com/place",
        "sourceType": "official_image_source",
        "sourceTitle": "Official representative image",
        "altText": "Representative image of Example Kids Cafe",
        "description": "Source-backed representative image that helps parents identify the exact place.",
        "displayTier": "official",
        "reviewStatus": "approved",
        "isPrimary": true,
        "checkedAt": "<ISO datetime with timezone>"
      }
    ]
  }'
```

Update:

```bash
curl -sS -X PATCH http://localhost:3000/v1/places/<placeId> \
  -H "Authorization: Bearer $AIGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceMode": "append",
    "imageMode": "append",
    "strollerFriendly": "yes",
    "diaperChangingTable": "partial",
    "parentNotes": "Updated with official facility guide and current public listing.",
    "actor": "codex:aigo-place-api",
    "changeSummary": "Enrich stroller and diaper-changing signals.",
    "sources": [
      {
        "sourceType": "public_agency",
        "url": "https://example.go.kr/facility",
        "summary": "Public facility guide lists elevator and diaper-changing space.",
        "checkedAt": "<ISO datetime with timezone>"
      }
    ]
  }'
```

Verify:

```bash
curl -sS http://localhost:3000/v1/places/<placeId> \
  -H "Authorization: Bearer $AIGO_API_KEY"

curl -sS http://localhost:3000/v1/places/<placeId>/versions \
  -H "Authorization: Bearer $AIGO_API_KEY"
```

## Before Finishing

- Confirm `agent-research/` is ignored before writing staging files: `git check-ignore -q agent-research/`.
- Confirm staged research files under `agent-research/` are not committed.
- Confirm every created/updated place has source-backed summaries.
- Confirm every created/updated user-requested place has at least one structured `images` entry with `sourceUrl`, `sourceType`, `sourceTitle`, `displayTier`, `reviewStatus: "approved"`, and useful `altText` or `description`.
- Confirm every created place passes the Family-Fit Gate; weak tourist/rest/cafe/culture candidates should be skipped unless the user explicitly asked to register them, in which case create them as `active` with conservative notes.
- Confirm unknown or weak evidence stays `unknown`, `partial`, or in notes, not in `needs_check` for user-requested registrations.
- Confirm duplicate handling decision is documented in the work summary.
- If API schemas, OpenAPI, source/image rules, categories, or AGENTS data policy changed during the task, update this skill in the same commit.
