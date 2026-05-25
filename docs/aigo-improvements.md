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

모든 사용자-facing 페이지와 주요 흐름은 모바일을 1급 기준으로 둔다. 구현자는 데스크톱에서만 맞춰 놓고 끝내지 말고, 검색 홈, 검색 결과, 지도/목록, 장소 상세, 로그인/비로그인 상태, 방문 입력, 방문로그, 빈 상태, 오류 상태, 긴 데이터 상태를 Playwright로 iPhone 13, iPhone 14/15 계열, iPhone 16 Pro, 작은 Android 폭(360px대), 넓은 Android 폭(412px대) 같은 흔한 모바일 해상도에서 실제로 열어 스크린샷을 확인하며 수정한다. 각 해상도에서 첫 화면, 스크롤 중간, 하단 액션, 입력/업로드, 필터/정렬, 지도와 카드 전환, 긴 장소명/주소/리뷰/태그, 공개/비공개/재방문 배지, 로그인 CTA가 모두 겹치지 않는지 눈으로 본다. 좋은 모바일 제품의 참고점은 Airbnb처럼 카드의 정보 위계가 명확하고 터치 타깃이 넉넉하며, Google Maps/Apple Maps처럼 장소 맥락과 액션이 빠르게 읽히고, Instagram/네이버 지도처럼 사진·리뷰·저장/공유 성격의 조작이 손가락 흐름 안에 자연스럽게 놓이는 것이다. 단순히 흉내 내기보다 AiGo의 가족 외출 맥락에 맞게 정보 밀도, 여백, 고정/복귀 액션, 하단 CTA, 아이콘 레이블, 손쉬운 재탐색을 조정한다. 구현 완료 전에는 `@media` 규칙과 실제 Playwright 스크린샷을 함께 확인하고, 어색한 장면이 하나라도 있으면 해당 항목을 끝내지 않는다.

구현 체크리스트:
