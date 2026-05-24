# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

UI/UX 개편은 아래 항목을 위에서부터 하나씩 진행한다. 한 번에 하나의 `[대기]` 항목만 `[개선 중]`으로 바꾸고, 구현과 검증이 끝나면 해당 항목을 삭제한 뒤 관련 파일만 커밋한다. 각 항목은 가능한 한 작은 독립 커밋 단위로 유지한다.

Data/API 후속 항목:

- [대기] place detail/version/image-health API가 일부 개발 서버 상태에서 JSON 오류 응답 대신 Next HTML 500을 반환하는 문제를 재현하고 고친다. 창원 장소 등록 작업(2026-05-24)에서 `GET /v1/places/3810e488-7a49-4ec4-aa6f-47e8b06dafbd`, `GET /v1/places/3810e488-7a49-4ec4-aa6f-47e8b06dafbd/versions`, 그리고 기존 `진해해양공원` 버전 경로가 `ENOENT: .../.next/server/pages/_document.js` HTML 오류 페이지를 반환했다. 후속 창원 1시간권 등록 작업에서도 `GET /v1/places/3c9da75e-1678-41a1-bd0e-b45d2e6f8404`, `GET /v1/places/3c9da75e-1678-41a1-bd0e-b45d2e6f8404/versions`, `GET /v1/places/image-health?status=attention&limit=1000`이 같은 HTML 500을 반환했다. 현재 image-health API의 `limit` 최대값은 200이므로 재현은 `GET /v1/places/image-health?status=attention&limit=200`으로 수행하고, 당시 `limit=1000` 호출은 과거 관찰값으로만 참고한다. 같은 place의 exact-name search 노출과 `getPlaceDetail`, `listPlaceVersions`, `listPlaceImageHealth` read-only helper는 정상이라 데이터 생성/버전/image row 자체보다는 API route/dev-server error rendering 경로 문제로 보인다. 재현 시 `Authorization: Bearer change-me`, `Accept: application/json`으로 detail/version/image-health route를 호출하고, API route 오류가 `apiErrorResponse` JSON으로 안정적으로 내려오는지 확인한다.
- [대기] retail alias exact-name 매칭에서 같은 브랜드/복합몰 계열이라도 지역이 다른 지점은 false hit로 돌려보내지 않도록 한다. Wave37/Wave38 리서치에서 `타임빌라스 수원` 계열 alias가 `롯데프리미엄아울렛 의왕점`(`47bd2d06-f613-4adb-8cbd-4b479eb140d3`)과 섞일 수 있었다. 실제 수원점은 별도 record(`8621ad1d-7861-4263-8785-598c33246443`)로 생성했으므로, 검색/중복 판단에서 지점명, 주소, 시군구 충돌을 reason으로 노출해야 한다. 재현: `POST /v1/places/search`에 `query: "타임빌라스 수원"`, `matchMode: "exactName"`, `projection: "compact"`를 보내고 반환 item의 alias reason/지역 충돌을 확인한다.
- [대기] 지역 제한이 있는 toy-store/restaurant/category 검색에서 전국 다른 지역의 같은 카테고리 후보가 상위권을 잠식하지 않도록 지역 앵커와 거리 점수를 강화한다. 창원 세부 카테고리 등록 작업(2026-05-24, `agent-research/changwon-1h-detailed-category-create-results-20260524-1123.json`) 후 `POST /v1/places/search`에 `query: "창원 장난감 가게"`, `origin: { lat: 35.227, lng: 128.681 }`, `filterByRadius: false`, `projection: "compact"`를 보내면 상위 10건이 모두 대전 toy_store였다. 같은 검증에서 `query: "김해 놀이방 식당"`도 창원/전국 식당이 김해 후보보다 높게 섞였다. 지역명이 포함된 카테고리 검색은 `regionAnchor`와 거리 근접도를 강하게 반영하고, 지역 밖 후보에는 `REGION_OUTSIDE_ANCHOR` 같은 caution reason을 붙이거나 명시적 broad-search 모드에서만 상위 노출되게 한다.

Agent 사용성/검색 후속 항목:

- [대기] 모래놀이터/물놀이터처럼 구체 장비를 요구하는 검색에서 근거 없는 일반 놀이터를 같은 수준의 후보로 반환하지 않도록 한다. 에이전트 사용성 점검(2026-05-24)에서 `POST /v1/places/search`에 `query: "모래놀이터 유모차 화장실"`, `origin: { lat: 36.3317, lng: 127.4348, label: "대전역" }`, `projection: "compact"`를 보내면 `normalizedQuery`는 `"모래놀이터"`가 되지만 상위권에 `PLAYGROUND_FEATURES_UNKNOWN`인 일반 어린이공원들이 다수 포함되고, `화장실`은 preference나 `playFeatures.toiletNearby` 의도로 남지 않는다. `sandPlay`, `waterPlayground`, `toiletNearby` 같은 장비/편의시설 facet을 required/soft로 요청할 수 있게 하고, 근거가 없는 fallback 결과에는 `EQUIPMENT_EVIDENCE_MISSING` 같은 caution reason을 붙인다.
- [대기] 경로 중간 휴식 검색이 목적지 방향성과 실제 경로를 고려하지 못하는 문제를 개선한다. 에이전트 사용성 점검(2026-05-24)에서 `POST /v1/places/search`에 `query: "청남대 가는 길 수유실 기저귀 휴게소"`, `origin: { lat: 36.3317, lng: 127.4348, label: "대전역" }`, `projection: "compact"`를 보내면 청남대 경로와 직접성이 약한 `청주국제공항 유아휴게실`이 최상위로 나오고, 고속도로 방향/우회 부담/목적지까지 남은 거리 사유가 없다. route-break 검색에는 `destination` 또는 destination place id/좌표를 받을 수 있게 하고, 후보별 `routeDetourKm`, `routeDirectionFit`, `remainingDistanceKm`, `oppositeDirection` reason을 계산해 휴게소/공항/터미널이 실제 동선상 유효한지 설명한다.
