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

이 작업 묶음의 큰 목적은 AiGo를 단순한 장소 검색 도구에서 "우리 가족이 실제로 어디를 다녀왔고, 다시 가고 싶은지"를 축적하는 개인화 제품으로 확장하는 것이다. 검색/추천은 공개 데이터와 장소 메타데이터만으로도 시작할 수 있지만, 장기적으로는 사용자의 방문 이력, 별점, 짧은 리뷰, 사진, 재방문 여부가 추천 품질과 장소 상세의 신뢰도를 크게 높인다. 특히 아이와 외출하는 맥락에서는 "좋은 장소인가"보다 "우리 가족 구성과 컨디션에서 다시 갈 만한가"가 더 중요하므로, 방문 기록을 1급 도메인으로 설계한다.

MVP는 실제 회원가입이나 소셜 로그인을 만들지 않고도 이후 확장을 막지 않는 구조를 먼저 깔아두는 데 초점을 둔다. 개발 환경에서는 `dev@aigo.local` 단일 유저로 원클릭 로그인할 수 있게 해서 기능 검증과 UI 개발을 빠르게 하고, 데이터 구조는 나중에 실제 회원가입/소셜 로그인/가족 공유가 붙어도 마이그레이션 부담이 작도록 `users`와 `auth_sessions`를 분리한다. 운영 환경에서는 dev 로그인이 기본적으로 노출되지 않아야 하며, 인증 쿠키는 httpOnly/sameSite=lax로 관리한다.

방문/리뷰 모델은 "방문 기록 1건"을 중심에 둔다. `place_visits`는 사용자, 장소, 방문일, 별점, 리뷰, 공개범위, 재방문 여부를 담고, `place_visit_photos`는 방문 기록에 귀속된 사진 메타데이터와 로컬 저장 키를 담는다. 평균 별점은 v1에서 별도 캐시 컬럼 없이 쿼리 집계로 계산해 스키마를 단순하게 유지한다. `private` 방문 기록도 별점 평균에는 반영하지만, 타인에게는 리뷰 텍스트와 사진을 숨기고 비공개 placeholder만 노출한다.

업로드는 repo에서 무시되는 `data/uploads` 아래에 저장한다. Docker Compose app 서비스에는 이 폴더를 볼륨으로 연결해 로컬 개발 중 업로드 파일을 쉽게 확인하고 정리할 수 있게 한다. v1 업로드는 jpeg/png/webp와 10MB 이하만 허용하고, 사진 리사이징, HEIC 변환, CDN/오브젝트 스토리지 이전은 후속 확장으로 둔다.

구현은 아래 체크리스트를 위에서부터 하나씩 진행한다. 각 항목은 하트비트가 하나의 `[대기]` 항목만 `[개선 중]`으로 바꾼 뒤 구현, 검증, 항목 삭제, 커밋까지 끝낼 수 있는 크기로 나눈다. 구현 중 새로 필요한 후속 작업, 설계 분기, 테스트 보강, UI 정리, 문서 갱신이 발견되면 현재 항목에 억지로 끼워 넣지 말고 이 문서에 새 `[대기]` 항목으로 다시 등록해 재귀적으로 이어간다. DB 기반이 먼저 들어간 뒤 인증, 방문 API, 업로드, 상세 UI, 요약 노출, 방문 로그, 문서 정리 순서로 진행해야 중간 상태에서도 타입/테스트/화면 검증이 가능하다.

구현 체크리스트:

- [대기] 장소 상세와 검색 카드에 사용자 평점 요약을 노출한다. 평균 별점은 private rating까지 포함하고 private 텍스트/사진은 숨긴다.
- [대기] 방문 로그 페이지를 만든다. 날짜별 방문 장소와 리뷰/사진 요약을 볼 수 있게 한다.
- [대기] 회원/방문/리뷰 기능 문서와 README의 MVP 경계를 갱신한다. 기존 `out of scope` 문구를 현재 구현 상태에 맞춘다.

Data/API 후속 항목:

- [대기] place detail/version/image-health API가 일부 개발 서버 상태에서 JSON 오류 응답 대신 Next HTML 500을 반환하는 문제를 재현하고 고친다. 창원 장소 등록 작업(2026-05-24)에서 `GET /v1/places/3810e488-7a49-4ec4-aa6f-47e8b06dafbd`, `GET /v1/places/3810e488-7a49-4ec4-aa6f-47e8b06dafbd/versions`, 그리고 기존 `진해해양공원` 버전 경로가 `ENOENT: .../.next/server/pages/_document.js` HTML 오류 페이지를 반환했다. 후속 창원 1시간권 등록 작업에서도 `GET /v1/places/3c9da75e-1678-41a1-bd0e-b45d2e6f8404`, `GET /v1/places/3c9da75e-1678-41a1-bd0e-b45d2e6f8404/versions`, `GET /v1/places/image-health?status=attention&limit=1000`이 같은 HTML 500을 반환했다. 방문지 점수 튜닝 작업(2026-05-24)에서도 보조 dev 서버로 API PATCH를 수행한 뒤 기존 3000 서버의 `POST /places/search`가 `ENOENT: .../.next/server/app/places/search/route.js` HTML 500을 반환해 서버 재시작으로 복구했다. 현재 image-health API의 `limit` 최대값은 200이므로 재현은 `GET /v1/places/image-health?status=attention&limit=200`으로 수행하고, 당시 `limit=1000` 호출은 과거 관찰값으로만 참고한다. 같은 place의 exact-name search 노출과 `getPlaceDetail`, `listPlaceVersions`, `listPlaceImageHealth` read-only helper는 정상이라 데이터 생성/버전/image row 자체보다는 API route/dev-server error rendering 경로 문제로 보인다. 재현 시 `Authorization: Bearer change-me`, `Accept: application/json`으로 detail/version/image-health route를 호출하고, API route 오류가 `apiErrorResponse` JSON으로 안정적으로 내려오는지 확인한다.
Agent 사용성/검색 후속 항목:

- [대기] 검색/추천 점수에 시설 규모와 무료/저비용 공공성 신호를 반영한다. `논산딸기향농촌테마공원` 점수 확인 중 검색어 매칭이 없으면 36점까지 내려가고, 장소가 무료이거나 넓은 복합 가족시설인지가 런타임 점수에 거의 반영되지 않는 문제가 드러났다. `pricing`의 무료 입장, `scoreSignals.facilityScale`, `scoreSignals.freeAdmission`, `playFeatures`, `taxonomy`, 관련 하위시설 수 등을 `scorePlace`/`scoreBreakdown`에 보수적으로 반영하되, crowding/예약/운영시간 미확인과 안전 리스크가 있으면 상한을 유지한다. 검증은 `논산딸기향농촌테마공원`처럼 무료·복합시설인 공공 destination과 유료 단일 키즈카페, 일반 공원을 함께 비교한다.
- [대기] 장소 등록/보강 에이전트가 rich public destination의 하위시설을 빠뜨리지 않도록 research lint 또는 checklist helper를 만든다. 이번 `논산딸기향농촌테마공원` 점수 대화에서 놀이터, 실내 키즈카페, 도서관/어린이자료실, 무료 여부, 주차, 기저귀갈이대, 유아화장실 같은 고가치 정보가 현재 record에 충분히 구조화되어 있지 않았다. 후보 이름과 category를 넣으면 `장소명 + 놀이터/실내놀이터/키즈카페/도서관/기저귀/유아화장실/주차/입장료/무료/시설안내` 검색 체크를 요구하고, `playFeatures`, `pricing`, `scoreSignals`, `parentNotes`, `sources`에 반영되지 않은 항목을 경고하게 한다.
