# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

- [대기] `/v1/places/search`의 후보군 산출을 `limit 750` 고정 선필터 방식에서 실제 검색 규모에 맞는 페이징/카운트 구조로 바꾼다. 현재 `buildSearchQuery()`가 DB에서 `order by coalesce(place_score, 5) desc, updated_at desc limit 750`만 가져온 뒤 애플리케이션에서 런타임 점수화, 다양성 필터, `offset/limit`을 적용하므로 장소 수가 750개를 넘으면 관련 후보가 사전에 잘리고 `meta.total`도 실제 전체가 아니라 잘린 후보 수가 된다. `query`, `tags`, 선호조건, 거리대, 다양성 필터가 있는 경우에도 누락 없이 동작하도록 SQL 후보 점수/키셋 페이징/별도 count 전략 중 하나를 설계하고, 800개 이상 더미 데이터에서 `offset`과 `total`이 깨지지 않는 통합 테스트를 추가한다.

- [대기] 장소 상세/검색 응답에서 기존 레코드의 source-backed 가족 물류 필드가 비어 있는지 빠르게 판단할 수 있는 gap indicator를 추가한다. Wave29 Jeolla/Gwangju 리서치(`agent-research/wave29-jeolla-gwangju-public-kids-20260523-0029.md`)에서 `국립광주과학관`, `전북특별자치도어린이창의체험관`, `다이노키즈월드` 같은 기존 레코드를 읽을 때 source/image count는 보이지만 `familyLogistics`가 null처럼 보여 실제로 `nursingRoom`, `diaperChangingTable`, `kidsToilet`, `strollerFriendly`, `reservationRequired`, `openingHoursSummary` 등이 미확인인지, 다른 필드에 이미 들어있는지 판단하기 어려웠다. `GET /v1/places/{placeId}`와 compact search card에 `structuredDataGaps` 또는 `familyLogisticsCoverage` 같은 요약을 제공하고, 공식 어린이관/수유실 출처를 찾은 경우 어떤 필드를 PATCH해야 하는지 agents가 낭비 없이 결정할 수 있게 한다.

- [대기] 공항, 철도역, 여객터미널, 버스터미널, 고속도로 휴게소를 위한 route-support/transport-terminal 모델을 추가한다. Wave30 route-break 리서치(`agent-research/wave30-route-break-transit-child-logistics-20260523-0110.md`)에서 `청주국제공항 유아휴게실`, `광주공항 유아·임산부 휴게실`, `여수공항 유아·임산부 휴게실`을 `rest_area`로 임시 생성했지만, 실제로는 terminal type, landside/airside, 층/게이트 위치, 유모차 대여 지점, 우선보안검색/탑승, 여러 유아휴게실 sublocation을 구조화해야 한다. 현재 모델은 parentNotes/tags/taxonomy에 평면화되어 search/detail UI에서 공항 route-break 의도가 흐려진다.

- [대기] 리조트/숙박 parent-child 모델링 기준을 명확히 한다. Wave30 accommodations 리서치에서 `델피노 키즈클럽`, `비발디파크 보노 키즈 클럽`, `휘닉스 아일랜드 키즈 플레이 존`, `라한 원더랜드`, `트니빌리지`처럼 숙박시설 안의 child-primary venue를 parent `accommodation`으로 만들지, child `kids_cafe`/`indoor_playground`로 만들지, 둘 다 만들고 `same_site`/`parent_child`로 연결할지 매번 판단이 필요했다. 검색 결과가 parent와 child를 중복 노출하거나 반대로 child-primary 시설을 숨기지 않도록 category/relationship/score/display 지침과 API 검증을 추가한다.

- [대기] 좌표 없이도 주소 기반 read-only duplicate check를 할 수 있게 한다. Wave30 public toy-library 리서치(`agent-research/wave30-public-toy-libraries-indoor-playgrounds-20260523-0110.md`)에서 공식 지자체 페이지가 branch name과 road address는 주지만 source-backed 좌표가 없어 `/v1/places/duplicates`를 호출하지 못하고 exact-name search만 사용했다. `도담도담 장난감월드 검단점`, `울주군 온산육아종합지원센터`, `공동육아나눔터 1호점`처럼 이름 표기가 흔한 공공시설은 `name + roadAddress/regionSigungu`로 같은 주소/건물 후보를 찾아주는 read-only endpoint 또는 search option이 필요하다.

- [대기] 대형 유통/쇼핑몰 체인의 alias와 branch-code normalization을 추가한다. Wave30 retail 리서치(`agent-research/wave30-nationwide-retail-fallbacks-20260523-0110.md`)에서 `롯데몰 김포공항` vs 공식 `백화점 김포공항점`, `쇼핑몰 은평점` vs `롯데몰 은평점`, `롯데프리미엄아울렛 의왕점` vs `타임빌라스`, AK store-number pages 같은 표기 차이 때문에 exact-name checks가 모두 0을 반환했다. Lotte/AK/Emart/Homeplus/Costco/Traders 등 주요 체인의 branch code/source URL hints를 search diagnostics에 노출해 false missing/false duplicate를 줄인다.

- [대기] Replace fixed-radius place filtering with map viewport search. Current search/list behavior is tied to a fixed radius such as 20km, which feels unlike map-first apps. Change the search flow so the place list is driven by the currently visible map bounds instead, while preserving family filters and making the API/query contract explicit. When the user pans or zooms the map to a different area, show a `현 지도에서 검색` button and refresh the list from the visible map area only when the user taps it, so map movement does not unexpectedly rewrite the results. Remove separate `내 주변 찾기` / `내주변 찾기` list-search behavior once the map is the primary search surface; if current-location support remains, use it only to recenter the map before the user searches the visible area. Source: user feedback on 2026-05-22.

- [대기] 웹 화면 전반의 UI/UX를 Playwright 기반 시각 검수로 프런티어급 수준까지 다듬는다. 검색 홈, 지도/리스트, 필터, 장소 카드, 상세보기, 빈 상태, 로딩/오류 상태, 모바일 화면을 실제 브라우저에서 직접 보며 아쉬운 부분을 충분히 수정한다. 구현 시점의 Apple, Spotify, Airbnb 등 현재 공개 웹/앱 경험에서 보이는 최신 디자인 철학과 마감 품질을 참고하되 AiGo의 가족 외출 탐색 맥락에 맞게 적용하고, 과한 장식보다 정보 위계, 여백, 타이포그래피, 색 대비, 모션, 터치 타깃, 반응형 완성도를 우선한다. 데스크톱/모바일 Playwright 스크린샷을 반복 비교해 텍스트 겹침, 버튼 밀도, 카드 균형, 지도와 리스트의 시각적 연결, 다크/라이트 모드 품질까지 확인한다. 특히 다크 모드는 단순 색상 반전처럼 보이지 않게 배경 깊이, 표면 구분, 지도/카드 대비, placeholder 이미지 톤, 포커스/hover 상태, 장시간 사용 시 눈부심까지 신경 써서 보기 좋게 다듬은 뒤 프런티어급 사이트처럼 보이는 디자인적 마감을 완료한다. Source: user feedback on 2026-05-22 and 2026-05-23.

- [대기] 구현 후 `README.md`, `AGENTS.md`, `.codex/skills/aigo-place-api/SKILL.md`, OpenAPI 문서 등 필요한 운영/개발 문서를 현 상태 코드에 맞춰 현행화한다. 기능, API 계약, 인증/환경 변수, place-data workflow, UI 동작, 검증 명령, 자동화/에이전트 지침이 코드와 달라진 경우 같은 작업 범위에서 문서를 함께 고치고, 오래된 설명이나 제거된 기능 안내가 남지 않도록 확인한다. 마무리 전에는 주요 변경 파일과 관련 문서의 불일치를 점검하고, 문서 업데이트가 필요한데 범위가 커서 당장 처리하지 못하면 `docs/aigo-improvements.md`에 별도 후속 항목으로 남긴다. Source: user feedback on 2026-05-22.

- [대기] 놀이터 데이터에 미끄럼틀, 시소, 그네 등 핵심 놀이기구 보유 여부를 구조화해서 포함한다. 부모가 놀이터를 고를 때 장비 하나하나가 중요하므로 `playFeatures` 또는 facet/tag 검색에서 `slide`, `seesaw`, `swing` 같은 장비별 여부를 표시하고, 검색/필터/상세 카드에서 확인할 수 있게 한다. 필요한 경우 인터넷 검색, 공식/공공 페이지, 공개 블로그/목록, 현장 사진/사용자 관찰을 통해 source-backed로 수집하고, 근거가 약하면 `unknown`으로 둔다. 사용자 관찰 seed: 석교동 범골놀이터는 그네/시소/미끄럼틀 모두 있음, 대흥공원은 그네 없음, 판암 어린이공원은 그네/시소/미끄럼틀 모두 있음. 이 예시들은 추후 API 업데이트 전 가능한 공개 출처나 추가 관찰로 확인하고, 확인한 기준일/출처를 version history에 남긴다. Source: user feedback on 2026-05-23.
