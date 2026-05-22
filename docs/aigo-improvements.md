# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

- [대기] 웹 화면 전반의 UI/UX를 Playwright 기반 시각 검수로 프런티어급 수준까지 다듬는다. 검색 홈, 지도/리스트, 필터, 장소 카드, 상세보기, 빈 상태, 로딩/오류 상태, 모바일 화면을 실제 브라우저에서 직접 보며 아쉬운 부분을 충분히 수정한다. 구현 시점의 Apple, Spotify, Airbnb 등 현재 공개 웹/앱 경험에서 보이는 최신 디자인 철학과 마감 품질을 참고하되 AiGo의 가족 외출 탐색 맥락에 맞게 적용하고, 과한 장식보다 정보 위계, 여백, 타이포그래피, 색 대비, 모션, 터치 타깃, 반응형 완성도를 우선한다. 데스크톱/모바일 Playwright 스크린샷을 반복 비교해 텍스트 겹침, 버튼 밀도, 카드 균형, 지도와 리스트의 시각적 연결, 다크/라이트 모드 품질까지 확인한다. 특히 다크 모드는 단순 색상 반전처럼 보이지 않게 배경 깊이, 표면 구분, 지도/카드 대비, placeholder 이미지 톤, 포커스/hover 상태, 장시간 사용 시 눈부심까지 신경 써서 보기 좋게 다듬은 뒤 프런티어급 사이트처럼 보이는 디자인적 마감을 완료한다. Source: user feedback on 2026-05-22 and 2026-05-23.
