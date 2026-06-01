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

- [개선 중] `/v1/places/duplicates`의 공공 하위시설/동일건물 판정을 조정한다. `agent-research/daegyeong-qa-daegu-public-retail-20260531-2131.md` 실행에서 `대구광역시립국채보상운동기념도서관 어린이자료실`은 가까운 `스파크랜드`에 high-confidence manual review로 걸렸고, `달서구육아종합지원센터 장난감도서관`/`북구육아종합지원센터 장난감도서관`은 서로 다른 구·주소의 기존 어린이자료실/장난감도서관 레코드에 `SAME_SIDO_GENERIC_REVIEW_ONLY`, `PUBLIC_SUBFACILITY_REVIEW_ONLY`, `GEO_OUTSIDE_REQUEST_RADIUS`로 막혔다. `대구신세계`/`주라지 테마파크 대구신세계`도 같은 건물의 `대구아쿠아리움`/`리틀란드 대구신세계`에 parent/tenant 관계가 아닌 identity review로 막힌다. 서울 북부 배치(`agent-research/seoul-ra-public-child-library-20260531-ledger.json`)의 `서울시립과학관 어린이/가족 체험`, `서울생활사박물관 어린이체험실 옴팡`/`서울생활사박물관 옴팡놀이터`, `도봉구육아종합지원센터 놀이체험실` 사례도 같은 개선의 재현 케이스로 포함한다. 개선 방향은 주소·시군구 충돌이 명확한 generic 공공시설은 hard hold 대신 낮은 우선순위 review로 낮추고, same-building tenant/parent-child 관계는 생성 차단용 identity duplicate와 분리해 API 응답에 관계 후보로 노출하는 것이다.
