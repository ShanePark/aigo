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

- [대기] production 환경의 dev 단일유저 로그인을 별도 안전장치 뒤로 숨긴다. 현재 `isDevLoginEnabled`는 `AIGO_DEV_LOGIN_ENABLED=true`이면 `NODE_ENV=production`에서도 dev 로그인 API와 topbar 버튼을 열 수 있고, `/api/auth/dev-login`은 추가 인증 없이 공유 `dev@aigo.local` 세션을 만든다. 초기 계획의 env override는 개발/스테이징 편의용으로 유지하되, 실제 운영에서 실수로 노출되지 않도록 production에서는 추가 secret, allowlist, 별도 `AIGO_ENV=local/staging` 조건, 또는 API 비활성화 정책을 명확히 한다. 관련 코드: `src/lib/app-auth.ts`, `src/app/api/auth/dev-login/route.ts`, `src/lib/app-auth.test.ts`. 검증: production 기본값 비활성, production에서 단순 env true만으로는 비활성, 허용된 개발/스테이징 조건에서만 활성화되는 테스트를 추가한다.
- [대기] 방문/사진 API 경로 파라미터 UUID를 DB 접근 전에 검증한다. 현재 `/api/places/[placeId]/visits`, `/api/visits/[visitId]`, `/api/visits/[visitId]/photos`, `/api/visit-photos/[photoId]`는 route param 문자열을 그대로 UUID 컬럼 비교에 넘긴다. 잘못된 UUID가 들어오면 Postgres 캐스팅 오류가 `apiErrorResponse`의 일반 500으로 떨어질 수 있어, 사용자 입력 오류와 서버 오류가 구분되지 않는다. 공유 UUID schema/helper를 두고 malformed id는 400으로 응답하게 만든다. 관련 코드: `src/app/api/places/[placeId]/visits/route.ts`, `src/app/api/visits/[visitId]/route.ts`, `src/app/api/visits/[visitId]/photos/route.ts`, `src/app/api/visit-photos/[photoId]/route.ts`, `src/lib/errors.ts`. 검증: 각 route의 invalid UUID 요청이 400을 반환하고 유효하지만 없는 UUID는 기존처럼 404를 반환하는 테스트를 추가한다.
- [대기] 방문 사진 파일 검증을 실제 이미지 구조 검증 수준으로 강화한다. 현재 업로드 검증은 jpeg/png/webp magic byte와 일부 크기 메타데이터만 확인하고, width/height를 읽지 못해도 `null`로 통과시킨다. 기존 테스트의 PNG fixture도 완전한 이미지가 아닌 부분 헤더라서, magic byte만 맞춘 잘린 파일이나 손상된 파일이 저장될 수 있다. v1 범위에서는 이미지 디코더나 검증 라이브러리를 사용해 최소한 완전한 jpeg/png/webp인지 확인하고, 불완전한 파일은 400으로 거부한다. 관련 코드: `src/lib/visit-photos.ts`, `src/lib/visit-photos.test.ts`. 검증: 정상 1x1 이미지, truncated PNG/JPEG/WebP, magic byte만 있는 payload, MIME mismatch 케이스를 추가한다.
- [대기] 방문 사진 업로드 크기 제한을 multipart 전체 요청을 소비하기 전에 방어한다. 현재 route는 `await request.formData()` 이후에야 `file.size > 10MB`를 검사하므로, 큰 요청 본문은 이미 메모리/디스크 파싱 비용을 치른 뒤 413을 반환한다. Next 런타임에서 가능한 요청 크기 제한, `content-length` 선검사, 스트리밍 파서 도입 여부를 검토하고 최소한 명확한 초과 요청 방어와 테스트를 추가한다. 관련 코드: `src/app/api/visits/[visitId]/photos/route.ts`, `src/lib/visit-photos.ts`. 검증: `content-length` 초과 요청과 파일 크기 초과 요청이 413으로 거부되는지 확인한다.
- [대기] 로컬 업로드 파일의 고아 파일 정리 전략을 추가한다. 현재 사진 업로드는 파일을 먼저 `data/uploads`에 쓰고 DB insert 실패 시에만 파일을 삭제한다. 이후 방문/사용자/장소 삭제로 `place_visit_photos` 행이 cascade 삭제되거나 수동 DB 정리가 일어나면 실제 파일은 남을 수 있다. v1에서는 삭제 API가 없더라도, 방문 사진 행과 로컬 파일을 비교하는 정리 스크립트나 삭제 경로에서 파일을 함께 지우는 helper를 마련해 `data/uploads`가 계속 불어나지 않게 한다. 관련 코드: `src/lib/visit-photos.ts`, `drizzle/0013_member_visit_review_schema.sql`, `docker-compose.yml`. 검증: DB 행이 없는 파일을 dry-run으로 보고하고, 명시 실행 시 안전하게 삭제하는 테스트 또는 스크립트 검증을 추가한다.
- [대기] 장소 상세 방문 요약을 검색 카드의 `userRatingSummary`와 맞춘다. 검색 결과는 평균 별점, 평가 수, 공개 리뷰 수, 공개 사진 수를 함께 보여주지만, 장소 상세의 `PlaceVisitPanel`은 평균/평가 수만 별도 API로 표시해 정보 밀도가 다르고 최신 방문일도 활용하지 못한다. 상세 API 또는 방문 API 응답을 검색 요약과 같은 형태로 맞춰 public review/photo count와 latestVisitedOn을 노출하고, private rating은 평균에만 반영한다는 정책을 유지한다. 관련 코드: `src/lib/places.ts`, `src/lib/place-visits.ts`, `src/app/places/place-visit-panel.tsx`, `src/app/explore-results.tsx`. 검증: 검색 카드와 상세 패널이 같은 fixture에서 같은 요약 숫자를 보여주는 테스트를 추가한다.
- [대기] 방문 수정 API 응답의 `photoCount`를 실제 사진 수로 반환한다. 현재 `updatePlaceVisit`는 PATCH 응답에서 항상 `0::int as "photoCount"`를 반환한다. 목록 조회와 내 방문 로그는 사진 수를 제대로 집계하므로, 방문 수정 직후 응답만 기존 사진이 있는 기록을 0장으로 보일 수 있다. PATCH 후 공통 조회/formatter를 재사용하거나 사진 count join을 추가해 즉시 응답도 일관되게 만든다. 관련 코드: `src/lib/place-visits.ts`, `src/lib/place-visits.test.ts`. 검증: 사진이 있는 방문 기록을 수정했을 때 PATCH 응답 `photoCount`가 실제 공개/소유자 정책에 맞게 유지되는 테스트를 추가한다.
- [대기] 만료된 `auth_sessions` 정리 경로를 마련한다. 세션은 30일 만료로 생성되고 조회 시 만료 row를 무시하지만, logout은 현재 토큰만 삭제하므로 만료 세션은 DB에 계속 남는다. dev 단일유저 단계에서는 치명적이지 않지만 실제 회원/방문 기록이 늘어날수록 세션 테이블 운영 부담이 생긴다. 로그인 시 opportunistic cleanup, 별도 maintenance script, 혹은 관리용 cron 중 가장 작은 방식을 선택해 만료 row를 안전하게 지우도록 한다. 관련 코드: `src/lib/app-auth.ts`, `drizzle/0013_member_visit_review_schema.sql`. 검증: 만료 세션 삭제가 유효 세션을 보존하고, cleanup 실패가 로그인 흐름을 깨지 않는지 테스트한다.
