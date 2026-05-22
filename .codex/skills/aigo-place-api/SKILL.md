---
name: aigo-place-api
description: Use when researching, deduplicating, creating, updating, enriching, or verifying AiGo place data through the /v1/places API, including source-backed Daejeon family outing data, agent-research staging notes, image URL provenance, duplicate checks, and version-history verification.
---

# AiGo Place API

## Use This Skill When

Use this skill for any AiGo task that researches, creates, updates, enriches, reviews, or verifies real place data. This includes new place discovery, user-visited reference places, duplicate resolution, image URL enrichment, source cleanup, and API mutation planning.

Do not use direct database writes for real place data. Real mutations go through the AiGo API.

## Ground Rules

- Treat source evidence as part of the data, not an afterthought. Every create/update requires at least one `sources` item.
- Treat image evidence as required for place registration. Every new place create, and every meaningful enrichment when the place has no usable image, must include at least one structured `images` item with citeable provenance.
- Unknown is acceptable. Do not invent amenities, ages, coordinates, opening hours, or image provenance.
- Prefer broad public internet research: official facility/operator pages, public agency pages, library/tourism/mall pages, and public local listings or blogs only as support.
- Avoid high-volume map/vendor automation. Do not run repeated Kakao Map/API loops. If a map URL is used, keep it sparse and manual-style, and store only URL/external ID/summary.
- Never log in, create accounts, bypass access controls, or send private user data to third-party sites.
- Subagents may research and write `agent-research/*.md`; the main agent consolidates and calls the API.
- For user-requested registrations, create/update directly as searchable data. Use `status: "active"` and avoid `dataConfidence: "needs_check"`; capture uncertainty with `unknown` fields, conservative scores, `parentNotes`, and `safetyNotes` instead of hiding the place from search.

## Workflow

1. Scope the research slice.
   - Prioritize Daejeon Station / old downtown, Daejeon, and roughly one-hour driving range.
   - Favor family-fit leads: indoor fallback, kids cafes, public child-friendly facilities, stroller logistics, nursing/diaper support, parking, snacks/meals, short outdoor sensory play, and practical day trips.

2. Delegate independent research.
   - Give each subagent a bounded slice such as indoor playgrounds, libraries/toy libraries, parks/day trips, family restaurants, or image candidates.
   - Tell subagents not to mutate data. Their deliverable is a structured Markdown file under `agent-research/`.

3. Research with source notes.
   - Use one staging file per slice: `agent-research/<topic>-YYYYMMDD-HHMM.md`.
   - For each place, record suggested action (`create`, `update`, `skip`, `needs_review`), family signals, source URLs with short summaries, confidence, open questions, and a possible API payload fragment using camelCase fields.

4. Check duplicates before mutation.
   - Call `POST /v1/places/duplicates` with `name`, `lat`, `lng`, optional `kakaoPlaceId`, optional `externalRefs`, and a reasonable `radiusMeters`.
   - If a likely candidate exists, call `GET /v1/places/{placeId}`, compare current data, and usually `PATCH`.
   - If no meaningful candidate exists, `POST /v1/places`.
   - If evidence is weak or identity is uncertain for a user-requested registration, still keep the place searchable with `status: "active"` and `dataConfidence: "agent_collected"` or `"user_reported"`; make the uncertainty explicit in `parentNotes`, `safetyNotes`, tags, or structured `unknown` fields.

5. Mutate through the API.
   - Use `Authorization: Bearer <AIGO_API_KEY>`.
   - Base URL is normally `http://localhost:3000`.
   - Creates use `POST /v1/places`.
   - Updates use `PATCH /v1/places/{placeId}`.
   - Keep `sourceMode: "append"` and `imageMode: "append"` unless correcting contamination after a deliberate audit.

6. Verify after meaningful changes.
   - Call `GET /v1/places/{placeId}`.
   - Call `GET /v1/places/{placeId}/versions` and confirm a new version exists with the expected source list.
   - For image work, optionally call `GET /v1/places/image-health?status=attention`.
   - For search relevance, call `POST /v1/places/search` with the intended visit context and family preferences.

## API Payload Rules

OpenAPI is the contract: `docs/openapi/aigo-v1.yaml`. Zod validation lives in `src/lib/schemas.ts`.

Create requires:

- `name`
- `primaryCategory`
- `lat`
- `lng`
- `address` or `regionSido`
- `sources` with at least one source
- `images` with at least one source-backed image

Update requires:

- `sources` with at least one source
- Any writable fields that actually changed
- `images` with at least one source-backed image when the place has no usable image or when the update is image enrichment

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
- Family logistics: `indoorType`, `strollerFriendly`, `parkingAvailable`, `nursingRoom`, `diaperChangingTable`, `kidsToilet`, `elevator`, `babyChair`, `foodAllowed`.
- Visit fit: `minRecommendedAgeMonths`, `maxRecommendedAgeMonths`, `averageStayMinutes`, `parentEffortLevel`, `childEngagementLevel`, `rainyDayScore`, `hotDayScore`, `coldDayScore`.
- Scoring: `placeScore`, `placeScoreRationale`, `externalRatingScore`, `externalReviewCount`, `searchEvidenceScore`, `scoreSignals`, `scoreUpdatedAt`.
- Notes/status: `safetyNotes`, `parentNotes`, `openingHours`, `status`, `dataConfidence`.
- Play/image data: `playFeatures`, `images`.

Use these enum values:

- Tri-state fields: `yes`, `no`, `partial`, `unknown`.
- `indoorType`: `indoor`, `outdoor`, `mixed`, `unknown`.
- `status`: `active`, `temporarily_closed`, `closed`, `draft`, `needs_review`.
- `dataConfidence`: `official_verified`, `operator_curated`, `agent_collected`, `user_reported`, `needs_check`, `unknown`.

Common `primaryCategory` values used by the UI/search:

- `kids_cafe`
- `indoor_playground`
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

`accommodation` is excluded from MVP and will be rejected.

Tags are soft matching signals. Use them for secondary intent and geography, not as a replacement for structured fields. Useful existing signals include `children_museum`, `children_experience`, `children_playground`, `toy_library`, `kids`, `어린이`, `놀이방식당`, `주말당일`, `세종`, `청주`, and `공주`.

Do not put `needs_check` into tri-state fields. Use `unknown` for missing evidence and `partial` for limited or conditional availability. For user-requested registrations, do not use `needs_check` in `dataConfidence`; use `agent_collected` or `user_reported` and describe weak freshness/provenance in notes.

## Source-Backed Scoring

AiGo has two score layers:

- Stored objective place score: `placeScore` is a 0-10 agent-assigned family outing quality score. It is not an AiGo user rating.
- Runtime search score: `/v1/places/search` combines stored score fields with distance, query match, child ages, preferences, visit context, opening hours, visit-fit fields, and data confidence to produce a 0-100 `score` plus `scoreBreakdown` and `reasonCodes`.

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
- Snack/meal handling: outside food, food court, cafe, family restaurant playroom, baby chair.
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

Image review statuses: `pending_review`, `approved`, `needs_review`, `rejected`.

Do not create a place until at least one branch/place-specific image candidate is available. If only logos, favicons, generic thumbnails, unrelated branch images, or rights-unclear personal photos are available, do not set user-requested registrations to `needs_review` solely because image evidence is incomplete; capture uncertainty in notes instead.

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
- Confirm every created place has at least one structured `images` entry with `sourceUrl`, `sourceType`, `sourceTitle`, `displayTier`, `reviewStatus`, and useful `altText` or `description`.
- Confirm unknown or weak evidence stays `unknown`, `partial`, or in notes, not in `needs_check` for user-requested registrations.
- Confirm duplicate handling decision is documented in the work summary.
- If API schemas, OpenAPI, source/image rules, categories, or AGENTS data policy changed during the task, update this skill in the same commit.
