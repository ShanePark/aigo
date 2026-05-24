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
- [대기] 기존 장소 update-ready suggested PATCH extractor를 만든다. 의왕 상세 재조사(`agent-research/uiwang-deep-parent-review-20260524-2346.md`), 평촌/안양 재조사(`agent-research/pyeongchon-anyang-deep-parent-review-20260524-2354.md`), 부천 공공/대형시설 재조사(`agent-research/bucheon-public-large-deep-parent-review-20260524-2351.md`) 모두 신규 create보다 기존 `롯데프리미엄아울렛 의왕점`, `왕송호수공원`, `의왕철도박물관`, `롯데백화점 평촌점`, `ER 뉴코아아울렛 평촌`, `스타필드 시티 부천`, `웅진플레이도시`의 parentNotes, age-fit, baby logistics, taxonomy, related-place 보강 가치가 더 컸다. exact-name existing records를 읽고 missing fields와 source freshness를 구조화된 PATCH draft로 출력한다.

Agent 사용성/검색 후속 항목:

- [대기] 검색 결과의 숫자가 장소 자체 품질점수인지 검색 맥락 점수인지 분리해서 보여주고, 야외 공공 놀이터의 기본 검색 점수 산식을 재검토한다. `어드벤처 포레` 등록 보정 작업(2026-05-25)에서 장소 데이터의 `placeScore`는 8.8로 조정되고 `sand_play`, 주차, 화장실, 놀이터 시설 증거도 들어갔지만, `대전 모래놀이 놀이터` 같은 넓은 검색에서는 런타임 검색 점수가 56으로 보였다. exact-name + required `sand_play` 검색에서는 69점으로 개선되었으나, 사용자에게는 낮은 숫자가 "장소 평가가 낮다"처럼 보일 수 있다. 검색 결과 카드/정렬은 `placeScore`, 검색 일치도, 거리/영업/증거 상한을 구분해 설명하고, 야외 놀이터는 운영시간 미상·하위시설 불확실성을 과하게 낮은 품질 평가처럼 보이게 하지 않는지 검증한다.
