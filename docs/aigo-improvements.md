# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.
- `[완료]`: fixed and verified.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

- [대기] Add date/time-aware search fields such as `visitDate`, `visitStartTime`, or target day so "this weekend" planning does not rely on `OPEN_NOW` for the current day. Source: `agent-research/weekend-outing-aigo-api-20260522-1440.md`.
- [대기] Improve Korean natural-language query matching; `"공공 어린이 체험 박물관 과학관"` returned 0 results while equivalent category filters returned useful candidates. Source: `agent-research/weekend-outing-aigo-api-20260522-1440.md`.
- [대기] Make place id fields consistent across search, detail, and duplicate endpoints, or document/client-normalize `placeId`, `id`, and `items[].place.id`. Source: `agent-research/weekend-outing-aigo-api-20260522-1440.md`.
- [대기] Add a compact/projection mode to `/v1/places/search` for planning and agent use. Source: `agent-research/weekend-outing-aigo-api-20260522-1440.md`.
- [대기] Surface image-health in search results so high-ranking places without an active primary image are obvious before rendering cards or recommending them. Source: `agent-research/weekend-outing-aigo-api-20260522-1440.md`.
- [대기] Propagate official opening-hours confidence into search results; 대전신세계 had official hours sources but search still emitted `OPENING_HOURS_UNKNOWN`. Source: `agent-research/weekend-outing-aigo-api-20260522-1440.md`.
- [대기] Add reservation/session/friction flags such as `reservationRequired`, `walkInAvailable`, `sessionBased`, and `sameDayAvailabilityKnown` for places like 대전광역시어린이회관. Source: `agent-research/weekend-outing-aigo-api-20260522-1440.md`.
- [대기] Add structured parking friction fields such as `parkingFrictionLevel`, `peakParkingWindow`, and `parkingWaitNote`, especially for large public facilities. Source: `agent-research/weekend-outing-aigo-api-20260522-1440.md`.
- [대기] Add an infant-logistics confidence signal separate from toddler child-engagement scoring. Source: `agent-research/weekend-outing-aigo-api-20260522-1440.md`.
