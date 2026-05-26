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

`[개선 중]` 세부조건 필터 확장과 아이콘 선택 UI 개선:

- `[대기]` 세부조건 필터 확장 2단계로 검색 데이터 계약을 정리한다. 현재 UI에 남아 있는 기존 조건과 아래 후보 조건을 비교해 URL 파라미터, API/OpenAPI, 장소 스키마, 검색 매칭, 빈 결과 fallback, 테스트 범위를 먼저 확정한 뒤 새 조건을 작은 묶음으로 추가한다.

필터 그룹은 최소한 `놀이터/놀이`, `아기 돌봄`, `편의/동선`, `환경/날씨`, `식사/휴식`, `안전`처럼 부모가 실제로 고르는 맥락으로 나눈다. `놀이터/놀이`에는 그네, 시소, 미끄럼틀, 물놀이터, 모래놀이, 트램펄린/방방, 클라이밍/정글짐, 잔디마당, 숲놀이터, 실내 놀이터, 체험/만들기, 책/장난감 놀이를 검토한다. `아기 돌봄`에는 수유실, 기저귀 교환대, 아기의자, 유모차 이동, 엘리베이터, 아기 쉼 공간, 유아 화장실, 전자레인지/이유식 데우기, 유아용 식기 여부를 검토한다. `편의/동선`에는 화장실, 주차, 실내, 대중교통 접근, 엘리베이터/무장애 동선, 예약 필요, 무료/저비용, 짧은 체류, 반나절 체류, 비 오는 날 가능, 대기/혼잡 주의, 카페/매점, 주변 식사 해결을 검토한다. `안전`에는 물가 주의, 도로 인접, 높은 구조물, 미끄럼/바닥, 그늘 부족, 보호자 시야 확보, 소음/붐빔, 난방/냉방 안정성을 검토한다.

구현할 때는 기존 장소 스키마의 `amenities`, `playFeatures`, `parentNotes`, `safetyNotes`, 태그/검색 파라미터와 충돌하지 않게 먼저 데이터 계약을 정리한다. 이미 장소 데이터에 존재하는 값은 최대한 재사용하고, 새 조건이 필요하면 API/OpenAPI/스키마/검색 URL/중복 처리/테스트를 함께 갱신한다. 증거가 약한 조건은 장소 데이터에서 `unknown` 또는 미표시로 남기고, 필터가 실제 검색 결과 품질을 해치지 않도록 조건별 매칭 범위와 빈 결과 fallback을 설계한다.

UI는 텍스트만 긴 버튼으로 늘어놓지 말고, lucide 아이콘 또는 일관된 코드-native 아이콘을 우선 사용한다. 아이콘이 부족한 카테고리는 단순하고 귀여운 프로젝트용 래스터 아이콘 세트를 검토하되, 필요하면 `$imagegen` skill로 WebP 에셋을 생성해 `public/` 아래에 넣는다. 선택된 조건은 색/채움/체크 상태가 분명해야 하고, 미선택 조건은 이미 선택된 것처럼 보이지 않게 중립적으로 둔다. 다크모드와 모바일에서 텍스트 겹침, 아이콘 크기, 터치 타깃, 가로 스크롤/접힘 동작을 Playwright로 확인한다.

- `[대기]` 장소 `openingHours.description`만 source-backed로 PATCH하면 상세 응답의 `structuredDataGaps`에는 여전히 `openingHours`가 남는다. 2026-05-26 서울 private kidscafe6 배치에서 `키즈런스포츠파크 목동점`, `점프업`, `곰도리도리 키즈카페`, `베이비온더풀 베이비카페`, `합앤합` 모두 공개 listing 기반 운영시간 설명을 넣었지만 검증 결과 `agent-research/seoul-density-private-kidscafe6-mutations-20260526-0420.results.json`의 gaps에 `openingHours`가 남았다. description-only 운영시간을 readiness/gap에서 부분 인정할지, 또는 validator가 요일별 구조화 키를 요구하도록 handoff 문구와 payload lint를 강화할지 결정한다.
- `[대기]` `/v1/places/duplicates` 응답의 `score`/`confidence`가 숫자와 문자열 라벨(`high`, `medium`, `low`)을 섞어 반환할 때 mutation executor guard가 숫자 비교만 하면 high duplicate를 통과시킬 수 있다. 2026-05-26 서울 shopping/toys8 AZ 배치에서 `토이저러스 롯데마트김포공항점`은 duplicate precheck에 `토이저러스 김포공항점` high 후보가 있었고, `레고스토어 용산아이파크몰점`은 parent-building high 후보가 있었으나 임시 executor가 문자열 점수를 숫자로 비교해 생성 후 soft-delete 보정했다. duplicate 응답 타입을 OpenAPI/스키마/헬퍼에서 명확히 하거나, 공통 preflight helper가 high 라벨과 숫자 threshold를 모두 blocking으로 처리하게 만든다.
- `[대기]` 체인/브랜드형 지점 등록에서는 `/v1/places/duplicates`가 주소·좌표가 명확히 다른 branch를 `ALIAS_MATCH`, `REGION_MATCH`, `NAME_SIMILAR`만으로 `hold_duplicate_review`로 묶어 밀도 스프린트 처리량을 떨어뜨린다. 2026-05-26 인천 malls/toys BL 배치에서 `토이저러스 청라점` 생성 후 `토이저러스 부평점`, `토이저러스 계양점`, `토이저러스 송도점`은 각각 다른 공개 listing 주소/좌표가 있었지만 기존 청라점을 low duplicate 후보로 받아 안전 규칙상 hold했다. 같은 브랜드라도 exact address 또는 coordinate distance가 충분히 다르고 지점명이 행정동/상권 단위로 구분되면 duplicate를 차단 신호가 아니라 branch sibling review 신호로 낮추고, executor helper가 별도 branch create를 허용할 수 있게 한다.
- `[대기]` `/v1/places/duplicates`가 같은 건물 또는 공공 하위시설 관계의 다른 카테고리 장소를 `suggestedAction: "update_existing"`으로 제안하는 사례를 줄인다. 2026-05-26 서울 toy-libraries9 BB 배치에서 `서대문구육아종합지원센터 놀잇감 대여실` precheck가 같은 건물의 `서울형 키즈카페 서대문구 BABY 남가좌1동점`을 `PUBLIC_SUBFACILITY_REVIEW_ONLY` reason과 함께 `update_existing`으로 반환했고, `라온장난감나라 은평구청별관점`도 근처 서울형 키즈카페를 `update_existing`으로 제안했다. `PUBLIC_SUBFACILITY_REVIEW_ONLY`, 다른 `primaryCategory`, 이름 목적 불일치가 같이 있으면 자동 update/create 차단보다 parent-child/same-building review로 분리하도록 duplicate suggestedAction 산출과 executor helper를 조정한다.
- `[대기]` `/v1/places/duplicates`가 providerPlaceId/address match 없이 `ALIAS_MATCH`, `REGION_MATCH`, `GEO_NEAR`, `NAME_SIMILAR`만으로 다른 공식 branch를 `confidence: "high"`, `suggestedAction: "update_existing"`으로 반환하는 false-positive를 줄인다. 2026-05-26 서울 seoul-kidscafe11 BI 배치에서 `서울형 키즈카페 동대문구 새샘공원점`(DM250901)이 기존 `서울형 키즈카페 동대문구 답십리1동점`(DM250103)을 high update 후보로 받았고, 임시 executor가 patch한 뒤 즉시 `agent-research/seoul-density-seoul-kidscafe11-mutations-20260526-0536.correction-results.json`로 복구했다. 같은 provider 내 branch끼리는 providerPlaceId 또는 exact address가 다르면 high/update_existing을 내리지 말고 `hold_duplicate_review`로 낮춘다.
- `[대기]` 물놀이터/분수/수변놀이 후보의 duplicate matching이 지역·주소 근거보다 물 관련 일반명사 alias를 과하게 반영해 먼 지역의 다른 시설을 `hold_duplicate_review`로 묶는 문제를 줄인다. 2026-05-26 West Gyeonggi DC batch에서 `부천중앙공원 물놀이터` duplicate precheck가 서울권 `뚝섬 벽천분수`, `반포 달빛무지개분수`, `여의도 수상분수`, `잠원 수영장`, 그리고 용인 `캐리비안 베이`까지 low `hold_duplicate_review` 후보로 반환해 create를 보류했다. `물놀이터`, `분수`, `수영장` 같은 generic activity aliases는 exact-name/nearby-address/regionSigungu match가 없으면 duplicate blocking보다 weak thematic similarity로 낮추고, executor helper가 지역 불일치 low candidates를 별도 noisy warning으로 분리하게 한다. Research context: `agent-research/west-gyeonggi-dc-bucheon-uiwang-anchors-parks-20260526-0738.results.json`.
- `[대기]` 어린이자료실/장난감도서관 같은 공공 generic subfacility 후보에서 `/v1/places/duplicates`가 주소·좌표가 명확히 다른 타 지역 records를 low `hold_duplicate_review`로 대량 반환해 source-ready create를 막는 문제를 줄인다. 2026-05-26 West Gyeonggi DB batch에서 `광명시립하안도서관 어린이자료실`과 `광명시립철산도서관 어린이자료실`은 exact search 0건, 공식 도서관 페이지·주소·좌표·이미지 근거가 있었지만 duplicate precheck가 부천/양천/서초/인천의 다른 어린이자료실들을 `ALIAS_MATCH`, `SAME_SIDO_GENERIC_REVIEW_ONLY`, `GEO_OUTSIDE_REQUEST_RADIUS`, `OUTSIDE_RADIUS_REVIEW_ONLY`, `NAME_SIMILAR` low `hold_duplicate_review` 후보로 반환해 안전 규칙상 모두 hold했다. exact address/coordinate가 요청 후보와 다르고 밖인 low generic same-category candidates는 blocking hold가 아니라 noisy cross-region warning으로 분리하고, executor helper가 source-ready 후보를 만들 수 있도록 duplicate suggestedAction 산출을 조정한다. Research context: `agent-research/west-gyeonggi-db-public-mutations-20260526-0738.results.json`.
- `[대기]` 공공 어린이 체험시설과 박물관 하위 체험실 후보에서도 `/v1/places/duplicates`가 주소·좌표가 명확히 다른 타 지역 experience/kids records를 low `hold_duplicate_review`로 반환해 source-ready create를 막는 문제를 줄인다. 2026-05-26 Busan/Ulsan/Gyeongnam NB Ulsan child-public-experience batch에서 `울산시립어린이테마파크`, `약사동제방유적전시관 어린이체험실`, `울산박물관 어린이체험실`은 exact search 0건, 공식 페이지·공개 주소/관광 좌표·공식 이미지 payload가 `validate-research-payloads.ts`를 통과했지만 duplicate precheck가 `인천공룡월드`, `안동 유교랜드`, `아르떼뮤지엄 강릉`, `아동놀이연구소 플레이랩 송파점` 등 주소/좌표 밖의 low `hold_duplicate_review` 후보를 반환해 안전 규칙상 모두 hold했다. `ALIAS_MATCH`와 `NAME_SIMILAR`가 generic child/experience terms only이고 exact address 또는 coordinate radius가 불일치하면 blocking hold가 아니라 noisy warning으로 분리한다. Research context: `agent-research/bugyeong-nb-ulsan-child-public-20260526-1020.results.json`.
