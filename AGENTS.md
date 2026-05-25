# AGENTS.md

## Project Guidance

This repository should be handled with a bias toward active investigation, small focused changes, and frequent verification. Read the surrounding code before editing, follow existing conventions, and keep changes scoped to the user's request.

## Development Server Port Policy

The user owns the local Next.js development server on port 3000 during normal work. Before starting a dev server, check whether `localhost:3000` is already serving this repository and use that existing server when it is available.

Only start `pnpm dev` yourself when no suitable server is running on port 3000. Do not let Next.js fall back to an arbitrary alternate port such as 3001, because multiple dev servers in the same checkout share `.next` and can corrupt or race on route and page build artifacts. If port 3000 is occupied by an unrelated process, stop and ask the user how to proceed instead of starting on another port.

## Git Commit Skill

For commit-related work in this repository, read and follow the committed repo skill at `.codex/skills/git-commit/SKILL.md` before inspecting, staging, committing, or reporting git changes. This project-local skill should be used instead of relying on a personal local skill path such as `/Users/shane/.codex/skills/git-commit/SKILL.md`.

Keep commit guidance synchronized with the project skill. When commit workflow behavior changes, update `.codex/skills/git-commit/SKILL.md` and `AGENTS.md` in the same commit.

## Codex Place Data Skill

For AiGo place-data work, read and follow the committed repo skill at `.codex/skills/aigo-place-api/SKILL.md` before researching places, preparing payloads, delegating data research, or calling the AiGo API.

Use this skill whenever a task involves family outing place research across Korea, source-backed place creation or enrichment, duplicate review, AiGo API data mutations, image URL provenance, `agent-research/` staging files, or place-data quality review. The skill is also the handoff document for subagents: subagents should use it to understand how to search, what evidence to record, what fields matter for public family-outing data, and where their responsibility ends before the main agent performs API mutations.

Keep detailed, evolving AiGo data workflow instructions in the skill rather than scattering them across code comments or unrelated docs. `AGENTS.md` should state the trigger and repository-wide rules; `.codex/skills/aigo-place-api/SKILL.md` should carry the operational workflow, API request sequence, payload expectations, source/image provenance rules, and verification checklist.

When any change affects the place-data workflow, update the skill in the same commit. This includes changes to `docs/openapi/aigo-v1.yaml`, `src/lib/schemas.ts`, `/v1/places` route behavior, auth requirements, version-history behavior, source or image provenance models, category/tag/search scoring semantics, `agent-research/` workflow, or the family data mission. If implementation and skill disagree, treat the code/OpenAPI contract as source of truth and bring the skill back into sync before finishing.

## AiGo Data Mission

AiGo's most important asset is the breadth and quality of real place data for family outings across Korea. Data work should collect nationwide and keep place records neutral enough to serve many households:

- Collection scope: nationwide Korea. Do not limit discovery to a single city or one-hour driving range when the task is broad place expansion.
- Personalization should come from runtime user preferences, location, child ages, and visit context, not from hard-coded household assumptions in repository guidance.
- Strong family-outing signals include indoor options, kids cafes, stroller practicality, nursing room, diaper changing table, parking, snack/meal handling, public child-friendly facilities, outdoor play, and nature/day-trip destinations.
- User-requested or user-visited reference places can be treated as useful leads, but public place data should remain broadly reusable and source-backed.

Research and data updates must be source-backed. Do not invent amenities. Unknown is acceptable when evidence is weak.

User-facing public place text must be written in Korean. API field names and structured keys can stay English/camelCase, but `description`, `parentNotes`, `safetyNotes`, `placeScoreRationale`, and `playFeatures.notes` should not contain English template prose or agent shorthand. Translate source-backed facts into natural Korean before registration or enrichment; keep English only for proper nouns, URLs, source titles, and unavoidable facility names.

Scoring changes should keep source-backed place quality separate from runtime search relevance and user visit ratings. Keep detailed scoring workflow guidance in `.codex/skills/aigo-place-api/SKILL.md` and user/developer-facing behavior in `README.md`; `AGENTS.md` should only carry this repository-wide guardrail.

## Family Outing Patterns

Treat user-requested and user-visited places as product feedback, but do not encode one household's needs as the default product boundary. Public data collection should cover a broad range of family outing patterns:

- Low-friction indoor fallback: department stores, outlets, malls, kids cafes inside malls, and facilities where parking/elevator/baby lounge/food can be solved in one building.
- Age-inclusive play value plus care logistics: active kids cafes and playgrounds matter, but recommendations must still expose stroller, nursing, diaper, safety, and parent-effort tradeoffs.
- Public child-friendly half-day options: science museums, children's halls, libraries, toy libraries, arboretums, parks, and municipal/national facilities are high value because they are repeatable and often cheaper.
- Short outdoor sensory play: sand play, water play, forest playgrounds, lawns, fountains, and stroller walks are important, especially near dense residential areas, lodging, transit hubs, or easy parking.
- Day-trip nature with practical stops: nationwide nature/travel candidates should include route limits, toilets, shade, water-edge risk, and feeding/change fallback.
- Playroom/family restaurants: these are useful after daycare or for meal+play combinations, but grill/fire risks, playroom line-of-sight, baby chairs, parking, and floor changes should be explicit.

When a source is weak or current operation is uncertain, keep the place searchable for user-requested registration and use cautionary parent notes, `unknown` fields, and conservative scoring rather than silently removing it from research. Do not use `needs_check` or `needs_review` as registration/review states for places the user asked us to add.

## Research Source Policy

Use broad public internet research first:

- Official facility pages, public agency pages, mall/facility pages, library pages, tourism pages.
- Public blog posts or public local listings only as supporting evidence, summarized in our own words.
- Search engine results and web pages are preferred over automated map scraping.
- For data discovery, prefer general internet search and source pages over typing repeated searches into map products.
- Subagents should not call map/vendor APIs in bulk. If they need coordinates, prefer official pages, public address/coordinate pages, public facility datasets, or a small number of source-backed public pages.

For broad place expansion, use a duplicate-first discovery loop. Gather shallow candidate names and rough areas from search results or directory pages, check AiGo with read-only search/duplicate endpoints before deep research, and only spend deeper source-reading effort on places that appear missing, stale, or valuable to enrich. Keep a visited-query/source ledger in the active `agent-research/` context or slice file so later agents do not keep reopening the same pages.

For nationwide expansion, split work by both region and category. Useful region blocks include Seoul/Incheon/Gyeonggi, Gangwon, Chungcheong/Sejong, Jeolla/Gwangju, Gyeongsang/Busan/Daegu/Ulsan, and Jeju. Within each block, prioritize high-signal family categories first: major malls/outlets, kids cafes and indoor playgrounds, public child facilities, toy libraries, science/museum experience spaces, water/sand/forest play, playroom restaurants, kid-primary accommodations, and route-break support stops.

When place research or registration reveals product/API/schema/search/tooling friction, do not fix it directly as part of the data-collection wave. Add an actionable `[대기]` proposal to `docs/aigo-improvements.md` with enough source task, research-file, payload, and result context for the separate improvement automation to reproduce and solve it later.

Avoid high-volume map service/API use. Do not make repeated automated Kakao Map/API calls or loops. If a map search URL is used as a source, keep it sparse and manual-style, and record only URL/external ID/summary, never copied source text.

Do not add committed documentation or code comments that imply AiGo depends on aggressive Kakao Map usage or scraping. Operational collection limits and sensitive collection notes belong only in ignored planning/worklog/spec files.

Never log in, create accounts, bypass access controls, or transmit private user data to third-party sites.

## Research File Workflow

Subagents collecting information should write structured Markdown files under `agent-research/`. This folder is intentionally excluded from git and must not be committed.

Use one file per research slice, for example:

- `agent-research/indoor-playgrounds-YYYYMMDD-HHMM.md`
- `agent-research/libraries-toy-libraries-YYYYMMDD-HHMM.md`
- `agent-research/parks-daytrips-YYYYMMDD-HHMM.md`
- `agent-research/family-restaurants-YYYYMMDD-HHMM.md`

Each researched place should include:

- Place name
- Suggested action: `create`, `update`, `skip_existing`, `skip`, or `hold_for_later`
- Category and tags
- Address/region and coordinates if confidently found
- Child/family signals: age fit, indoor/outdoor, stroller, parking, nursing room, diaper table, kids toilet, elevator, baby chair, food/snack handling, stay duration, parent effort, safety notes
- Source URLs with short summaries
- Confidence level and open questions
- Possible API payload fields, using English camelCase field names

Research files are staging material only. Actual DB changes must go through AiGo API flow.

## AiGo Improvement Backlog

When AiGo service/API usage reveals friction, bugs, unclear behavior, or future product improvements, record the durable improvement backlog in `docs/aigo-improvements.md`. `agent-research/*.md` files may contain task-local observations and raw notes, but any improvement that should be fixable later must be copied or summarized into `docs/aigo-improvements.md`. During place data collection/registration, the correct action is to write the improvement proposal, not to implement the fix directly.

Use a simple checklist format with one improvement per item. Keep each item actionable, include the source task or research file when useful, and preserve enough API payload/result context for a future agent to reproduce the issue.

Use these Korean status labels at the start of each open item:

- `[대기]` for an improvement that has not started.
- `[개선 중]` for the single improvement currently being worked on.

When starting work on an existing improvement, first update that item from `[대기]` to `[개선 중]`, then implement and verify the fix. When finishing, delete the item from `docs/aigo-improvements.md` instead of changing it to `[완료]`; keep verification details in the relevant commit, PR, test, or implementation notes. Do not leave multiple unrelated items marked `[개선 중]` unless they are intentionally part of the same active change.

## API Data Mutation Rules

All real place data creation or enrichment must use the AiGo API, not direct DB writes:

1. `POST /v1/places/duplicates`
2. `GET /v1/places/{placeId}` if a candidate exists
3. `POST /v1/places` for new places
4. `PATCH /v1/places/{placeId}` for updates
5. Verify version history after meaningful updates

Every create/update must include at least one source and at least one citeable, place-specific image entry. Prefer official/public sources. Use `unknown` instead of guessing.

Do not create real data seed/export files. Real place data belongs in the development DB only.

The main agent is responsible for applying mutations. Research subagents should normally stop at structured Markdown findings under `agent-research/`, including possible payload fragments and source evidence, so updates can be consolidated without conflicting writes.

For large discovery waves, assigned subagents may call read-only AiGo endpoints such as `/v1/places/search`, `/v1/places/duplicates`, and place detail reads for dedupe and gap checks. They must not create, patch, delete, or otherwise mutate real place data unless explicitly assigned as the single API mutation executor.

## Image URL Enrichment

AiGo should use image links as source-backed metadata, not downloaded files. Store remote image URLs only when the source page can be cited and the image helps a parent recognize or compare the place.

Preferred image sources:

- Official facility, public agency, mall, museum, library, tourism, or operator pages.
- Branch-specific `og:image`, hero images, or embedded representative images from official pages.
- Public listing images only when official/operator images are unavailable and the listing clearly matches the exact branch/place.

Avoid or mark as low-confidence:

- Logos, favicons, generic share thumbnails, brand-only images, icon-sized branch buttons, or multi-branch ticket graphics.
- Personal blog/SNS images unless there is no better source and the report clearly labels confidence and rights uncertainty.
- Direct image URLs without a source page URL.

For each image candidate, research notes should include:

- Structured `images[]` candidates with `url`, `sourceUrl`, `sourceType`, `sourceTitle`, `displayTier`, `reviewStatus`, `altText` or `description`, and `checkedAt` when available.
- Whether the image is official/public-agency/public-listing/generic.
- Confidence and hotlink/rendering caveats.
- A possible API `PATCH` fragment that appends structured `images` and a source entry. Use `imageUrls` only as a legacy shorthand when preserving existing linkage is enough.

Actual DB image updates must go through the normal AiGo API update flow, with at least one source entry summarizing the image provenance. Keep image collection constraints and operational notes out of committed docs/code.

## Subagent Usage

Use subagents aggressively and frequently. When a task can be decomposed into independent research, implementation, review, testing, or verification work, delegate those pieces to subagents early so useful context and changes can be produced in parallel.

Prefer subagents for:

- Exploring separate areas of the codebase.
- Investigating independent bugs or failure modes.
- Implementing clearly separated file or module changes.
- Reviewing risky changes while implementation continues.
- Running or analyzing verification tasks that do not block immediate work.

When assigning subagents, give them clear ownership, concrete deliverables, and explicit boundaries. If multiple subagents are working at once, make sure their write scopes do not overlap unless coordination is required.

## Parallel Work

Run tasks in parallel whenever they can be performed independently. Do not serialize unrelated work out of habit. Searches, file reads, test runs, build checks, documentation lookups, and independent code investigations should be batched or delegated when possible.

Use parallel execution especially for:

- Reading multiple files.
- Searching for related symbols or patterns.
- Comparing implementations across modules.
- Running independent test or lint commands.
- Collecting context while another task is being implemented.

Keep the critical path moving locally while background or delegated work runs.

## Frontend Visual Assets and ImageGen

For frontend work, use visual assets actively when they make the app easier to scan, warmer, or more delightful for family outing discovery. AiGo should feel polished, cute, friendly, and practical rather than generic or text-heavy.

Use existing code-native assets first for deterministic UI controls: lucide icons, established SVG/icon systems, CSS shapes, map markers, state indicators, toolbar buttons, and simple category/filter icons. These should stay crisp, accessible, and consistent with the surrounding component system.

Use the `$imagegen` skill at `/Users/shane/.codex/skills/.system/imagegen/SKILL.md` when the frontend needs high-quality raster visuals such as cute category illustrations, mascot-like icons, empty-state art, hero or onboarding images, polished app badges, transparent-background cutouts, or visual variants that would be weaker as plain SVG.

Before generating or editing any project-bound raster asset, read and follow the ImageGen skill. Use the built-in `image_gen` path by default. If the final asset is referenced by the app, move or copy it into the repository, usually under `public/`, and update the consuming code so the project never depends on a file left only under `$CODEX_HOME`.

Project-bound raster UI assets should be WebP by default to keep the app light. Convert generated PNG outputs to WebP before referencing them unless PNG is genuinely required for platform compatibility, such as favicons, Apple/Android manifest icons, Windows tiles, source masters, or a tooling/browser requirement that WebP cannot satisfy.

For transparent icons or cutouts, prefer the skill's chroma-key workflow first, then validate the alpha output before using it in the UI. Ask before falling back to CLI/native transparency paths that require model or API-key changes.

Generated AiGo visual assets should be readable at real UI sizes, warm and family-friendly, and visually consistent across a set. Avoid tiny text inside generated icons unless explicitly required, and do not use generated raster assets when a simple lucide/code-native icon is the cleaner fit.

## Product UI Design System

AiGo's interface should feel calm, modern, warm, and operationally useful. Before adding new controls, inspect the existing shared CSS primitives in `src/app/globals.css` and compose from them instead of creating one-off button, chip, card, or toolbar styles.

Use a clear action hierarchy:

- One visually dominant primary action per local surface, usually the main search or save action.
- Secondary actions should be quiet tonal, ghost, or icon+label controls with the same height and rhythm as nearby primary actions.
- Filters and categories should read as chips or segmented choices, not as little buttons with nested boxes. Avoid decorative plus boxes or redundant state glyphs; use fill, border, color, and a simple check state when selection needs confirmation.
- Dense operational areas should use restrained elevation, consistent gaps, and predictable alignment. Prefer compact, scannable controls over marketing-style decoration.
- Header actions should stay consolidated. When more than one or two utilities accumulate in the topbar, put them behind a menu button so the brand and primary workflow remain visually quiet.
- Saved-place user-facing terminology should use `찜` for the want-to-go state. Keep internal API/schema names such as `wantToGo` unchanged unless the data contract itself is intentionally migrated.
- Binary or saved-state controls should look clearly different before and after selection: inactive controls stay neutral and quiet, while selected controls may use the semantic color fill. Do not make unchecked save buttons look already selected.
- Related header actions should feel like one composed control surface rather than separate nested capsules. Prefer simple segmented or grouped controls with shared height, radius, and rhythm.
- Score affordances should stay minimal. Show the score number as the primary signal, and use click/tap to reveal explanatory detail instead of adding visible helper text like "점수 보기" when the interaction is already clear.
- Dark mode must be checked for readability on every touched page or component. Avoid hard-coded light translucent surfaces; route panels, chips, dialogs, and helper text through theme tokens so contrast stays clear in both themes.
- Keep default surfaces concise. Avoid long instructional helper copy in cards, panels, and headers; preserve only the text needed to choose the next action, and move detailed explanations behind an info icon, disclosure, or modal when users may need context.
- Do not use native `alert`, `confirm`, or `prompt` for product flows. Use shared app UI such as `ConfirmDialog`, an in-context editor, toast/status copy, or a purpose-built modal.
- Editing an existing record should happen in that record's local context whenever possible, not by repurposing a separate create form.
- New UI patterns should define reusable tokens/classes first when they are likely to repeat. Do not let each feature invent its own button radius, shadow, padding, or hover language.

## Editing Rules

- Preserve existing user changes.
- Do not revert files unless explicitly asked.
- Prefer minimal, idiomatic changes over broad refactors.
- Match the repository's established style and tooling.
- Add comments only when they clarify non-obvious logic.
- Verify changes with the most relevant available checks.

## Commit Workflow

When a task is complete, the changes are cohesive enough to commit, and review/verification finds no blocking issues, proactively create a git commit for only the changes made in the current session or task. Before committing, use `.codex/skills/git-commit/SKILL.md` and commit at sensible, focused boundaries rather than batching unrelated work together.

Before committing:

- Inspect `git status` and relevant diffs.
- Stage only files changed for the current task; never include unrelated user changes or ignored research files.
- Run or cite the most relevant verification available for the change.
- Use a clear conventional commit message such as `docs: update agent workflow guidance` or `fix: ...`.

If verification fails, the worktree contains ambiguous unrelated edits, or the commit scope is not clearly separable, do not commit automatically. Explain the blocker and the safest next step instead.

## Communication

Keep updates concise and useful. Explain what is being investigated, what changed, and what verification was performed. If a blocker appears, state the concrete issue and the best available next step.
