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

- [대기] `PATCH /v1/places/{placeId}`에서 `externalRefs` 일부 키만 보내면 기존 nested provenance가 통째로 사라질 수 있다. 재현 record는 `abc29bd9-e4a8-4e9c-84e9-5cc9d3b7c579`이다. 생성 payload `agent-research/jeju-20260608-2216-jejuoseong-create-payload.json`에는 aliases와 `coordinateProvenance`가 있었지만, cleanup patch `agent-research/jeju-20260608-2216-jejuoseong-korean-text-patch.json`가 `externalRefs.parentReviewEvidence`만 보내자 aliases와 coordinate provenance가 응답에서 사라졌고, 이후 `agent-research/jeju-20260608-2216-jejuoseong-externalrefs-image-recovery-patch.json`로 복구했다. 해결 방향은 PATCH의 `externalRefs`를 전체 교체가 아니라 deep merge로 처리해 전달된 키만 갱신하고 기존 `aliases`, `koreanSearchAliases`, `coordinateProvenance`, `infoLinks`, `reviewLinks` 같은 known nested object를 보존하는 것이다. 완료 기준은 같은 부분 PATCH를 재현해도 기존 nested provenance가 유실되지 않고, 교체가 필요한 경우를 위한 별도 명시 정책이 문서화되거나 테스트로 보호되는 것이다.

- [대기] 숫자 지점명 공백 차이 때문에 정확/별칭 검색이 새로 만든 지점을 놓치는 문제가 현재도 재현되는지 확인해야 한다. 재현 record는 `885d12c0-5e88-4d9d-8ebc-f8525c04c8e9`(`맛나감자탕 제주1호점`)이고 자료는 `agent-research/payload-jeju-matna-gamjatang-20260609-0002.json`이다. 당시 `맛나감자탕 제주1호점` exact query는 새 id를 반환했지만, 저장된 alias인 `맛나감자탕 제주 1호점` 검색은 broad 제주 결과로 흘러가 새 id를 포함하지 않았다. 다만 OpenAPI와 place-data skill에는 이미 `matchMode: "exactName"`, whitespace-compacted alias 검색, agent verification guidance가 반영되어 있으므로 먼저 production/API에서 stale 여부를 확인한다. 여전히 재현되면 exact alias boost와 숫자 지점명 normalization을 강화하고, 재현되지 않으면 이 backlog 항목을 삭제한다. 완료 기준은 `맛나감자탕 제주1호점`과 `맛나감자탕 제주 1호점`이 exact-name 검증에서 같은 장소를 안정적으로 반환하거나, 이미 해결된 것으로 확인되어 항목이 제거되는 것이다.

- [대기] `PATCH /v1/places/{placeId}`가 flat `parentNotes`와 `safetyNotes`를 받아 version은 만들지만 detail 응답에서는 두 필드가 `null`로 남을 수 있다. 재현 record는 `d2a04ac5-723b-4db4-a9b3-8bcf5ff10b26`(`곽지과물해변`)이고 payload는 `agent-research/jeju-gwakji-floor-fountain-patch-20260609-0955.json` 및 retry `agent-research/jeju-gwakji-notes-retry-patch-20260609-0955.json`이다. version 2에는 tags, playFeatures, source가 반영되고 version 3에는 retry source가 추가됐지만, detail은 계속 `parentNotes: null`, `safetyNotes: null`을 반환했다. 해결 방향은 update normalization, DB column write, route deployment version, response mapping을 분리해 확인하고, 생성에서는 되는지와 업데이트에서만 빠지는지를 나눠 재현하는 것이다. 완료 기준은 PATCH 후 detail 응답에서 두 note 필드가 실제로 반환되고, flat 필드와 nested alias 입력 모두를 보호하는 회귀 테스트가 추가되는 것이다.
