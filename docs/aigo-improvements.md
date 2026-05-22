# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

- [대기] 프로덕션에서 기본 개발용 인증키(`AIGO_API_KEY=change-me`)가 그대로 허용되지 않도록 환경 설정을 강제한다. 현재 `src/env.ts`가 `AIGO_API_KEY` 미설정 시 공개적으로 추측 가능한 `"change-me"`를 사용하고, 모든 `/v1/places` 쓰기/삭제 API가 그 값만 알면 통과한다. `NODE_ENV=production` 또는 명시적 외부 노출 환경에서는 앱 시작 시 실패시키거나 API 라우트에서 기본 키를 거부하고, README/프리플라이트도 “로컬 개발 전용 기본값”과 “외부 노출 금지”를 검증하도록 맞춘다. 회귀 테스트는 env 조합별 `requireApiKey` 동작 또는 route-handler 단위 테스트로 추가한다.

- [대기] `/v1/places/search`의 후보군 산출을 `limit 750` 고정 선필터 방식에서 실제 검색 규모에 맞는 페이징/카운트 구조로 바꾼다. 현재 `buildSearchQuery()`가 DB에서 `order by coalesce(place_score, 5) desc, updated_at desc limit 750`만 가져온 뒤 애플리케이션에서 런타임 점수화, 다양성 필터, `offset/limit`을 적용하므로 장소 수가 750개를 넘으면 관련 후보가 사전에 잘리고 `meta.total`도 실제 전체가 아니라 잘린 후보 수가 된다. `query`, `tags`, 선호조건, 거리대, 다양성 필터가 있는 경우에도 누락 없이 동작하도록 SQL 후보 점수/키셋 페이징/별도 count 전략 중 하나를 설계하고, 800개 이상 더미 데이터에서 `offset`과 `total`이 깨지지 않는 통합 테스트를 추가한다.

- [대기] Zod 요청 스키마와 `docs/openapi/aigo-v1.yaml`의 계약 불일치를 막는 동기화 검증을 추가한다. 현재 API는 `createPlaceSchema`에서 `address` 또는 `regionSido`를 필수로 요구하고, `updatePlaceSchema`에서 `lat/lng` 동시 업데이트 및 권장 월령 min/max 순서를 검증하지만 OpenAPI에는 이 refinement가 표현되지 않아 에이전트가 문서상 유효한 payload를 보내고 실제 API에서 400을 받을 수 있다. 최소한 OpenAPI에 `anyOf`/설명/테스트 사례를 보강하고, `tests/openapi.test.ts`가 문서 문법 검증뿐 아니라 대표 Zod accept/reject 케이스와 OpenAPI accept/reject 케이스를 비교하도록 확장한다.

- [대기] `src/db/schema.ts`와 실제 SQL 마이그레이션 사이의 스키마 드리프트를 정리한다. Drizzle 설정은 `src/db/schema.ts`를 단일 schema source로 보지만 실제 DB에는 마이그레이션으로만 존재하는 `places.geo`, `places.search_text`, PostGIS/pg_trgm 인덱스, trigger, 각종 check constraint, `place_images_one_primary_active_idx`, related-place canonical/distinct constraint 등이 있고 Drizzle 스키마에는 누락되어 있다. 이후 `drizzle-kit` 생성/검토 시 잘못된 diff가 나올 수 있으므로 Drizzle에서 표현 가능한 항목은 반영하고, 표현이 어려운 PostGIS trigger/index/constraint는 명시적 custom migration 검증 또는 preflight schema check에 포함한다.

- [대기] 버전 조회 API가 존재하지 않는 장소를 404로 반환하도록 계약과 구현을 맞춘다. 현재 `GET /v1/places/{placeId}/versions`는 `places` 존재 여부를 확인하지 않고 `place_versions`만 조회해서, 없는 `placeId`에도 `{ items: [] }`를 반환할 수 있는데 OpenAPI는 404를 문서화하고 있다. `listPlaceVersions()`에서 먼저 장소 존재를 확인하거나 공통 helper를 사용하고, 없는 장소와 버전이 없는 정상 장소를 구분하는 route/lib 테스트를 추가한다.

- [대기] 운영시간 평가를 한국 로컬 일정 데이터에 맞게 고친다. 현재 `searchEvaluationDate()`는 서버 로컬 타임존으로 `new Date(year, month - 1, day, ...)`를 만들고, `parseDay()`는 영어 요일/숫자만 인식한다. 배포 환경 타임존이 UTC이거나 `openingHours.weekly`가 `월`, `화`, `월요일`, `공휴일` 같은 한국어 키를 쓰면 계획 방문 시간/요일 평가가 어긋나 `OPEN_NOW`, `CLOSED_NOW`, `OPENING_HOURS_UNKNOWN` reason code가 잘못 붙을 수 있다. Asia/Seoul 기준 wall-clock 평가를 명시적으로 구현하고 한국어 요일 키 및 자정 넘김 케이스를 테스트한다.

- [대기] `DELETE /v1/places/{placeId}`의 영구 삭제 안전장치를 추가한다. 현재 API는 인증만 통과하면 장소, 출처, 이미지, 버전 기록까지 cascade hard delete하며 삭제 사유, actor, source, 확인 토큰을 남기지 않는다. AiGo 데이터는 수집 비용이 큰 핵심 자산이므로 실수/에이전트 오작동에 대비해 삭제 전 명시적 확인 payload와 `changeSummary`를 요구하거나, 기본은 `status: closed`/archived 형태의 soft delete로 바꾸고 hard delete는 별도 감사용 경로로 제한한다. 삭제 후 검색 제외와 감사 기록이 남는지 테스트한다.

- [대기] 이미지 provenance upsert가 기존 검수 정보를 약화시키지 않도록 보강한다. `insertImages()`는 `(place_id, url)` 충돌 시 `source_id`, `source_type`, `source_url`, `review_status`, `is_primary` 등을 항상 `excluded` 값으로 덮어쓰는데, agent가 `imageUrls` shorthand나 sourceId 없는 간단 payload를 다시 보내면 기존 source linkage 또는 `approved` 검수 상태가 `null`/`pending_review`로 후퇴할 수 있다. 충돌 업데이트에서 null/unknown 입력은 기존 값을 보존하고, 명시적 `imageMode: replace` 또는 structured `images` payload일 때만 검수 상태를 낮출 수 있도록 규칙을 정한 뒤 기존 승인 이미지에 shorthand를 append하는 회귀 테스트를 추가한다.

- [대기] 검색 결과 카드에서 출처 신뢰도와 최신성 신호를 다시 노출한다. API는 `sourceSummary`와 `openingHoursSummary`를 계산하지만 현재 `src/app/page.tsx`의 결과 카드에서는 source tier/freshness 배지가 제거되어 부모가 목록 단계에서 공식/공공/운영자/공개목록 출처와 재확인 필요 여부를 비교할 수 없다. 카드 밀도를 해치지 않는 작은 배지나 tooltip 형태로 `bestSourceTier`, `freshnessStatus`, 운영시간 구조화 gap을 표시하고, source 없는/오래된 장소가 리스트에서 식별되는지 SSR 또는 Playwright 검증을 추가한다.

- [대기] Replace fixed-radius place filtering with map viewport search. Current search/list behavior is tied to a fixed radius such as 20km, which feels unlike map-first apps. Change the search flow so the place list is driven by the currently visible map bounds instead, including a "search this area" style interaction after pan/zoom, while preserving family filters and making the API/query contract explicit. Source: user feedback on 2026-05-22.
