# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

- [대기] Add structured parking friction fields such as `parkingFrictionLevel`, `peakParkingWindow`, and `parkingWaitNote`, especially for large public facilities. Source: `agent-research/weekend-outing-aigo-api-20260522-1440.md`.
- [대기] Add itinerary/cluster grouping for day trips, such as 아산장영실과학관 + 아산생태곤충원 or 국립생태원 + 씨큐리움, with shared drive burden, meal/rest fallback, and parent effort notes. Source: `agent-research/weekend-outing-aigo-api-20260522-1440.md`.
- [대기] Add a user-facing info link for every place, preferring an official site or public-agency/operator page and falling back to Naver Place, Kakao/Google Maps, tourism pages, mall/library listings, or other public listings when no official site exists. Run a full audit of already-registered places and backfill address-matched `officialUrl` or `externalRefs.infoLinks` entries so parents can open a reliable page for more details.
