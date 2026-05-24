# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

If a `[대기]` item is judged weak, obsolete, unactionable, already solved, or no longer worth improving, delete it from this file instead of leaving it in the queue.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

UI/UX 개편은 아래 항목을 위에서부터 하나씩 진행한다. 한 번에 하나의 `[대기]` 항목만 `[개선 중]`으로 바꾸고, 구현과 검증이 끝나면 해당 항목을 삭제한 뒤 관련 파일만 커밋한다. 각 항목은 가능한 한 작은 독립 커밋 단위로 유지한다.

회원/방문/리뷰 기능 후속 항목:

이 작업 묶음의 큰 목적은 AiGo를 단순한 장소 검색 도구에서 각 가정이 실제로 어디를 다녀왔고, 다시 가고 싶은지 축적하는 개인화 제품으로 확장하는 것이다. 검색/추천은 공개 데이터와 장소 메타데이터만으로도 시작할 수 있지만, 장기적으로는 사용자의 방문 이력, 별점, 짧은 리뷰, 사진, 재방문 여부가 추천 품질과 장소 상세의 신뢰도를 크게 높인다. 특히 아이와 외출하는 맥락에서는 "좋은 장소인가"보다 "가정별 상황과 컨디션에서 다시 갈 만한가"가 더 중요하므로, 방문 기록을 1급 도메인으로 설계한다.

MVP는 실제 회원가입이나 소셜 로그인을 만들지 않고도 이후 확장을 막지 않는 구조를 먼저 깔아두는 데 초점을 둔다. 개발 환경에서는 `dev@aigo.local` 단일 유저로 원클릭 로그인할 수 있게 해서 기능 검증과 UI 개발을 빠르게 하고, 데이터 구조는 나중에 실제 회원가입/소셜 로그인/가족 공유가 붙어도 마이그레이션 부담이 작도록 `users`와 `auth_sessions`를 분리한다. 운영 환경에서는 dev 로그인이 기본적으로 노출되지 않아야 하며, 인증 쿠키는 httpOnly/sameSite=lax로 관리한다.

방문/리뷰 모델은 "방문 기록 1건"을 중심에 둔다. `place_visits`는 사용자, 장소, 방문일, 별점, 리뷰, 공개범위, 재방문 여부를 담고, `place_visit_photos`는 방문 기록에 귀속된 사진 메타데이터와 로컬 저장 키를 담는다. 평균 별점은 v1에서 별도 캐시 컬럼 없이 쿼리 집계로 계산해 스키마를 단순하게 유지한다. `private` 방문 기록도 별점 평균에는 반영하지만, 타인에게는 리뷰 텍스트와 사진을 숨기고 비공개 placeholder만 노출한다.

업로드는 repo에서 무시되는 `data/uploads` 아래에 저장한다. Docker Compose app 서비스에는 이 폴더를 볼륨으로 연결해 로컬 개발 중 업로드 파일을 쉽게 확인하고 정리할 수 있게 한다. v1 업로드는 jpeg/png/webp와 10MB 이하만 허용하고, 사진 리사이징, HEIC 변환, CDN/오브젝트 스토리지 이전은 후속 확장으로 둔다.

구현은 아래 체크리스트를 위에서부터 하나씩 진행한다. 각 항목은 하트비트가 하나의 `[대기]` 항목만 `[개선 중]`으로 바꾼 뒤 구현, 검증, 항목 삭제, 커밋까지 끝낼 수 있는 크기로 나눈다. 구현 중 새로 필요한 후속 작업, 설계 분기, 테스트 보강, UI 정리, 문서 갱신이 발견되면 현재 항목에 억지로 끼워 넣지 말고 이 문서에 새 `[대기]` 항목으로 다시 등록해 재귀적으로 이어간다. DB 기반이 먼저 들어간 뒤 인증, 방문 API, 업로드, 상세 UI, 요약 노출, 방문 로그, 문서 정리 순서로 진행해야 중간 상태에서도 타입/테스트/화면 검증이 가능하다.

구현 체크리스트:

Data/API 후속 항목:

- [대기] place detail/version/image-health API가 일부 개발 서버 상태에서 JSON 오류 응답 대신 Next HTML 500을 반환하는 문제를 재현하고 고친다. 창원 장소 등록 작업(2026-05-24)에서 `GET /v1/places/3810e488-7a49-4ec4-aa6f-47e8b06dafbd`, `GET /v1/places/3810e488-7a49-4ec4-aa6f-47e8b06dafbd/versions`, 그리고 기존 `진해해양공원` 버전 경로가 `ENOENT: .../.next/server/pages/_document.js` HTML 오류 페이지를 반환했다. 후속 창원 1시간권 등록 작업에서도 `GET /v1/places/3c9da75e-1678-41a1-bd0e-b45d2e6f8404`, `GET /v1/places/3c9da75e-1678-41a1-bd0e-b45d2e6f8404/versions`, `GET /v1/places/image-health?status=attention&limit=1000`이 같은 HTML 500을 반환했다. 방문지 점수 튜닝 작업(2026-05-24)에서도 보조 dev 서버로 API PATCH를 수행한 뒤 기존 3000 서버의 `POST /places/search`가 `ENOENT: .../.next/server/app/places/search/route.js` HTML 500을 반환해 서버 재시작으로 복구했다. 현재 image-health API의 `limit` 최대값은 200이므로 재현은 `GET /v1/places/image-health?status=attention&limit=200`으로 수행하고, 당시 `limit=1000` 호출은 과거 관찰값으로만 참고한다. 같은 place의 exact-name search 노출과 `getPlaceDetail`, `listPlaceVersions`, `listPlaceImageHealth` read-only helper는 정상이라 데이터 생성/버전/image row 자체보다는 API route/dev-server error rendering 경로 문제로 보인다. 재현 시 `Authorization: Bearer change-me`, `Accept: application/json`으로 detail/version/image-health route를 호출하고, API route 오류가 `apiErrorResponse` JSON으로 안정적으로 내려오는지 확인한다.
- [대기] 의왕/평촌/부천처럼 기존 리서치가 여러 wave와 ignored research file에 흩어진 지역을 위해 지역별 등록 상태 대시보드 또는 read-only audit helper를 만든다. 이번 확장 작업(`agent-research/uiwang-pyeongchon-bucheon-current-ready-20260524-2255.md`)에서 `롯데프리미엄아울렛 의왕점`, `롯데백화점 평촌점`, `스타필드 시티 부천`은 기존 처리 이력이 있었지만 exact-name alias와 duplicate 결과만으로 이미 처리된 후보와 진짜 누락 후보를 빠르게 구분하기 어려웠다. 지역명/후보명을 넣으면 exact search, duplicate check, prior version summary, image-health, source freshness를 한 번에 보여주게 한다.
- [대기] 공공 육아시설·장난감도서관·지자체 관광지의 좌표 provenance 초안을 자동 보조한다. 의왕/평촌/부천 리서치(`agent-research/uiwang-public-parks-tier1-20260524-2253.md`, `agent-research/uiwang-pyeongchon-bucheon-current-research-20260524-2301.md`)에서 공식 페이지는 주소와 이미지를 주지만 좌표가 정적 HTML에 없거나 branch-level 좌표가 약해 `의왕시 장난감도서관`, `안양 아이사랑놀이터`, `안양어린이도서관` 같은 가족 핵심 시설이 hold로 남았다. 공식 주소와 공공 주소좌표 URL을 함께 입력하면 normalized road address match 여부와 `public_address_coordinate` 초안을 출력하는 helper를 추가한다.
- [대기] mall/retail alias exact-name normalization에서 공백·브랜드 표기 변형을 더 안정적으로 처리한다. 의왕/평촌/부천 mall 리서치(`agent-research/uiwang-pyeongchon-bucheon-mall-food-20260524-2256.md`)에서 `스타필드 시티 부천` 기존 record는 있으나 `스타필드시티 부천` exact lookup은 0건이었다. `타임빌라스`와 `롯데프리미엄아울렛 의왕점`처럼 대중 명칭과 저장 명칭이 다른 경우 create 후보가 아니라 update/enrichment 후보로 자동 분리하는 read-only helper도 함께 검토한다.
- [대기] private kids cafe evidence를 source role별로 분류하는 lint/helper를 만든다. 부천 실내놀이 리서치(`agent-research/bucheon-private-indoor-retail-20260524-2250.md`)에서 MomMom은 branch identity, 좌표, 이미지를 제공하고 Naver Booking은 예약/운영자 성격을 보강했지만, 현재는 mutation agent가 수동으로 source role을 판단해야 했다. public child listing + operator booking URL 조합을 combined evidence pattern으로 표시하고, blog-only 후보는 자동으로 hold 권고한다.
- [대기] local family research lint가 parent-review URL을 실제로 보존했는지 검사하게 한다. 부천 공공/대형시설 재조사(`agent-research/bucheon-public-large-deep-parent-review-20260524-2351.md`)는 parent-intent 검색어를 따랐지만, interruption 전에 장문 리뷰 URL을 후보별로 충분히 보존하지 못해 `parent-review-supported` 요약이 약해졌다. `Search ledger`가 있더라도 create/update 후보마다 최소 1개 parent-facing review/listing/blog URL 또는 명시적 `parentReviewEvidence: "not_found"`와 시도 검색어가 없으면 경고한다.
- [대기] 기존 장소 update-ready suggested PATCH extractor를 만든다. 의왕 상세 재조사(`agent-research/uiwang-deep-parent-review-20260524-2346.md`), 평촌/안양 재조사(`agent-research/pyeongchon-anyang-deep-parent-review-20260524-2354.md`), 부천 공공/대형시설 재조사(`agent-research/bucheon-public-large-deep-parent-review-20260524-2351.md`) 모두 신규 create보다 기존 `롯데프리미엄아울렛 의왕점`, `왕송호수공원`, `의왕철도박물관`, `롯데백화점 평촌점`, `ER 뉴코아아울렛 평촌`, `스타필드 시티 부천`, `웅진플레이도시`의 parentNotes, age-fit, baby logistics, taxonomy, related-place 보강 가치가 더 컸다. exact-name existing records를 읽고 missing fields와 source freshness를 구조화된 PATCH draft로 출력한다.
- [대기] CLI fetch가 TLS/406/동적 페이지로 실패하는 공식 사이트를 browser/manual 확인 대상으로 넘기는 research fallback을 만든다. 부천 공공/대형시설 재조사(`agent-research/bucheon-public-large-deep-parent-review-20260524-2351.md`)에서 `playaquarium.co.kr`와 `bcfoodsafety.or.kr`는 일반 CLI fetch로 안정적으로 읽히지 않아 `플레이아쿠아리움 부천`, `경기도 어린이식품안전체험관 부천센터`가 hold로 남았다. research helper가 이런 실패를 감지하면 Browser/manual-source checklist와 캡처해야 할 필드(주소, 운영, image, 수유/기저귀/유모차)를 출력하게 한다.
- [대기] 같은 site/cluster 공공시설을 parent-child/same-site로 모델링하기 위한 read-only cluster audit helper를 만든다. 부천 재조사에서 `부천식물원`, `부천자연생태공원`, `자연생태박물관`, `무릉도원수목원`, `부천호수식물원 수피아`, `상동호수공원`은 가족 가치가 높지만 별도 create를 서두르면 same-site 중복이 생길 수 있었다. 후보명 목록을 넣으면 기존 record, 좌표거리, 공식 site hierarchy, relation suggestion을 함께 보여주게 한다.
- [대기] parent-building coordinate evidence bundle helper를 만든다. 민간 키즈/놀이방 재조사(`agent-research/private-kidsfood-bucheon-pyeongchon-deep-20260524-2350.md`)에서 볼베어파크 부천점, 브루미즈키즈카페 뉴코아아울렛 평촌점 같은 tenant 후보는 parent building 좌표와 tenant source를 조합해야 했다. 후보명, parent building record/source, tenant official/listing URL을 넣으면 `parent_building_coordinate` provenance와 duplicate caution을 자동 초안화한다.
- [대기] 전국 coverage 집계에서 raw region alias와 normalized region을 함께 보여준다. 약한 지역 보강 리포트(`agent-research/nationwide-weak-region-backlog-20260524-2258.md`)에서 `세종`/`세종특별자치시`, `충북`/`충청북도`, `경북`/`경상북도`, `부산`/`부산광역시`, `강원특별자치도특별자치도`처럼 표기 차이와 오타가 count를 분산시켜 약한 지역 우선순위 판단을 흐렸다. active count/audit tooling에 raw value와 normalized value를 함께 노출한다.
- [대기] duplicate check에서 광역명+일반 공공기관명 후보의 outside-radius noise를 별도 bucket으로 분리한다. 약한 지역 보강 리포트(`agent-research/nationwide-weak-region-backlog-20260524-2258.md`)의 `충청북도교육문화원` duplicate check가 괴산/옥천/충주 등 다른 시군구 시설을 low confidence로 여러 건 반환했다. 전국 공공기관 bulk review에서는 같은 광역명과 유사 일반명만으로 잡힌 후보를 identity duplicate와 분리해 `same_sido_generic_review_only` 같은 reason으로 낮춰 보여준다.

Agent 사용성/검색 후속 항목:

- [대기] 검색 결과의 숫자가 장소 자체 품질점수인지 검색 맥락 점수인지 분리해서 보여주고, 야외 공공 놀이터의 기본 검색 점수 산식을 재검토한다. `어드벤처 포레` 등록 보정 작업(2026-05-25)에서 장소 데이터의 `placeScore`는 8.8로 조정되고 `sand_play`, 주차, 화장실, 놀이터 시설 증거도 들어갔지만, `대전 모래놀이 놀이터` 같은 넓은 검색에서는 런타임 검색 점수가 56으로 보였다. exact-name + required `sand_play` 검색에서는 69점으로 개선되었으나, 사용자에게는 낮은 숫자가 "장소 평가가 낮다"처럼 보일 수 있다. 검색 결과 카드/정렬은 `placeScore`, 검색 일치도, 거리/영업/증거 상한을 구분해 설명하고, 야외 놀이터는 운영시간 미상·하위시설 불확실성을 과하게 낮은 품질 평가처럼 보이게 하지 않는지 검증한다.
- [대기] 검색/추천 점수에 시설 규모와 무료/저비용 공공성 신호를 반영한다. `논산딸기향농촌테마공원` 점수 확인 중 검색어 매칭이 없으면 36점까지 내려가고, 장소가 무료이거나 넓은 복합 가족시설인지가 런타임 점수에 거의 반영되지 않는 문제가 드러났다. `pricing`의 무료 입장, `scoreSignals.facilityScale`, `scoreSignals.freeAdmission`, `playFeatures`, `taxonomy`, 관련 하위시설 수 등을 `scorePlace`/`scoreBreakdown`에 보수적으로 반영하되, crowding/예약/운영시간 미확인과 안전 리스크가 있으면 상한을 유지한다. 검증은 `논산딸기향농촌테마공원`처럼 무료·복합시설인 공공 destination과 유료 단일 키즈카페, 일반 공원을 함께 비교한다.
- [대기] 장소 등록/보강 에이전트가 rich public destination의 하위시설을 빠뜨리지 않도록 research lint 또는 checklist helper를 만든다. 이번 `논산딸기향농촌테마공원` 점수 대화에서 놀이터, 실내 키즈카페, 도서관/어린이자료실, 무료 여부, 주차, 기저귀갈이대, 유아화장실 같은 고가치 정보가 현재 record에 충분히 구조화되어 있지 않았다. 후보 이름과 category를 넣으면 `장소명 + 놀이터/실내놀이터/키즈카페/도서관/기저귀/유아화장실/주차/입장료/무료/시설안내` 검색 체크를 요구하고, `playFeatures`, `pricing`, `scoreSignals`, `parentNotes`, `sources`에 반영되지 않은 항목을 경고하게 한다.
