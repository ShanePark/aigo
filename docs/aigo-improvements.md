# AiGo Improvement Backlog

Durable service/API/product improvements discovered while using AiGo belong here. Raw task notes can stay in `agent-research/*.md`, but anything that should be easy to fix later should be summarized in this file.

Status labels:

- `[대기]`: not started.
- `[개선 중]`: actively being worked on.

Completed improvements should be removed from this file after verification instead of being changed to `[완료]`. Keep verification details in the commit, PR, or implementation notes that closed the item.

Only mark unrelated items as `[개선 중]` at the same time when they are intentionally part of the same active change.

## Backlog

UI/UX 개편은 아래 항목을 위에서부터 하나씩 진행한다. 한 번에 하나의 `[대기]` 항목만 `[개선 중]`으로 바꾸고, 구현과 검증이 끝나면 해당 항목을 삭제한 뒤 관련 파일만 커밋한다. 각 항목은 가능한 한 작은 독립 커밋 단위로 유지한다.

Data/API 후속 항목:

- [대기] 공식 이미지 검사에서 content-type이 부정확해도 magic bytes로 이미지 여부를 판정한다. Wave36 science/museum 리포트(`agent-research/wave36-childrens-science-museum-experience-readiness-20260523-1000.md`)에서 부산과학체험관 썸네일은 `application/octer-stream`이지만 PNG bytes, 울산안전체험관 파일 다운로드는 `text/plain;charset=utf-8`이지만 JPEG bytes로 확인됐다. `scripts/check-image-candidate.ts`나 image-health 경로가 `HEAD/Range GET` 뒤 선행 bytes를 sniff해서 공식 file/download URL을 과도하게 hold하지 않도록 한다.
- [대기] retail alias exact-name 매칭에서 같은 브랜드/복합몰 계열이라도 지역이 다른 지점은 false hit로 돌려보내지 않도록 한다. Wave37/Wave38 리서치에서 `타임빌라스 수원` 계열 alias가 `롯데프리미엄아울렛 의왕점`(`47bd2d06-f613-4adb-8cbd-4b479eb140d3`)과 섞일 수 있었다. 실제 수원점은 별도 record(`8621ad1d-7861-4263-8785-598c33246443`)로 생성했으므로, 검색/중복 판단에서 지점명, 주소, 시군구 충돌을 reason으로 노출해야 한다. 재현: `POST /v1/places/search`에 `query: "타임빌라스 수원"`, `matchMode: "exactName"`, `projection: "compact"`를 보내고 반환 item의 alias reason/지역 충돌을 확인한다.
