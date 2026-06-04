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

- [대기] 공공 놀이터/도시공원 좌표 품질 감사 도구를 추가한다. 2026-06-04 대전 동구 어린이공원 좌표 보정 중 `woori-chunsa` 어린이놀이시설 안전정보 mirror 및 `fcyk` 전국도시공원 계열 좌표가 지자체 공식 공원 목록의 카카오 길찾기 좌표와 300m-11km 이상 어긋나는 사례를 확인했다. 실제 production 보정: `옥토끼어린이공원`, `늘봄어린이공원`, `대동어린이공원`, `성남어린이공원`, `대성어린이공원`, `동광어린이공원`, `안터어린이공원`, `용전어린이공원`, `도리공원`; 중복 종료: `늘봄공원`. 후속 작업은 지자체 공식 목록/공공데이터의 embedded map 좌표를 읽어 기존 `externalRefs.coordinateProvenance`가 없거나 낮은 신뢰도인 playground/park 레코드와 거리 차를 계산하고, `urlX/urlY`가 없는 Kakao `itemId` 링크는 좌표 근거로 쓰지 않도록 제외하는 read-only audit script를 만든다. 감사 결과는 mutation 없이 후보 id, 현재 좌표, 공식 좌표, 거리, source title, duplicate 후보를 출력해야 한다.
