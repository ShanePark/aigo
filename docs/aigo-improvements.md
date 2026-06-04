# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

If a `[대기]` item is judged weak, obsolete, unactionable, already solved, or no longer worth improving, delete it from this file instead of leaving it in the queue.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

한 번에 하나의 `[대기]` 항목만 `[개선 중]`으로 바꾸고, 구현과 검증이 끝나면 해당 항목을 삭제한 뒤 관련 파일만 커밋한다. 각 항목은 가능한 한 작은 독립 커밋 단위로 유지한다. 구현 중 새로 필요한 후속 작업, 설계 분기, 테스트 보강, UI 정리, 문서 갱신이 발견되면 현재 항목에 억지로 끼워 넣지 말고 이 문서에 새 `[대기]` 항목으로 다시 등록해 재귀적으로 이어간다.

- [대기] active place duplicate merge/retire workflow를 만든다. 2026-06-04 Daegu/Gyeongbuk duplicate-pair review에서 `이월드`, `대구시민안전테마파크`, `국립대구과학관`, `경주월드`가 같은 이름·주소·좌표와 high duplicate confidence를 가진 active 중복 쌍으로 확인됐지만, 현재 `DELETE /v1/places/{placeId}`는 source-backed closed-place soft delete라서 영업 중인 중복 레코드 정리에 쓰기 부적절했다. 후속 작업은 canonical keep id와 retire/merge id, transferred aliases/sources/images/version audit, search exclusion, and user-facing status semantics를 다루는 안전한 admin/API workflow를 설계·구현해야 한다. 재현 handoff: `agent-research/daegyeong-second-duplicate-review-worker-20260604-1516.md`; recommended keep/merge ids are listed there.
