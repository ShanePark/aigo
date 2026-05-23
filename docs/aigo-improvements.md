# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

UI/UX 개편은 아래 항목을 위에서부터 하나씩 진행한다. 한 번에 하나의 `[대기]` 항목만 `[개선 중]`으로 바꾸고, 구현과 검증이 끝나면 해당 항목을 삭제한 뒤 관련 파일만 커밋한다. 각 항목은 가능한 한 작은 독립 커밋 단위로 유지한다.

- [대기] 장소 카드의 스캔성과 신뢰도를 높인다. 범위: `ResultCard`, `PlaceImage`, `SearchResultTrustBadges`, 카드 관련 CSS. 개선 내용: 대표 이미지 비율, 이름, 거리/지역, 가족 물류 신호, 가격/출처 배지를 명확한 순서로 재배치하고, 긴 장소명/태그/노트가 카드 밖으로 밀리지 않게 한다. 완료 기준: 카드 하나만 봐도 "왜 가족 외출 후보인지"와 "확인된 근거가 무엇인지"가 보이며, 이미지 없는 카드도 placeholder가 싸구려처럼 보이지 않는다. 검증: `pnpm lint`, 기존 `search-result-badges` 테스트 필요 시 보강, 390px/1440px 스크린샷 확인.
- [대기] 세부 조건 필터를 부모 사용 맥락에 맞게 재구성한다. 범위: `advanced-search`, 체크박스 필터, 정렬/limit 컨트롤. 개선 내용: 실내/주차/유모차/수유실/아기의자를 반복 사용하기 쉬운 컨트롤로 정리하고, 고급 입력(월령, 반경, 좌표)은 덜 방해되는 영역에 둔다. 완료 기준: 모바일에서 필터 텍스트가 줄바꿈되어도 버튼/체크박스가 깨지지 않고, 현재 활성 조건이 결과 헤더나 칩에서 확인된다. 검증: `pnpm lint`, 필터 조합 URL이 유지되는지 수동 확인.
- [대기] 빈 상태, 오류 상태, 결과 없음 상태를 실제 제품 화면처럼 만든다. 범위: `page.tsx`의 `notice` 렌더링과 관련 CSS. 개선 내용: 검색 결과 없음, API 오류, 지도/이미지 실패 상황에서 다음 행동(조건 완화, 전체 보기, 다른 카테고리 선택)이 바로 보이게 한다. 완료 기준: 빈 상태가 단순 문장 하나로 끝나지 않고 가족 외출 탐색 맥락의 행동 버튼을 제공하며, 다크/라이트 모드에서 대비가 충분하다. 검증: `pnpm lint`, 결과 없음 쿼리와 API 오류 케이스를 브라우저에서 확인.
- [대기] 장소 상세 화면의 의사결정 흐름을 정리한다. 범위: `src/app/places/[placeId]/page.tsx`, `place-detail-map`, `back-to-search-link`, 상세 CSS. 개선 내용: 상단에는 이름/대표 이미지/핵심 물류/지도/돌아가기 액션을 배치하고, 아래에는 운영 정보, 가격, 출처, 안전 노트를 부모가 훑기 쉬운 섹션으로 나눈다. 완료 기준: 모바일에서도 대표 정보와 지도/주소가 접힘 없이 읽히고, 긴 출처/노트가 레이아웃을 밀어내지 않는다. 검증: `pnpm lint`, 실제 장소 상세 1개 이상을 브라우저에서 데스크톱/모바일 확인.
- [대기] 다크 모드를 별도 디자인으로 정돈한다. 범위: `globals.css`의 dark theme token, 카드/지도/placeholder/배지/폼 상태. 개선 내용: 단순 반전처럼 보이는 색을 줄이고, 배경 깊이, 표면 구분, 지도 타일 필터, placeholder 톤, hover/focus 대비를 장시간 보기 편하게 조정한다. 완료 기준: 다크 모드에서 검색 폼, 카드, 지도, 상세 섹션의 경계가 명확하고 mint/blue/coral/yellow 포인트가 과하게 튀지 않는다. 검증: `pnpm lint`, 라이트/다크 각각 390px/1440px 스크린샷 비교.
- [대기] 모바일 탐색 밀도와 터치 조작을 개선한다. 범위: 전역 반응형 CSS, 카테고리 탭, 결과 액션, 페이지네이션, 상세 페이지. 개선 내용: 작은 화면에서 카드, 탭, 필터, 페이지네이션의 터치 타깃과 줄바꿈을 안정화하고, 중요한 액션이 화면 아래로 과도하게 밀리지 않게 한다. 완료 기준: 390px 폭에서 가로 스크롤이 없고, 긴 한국어 라벨이 버튼 내부에서 깨지지 않으며, 지도와 리스트를 오갈 때 조작 피로가 낮다. 검증: `pnpm lint`, 모바일 viewport 스크린샷과 실제 클릭 확인.
- [대기] 포커스, hover, 선택 상태, 모션을 일관되게 만든다. 범위: 버튼, 링크 카드, 카테고리 탭, 테마 토글, 지도 marker, 페이지네이션 CSS. 개선 내용: 키보드 포커스가 항상 보이고, hover/focus/active 상태가 같은 디자인 언어를 쓰며, 미세 모션은 정보 이해를 돕는 수준으로만 추가한다. 완료 기준: Tab 이동으로 주요 탐색 요소를 모두 찾을 수 있고, motion-reduce 환경에서도 정보 손실이 없다. 검증: `pnpm lint`, 키보드 탐색 수동 확인.
- [대기] Playwright 기반 시각 검수 루틴을 추가한다. 범위: 필요한 dev dependency, `package.json` script, 최소 smoke/visual test 또는 문서화된 스크린샷 스크립트. 개선 내용: 홈, 검색 결과 있음, 결과 없음, 상세 페이지, 다크 모드, 모바일 viewport를 반복 확인할 수 있는 명령을 만든다. 완료 기준: 한 명령으로 주요 화면 스크린샷 또는 smoke 확인이 가능하고, 실패 시 어떤 화면이 깨졌는지 알 수 있다. 검증: 새 명령 실행, `pnpm lint`, 기존 테스트 영향 확인.
- [대기] 기본 placeholder와 시각 자산의 제품감을 높인다. 범위: `public/placeholders/*`, `PlaceImage`, 이미지 fallback 스타일. 개선 내용: 카테고리별 placeholder가 실제 장소 카드에서 자연스럽게 보이도록 톤, 대비, crop 안정성을 점검하고 필요 시 코드 네이티브 또는 생성 이미지 자산으로 교체한다. 완료 기준: 이미지가 없는 장소도 카드 품질이 급격히 떨어지지 않고, 다크 모드에서 placeholder가 밝게 뜨거나 죽어 보이지 않는다. 검증: `pnpm lint`, 이미지 없는 장소 카드와 상세 화면 확인.
- [대기] 전체 UI 개편 마감 QA를 수행한다. 범위: 홈, 지도/리스트, 필터, 카드, 상세, 빈/오류 상태, 라이트/다크, 모바일/데스크톱. 개선 내용: 앞선 작업 후 남은 겹침, 과밀한 버튼, 불균형한 카드, 색 대비, 스크롤 피로, 지도/리스트 연결성 문제를 마지막으로 정리한다. 완료 기준: 주요 화면을 390px/768px/1440px에서 확인했고, 새로 발견된 큰 결함이 없으며, 남은 작은 개선은 별도 backlog 항목으로 분리되어 있다. 검증: `pnpm lint`, `pnpm test` 또는 변경 범위에 맞는 테스트, Playwright/브라우저 스크린샷 비교.
