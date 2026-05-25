# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

If a `[대기]` item is judged weak, obsolete, unactionable, already solved, or no longer worth improving, delete it from this file instead of leaving it in the queue.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

한 번에 하나의 `[대기]` 항목만 `[개선 중]`으로 바꾸고, 구현과 검증이 끝나면 해당 항목을 삭제한 뒤 관련 파일만 커밋한다. 각 항목은 가능한 한 작은 독립 커밋 단위로 유지한다. 구현 중 새로 필요한 후속 작업, 설계 분기, 테스트 보강, UI 정리, 문서 갱신이 발견되면 현재 항목에 억지로 끼워 넣지 말고 이 문서에 새 `[대기]` 항목으로 다시 등록해 재귀적으로 이어간다.

계정 기반 개인화 MVP 후속 항목:

회원/세션/방문/리뷰/사진 MVP 기반은 구현 완료된 것으로 보고, 이 섹션은 다음 단계인 계정 기반 개인화에 집중한다. 목표는 사용자가 매번 아이 나이와 출발 위치를 다시 입력하지 않아도 AiGo가 사용자의 가족 맥락을 기본값으로 이해하게 만드는 것이다. 장소 데이터와 공개 리뷰는 여러 가정이 함께 쓰는 공용 기반이고, 내 정보에 저장된 아이 생년월/성별과 집 위치는 런타임 추천과 검색 경험을 개인화하는 사적 기반이다.

이번 묶음은 실제 회원가입, 소셜 로그인, 가족 공유를 만들지 않는다. 현재 dev 단일유저 로그인으로 시작한 계정 구조에 "내 가족 기본값"을 연결하고, 나중에 실제 회원가입이 들어와도 데이터 모델을 크게 갈아엎지 않도록 경계를 잡는다. 내 정보 페이지는 아이 정보와 집 위치를 관리하는 프로필 관리 페이지가 된다.

아이 정보는 생년월과 성별을 저장한다. 화면에서는 저장된 생년월을 현재 날짜 기준 개월수/나이대로 계산하고, 성별별 아이 나이대 아이콘으로 보기 좋게 표시한다. 검색 URL에 아이 조건이 명시되어 있으면 URL을 우선하고, 명시되어 있지 않은 로그인 사용자는 계정 아이 정보를 성별/나이대 조건으로 자동 채운다. 비로그인 사용자는 기존 localStorage 기반 아이 조건을 계속 쓸 수 있어야 한다.

집 위치는 사용자가 지정한 지도 핀 좌표를 저장한다. 첫 진입과 랜딩 검색은 현재 위치 권한이 있으면 현재 위치를 우선하고, 현재 위치를 얻지 못했을 때 저장된 집 위치를 fallback으로 쓴다. 지도/검색 화면에는 현재 위치 아이콘 옆에 집 아이콘을 추가하고, 사용자가 집 아이콘을 누르면 저장된 집 좌표로 지도와 검색 결과를 즉시 갱신한다. 집 위치가 없으면 홈 버튼은 비활성 또는 설정 유도 상태로 보여준다.

세부조건의 실내, 주차, 유모차, 모래놀이, 수유실, 아기의자, 선호 적용 방식은 검색 화면에서 즉시 조작하는 필터로 유지하고 내 정보에는 저장하지 않는다. 내 정보가 검색 필터까지 품으면 의도치 않게 검색이 고정될 수 있으므로, 계정 개인화는 아이 정보와 집 위치처럼 반복 입력 부담이 큰 값에 집중한다.

모든 사용자-facing 구현은 모바일을 1급 기준으로 검증한다. 내 정보 페이지, 검색 홈, 지도/목록, 세부조건 패널, 집 위치 버튼, 로그인/비로그인 상태를 Playwright 모바일 해상도에서 열어 텍스트 겹침, 터치 타깃, 하단 액션, 긴 장소명/주소/조건 표시가 깨지지 않는지 확인한다.

구현 체크리스트:

- [대기] 기존 localStorage 아이 조건을 계정 설정으로 옮기는 흐름을 검토한다. 자동 병합 대신 로그인 후 내 정보 페이지에서 가져오기/무시 선택지를 제공하는 최소 UX를 설계한다.
