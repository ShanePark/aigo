<p align="center">
  <img src="public/icons/icon-192.png" alt="AiGo app icon" width="96" height="96">
</p>

<h1 align="center">AiGo</h1>

AiGo is an agent-friendly place database and search UI for kid-friendly family outings across Korea. It is built for the practical questions parents ask before leaving the house: Is this place indoors? Can a stroller move through it? Is there parking, a nursing room, a diaper changing table, an elevator, a baby chair, or a reliable snack/meal fallback?

The project combines a Korean Next.js search experience with a structured API that external agents can use to collect, deduplicate, enrich, and inspect source-backed place data. It is a personal/family place intelligence tool, not a generic travel marketplace or review community.

## Product Focus

AiGo is optimized for families planning low-friction outings across Korea, with personalization based on the user's selected or current origin.

The data model intentionally treats parent logistics as first-class signals:

- Indoor, outdoor, and mixed destinations
- Recommended child ages
- Stroller practicality, elevator access, parking, nursing rooms, diaper changing tables, kids toilets, baby chairs, and food/snack handling
- Parent effort, child engagement, weather fit, average stay time, safety notes, and parent notes
- Public child-friendly facilities, indoor and outdoor playgrounds, kids cafes, toy stores, libraries, toy libraries, museums, art museums, science museums, aquariums, zoos, parks, family restaurants, shopping malls, rest areas, kid-primary accommodations, and short nature trips
- Source-backed place records, image provenance, wiki-style version history, and user visit feedback
- Closed top-level categories plus controlled taxonomy facets for family-fit, activity type, use case, age band, logistics, and risk semantics

Unknown is an acceptable value when evidence is weak. AiGo should not invent amenities just to make a place look complete.

## MVP Boundary

The MVP focuses on structured place data, source-backed updates, duplicate review, search, details, image provenance, version history, and a lightweight account-backed visit/review/personalization loop. It includes the database and app APIs needed for dev-only login, child profile defaults, home-location settings, place visits, integer ratings, short reviews, private/public visibility, local visit-photo uploads, and a personal visit log.

Out of scope for the current MVP:

- Public signup, social login, account recovery, family sharing, and multi-user family/profile sharing
- Saved lists and broad community/social features
- Full natural-language trip planning as an API responsibility
- Full itinerary generation, real-time crowding, reservations, payments, lodging booking flows, photo resizing, HEIC conversion, CDN storage, and moderation workflows
- Admin data-entry UI

## Current App

The web app provides a Korean place-search UI with:

- Keyword, category, age, map-viewport/distance, and family-logistics filters
- Account-backed child defaults through `/me`, storing child birth year-month and gender for logged-in users; guests can still use local search-form child conditions
- Account-backed home-location settings through `/me`; search filters such as indoor, parking, stroller, nursing room, baby chair, and required/soft preference mode remain immediate search controls rather than saved profile defaults
- Kakao login for account-backed family defaults, visit logs, saved places, and place notes
- Map-first browsing: the first landing view uses browser geolocation when available, then pan or zoom the map and tap `현 지도에서 검색` to refresh the list from the visible map area without changing results during casual map movement
- Soft matching instead of hard exclusion for age and amenity mismatches
- Result cards with score, distance, tags, facility chips, play-feature chips, confidence, image tier, parent notes, safety notes, reason codes, and user rating summaries
- Place detail pages with source links, image audit information, child-friendly signals, play features, visit judgment, notes, recent versions, and a signed-in visit/review/photo form
- A `/visits` page that groups the signed-in user's visit log by date with place, rating, review, revisit, and photo-count summaries

The UI uses the browser's current location as the initial origin when permission is available, and otherwise falls back to a neutral default origin that users can change.

## Agent API

The OpenAPI contract is in [`docs/openapi/aigo-v1.yaml`](docs/openapi/aigo-v1.yaml). The API expects structured JSON; it supports lightweight keyword and taxonomy-facet normalization for search, while full natural-language trip planning belongs outside the API.

Main endpoints:

- `GET /v1/health` - check bearer key validity and shallow API/database health before agent work
- `POST /v1/places/search` - search places with soft matching and reason codes
- `POST /v1/places/duplicates` - check likely duplicates before creating or updating data
- `POST /v1/places` - create a source-backed place and publish it immediately
- `GET /v1/places/{placeId}` - fetch place detail
- `PATCH /v1/places/{placeId}` - update a place and append a new version
- `DELETE /v1/places/{placeId}` - source-backed soft delete that closes a place while preserving audit history
- `GET /v1/places/{placeId}/versions` - list place versions
- `GET /v1/places/{placeId}/versions/{versionId}` - inspect a specific version
- `GET /v1/places/image-health` - list image coverage and review queues

All `/v1` agent API routes require bearer auth:

```bash
Authorization: Bearer $AIGO_API_KEY
```

For live place-data work, agents should target the deployed API:

```bash
export AIGO_API_BASE_URL="${AIGO_API_BASE_URL:-https://aigo.o-r.kr}"
```

Use `http://localhost:3000` only for local development or route implementation testing. The local default key `change-me` must not be used against the deployed API.

Before registration or enrichment batches, check the agent API health with the same bearer key:

```bash
curl -sS "$AIGO_API_BASE_URL/v1/health" \
  -H "Authorization: Bearer $AIGO_API_KEY"
```

A `200` response means the key is accepted and the database answered a shallow query. Repeated invalid health-check keys from the same client are temporarily blocked with `429`.

## App Auth And Visits

User-facing app routes use the `aigo_session` httpOnly, sameSite=lax cookie instead of the `/v1` bearer token. Kakao OAuth creates or reuses the linked app user and issues a local session; `POST /api/auth/logout` clears it; `GET /api/me` returns the current viewer.

Visit and review endpoints are intentionally app-scoped APIs:

- `GET /api/places/[placeId]/visits` - return public visit content, aggregate ratings, and the current user's visits for a place
- `POST /api/places/[placeId]/visits` - create today's visit with a required 1-5 rating, optional short review, and visibility; repeat visits are inferred server-side
- `PATCH /api/visits/[visitId]` - update the signed-in user's own rating, review text, or visibility
- `POST /api/visits/[visitId]/photos` - upload jpeg/png/webp visit photos up to 10MB
- `GET /api/visit-photos/[photoId]` - stream public photos to anyone and private photos only to the owner
- `GET /api/visits` - return the signed-in user's date-grouped visit log

## Data Model

AiGo stores places in PostgreSQL/PostGIS with Drizzle schema definitions in [`src/db/schema.ts`](src/db/schema.ts). The main tables are:

- `places` - identity, closed primary category, canonical tags, controlled taxonomy facets, location, family logistics, visit-fit scores, notes, status, confidence, and derived search/geography fields
- `place_sources` - source evidence attached to a place
- `place_images` - remote image URLs with provenance, display tier, review status, visual features, and primary-image selection
- `place_versions` - wiki-style snapshots created after create/update actions
- `users` and `auth_sessions` - future-compatible user/session foundations, currently used for the dev-only local login flow
- `user_children` - user-owned child birth year-month and gender defaults for search child conditions
- `user_home_locations` - user-owned home coordinates and label/address memo for future home-origin search shortcuts
- `place_visits` - user-owned visit records with server-owned visit dates, inferred revisit status, 1-5 ratings, short review text, and visibility
- `place_visit_photos` - metadata for visit photos stored under the local upload directory

Real place data should be created and updated through the AiGo API, not direct database writes. The seed script intentionally inserts no real places.

## Search And Scoring

Search uses PostGIS distance filtering plus text/tag/play-feature matching and a scoring layer split between [`src/lib/scoring.ts`](src/lib/scoring.ts) and [`src/lib/recommendation-scoring.ts`](src/lib/recommendation-scoring.ts). The visible 0-100 `관련도` score is contextual, not a permanent rating for the place. It blends stored source-backed place quality with the user's current query, distance, visit context, preferences, and data readiness.

Search result sorting uses explicit user-facing names:

- `관련도` (`sort=recommended`) ranks by the current contextual relevance score.
- `거리` (`sort=distance`) ranks by distance from the active origin.
- `평가` (`sort=rating`) ranks by the source-backed place evaluation score shown on cards. This is the place's objective quality evaluation, not user visit star ratings.

Stored objective place scoring is separate from user ratings:

- `placeScore` is an agent-maintained 0-10 family-outing quality score backed by sources and rationale. It is shown in the UI as `평가`, appears on detail pages, and contributes to search ranking through the `placeQuality` component.
- `externalRatingScore`, `externalReviewCount`, and `searchEvidenceScore` capture citeable third-party review/prominence evidence and feed the `externalEvidence` component.
- `scoreSignals` stores structured scoring evidence such as provider ratings, source observations, conflicts, caps, facility scale, free-admission evidence, and freshness notes.
- User visit ratings are stored in `place_visits` and returned as `userRatingSummary`; they are not the same as `placeScore`.

Runtime search scores and reason codes are influenced by:

- Distance from the requested origin
- Search-intent-sensitive distance profiles: nearby playgrounds are expected to be close, shopping malls can tolerate a short drive, and museums, parks, lodging, or day-trip destinations can remain viable at longer distances
- Optional `viewportBounds`, which restricts candidates to the visible map area while keeping `origin` for distance labels and scoring
- Visit context: `afterDaycare`, `nearbyNow`, `rainyDay`, `weekendHalfDay`, or `dayTrip`
- Category, tag, and taxonomy facet matches
- Recommended child-age fit
- Family logistics preferences
- Source-backed objective place score and external evidence, including conservative bonuses for free or low-cost admission and broad facility scale when those signals are source-backed
- Opening-hours confidence and planned visit date/time when provided
- Visit-fit fields such as average stay, parent effort, child engagement, and weather fit
- Data confidence

Age or amenity mismatches usually reduce score or add cautionary reason codes; they do not automatically remove a candidate.

The `scoreBreakdown` response separates components such as `placeQuality`, `externalEvidence`, `distance`, `context`, `match`, `age`, `preferences`, `openingHours`, `visitFit`, and `confidence`. Evidence caps keep under-sourced records, generic family spaces for immediate kid-activity searches, uncertain opening hours, and lodging with weak infant-logistics evidence from over-ranking.

Taxonomy search facets use `soft` mode by default, so unknown records remain eligible with reason-code context. Use `taxonomy.mode: "required"` only when every requested facet must appear in either `sourceBacked` or `inferred` taxonomy.

## Tech Stack

- Next.js 15 and React 19
- TypeScript
- PostgreSQL with PostGIS, pg_trgm, and pgcrypto
- Drizzle ORM and SQL migrations
- Zod request validation
- Vitest tests
- OpenAPI 3.1 contract validation
- Docker Compose for local PostGIS

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the local development database:

```bash
docker compose -f dev/docker-compose.yml up -d
```

Run migrations:

```bash
pnpm db:migrate
```

Start the app:

```bash
pnpm dev
```

Open the UI at [http://localhost:3000](http://localhost:3000).

## Environment

The app has local defaults for development:

```bash
DATABASE_URL=postgres://aigo:aigo@localhost:5431/aigo
AIGO_API_KEY=change-me
AIGO_APP_ORIGIN=http://localhost:3000
KAKAO_REST_API_KEY=your-local-kakao-test-app-rest-api-key
KAKAO_CLIENT_SECRET=your-local-kakao-test-app-client-secret
AIGO_UPLOAD_DIR=./data/uploads
```

`AIGO_API_KEY=change-me` is accepted only as a local development convenience. Set `AIGO_API_KEY` to a real secret before exposing the API beyond local development. In `NODE_ENV=production`, or when `AIGO_REQUIRE_STRONG_API_KEY=true`, the API rejects the default development key and `pnpm agent:preflight` reports the unsafe configuration.

Visit-photo uploads default to `data/uploads`, which is ignored by git and mounted into the app service by the root Docker Compose file.

## CI/CD

GitHub Actions runs lint, typecheck, tests, a Next.js production build, and a Docker image build for pull requests and pushes to `main`.

Pushes to `main` also deploy through SSH. The deployment host should already have this repository checked out, a populated `.env`, Docker Compose, and the external `aigo_caddy` network used by `docker-compose.yml`.

Required repository secrets for deployment:

```bash
SSH_IP
SSH_PORT
SSH_USER
SSH_PRIVATE_KEY
```

Optional `.env` value for Slack startup/shutdown notifications:

```bash
SLACK_TOKEN=T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
```

Optional repository secret:

```bash
DEPLOY_PATH=/home/shane/aigo
```

If `DEPLOY_PATH` is not set, the workflow deploys from `/home/shane/aigo`.

## Useful Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build:check
pnpm build
pnpm db:migrate
pnpm agent:preflight
pnpm tsx scripts/audit-taxonomy.ts --json
pnpm tsx scripts/apply-taxonomy-migration.ts --limit=5
```

## API Example

```bash
export AIGO_API_BASE_URL="${AIGO_API_BASE_URL:-https://aigo.o-r.kr}"

curl -sS "$AIGO_API_BASE_URL/v1/places/search" \
  -H "Authorization: Bearer $AIGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": { "lat": 36.5, "lng": 127.8, "label": "Selected origin" },
    "filterByRadius": false,
    "viewportBounds": {
      "minLat": 35.95,
      "minLng": 126.95,
      "maxLat": 37.05,
      "maxLng": 128.65
    },
    "visitContext": "rainyDay",
    "childAgeMonths": [32, 7, 7],
    "preferences": {
      "indoorTypes": ["indoor", "mixed"],
      "parkingAvailable": true,
      "strollerFriendly": true,
      "elevator": true,
      "nursingRoom": true,
      "diaperChangingTable": true,
      "babyChair": true,
      "foodAllowed": true
    },
    "limit": 20
  }'
```

## Data Quality Principles

- Check duplicates before creating a place.
- Include at least one source for every create or update.
- Prefer official, public-agency, facility, library, tourism, mall, or operator pages.
- Use public blogs or public listings only as supporting evidence.
- Store image URLs only when the source page is citeable and the image helps identify or compare the exact place.
- Keep `primaryCategory` in the closed top-level category set; use taxonomy facets for finer family-planning meaning and `playFeatures` for physical equipment. Prefer split categories such as `aquarium`, `zoo`, `playground`, and `art_museum` when source evidence supports the specific place type.
- Use canonical source types and full Korean province/city names; API normalization handles common aliases such as `official`, `blog`, `public_data_mirror`, `서울`, `경기`, and `부산`.
- Use `unknown` when evidence is weak instead of guessing.
- Preserve uncertainty in `parentNotes`, `safetyNotes`, `dataConfidence`, image review status, or play-feature evidence.
