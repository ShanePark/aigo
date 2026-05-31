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

- `[개선 중]` 세부조건 필터 확장 2단계로 검색 데이터 계약을 정리한다. 현재 UI 조건과 후보 조건을 비교해 URL 파라미터, API/OpenAPI, 장소 스키마, 검색 매칭, 빈 결과 fallback, 테스트 범위를 먼저 확정한 뒤 작은 묶음으로 추가한다. 후보는 부모가 실제로 고르는 맥락인 `놀이터/놀이`, `아기 돌봄`, `편의/동선`, `환경/날씨`, `식사/휴식`, `안전` 그룹으로 정리하고, 기존 `amenities`, `playFeatures`, `parentNotes`, `safetyNotes`, taxonomy, tags 값을 최대한 재사용한다. UI는 기존 CSS primitive와 lucide/code-native 아이콘을 우선 쓰고, 다크모드와 모바일에서 선택 상태, 텍스트 줄바꿈, 터치 타깃, 가로 overflow를 Playwright로 확인한다.
- `[대기]` `/regions` 대표 장소 검색과 ranking을 공공·대형 가족 목적지 중심으로 조정한다. 현재 `park`는 대표 카테고리에 포함되어 있으므로 별도 카테고리 추가보다는, 공공 대형 어린이테마파크처럼 `indoor_playground`로 분류된 대표 시설을 조건부 포함하고 `representativeVisit` 점수가 쇼핑몰·대형마트보다 박물관, 과학관, 동물원, 수목원, 국가정원, 공식 운영 체험시설을 우선하도록 테스트를 보강한다. Research context: `agent-research/regional-place-expansion-20260530-2247.md` 2026-05-31 notes.
- `[대기]` `/v1/places/duplicates`가 주소·좌표·providerPlaceId가 다른 지점 또는 같은 건물의 다른 목적 시설을 `update_existing`/blocking duplicate로 과하게 제안하는 false-positive를 줄인다. 체인/브랜드 지점, 같은 provider의 다른 공식 branch, 공공 하위시설/tenant 관계는 exact address, provider id, external refs, 매우 가까운 좌표와 높은 이름 일치처럼 강한 identity evidence가 없으면 branch sibling 또는 same-building review 신호로 낮춘다. 검증은 `src/lib/duplicates.test.ts`, `src/lib/places.ts` duplicate query, OpenAPI `DuplicatePlaceResponse` 설명을 함께 갱신한다. Research contexts: 2026-05-26 인천 malls/toys BL, 서울 toy-libraries9 BB, 서울 seoul-kidscafe11 BI mutation notes.
- `[대기]` `/v1/places/duplicates`가 지역·주소가 다른 generic activity/subfacility 후보를 low `hold_duplicate_review`로 대량 반환해 source-ready create를 막는 문제를 noisy warning으로 분리한다. 물놀이터/분수/수영장, 어린이자료실/장난감도서관, 공공 어린이 체험실처럼 일반명사 alias나 generic child/experience terms만 겹치는 경우 exact name, same address, same sigungu, coordinate radius 중 하나가 없으면 blocking hold보다 weak thematic similarity로 낮춘다. 검증은 West Gyeonggi DC/DB와 Busan-Ulsan-Gyeongnam NB 사례를 재현하는 duplicate 단위 테스트로 추가한다.
