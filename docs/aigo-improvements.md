# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

- [대기] `/v1/places/search`의 후보군 산출을 `limit 750` 고정 선필터 방식에서 실제 검색 규모에 맞는 페이징/카운트 구조로 바꾼다. 현재 `buildSearchQuery()`가 DB에서 `order by coalesce(place_score, 5) desc, updated_at desc limit 750`만 가져온 뒤 애플리케이션에서 런타임 점수화, 다양성 필터, `offset/limit`을 적용하므로 장소 수가 750개를 넘으면 관련 후보가 사전에 잘리고 `meta.total`도 실제 전체가 아니라 잘린 후보 수가 된다. `query`, `tags`, 선호조건, 거리대, 다양성 필터가 있는 경우에도 누락 없이 동작하도록 SQL 후보 점수/키셋 페이징/별도 count 전략 중 하나를 설계하고, 800개 이상 더미 데이터에서 `offset`과 `total`이 깨지지 않는 통합 테스트를 추가한다.

- [대기] 검색 결과 카드에서 출처 신뢰도와 최신성 신호를 다시 노출한다. API는 `sourceSummary`와 `openingHoursSummary`를 계산하지만 현재 `src/app/page.tsx`의 결과 카드에서는 source tier/freshness 배지가 제거되어 부모가 목록 단계에서 공식/공공/운영자/공개목록 출처와 재확인 필요 여부를 비교할 수 없다. 카드 밀도를 해치지 않는 작은 배지나 tooltip 형태로 `bestSourceTier`, `freshnessStatus`, 운영시간 구조화 gap을 표시하고, source 없는/오래된 장소가 리스트에서 식별되는지 SSR 또는 Playwright 검증을 추가한다.

- [대기] Replace fixed-radius place filtering with map viewport search. Current search/list behavior is tied to a fixed radius such as 20km, which feels unlike map-first apps. Change the search flow so the place list is driven by the currently visible map bounds instead, while preserving family filters and making the API/query contract explicit. When the user pans or zooms the map to a different area, show a `현 지도에서 검색` button and refresh the list from the visible map area only when the user taps it, so map movement does not unexpectedly rewrite the results. Remove separate `내 주변 찾기` / `내주변 찾기` list-search behavior once the map is the primary search surface; if current-location support remains, use it only to recenter the map before the user searches the visible area. Source: user feedback on 2026-05-22.

- [대기] 검색 화면의 상단 인터페이스를 정리하고 다크/라이트 모드를 추가한다. 우측 상단의 `대전 +1 시간권 장소 데이터베이스`처럼 사용자가 행동하거나 판단하는 데 도움 되지 않는 설명성 텍스트는 제거하고, 화면 밀도를 해치지 않는 위치에 테마 전환 토글을 둔다. 테마는 시스템 설정을 초기값으로 삼고 사용자 선택을 저장하며, 지도/검색 리스트/필터/카드/버튼/placeholder 이미지가 라이트와 다크 모드에서 모두 보기 좋고 대비가 충분한지 Playwright 스크린샷으로 확인한다. Source: user feedback on 2026-05-22.

- [대기] 세부조건 필터에서 부모 의사결정에 약한 항목을 제거한다. `엘리베이터`, `간식`, `기저귀` 같은 조건은 실제 부모가 장소를 고를 때 별도 필터로 강하게 따지는 정보가 아니므로 검색 필터 UI와 쿼리 조건에서 빼고, 필요하면 카드/상세 화면의 참고 정보로만 남긴다. 필터는 실내/야외, 주차, 수유실, 놀이 적합 연령, 거리/지도 범위처럼 선택을 실제로 갈라주는 조건 중심으로 재정리하고, 제거된 필터가 API query/schema/테스트/빈 상태 문구에 남지 않게 정리한다. Source: user feedback on 2026-05-22.
