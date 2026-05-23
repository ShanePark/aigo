# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

UI/UX 개편은 아래 항목을 위에서부터 하나씩 진행한다. 한 번에 하나의 `[대기]` 항목만 `[개선 중]`으로 바꾸고, 구현과 검증이 끝나면 해당 항목을 삭제한 뒤 관련 파일만 커밋한다. 각 항목은 가능한 한 작은 독립 커밋 단위로 유지한다.

- [대기] `POST /v1/places/search` 응답에 주말 추천용 `recommendationReadiness` 요약을 추가한다. 2026-05-23 대전역 기준 주말 오전 검색에서 상위권 후보가 실제 추천에는 좋아 보였지만, 에이전트가 `structuredDataGaps`, `imageHealth`, `openingHoursSummary`, `visit.*`, `pricing`을 직접 조합해야 했다. 검색 응답의 각 item에 `readyForWeekendRecommendation`, `blockingGaps`, `cautionNotes`, `agentSummary` 같은 짧은 요약 필드를 제공하고, 필요하면 `readinessMode: familyWeekend | rainyDay | dayTrip` 요청 옵션도 추가한다. 재현 조건: `visitDate=2026-05-23`, `visitStartTime=10:30`, origin 대전역, `childAgeMonths=[32,7,7]`, viewport 대전 중심부. 예시: 대전광역시어린이회관은 점수와 영아 편의성은 높지만 `reservationRequired`, `walkInAvailable`, `sessionBased`, `sameDayAvailabilityKnown`가 비어 있어 출발 전 확인 문구가 필요했다.
- [대기] 야외 놀이터/공원 추천은 장비 정보, 대표 이미지, 영아 동선 확신도가 낮으면 순위 보정과 경고를 강화한다. 2026-05-23 `playgroundOnly` 검색에서 대동복지관어린이놀이터, 대동쉼터어린이놀이터, 대흥어린이공원 놀이터 등이 가까워 상위에 노출됐지만 `strollerFriendly`, `parkingAvailable`, `nursingRoom`, `diaperChangingTable`, `kidsToilet`, `imageHealth`가 대부분 unknown 또는 no active image였다. 놀이터 검색 결과에는 그네/시소/미끄럼틀/모래/그늘/울타리 같은 `playFeatures` 완성도, 사진 검증 상태, 유모차 접근 가능성, 화장실/그늘/차도 위험을 별도 신호로 보여주고, 정보가 부족한 후보는 "가까운 후보지만 검증 필요"로 낮춰 추천한다.
- [대기] 웹 UI에 "이번 주말 아이와 갈 곳" 비교/플래너 모드를 만든다. 현재는 API가 좋은 후보를 반환해도 사용자가 어린이회관, 과학관, 키즈카페, 쇼핑몰, 야외 놀이터를 직접 비교해야 한다. 주말 플래너 화면은 날짜/시간/아이 월령/지도 범위를 기준으로 상위 후보를 `실내 안정형`, `첫째 활동량`, `쌍둥이 동선`, `비용/예약 확인`, `비 올 때 대안`, `짧은 야외` 기준으로 비교하고, 각 후보의 부족한 데이터와 외부 확인 링크를 한 화면에서 보여준다. 에이전트도 같은 비교 요약을 API로 받을 수 있어야 한다.
