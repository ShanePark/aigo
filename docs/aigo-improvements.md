# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

UI/UX 개편은 아래 항목을 위에서부터 하나씩 진행한다. 한 번에 하나의 `[대기]` 항목만 `[개선 중]`으로 바꾸고, 구현과 검증이 끝나면 해당 항목을 삭제한 뒤 관련 파일만 커밋한다. 각 항목은 가능한 한 작은 독립 커밋 단위로 유지한다.

- [대기] 전체 UI 개편 마감 QA를 수행한다. 범위: 홈, 지도/리스트, 필터, 카드, 상세, 빈/오류 상태, 라이트/다크, 모바일/데스크톱. 개선 내용: 앞선 작업 후 남은 겹침, 과밀한 버튼, 불균형한 카드, 색 대비, 스크롤 피로, 지도/리스트 연결성 문제를 마지막으로 정리한다. 완료 기준: 주요 화면을 390px/768px/1440px에서 확인했고, 새로 발견된 큰 결함이 없으며, 남은 작은 개선은 별도 backlog 항목으로 분리되어 있다. 검증: `pnpm lint`, `pnpm test` 또는 변경 범위에 맞는 테스트, Playwright/브라우저 스크린샷 비교.
