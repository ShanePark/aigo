# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Before starting a `[대기]` item, review it explicitly while it is still `[대기]`. Confirm that the improvement is still real, necessary, and worth doing; check whether the proposed direction could create product, data, API, migration, UX, or operational problems; and compare the expected value against the risk and implementation cost. Only change the item to `[개선 중]` and implement it when that review concludes the work should proceed.

If a `[대기]` item is judged weak, obsolete, unactionable, already solved, or no longer worth improving, delete it from this file instead of leaving it in the queue.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

한 번에 하나의 `[대기]` 항목만 고르고, 먼저 확실한 개선 사항인지, 현재도 필요한지, 제안된 방식이 문제를 만들 가능성은 없는지 리뷰한다. 진행 가치가 충분하다고 판단될 때만 `[개선 중]`으로 바꾸고, 구현과 검증이 끝나면 해당 항목을 삭제한 뒤 관련 파일만 커밋한다. 각 항목은 가능한 한 작은 독립 커밋 단위로 유지한다. 구현 중 새로 필요한 후속 작업, 설계 분기, 테스트 보강, UI 정리, 문서 갱신이 발견되면 현재 항목에 억지로 끼워 넣지 말고 이 문서에 새 `[대기]` 항목으로 다시 등록해 재귀적으로 이어간다.

- [대기] `imageUrls` legacy 필드가 구조화된 `images`와 함께 들어올 때 이미지 검수 상태가 꼬일 수 있다. 재현 자료는 `agent-research/jeju-981park-create-payload-20260606-0439.json`와 production record `cd4bb0ef-d568-4a67-9348-07476c091472`이다. 해당 생성 payload에서는 VisitJeju 기반 구조화 이미지가 승인되고 대표 이미지로 잡혔지만, `imageUrls`에 남은 추가 legacy URL 때문에 `GET /v1/places/image-health?placeIds=cd4bb0ef-d568-4a67-9348-07476c091472`가 `pendingReviewCount: 1`을 반환했다. 해결 방향은 `images`를 기준 필드로 삼고, 기존 `imageUrls` 데이터는 영향 범위를 확인한 뒤 구조화 이미지로 마이그레이션하거나 중복 제거한다. 이후 OpenAPI, schema, place-data skill에서 `imageUrls`를 deprecated shorthand가 아니라 제거 대상 legacy 필드로 정리하고, 새 agent payload는 `images`만 쓰도록 가이드를 맞춘다. 완료 기준은 기존 production 데이터의 이미지 헬스 pending 재현 케이스가 사라지고, `imageUrls` 제거 또는 무시 정책이 API 문서와 agent workflow에 일관되게 반영되는 것이다.

- [대기] `/v1/places/duplicates`가 일반적인 공공 하위시설명을 관련 없는 주변 명소와 high-confidence 중복으로 과대평가할 수 있다. 재현 자료는 `agent-research/jeju-20260608-2131-toybaksa-sharedcare1-final-preflight.json`이다. 후보 `서귀포시 공동육아나눔터 1호점`은 `shared_childcare`이고 주소가 `제주특별자치도 서귀포시 안덕면 서광동로 17 서광동리복지회관 2층 작은도서관`인데, 714m 떨어진 `소인국테마파크`(`313f5944-7dc8-4ebf-b008-4a414871463d`, `experience_center`)가 `ALIAS_MATCH`, `REGION_MATCH`, `NAME_SIMILAR`로 high-confidence 중복 후보가 되었다. 해결 방향은 일반 alias, 같은 지역, 약한 이름 유사도만으로는 high-confidence나 `update_existing`이 나오지 않게 하고, 카테고리 충돌, 주소 충돌, 약한 이름 토큰 겹침이 있으면 confidence와 suggestedAction을 낮추는 것이다. 완료 기준은 같은 재현 후보가 identity duplicate가 아니라 수동 검토 또는 낮은 우선순위 후보로 내려가고, 같은 주소나 강한 provider/id 근거가 있는 진짜 중복은 계속 잡히는 회귀 테스트를 추가하는 것이다.

- [대기] 다이소처럼 아이용 상품이 일부 있는 일반 소매 체인을 AiGo 공용 장소 데이터에 포함할지 기준이 불명확하다. 재현 자료는 `agent-research/jeju-daiso-policy-image-next-qa-20260608-2238.md`이며, `다이소 제주노형점`과 `다이소 제주동문시장점`은 공식 지점 정보와 영업시간, 좌표, 이미지 근거가 있지만 아이 중심 목적지나 가족 외출 장소로 보기는 어렵다. 사용자 결정에 따라 다이소류 일반 소매 체인은 AiGo에 등록하지 않는다. `general_store` 같은 새 primary category를 만들지 않고, `toy_store`도 장난감 전문점이나 아이 중심 쇼핑 목적지에만 사용한다. 해결 방향은 `.codex/skills/aigo-place-api/SKILL.md`의 retail fallback 가이드를 정리해 일반 소매 체인이 신규 등록 후보로 남지 않도록 하고, 이미 staging된 다이소류 후보는 생성하지 않거나 `skip`으로 정리하는 것이다. 완료 기준은 place-data workflow에서 일반 생활용품점이 `toy_store` 후보로 올라오지 않고, 장난감 전문점/캐릭터 매장/아이 중심 쇼핑 장소만 보수적으로 등록되는 것이다.

- [대기] `PATCH /v1/places/{placeId}`에서 `externalRefs` 일부 키만 보내면 기존 nested provenance가 통째로 사라질 수 있다. 재현 record는 `abc29bd9-e4a8-4e9c-84e9-5cc9d3b7c579`이다. 생성 payload `agent-research/jeju-20260608-2216-jejuoseong-create-payload.json`에는 aliases와 `coordinateProvenance`가 있었지만, cleanup patch `agent-research/jeju-20260608-2216-jejuoseong-korean-text-patch.json`가 `externalRefs.parentReviewEvidence`만 보내자 aliases와 coordinate provenance가 응답에서 사라졌고, 이후 `agent-research/jeju-20260608-2216-jejuoseong-externalrefs-image-recovery-patch.json`로 복구했다. 해결 방향은 PATCH의 `externalRefs`를 전체 교체가 아니라 deep merge로 처리해 전달된 키만 갱신하고 기존 `aliases`, `koreanSearchAliases`, `coordinateProvenance`, `infoLinks`, `reviewLinks` 같은 known nested object를 보존하는 것이다. 완료 기준은 같은 부분 PATCH를 재현해도 기존 nested provenance가 유실되지 않고, 교체가 필요한 경우를 위한 별도 명시 정책이 문서화되거나 테스트로 보호되는 것이다.

- [대기] 숫자 지점명 공백 차이 때문에 정확/별칭 검색이 새로 만든 지점을 놓치는 문제가 현재도 재현되는지 확인해야 한다. 재현 record는 `885d12c0-5e88-4d9d-8ebc-f8525c04c8e9`(`맛나감자탕 제주1호점`)이고 자료는 `agent-research/payload-jeju-matna-gamjatang-20260609-0002.json`이다. 당시 `맛나감자탕 제주1호점` exact query는 새 id를 반환했지만, 저장된 alias인 `맛나감자탕 제주 1호점` 검색은 broad 제주 결과로 흘러가 새 id를 포함하지 않았다. 다만 OpenAPI와 place-data skill에는 이미 `matchMode: "exactName"`, whitespace-compacted alias 검색, agent verification guidance가 반영되어 있으므로 먼저 production/API에서 stale 여부를 확인한다. 여전히 재현되면 exact alias boost와 숫자 지점명 normalization을 강화하고, 재현되지 않으면 이 backlog 항목을 삭제한다. 완료 기준은 `맛나감자탕 제주1호점`과 `맛나감자탕 제주 1호점`이 exact-name 검증에서 같은 장소를 안정적으로 반환하거나, 이미 해결된 것으로 확인되어 항목이 제거되는 것이다.

- [대기] `PATCH /v1/places/{placeId}`가 flat `parentNotes`와 `safetyNotes`를 받아 version은 만들지만 detail 응답에서는 두 필드가 `null`로 남을 수 있다. 재현 record는 `d2a04ac5-723b-4db4-a9b3-8bcf5ff10b26`(`곽지과물해변`)이고 payload는 `agent-research/jeju-gwakji-floor-fountain-patch-20260609-0955.json` 및 retry `agent-research/jeju-gwakji-notes-retry-patch-20260609-0955.json`이다. version 2에는 tags, playFeatures, source가 반영되고 version 3에는 retry source가 추가됐지만, detail은 계속 `parentNotes: null`, `safetyNotes: null`을 반환했다. 해결 방향은 update normalization, DB column write, route deployment version, response mapping을 분리해 확인하고, 생성에서는 되는지와 업데이트에서만 빠지는지를 나눠 재현하는 것이다. 완료 기준은 PATCH 후 detail 응답에서 두 note 필드가 실제로 반환되고, flat 필드와 nested alias 입력 모두를 보호하는 회귀 테스트가 추가되는 것이다.
