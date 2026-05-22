# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

- [대기] Replace fixed-radius place filtering with map viewport search. Current search/list behavior is tied to a fixed radius such as 20km, which feels unlike map-first apps. Change the search flow so the place list is driven by the currently visible map bounds instead, including a "search this area" style interaction after pan/zoom, while preserving family filters and making the API/query contract explicit. Source: user feedback on 2026-05-22.
