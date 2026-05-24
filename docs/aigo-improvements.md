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

- [대기] 회원/세션 기반 DB 스키마와 마이그레이션을 추가한다. `users`, `auth_sessions`, `place_visits`, `place_visit_photos`를 만들고 schema/preflight/test를 맞춘다.
- [대기] dev 단일유저 로그인 기반을 만든다. `POST /api/auth/dev-login`, `POST /api/auth/logout`, `GET /api/me`와 httpOnly `aigo_session` 세션 쿠키, topbar dev 로그인 버튼을 추가한다.
- [대기] 방문 기록 도메인 API를 만든다. 장소별 방문 생성/조회/수정과 내 방문 로그 조회를 구현하고, 공개/비공개 정책을 검증한다.
- [대기] 로컬 업로드 저장소를 구축한다. `data/uploads` 저장, Docker Compose 볼륨, 업로드 검증, 사진 스트리밍 라우트를 추가한다.
- [대기] 장소 상세에 평가/방문 기록 UI를 붙인다. 별점, 방문일, 재방문 체크, 공개범위, 짧은 리뷰, 사진 업로드를 한 흐름으로 만든다.
- [대기] 장소 상세와 검색 카드에 사용자 평점 요약을 노출한다. 평균 별점은 private rating까지 포함하고 private 텍스트/사진은 숨긴다.
- [대기] 방문 로그 페이지를 만든다. 날짜별 방문 장소와 리뷰/사진 요약을 볼 수 있게 한다.
- [대기] 회원/방문/리뷰 기능 문서와 README의 MVP 경계를 갱신한다. 기존 `out of scope` 문구를 현재 구현 상태에 맞춘다.

Data/API 후속 항목:

- [대기] place detail/version/image-health API가 일부 개발 서버 상태에서 JSON 오류 응답 대신 Next HTML 500을 반환하는 문제를 재현하고 고친다. 창원 장소 등록 작업(2026-05-24)에서 `GET /v1/places/3810e488-7a49-4ec4-aa6f-47e8b06dafbd`, `GET /v1/places/3810e488-7a49-4ec4-aa6f-47e8b06dafbd/versions`, 그리고 기존 `진해해양공원` 버전 경로가 `ENOENT: .../.next/server/pages/_document.js` HTML 오류 페이지를 반환했다. 후속 창원 1시간권 등록 작업에서도 `GET /v1/places/3c9da75e-1678-41a1-bd0e-b45d2e6f8404`, `GET /v1/places/3c9da75e-1678-41a1-bd0e-b45d2e6f8404/versions`, `GET /v1/places/image-health?status=attention&limit=1000`이 같은 HTML 500을 반환했다. 방문지 점수 튜닝 작업(2026-05-24)에서도 보조 dev 서버로 API PATCH를 수행한 뒤 기존 3000 서버의 `POST /places/search`가 `ENOENT: .../.next/server/app/places/search/route.js` HTML 500을 반환해 서버 재시작으로 복구했다. 현재 image-health API의 `limit` 최대값은 200이므로 재현은 `GET /v1/places/image-health?status=attention&limit=200`으로 수행하고, 당시 `limit=1000` 호출은 과거 관찰값으로만 참고한다. 같은 place의 exact-name search 노출과 `getPlaceDetail`, `listPlaceVersions`, `listPlaceImageHealth` read-only helper는 정상이라 데이터 생성/버전/image row 자체보다는 API route/dev-server error rendering 경로 문제로 보인다. 재현 시 `Authorization: Bearer change-me`, `Accept: application/json`으로 detail/version/image-health route를 호출하고, API route 오류가 `apiErrorResponse` JSON으로 안정적으로 내려오는지 확인한다.
Agent 사용성/검색 후속 항목:
