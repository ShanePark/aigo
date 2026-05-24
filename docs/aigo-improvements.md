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

- [대기] place detail/version/image-health API가 일부 개발 서버 상태에서 JSON 오류 응답 대신 Next HTML 500을 반환하는 문제를 재현하고 고친다. 창원 장소 등록 작업(2026-05-24)에서 `GET /v1/places/3810e488-7a49-4ec4-aa6f-47e8b06dafbd`, `GET /v1/places/3810e488-7a49-4ec4-aa6f-47e8b06dafbd/versions`, 그리고 기존 `진해해양공원` 버전 경로가 `ENOENT: .../.next/server/pages/_document.js` HTML 오류 페이지를 반환했다. 후속 창원 1시간권 등록 작업에서도 `GET /v1/places/3c9da75e-1678-41a1-bd0e-b45d2e6f8404`, `GET /v1/places/3c9da75e-1678-41a1-bd0e-b45d2e6f8404/versions`, `GET /v1/places/image-health?status=attention&limit=1000`이 같은 HTML 500을 반환했다. 같은 place의 exact-name search 노출과 `getPlaceDetail`, `listPlaceVersions`, `listPlaceImageHealth` read-only helper는 정상이라 데이터 생성/버전/image row 자체보다는 API route/dev-server error rendering 경로 문제로 보인다. 재현 시 `Authorization: Bearer change-me`, `Accept: application/json`으로 detail/version/image-health route를 호출하고, API route 오류가 `apiErrorResponse` JSON으로 안정적으로 내려오는지 확인한다.
- [대기] 공식 이미지 검사에서 content-type이 부정확해도 magic bytes로 이미지 여부를 판정한다. Wave36 science/museum 리포트(`agent-research/wave36-childrens-science-museum-experience-readiness-20260523-1000.md`)에서 부산과학체험관 썸네일은 `application/octer-stream`이지만 PNG bytes, 울산안전체험관 파일 다운로드는 `text/plain;charset=utf-8`이지만 JPEG bytes로 확인됐다. `scripts/check-image-candidate.ts`나 image-health 경로가 `HEAD/Range GET` 뒤 선행 bytes를 sniff해서 공식 file/download URL을 과도하게 hold하지 않도록 한다.
- [대기] retail alias exact-name 매칭에서 같은 브랜드/복합몰 계열이라도 지역이 다른 지점은 false hit로 돌려보내지 않도록 한다. Wave37/Wave38 리서치에서 `타임빌라스 수원` 계열 alias가 `롯데프리미엄아울렛 의왕점`(`47bd2d06-f613-4adb-8cbd-4b479eb140d3`)과 섞일 수 있었다. 실제 수원점은 별도 record(`8621ad1d-7861-4263-8785-598c33246443`)로 생성했으므로, 검색/중복 판단에서 지점명, 주소, 시군구 충돌을 reason으로 노출해야 한다. 재현: `POST /v1/places/search`에 `query: "타임빌라스 수원"`, `matchMode: "exactName"`, `projection: "compact"`를 보내고 반환 item의 alias reason/지역 충돌을 확인한다.
- [대기] 지역 앵커가 포함된 자연어 검색에서 `창원 근교`, `창원 1시간`, `근처` 같은 표현을 장소명 필수 토큰처럼 다루지 않고 origin/distance 의도로 해석하게 개선한다. 창원 1시간권 등록 작업(2026-05-24, `agent-research/changwon-1h-consolidated-create-20260524-0912.json`) 이후 `POST /v1/places/search`에 `query: "창원 근교 공룡 아이"`, `origin: { lat: 35.227, lng: 128.681 }`, `filterByRadius: false`, `projection: "compact"`를 보내면 0건이지만, `query: "고성 공룡"`은 `고성공룡박물관`, `고성 덕명리 공룡과 새발자국 화석산지`, `고성당항포랜드`를 반환했다. `query: "창원 근교 우포 아이 자연"`도 0건이지만 `query: "우포 아이"`는 `창녕우포곤충나라`, `우포늪생태관`을 반환했다. 검색 정규화에서 출발지/거리 표현은 scoring context로 빼고, 남은 활동/테마 토큰으로 근교 후보를 찾도록 한다.
