<p align="center">
  <img src="public/icons/icon-192.png" alt="AiGo app icon" width="96" height="96">
</p>

<h1 align="center">AiGo</h1>

AiGo is an agent-friendly place database and search UI for kid-friendly family outings across Korea, anchored around a Daejeon family context. It is built for the practical questions parents ask before leaving the house: Is this place indoors? Can a stroller move through it? Is there parking, a nursing room, a diaper changing table, an elevator, a baby chair, or a reliable snack/meal fallback?

The project combines a Korean Next.js search experience with a structured API that external agents can use to collect, deduplicate, enrich, and inspect source-backed place data. It is a personal/family place intelligence tool, not a generic travel marketplace or review community.

## Product Focus

AiGo is optimized for families planning low-friction outings, with Daejeon Station / old downtown as the default personalization anchor and nationwide Korea as the broader collection scope.

The data model intentionally treats parent logistics as first-class signals:

- Indoor, outdoor, and mixed destinations
- Recommended child ages
- Stroller practicality, elevator access, parking, nursing rooms, diaper changing tables, kids toilets, baby chairs, and food/snack handling
- Parent effort, child engagement, weather fit, average stay time, safety notes, and parent notes
- Public child-friendly facilities, indoor playgrounds, kids cafes, toy stores, libraries, toy libraries, museums, science museums, parks, family restaurants, shopping malls, rest areas, kid-primary accommodations, and short nature trips
- Source-backed place records, image provenance, and wiki-style version history
- Closed top-level categories plus controlled taxonomy facets for family-fit, activity type, use case, age band, logistics, and risk semantics

Unknown is an acceptable value when evidence is weak. AiGo should not invent amenities just to make a place look complete.

## MVP Boundary

The MVP focuses on structured place data, source-backed updates, duplicate review, search, details, image provenance, and version history.

Out of scope for the current MVP:

- User accounts and family profiles
- Saved lists, reviews, visit logs, and community features
- Full natural-language trip planning as an API responsibility
- Full itinerary generation, real-time crowding, reservations, payments, and lodging booking flows
- Admin data-entry UI

## Current App

The web app provides a Korean place-search UI with:

- Keyword, category, visit-context, age, distance, and family-logistics filters
- Soft matching instead of hard exclusion for age and amenity mismatches
- Result cards with score, distance, tags, facility chips, play-feature chips, confidence, image tier, parent notes, safety notes, and reason codes
- Place detail pages with source links, image audit information, child-friendly signals, play features, visit judgment, notes, and recent versions

The default origin in the UI is Daejeon Station / old downtown.

## Agent API

The OpenAPI contract is in [`docs/openapi/aigo-v1.yaml`](docs/openapi/aigo-v1.yaml). The API expects structured JSON; it supports lightweight keyword and taxonomy-facet normalization for search, while full natural-language trip planning belongs outside the API.

Main endpoints:

- `POST /v1/places/search` - search places with soft matching and reason codes
- `POST /v1/places/duplicates` - check likely duplicates before creating or updating data
- `POST /v1/places` - create a source-backed place and publish it immediately
- `GET /v1/places/{placeId}` - fetch place detail
- `PATCH /v1/places/{placeId}` - update a place and append a new version
- `GET /v1/places/{placeId}/versions` - list place versions
- `GET /v1/places/{placeId}/versions/{versionId}` - inspect a specific version
- `GET /v1/places/image-health` - list image coverage and review queues

All API routes require bearer auth:

```bash
Authorization: Bearer $AIGO_API_KEY
```

## Data Model

AiGo stores places in PostgreSQL/PostGIS with Drizzle schema definitions in [`src/db/schema.ts`](src/db/schema.ts). The main tables are:

- `places` - identity, closed primary category, canonical tags, controlled taxonomy facets, location, family logistics, visit-fit scores, notes, status, confidence, and derived search/geography fields
- `place_sources` - source evidence attached to a place
- `place_images` - remote image URLs with provenance, display tier, review status, visual features, and primary-image selection
- `place_versions` - wiki-style snapshots created after create/update actions

Real place data should be created and updated through the AiGo API, not direct database writes. The seed script intentionally inserts no real places.

## Search And Scoring

Search uses PostGIS distance filtering plus text/tag/play-feature matching and a scoring layer in [`src/lib/scoring.ts`](src/lib/scoring.ts). Scores and reason codes are influenced by:

- Distance from the requested origin
- Visit context: `afterDaycare`, `nearbyNow`, `rainyDay`, `weekendHalfDay`, or `dayTrip`
- Category, tag, and taxonomy facet matches
- Recommended child-age fit
- Family logistics preferences
- Data confidence

Age or amenity mismatches usually reduce score or add cautionary reason codes; they do not automatically remove a candidate.

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
```

`AIGO_API_KEY=change-me` is accepted only as a local development convenience. Set `AIGO_API_KEY` to a real secret before exposing the API beyond local development. In `NODE_ENV=production`, or when `AIGO_REQUIRE_STRONG_API_KEY=true`, the API rejects the default development key and `pnpm agent:preflight` reports the unsafe configuration.

## Useful Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:migrate
pnpm agent:preflight
pnpm tsx scripts/audit-taxonomy.ts --json
pnpm tsx scripts/apply-taxonomy-migration.ts --limit=5
```

## API Example

```bash
curl -sS http://localhost:3000/v1/places/search \
  -H "Authorization: Bearer $AIGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": { "lat": 36.3322, "lng": 127.4341, "label": "Daejeon Station / old downtown" },
    "radiusKm": 80,
    "visitContext": "rainyDay",
    "childAgeMonths": [32, 7, 7],
    "preferences": {
      "indoorTypes": ["indoor", "mixed"],
      "parkingAvailable": true,
      "strollerFriendly": true,
      "nursingRoom": true,
      "diaperChangingTable": true
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
- Keep `primaryCategory` in the closed top-level category set; use taxonomy facets for finer family-planning meaning and `playFeatures` for physical equipment.
- Use canonical source types and full Korean province/city names; API normalization handles common aliases such as `official`, `blog`, `public_data_mirror`, `대전`, `충남`, and `세종`.
- Use `unknown` when evidence is weak instead of guessing.
- Preserve uncertainty in `parentNotes`, `safetyNotes`, `dataConfidence`, image review status, or play-feature evidence.
