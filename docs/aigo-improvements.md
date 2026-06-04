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

- [개선 중] active place duplicate merge/retire workflow를 만든다. 2026-06-04 Daegu/Gyeongbuk duplicate-pair review에서 `이월드`, `대구시민안전테마파크`, `국립대구과학관`, `경주월드`가 같은 이름·주소·좌표와 high duplicate confidence를 가진 active 중복 쌍으로 확인됐지만, 현재 `DELETE /v1/places/{placeId}`는 source-backed closed-place soft delete라서 영업 중인 중복 레코드 정리에 쓰기 부적절했다. 후속 작업은 canonical keep id와 retire/merge id, transferred aliases/sources/images/version audit, search exclusion, and user-facing status semantics를 다루는 안전한 admin/API workflow를 설계·구현해야 한다. 재현 handoff: `agent-research/daegyeong-second-duplicate-review-worker-20260604-1516.md`; recommended keep/merge ids are listed there. 2026-06-04 첫 slice: read-only merge/retire planning script를 추가해 keep/retire 후보의 alias/source/image/version 전송 계획을 출력한다. 2026-06-04 둘째 slice: `POST /v1/places/{placeId}/retire-duplicate`를 추가해 active duplicate만 `merged`로 은퇴시키고 canonical id/version audit/search·duplicate exclusion을 보장한다. 2026-06-05 production validation blocker: Bucheon duplicate cleanup attempted schema-valid retire requests for lower-evidence duplicate ids `2a85abfc-ab4f-4ba6-a808-c1f8ea221e67` -> canonical `0c361ca0-fc30-4cf1-9982-d56e3e38b0a2` (`스타필드 시티 부천`) and `cc4cda81-c4ba-4b71-82d5-17b3453d29e7` -> canonical `4a5a74c7-f386-46e0-954c-f96cf2fd6269` (`웅진플레이도시`), but production returned a Next.js HTML 404 for `/v1/places/{placeId}/retire-duplicate`. Before any real retire batch, verify the deployed route exists on `https://aigo.o-r.kr`, add a production smoke check, and confirm canonical transfer/apply behavior. Evidence: `agent-research/bucheon-duplicate-pairs-precheck-20260605-0104.json`, `agent-research/bucheon-anchors-readonly-audit-20260605-0104.txt`. 2026-06-05 셋째 slice: `scripts/smoke-retire-duplicate-route.ts`를 추가해 nonexistent sentinel id POST가 API JSON 404인지 확인한다. 현재 production smoke는 HTML 404로 실패하므로 route 배포 전 실제 retire batch는 계속 중단한다. 다음 slice는 route 배포 확인 후 canonical 레코드로 alias/source/image를 이전·병합하는 apply workflow와 실제 production retire batch 검증이다.
- [대기] generic branch-alias duplicate scoring을 distance/address conflict에 더 강하게 낮춘다. 2026-06-04 Seoul/Gyeonggi Bucheon/Siheung density sprint에서 `아이러브맘카페`, `아이맘카페`, `장난감도서관` 같은 공통 alias가 다른 시군/원거리 branch들을 low-confidence `hold_duplicate_review` 또는 `manual_duplicate_review` 후보로 반복 노출했다. 생성은 막히지 않았지만 mutating executor가 매번 false-positive를 읽어야 하므로, `/v1/places/duplicates`가 `GENERIC_ALIAS_REVIEW_ONLY`, `GEO_OUTSIDE_REQUEST_RADIUS`, `ADDRESS_REGION_CONFLICT` 조합을 별도 `sibling_branch_review` 또는 낮은-priority bucket으로 분리하고 high/manual 같은 운영 판단과 명확히 구분하도록 개선한다. 재현 handoff/results: `agent-research/seoul-gyeonggi-20260604-1717-bucheon-beombak-api-results.json`, `agent-research/seoul-gyeonggi-20260604-1717-bucheon-alias-worker.md`, `agent-research/seoul-gyeonggi-20260604-1717-siheung-closure-worker.md`.
