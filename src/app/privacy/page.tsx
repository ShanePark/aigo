import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { AppPageHeader } from "@/app/page-shell";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | AiGo",
  description: "AiGo 개인정보 처리방침"
};

const effectiveDate = "2026년 6월 3일";

export default function PrivacyPage() {
  return (
    <div className="page app-page legal-page">
      <AppPageHeader
        eyebrow={`시행일 ${effectiveDate}`}
        icon={ShieldCheck}
        title="개인정보 처리방침"
      />

      <section className="legal-section">
        <p>
          AiGo는 아이 동반 장소 검색, 저장, 방문 기록, 장소 팁 기능을 제공하기 위해 필요한 최소한의 개인정보를 처리합니다. 처리하는 개인정보는
          서비스 제공, 보안, 오류 대응, 품질 개선 목적 안에서만 사용합니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-items">
        <h2 id="privacy-items">처리하는 개인정보</h2>
        <div className="legal-table" role="table" aria-label="개인정보 항목과 이용 목적">
          <div role="row">
            <strong role="cell">계정</strong>
            <span role="cell">카카오 계정 식별자, 이메일, 표시 이름, 로그인 세션 정보</span>
          </div>
          <div role="row">
            <strong role="cell">가족 기본값</strong>
            <span role="cell">아이 생년월, 성별, 선택 입력한 이름 또는 별명</span>
          </div>
          <div role="row">
            <strong role="cell">위치</strong>
            <span role="cell">브라우저가 제공한 현재 위치, 사용자가 저장한 집 위치 좌표와 주소 메모</span>
          </div>
          <div role="row">
            <strong role="cell">이용 기록</strong>
            <span role="cell">검색 조건, 장소 상세 조회, 찜/하트, 최근 본 장소, IP 주소, User-Agent 분석 정보</span>
          </div>
          <div role="row">
            <strong role="cell">사용자 콘텐츠</strong>
            <span role="cell">방문일, 별점, 리뷰, 공개 여부, 방문 사진과 사진 메타데이터, 장소 이용 팁</span>
          </div>
          <div role="row">
            <strong role="cell">분석 도구</strong>
            <span role="cell">Google Analytics를 통해 수집되는 페이지 방문 및 기기/브라우저 관련 정보</span>
          </div>
        </div>
      </section>

      <section className="legal-section" aria-labelledby="privacy-purpose">
        <h2 id="privacy-purpose">이용 목적</h2>
        <ul>
          <li>로그인, 세션 유지, 본인 계정의 저장 장소와 방문 기록 제공</li>
          <li>아이 연령, 집 위치, 현재 위치, 검색 조건에 맞는 장소 검색과 거리 표시 제공</li>
          <li>방문 리뷰, 사진, 장소 팁의 등록, 수정, 삭제, 공개/비공개 처리</li>
          <li>오류 조사, 보안 이벤트 대응, 비정상 이용 방지, 서비스 품질 개선</li>
          <li>익명 또는 집계된 통계 분석을 통한 검색 품질과 화면 개선</li>
        </ul>
      </section>

      <section className="legal-section" aria-labelledby="privacy-location">
        <h2 id="privacy-location">위치정보 처리</h2>
        <p>
          현재 위치는 사용자가 브라우저 권한을 허용하고 위치 버튼이나 자동 위치 검색 기능을 사용할 때만 사용됩니다. 현재 위치는 검색 기준점과 거리
          계산에 사용되며, 사용자가 집 위치로 저장하지 않는 한 계정의 집 위치로 저장하지 않습니다. 집 위치를 저장한 경우 사용자는 내 정보 화면에서
          언제든지 삭제할 수 있습니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-public-content">
        <h2 id="privacy-public-content">공개 콘텐츠</h2>
        <p>
          사용자가 공개로 설정한 방문 리뷰, 방문 사진, 장소 이용 팁은 다른 이용자에게 표시될 수 있습니다. 비공개로 설정한 방문 기록과 사진은 본인
          계정에서만 볼 수 있도록 처리합니다. 공개 콘텐츠에 개인정보, 타인의 얼굴, 차량번호, 상세 주소 등 민감한 정보가 포함되지 않도록 주의해
          주세요.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-retention">
        <h2 id="privacy-retention">보유 및 파기</h2>
        <ul>
          <li>계정 정보와 사용자 설정은 계정 이용 기간 동안 보관합니다.</li>
          <li>로그인 세션은 만료되거나 로그아웃하면 삭제 또는 무효화합니다.</li>
          <li>사용자가 삭제한 방문 기록, 사진, 장소 팁은 서비스 제공에 필요한 범위에서 삭제합니다.</li>
          <li>보안, 오류 조사, 서비스 품질 개선을 위한 이용 로그는 목적 달성 후 지체 없이 파기하거나 식별성을 낮춘 형태로 처리합니다.</li>
          <li>법령상 보존 의무가 있는 정보는 해당 법령에서 정한 기간 동안 분리 보관할 수 있습니다.</li>
        </ul>
      </section>

      <section className="legal-section" aria-labelledby="privacy-third-party">
        <h2 id="privacy-third-party">제3자 제공 및 외부 서비스</h2>
        <p>
          AiGo는 법령에 근거가 있거나 사용자의 동의가 있는 경우를 제외하고 개인정보를 제3자에게 판매하거나 임의로 제공하지 않습니다. 다만 서비스
          제공을 위해 다음 외부 서비스를 사용할 수 있습니다.
        </p>
        <ul>
          <li>카카오: 소셜 로그인과 계정 식별</li>
          <li>Google Analytics: 방문 통계와 서비스 품질 분석</li>
          <li>OpenStreetMap 타일 서비스: 지도 화면 표시</li>
        </ul>
      </section>

      <section className="legal-section" aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">이용자의 권리</h2>
        <p>
          이용자는 본인의 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다. 앱에서 직접 수정하거나 삭제할 수 있는 정보는 내 정보, 방문 기록,
          방문 사진, 장소 이용 팁 화면에서 처리할 수 있습니다. 앱에서 직접 처리하기 어려운 요청은 서비스 운영자에게 문의해 주세요.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-safety">
        <h2 id="privacy-safety">안전성 확보 조치</h2>
        <ul>
          <li>로그인 세션 토큰은 원문이 아니라 해시값으로 저장합니다.</li>
          <li>권한이 필요한 API는 로그인 세션 또는 관리자 권한을 확인합니다.</li>
          <li>방문 사진은 파일 형식과 크기를 검증하고, 비공개 사진은 소유자만 접근할 수 있도록 제한합니다.</li>
          <li>개인정보 접근 권한은 서비스 운영에 필요한 범위로 제한합니다.</li>
        </ul>
      </section>

      <section className="legal-section" aria-labelledby="privacy-contact">
        <h2 id="privacy-contact">문의</h2>
        <p>
          개인정보와 관련한 문의, 신고, 삭제 요청은 AiGo 서비스 운영자에게 전달해 주세요. 요청을 받으면 본인 여부와 요청 내용을 확인한 뒤 필요한
          조치를 안내합니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="privacy-changes">
        <h2 id="privacy-changes">변경 고지</h2>
        <p>
          이 처리방침이 변경되는 경우 서비스 화면에 변경 내용을 게시합니다. 중요한 변경이 있는 경우 적용 전에 충분한 기간을 두고 안내합니다.
        </p>
      </section>
    </div>
  );
}
