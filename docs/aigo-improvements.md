# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Before starting a `[대기]` item, review it explicitly while it is still `[대기]`. Confirm that the improvement is still real, necessary, and worth doing; check whether the proposed direction could create product, data, API, migration, UX, or operational problems; and compare the expected value against the risk and implementation cost. Only change the item to `[개선 중]` and implement it when that review concludes the work should proceed.

If a `[대기]` item is judged weak, obsolete, unactionable, already solved, or no longer worth improving, delete it from this file instead of leaving it in the queue.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

한 번에 하나의 `[대기]` 항목만 고르고, 먼저 확실한 개선 사항인지, 현재도 필요한지, 제안된 방식이 문제를 만들 가능성은 없는지 리뷰한다. 진행 가치가 충분하다고 판단될 때만 `[개선 중]`으로 바꾸고, 구현과 검증이 끝나면 해당 항목을 삭제한 뒤 관련 파일만 커밋한다. 각 항목은 가능한 한 작은 독립 커밋 단위로 유지한다. 구현 중 새로 필요한 후속 작업, 설계 분기, 테스트 보강, UI 정리, 문서 갱신이 발견되면 현재 항목에 억지로 끼워 넣지 말고 이 문서에 새 `[대기]` 항목으로 다시 등록해 재귀적으로 이어간다.

- [대기] Place-data automation credential preflight and cooldown: `agent-research/aigo-collection-context.md` had accumulated 31 repeated Jeonbuk credential-blocker follow-ups after `.env` resolved to placeholder `AIGO_API_KEY`. Add or document a durable preflight path so missing/placeholder credentials stop before subagents, production read-only API artifacts, count movement, or repeated blocker context writes; unchanged auth blockers should end quietly instead of notifying every heartbeat. Source audit: `agent-research/cleanup-status-20260616.md`.
- [대기] Research artifact compaction workflow: `agent-research/` grew back to 6,000+ files and roughly 212 MB after the prior cleanup, with many raw detail/verify/patch/search/duplicate JSON files and downloaded source captures. Add a script or documented workflow that summarizes production ids, unresolved candidate queues, blockers, source URLs, image candidates, and coordinate provenance into a compact manifest before archiving/removing raw artifacts. Source audit: `agent-research/cleanup-status-20260616.md`.
