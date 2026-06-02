create table if not exists consent_documents (
  id uuid primary key default gen_random_uuid(),
  consent_type text not null,
  version text not null,
  document_title text not null,
  document_url text not null,
  document_effective_date text,
  body_text text not null,
  body_sha256 text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint consent_documents_type_check check (consent_type in ('privacy_policy', 'terms_of_service', 'location_terms', 'marketing')),
  constraint consent_documents_status_check check (status in ('active', 'archived'))
);

create unique index if not exists consent_documents_type_version_unique
  on consent_documents (consent_type, version);

create index if not exists consent_documents_type_version_idx
  on consent_documents (consent_type, version);

alter table user_consents
  add column if not exists document_id uuid references consent_documents(id) on delete restrict,
  add column if not exists document_body_sha256 text;

insert into consent_documents (
  consent_type,
  version,
  document_title,
  document_url,
  document_effective_date,
  body_text,
  body_sha256,
  status
)
values
(
  'privacy_policy',
  'privacy-2026-06-03',
  '개인정보 처리방침',
  '/privacy',
  '2026-06-03',
  $privacy$AiGo는 아이 동반 장소 검색, 저장, 방문 기록, 장소 팁 기능을 제공하기 위해 필요한 최소한의 개인정보를 처리합니다. 처리하는 개인정보는 서비스 제공, 보안, 오류 대응, 품질 개선 목적 안에서만 사용합니다.
처리하는 개인정보
계정: 카카오 계정 식별자, 이메일, 표시 이름, 로그인 세션 정보
가족 기본값: 아이 생년월, 성별, 선택 입력한 이름 또는 별명
위치: 브라우저가 제공한 현재 위치, 사용자가 저장한 집 위치 좌표와 주소 메모
이용 기록: 검색 조건, 장소 상세 조회, 찜/하트, 최근 본 장소, IP 주소, User-Agent 분석 정보
사용자 콘텐츠: 방문일, 별점, 리뷰, 공개 여부, 방문 사진과 사진 메타데이터, 장소 이용 팁
분석 도구: Google Analytics를 통해 수집되는 페이지 방문 및 기기/브라우저 관련 정보
이용 목적
로그인, 세션 유지, 본인 계정의 저장 장소와 방문 기록 제공
아이 연령, 집 위치, 현재 위치, 검색 조건에 맞는 장소 검색과 거리 표시 제공
방문 리뷰, 사진, 장소 팁의 등록, 수정, 삭제, 공개/비공개 처리
오류 조사, 보안 이벤트 대응, 비정상 이용 방지, 서비스 품질 개선
익명 또는 집계된 통계 분석을 통한 검색 품질과 화면 개선
위치정보 처리
현재 위치는 사용자가 브라우저 권한을 허용하고 위치 버튼이나 자동 위치 검색 기능을 사용할 때만 사용됩니다. 현재 위치는 검색 기준점과 거리 계산에 사용되며, 사용자가 집 위치로 저장하지 않는 한 계정의 집 위치로 저장하지 않습니다. 집 위치를 저장한 경우 사용자는 내 정보 화면에서 언제든지 삭제할 수 있습니다.
공개 콘텐츠
사용자가 공개로 설정한 방문 리뷰, 방문 사진, 장소 이용 팁은 다른 이용자에게 표시될 수 있습니다. 비공개로 설정한 방문 기록과 사진은 본인 계정에서만 볼 수 있도록 처리합니다. 공개 콘텐츠에 개인정보, 타인의 얼굴, 차량번호, 상세 주소 등 민감한 정보가 포함되지 않도록 주의해 주세요.
보유 및 파기
계정 정보와 사용자 설정은 계정 이용 기간 동안 보관합니다.
로그인 세션은 만료되거나 로그아웃하면 삭제 또는 무효화합니다.
사용자가 삭제한 방문 기록, 사진, 장소 팁은 서비스 제공에 필요한 범위에서 삭제합니다.
보안, 오류 조사, 서비스 품질 개선을 위한 이용 로그는 목적 달성 후 지체 없이 파기하거나 식별성을 낮춘 형태로 처리합니다.
법령상 보존 의무가 있는 정보는 해당 법령에서 정한 기간 동안 분리 보관할 수 있습니다.
제3자 제공 및 외부 서비스
AiGo는 법령에 근거가 있거나 사용자의 동의가 있는 경우를 제외하고 개인정보를 제3자에게 판매하거나 임의로 제공하지 않습니다. 다만 서비스 제공을 위해 다음 외부 서비스를 사용할 수 있습니다.
카카오: 소셜 로그인과 계정 식별
Google Analytics: 방문 통계와 서비스 품질 분석
OpenStreetMap 타일 서비스: 지도 화면 표시
이용자의 권리
이용자는 본인의 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다. 앱에서 직접 수정하거나 삭제할 수 있는 정보는 내 정보, 방문 기록, 방문 사진, 장소 이용 팁 화면에서 처리할 수 있습니다. 앱에서 직접 처리하기 어려운 요청은 서비스 운영자에게 문의해 주세요.
안전성 확보 조치
로그인 세션 토큰은 원문이 아니라 해시값으로 저장합니다.
권한이 필요한 API는 로그인 세션 또는 관리자 권한을 확인합니다.
방문 사진은 파일 형식과 크기를 검증하고, 비공개 사진은 소유자만 접근할 수 있도록 제한합니다.
개인정보 접근 권한은 서비스 운영에 필요한 범위로 제한합니다.
문의
개인정보와 관련한 문의, 신고, 삭제 요청은 AiGo 서비스 운영자에게 전달해 주세요. 요청을 받으면 본인 여부와 요청 내용을 확인한 뒤 필요한 조치를 안내합니다.
변경 고지
이 처리방침이 변경되는 경우 서비스 화면에 변경 내용을 게시합니다. 중요한 변경이 있는 경우 적용 전에 충분한 기간을 두고 안내합니다.$privacy$,
  '26d82d645c869859f721d2f1e0b3a68dc6735f8f5cceb0512d29f269db28dbb1',
  'active'
),
(
  'terms_of_service',
  'terms-2026-06-03',
  'AiGo 이용약관',
  '/terms',
  '2026-06-03',
  $terms$이 약관은 AiGo가 제공하는 아이 동반 장소 검색, 저장, 방문 기록, 장소 팁 서비스의 이용 조건과 운영 기준을 정합니다. AiGo를 이용하는 사용자는 이 약관에 동의한 것으로 봅니다.
서비스 성격
AiGo는 가족 나들이 장소를 찾기 쉽게 돕는 정보 제공 서비스입니다. 장소 정보, 운영시간, 가격, 주차, 안전 관련 정보는 수집 시점의 공개 출처와 사용자 기록을 바탕으로 제공되며, 방문 전 공식 채널에서 최신 정보를 확인해야 합니다.
계정과 로그인
사용자는 소셜 로그인으로 계정을 만들고 저장 장소, 방문 기록, 내 정보 기능을 이용할 수 있습니다.
사용자는 본인 계정을 안전하게 관리해야 하며, 계정이 무단 사용된 것으로 의심되면 운영자에게 알려야 합니다.
AiGo는 비정상 이용, 보안 위험, 약관 위반이 확인된 계정의 일부 기능을 제한할 수 있습니다.
사용자 콘텐츠
사용자가 등록한 방문 리뷰, 방문 사진, 장소 이용 팁은 사용자가 공개로 설정한 경우 다른 사용자에게 표시될 수 있습니다. 사용자는 본인이 작성하거나 게시할 권리가 있는 콘텐츠만 등록해야 하며, 타인의 개인정보, 초상, 저작물, 명예를 침해하는 내용을 게시해서는 안 됩니다.
금지 행위
허위 정보, 광고, 스팸, 악성 코드, 자동화된 과도한 요청을 등록하거나 전송하는 행위
타인의 개인정보, 위치정보, 사진, 리뷰를 무단으로 수집하거나 공개하는 행위
서비스나 장소 데이터베이스를 무단 복제, 대량 추출, 재판매하는 행위
타인의 권리 또는 서비스 운영을 침해하는 행위
신고와 삭제
AiGo는 권리 침해, 개인정보 노출, 부적절한 콘텐츠 신고를 받으면 내용을 확인하고 필요한 경우 게시물을 숨기거나 삭제할 수 있습니다. 사용자는 본인이 등록한 방문 기록, 사진, 장소 팁을 앱에서 직접 수정하거나 삭제할 수 있습니다.
책임 제한
AiGo는 정확한 정보를 제공하기 위해 노력하지만 모든 장소 정보의 완전성, 최신성, 방문 가능성을 보장하지 않습니다. 사용자는 아이의 연령, 건강 상태, 날씨, 교통, 현장 안전 상황을 고려해 최종 방문 여부를 결정해야 합니다.
약관 변경
이 약관이 변경되는 경우 서비스 화면에 변경 내용을 게시합니다. 중요한 변경이 있는 경우 적용 전에 충분한 기간을 두고 안내하며, 필요한 경우 다시 동의를 받을 수 있습니다.$terms$,
  '276b09bce3bf35eb520e08bf1764ec2ac77909c6305a170f652f956a09e39b70',
  'active'
),
(
  'location_terms',
  'location-terms-2026-06-03',
  '위치기반서비스 이용약관',
  '/location-terms',
  '2026-06-03',
  $location$이 약관은 AiGo가 사용자의 현재 위치 또는 저장한 집 위치를 이용해 장소 검색, 거리 표시, 지도 기반 탐색 기능을 제공하는 조건을 정합니다.
제공하는 위치기반서비스
현재 위치 또는 사용자가 선택한 위치를 기준으로 가까운 아이 동반 장소를 검색합니다.
지도 화면에서 보이는 영역을 기준으로 장소 목록을 다시 검색합니다.
사용자가 저장한 집 위치를 기준으로 거리, 추천 순서, 검색 조건을 보조합니다.
위치정보 이용 방식
현재 위치는 사용자가 브라우저 권한을 허용하고 위치 기능을 사용할 때만 사용됩니다. 현재 위치는 검색 기준점과 거리 계산에 사용되며, 사용자가 직접 집 위치로 저장하지 않는 한 계정의 집 위치로 저장하지 않습니다.
집 위치 저장과 삭제
사용자가 내 정보 화면에서 집 위치를 저장하면 좌표와 주소 메모가 계정에 저장됩니다. 저장된 집 위치는 검색 편의를 위한 기본 기준점으로 사용되며, 사용자는 언제든지 내 정보 화면에서 수정하거나 삭제할 수 있습니다.
외부 지도 서비스
AiGo는 지도 화면 표시를 위해 OpenStreetMap 타일 등 외부 지도 서비스를 사용할 수 있습니다. 지도 타일 제공자는 지도 표시 과정에서 브라우저 요청 정보를 처리할 수 있습니다.
서비스 한계
위치정보, 거리, 지도 표시, 경로 판단은 기기와 네트워크 상태, 지도 데이터, 장소 데이터의 최신성에 따라 오차가 있을 수 있습니다. 실제 방문 가능 여부와 안전성은 현장 상황과 공식 안내를 함께 확인해야 합니다.
약관 변경
이 약관이 변경되는 경우 서비스 화면에 변경 내용을 게시합니다. 중요한 변경이 있는 경우 적용 전에 충분한 기간을 두고 안내하며, 필요한 경우 다시 동의를 받을 수 있습니다.$location$,
  'fcb0d68c9188b3ad8edee1da5f7a1810e2affca69f58442c9c52a8bdb79e45e9',
  'active'
)
on conflict (consent_type, version) do nothing;

update user_consents
set
  document_id = consent_documents.id,
  document_body_sha256 = consent_documents.body_sha256
from consent_documents
where user_consents.consent_type = consent_documents.consent_type
  and user_consents.version = consent_documents.version
  and user_consents.document_id is null;
