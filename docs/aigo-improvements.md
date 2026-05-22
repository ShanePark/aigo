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

- [대기] 검색 화면의 상단 인터페이스를 정리하고 다크/라이트 모드를 추가한다. 우측 상단의 `대전 +1 시간권 장소 데이터베이스`처럼 사용자가 행동하거나 판단하는 데 도움 되지 않는 설명성 텍스트는 제거하고, 화면 밀도를 해치지 않는 위치에 테마 전환 토글을 둔다. 테마는 시스템 설정을 초기값으로 삼고 사용자 선택을 저장하며, 지도/검색 리스트/필터/카드/버튼/placeholder 이미지가 라이트와 다크 모드에서 모두 보기 좋고 대비가 충분한지 Playwright 스크린샷으로 확인한다. Source: user feedback on 2026-05-22.

- [대기] 장소 상세보기 상단 소개 영역에 `네이버지도에서 보기` CTA를 추가한다. 토이빌리지 같은 장소 상세 페이지에서 제목/요약 소개와 대표 사진을 본 직후 바로 네이버지도 정보를 확인할 수 있도록, 소개 영역 안에 눈에 잘 띄는 큰 외부 링크 버튼을 배치한다. 장소에 네이버지도 URL 또는 외부 지도 출처가 있을 때만 노출하고, 링크가 없으면 버튼을 숨기거나 `지도 정보 준비 중`처럼 행동 없는 비활성 요소로 처리하지 않는다. 버튼은 새 탭으로 열고, 카드/상세 지도/기존 출처 링크와 중복되어도 사용자가 가장 먼저 찾는 주요 행동으로 보이게 디자인하며, 모바일에서도 엄지로 누르기 쉬운 크기로 검증한다. Source: user feedback on 2026-05-22.

- [대기] 웹 화면 전반의 UI/UX를 Playwright 기반 시각 검수로 프런티어급 수준까지 다듬는다. 검색 홈, 지도/리스트, 필터, 장소 카드, 상세보기, 빈 상태, 로딩/오류 상태, 모바일 화면을 실제 브라우저에서 직접 보며 아쉬운 부분을 충분히 수정한다. 구현 시점의 Apple, Spotify, Airbnb 등 현재 공개 웹/앱 경험에서 보이는 최신 디자인 철학과 마감 품질을 참고하되 AiGo의 가족 외출 탐색 맥락에 맞게 적용하고, 과한 장식보다 정보 위계, 여백, 타이포그래피, 색 대비, 모션, 터치 타깃, 반응형 완성도를 우선한다. 데스크톱/모바일 Playwright 스크린샷을 반복 비교해 텍스트 겹침, 버튼 밀도, 카드 균형, 지도와 리스트의 시각적 연결, 다크/라이트 모드 품질까지 확인한 뒤 프런티어급 사이트처럼 보이는 디자인적 마감을 완료한다. Source: user feedback on 2026-05-22.
