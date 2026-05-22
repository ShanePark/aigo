<p align="center">
  <img src="public/icons/icon-192.png" alt="AiGo app icon" width="96" height="96">
</p>

<h1 align="center">AiGo</h1>

AiGo is an agent-friendly place database and search UI for kid-friendly family outings around Daejeon, South Korea. It is built for the practical questions parents ask before leaving the house: Is this place indoors? Can a stroller move through it? Is there parking, a nursing room, a diaper changing table, an elevator, a baby chair, or a reliable snack/meal fallback?

The project combines a Korean Next.js search experience with a structured API that external agents can use to collect, deduplicate, enrich, and inspect source-backed place data. It is a personal/family place intelligence tool, not a generic travel marketplace or review community.

## Product Focus

AiGo is optimized for families planning low-friction outings from the Daejeon Station / old downtown area across Daejeon and roughly one-hour day-trip range.

The data model intentionally treats parent logistics as first-class signals:

- Indoor, outdoor, and mixed destinations
- Recommended child ages
- Stroller practicality, elevator access, parking, nursing rooms, diaper changing tables, kids toilets, baby chairs, and food/snack handling
- Parent effort, child engagement, weather fit, average stay time, safety notes, and parent notes
- Public child-friendly facilities, indoor playgrounds, kids cafes, toy stores, libraries, toy libraries, museums, science museums, parks, family restaurants, shopping malls, rest areas, and short nature trips
- Source-backed place records, image provenance, and wiki-style version history

Unknown is an acceptable value when evidence is weak. AiGo should not invent amenities just to make a place look complete.

## MVP Boundary

The MVP focuses on structured place data, source-backed updates, duplicate review, search, details, image provenance, and version history.

Out of scope for the current MVP:

- User accounts and family profiles
- Saved lists, reviews, visit logs, and community features
- Natural-language search as an API responsibility
- Course generation, real-time crowding, reservations, payments, and accommodations
- Admin data-entry UI

## Current App

The web app provides a Korean place-search UI with:

- Keyword, category, visit-context, age, distance, and family-logistics filters
- Soft matching instead of hard exclusion for age and amenity mismatches
- Result cards with score, distance, tags, facility chips, play-feature chips, confidence, image tier, parent notes, safety notes, and reason codes
- Place detail pages with source links, image audit information, child-friendly signals, play features, visit judgment, notes, and recent versions

The default origin in the UI is Daejeon Station / old downtown.

## Agent API

The OpenAPI contract is in [`docs/openapi/aigo-v1.yaml`](docs/openapi/aigo-v1.yaml). The API expects structured JSON; natural-language parsing belongs outside the API.

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

- `places` - identity, category, tags, location, family logistics, visit-fit scores, notes, status, confidence, and derived search/geography fields
- `place_sources` - source evidence attached to a place
- `place_images` - remote image URLs with provenance, display tier, review status, visual features, and primary-image selection
- `place_versions` - wiki-style snapshots created after create/update actions

Real place data should be created and updated through the AiGo API, not direct database writes. The seed script intentionally inserts no real places.

## Search And Scoring

Search uses PostGIS distance filtering plus text/tag/play-feature matching and a scoring layer in [`src/lib/scoring.ts`](src/lib/scoring.ts). Scores and reason codes are influenced by:

- Distance from the requested origin
- Visit context: `afterDaycare`, `nearbyNow`, `rainyDay`, `weekendHalfDay`, or `dayTrip`
- Category and tag matches
- Recommended child-age fit
- Family logistics preferences
- Data confidence

Age or amenity mismatches usually reduce score or add cautionary reason codes; they do not automatically remove a candidate.

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

Set `AIGO_API_KEY` to a real local secret before exposing the API beyond local development.

## Useful Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:migrate
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
- Use `unknown` when evidence is weak instead of guessing.
- Preserve uncertainty in `parentNotes`, `safetyNotes`, `dataConfidence`, image review status, or play-feature evidence.
