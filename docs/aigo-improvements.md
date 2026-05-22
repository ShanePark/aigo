# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

- [대기] `/v1/places/search`의 후보군 산출을 `limit 750` 고정 선필터 방식에서 실제 검색 규모에 맞는 페이징/카운트 구조로 바꾼다. 현재 `buildSearchQuery()`가 DB에서 `order by coalesce(place_score, 5) desc, updated_at desc limit 750`만 가져온 뒤 애플리케이션에서 런타임 점수화, 다양성 필터, `offset/limit`을 적용하므로 장소 수가 750개를 넘으면 관련 후보가 사전에 잘리고 `meta.total`도 실제 전체가 아니라 잘린 후보 수가 된다. `query`, `tags`, 선호조건, 거리대, 다양성 필터가 있는 경우에도 누락 없이 동작하도록 SQL 후보 점수/키셋 페이징/별도 count 전략 중 하나를 설계하고, 800개 이상 더미 데이터에서 `offset`과 `total`이 깨지지 않는 통합 테스트를 추가한다.

- [대기] Replace fixed-radius place filtering with map viewport search. Current search/list behavior is tied to a fixed radius such as 20km, which feels unlike map-first apps. Change the search flow so the place list is driven by the currently visible map bounds instead, while preserving family filters and making the API/query contract explicit. When the user pans or zooms the map to a different area, show a `현 지도에서 검색` button and refresh the list from the visible map area only when the user taps it, so map movement does not unexpectedly rewrite the results. Remove separate `내 주변 찾기` / `내주변 찾기` list-search behavior once the map is the primary search surface; if current-location support remains, use it only to recenter the map before the user searches the visible area. Source: user feedback on 2026-05-22.

- [대기] 웹 화면 전반의 UI/UX를 Playwright 기반 시각 검수로 프런티어급 수준까지 다듬는다. 검색 홈, 지도/리스트, 필터, 장소 카드, 상세보기, 빈 상태, 로딩/오류 상태, 모바일 화면을 실제 브라우저에서 직접 보며 아쉬운 부분을 충분히 수정한다. 구현 시점의 Apple, Spotify, Airbnb 등 현재 공개 웹/앱 경험에서 보이는 최신 디자인 철학과 마감 품질을 참고하되 AiGo의 가족 외출 탐색 맥락에 맞게 적용하고, 과한 장식보다 정보 위계, 여백, 타이포그래피, 색 대비, 모션, 터치 타깃, 반응형 완성도를 우선한다. 데스크톱/모바일 Playwright 스크린샷을 반복 비교해 텍스트 겹침, 버튼 밀도, 카드 균형, 지도와 리스트의 시각적 연결, 다크/라이트 모드 품질까지 확인한다. 특히 다크 모드는 단순 색상 반전처럼 보이지 않게 배경 깊이, 표면 구분, 지도/카드 대비, placeholder 이미지 톤, 포커스/hover 상태, 장시간 사용 시 눈부심까지 신경 써서 보기 좋게 다듬은 뒤 프런티어급 사이트처럼 보이는 디자인적 마감을 완료한다. Source: user feedback on 2026-05-22 and 2026-05-23.

- [대기] 구현 후 `README.md`, `AGENTS.md`, `.codex/skills/aigo-place-api/SKILL.md`, OpenAPI 문서 등 필요한 운영/개발 문서를 현 상태 코드에 맞춰 현행화한다. 기능, API 계약, 인증/환경 변수, place-data workflow, UI 동작, 검증 명령, 자동화/에이전트 지침이 코드와 달라진 경우 같은 작업 범위에서 문서를 함께 고치고, 오래된 설명이나 제거된 기능 안내가 남지 않도록 확인한다. 마무리 전에는 주요 변경 파일과 관련 문서의 불일치를 점검하고, 문서 업데이트가 필요한데 범위가 커서 당장 처리하지 못하면 `docs/aigo-improvements.md`에 별도 후속 항목으로 남긴다. Source: user feedback on 2026-05-22.

- [대기] 입장료가 있는 장소와 키즈카페를 위한 가격 정보 엔티티와 API 입력 흐름을 추가한다. 키즈카페, 유료 체험시설, 박물관/수목원/숙박형 장소처럼 비용이 의사결정에 영향을 주는 곳은 장소 상세와 검색 카드에 가격 요약을 노출하되, 가격은 자주 바뀌므로 항상 `가격 기준일` 또는 `확인일`을 함께 표시한다. 장소 등록/수정 API에서 가격 정보를 알 때 함께 추가할 수 있도록 별도 `place_prices` 또는 구조화된 `pricing` 모델을 설계하고, 연령/인원/시간권/보호자/무료 조건/주말·평일 차이/예약가 같은 항목을 source-backed로 저장한다. 가격 출처와 확인 시각을 버전 히스토리에 남기고, 오래된 가격은 `가격 재확인 필요`처럼 UI에서 보수적으로 표시하며, 가격 미상인 장소는 추정 금액을 만들지 않는다. Source: user feedback on 2026-05-22.
