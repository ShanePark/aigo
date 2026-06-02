import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { AppPageHeader } from "@/app/page-shell";

export const metadata: Metadata = {
  title: "이용약관 | AiGo",
  description: "AiGo 이용약관"
};

const effectiveDate = "2026년 6월 3일";

export default function TermsPage() {
  return (
    <div className="page app-page legal-page">
      <AppPageHeader eyebrow={`시행일 ${effectiveDate}`} icon={FileText} title="이용약관" />

      <section className="legal-section">
        <p>
          이 약관은 AiGo가 제공하는 아이 동반 장소 검색, 저장, 방문 기록, 장소 팁 서비스의 이용 조건과 운영 기준을 정합니다. AiGo를 이용하는
          사용자는 이 약관에 동의한 것으로 봅니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-service">
        <h2 id="terms-service">서비스 성격</h2>
        <p>
          AiGo는 가족 나들이 장소를 찾기 쉽게 돕는 정보 제공 서비스입니다. 장소 정보, 운영시간, 가격, 주차, 안전 관련 정보는 수집 시점의 공개
          출처와 사용자 기록을 바탕으로 제공되며, 방문 전 공식 채널에서 최신 정보를 확인해야 합니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-account">
        <h2 id="terms-account">계정과 로그인</h2>
        <ul>
          <li>사용자는 소셜 로그인으로 계정을 만들고 저장 장소, 방문 기록, 내 정보 기능을 이용할 수 있습니다.</li>
          <li>사용자는 본인 계정을 안전하게 관리해야 하며, 계정이 무단 사용된 것으로 의심되면 운영자에게 알려야 합니다.</li>
          <li>AiGo는 비정상 이용, 보안 위험, 약관 위반이 확인된 계정의 일부 기능을 제한할 수 있습니다.</li>
        </ul>
      </section>

      <section className="legal-section" aria-labelledby="terms-content">
        <h2 id="terms-content">사용자 콘텐츠</h2>
        <p>
          사용자가 등록한 방문 리뷰, 방문 사진, 장소 이용 팁은 사용자가 공개로 설정한 경우 다른 사용자에게 표시될 수 있습니다. 사용자는 본인이
          작성하거나 게시할 권리가 있는 콘텐츠만 등록해야 하며, 타인의 개인정보, 초상, 저작물, 명예를 침해하는 내용을 게시해서는 안 됩니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-restrictions">
        <h2 id="terms-restrictions">금지 행위</h2>
        <ul>
          <li>허위 정보, 광고, 스팸, 악성 코드, 자동화된 과도한 요청을 등록하거나 전송하는 행위</li>
          <li>타인의 개인정보, 위치정보, 사진, 리뷰를 무단으로 수집하거나 공개하는 행위</li>
          <li>서비스나 장소 데이터베이스를 무단 복제, 대량 추출, 재판매하는 행위</li>
          <li>타인의 권리 또는 서비스 운영을 침해하는 행위</li>
        </ul>
      </section>

      <section className="legal-section" aria-labelledby="terms-removal">
        <h2 id="terms-removal">신고와 삭제</h2>
        <p>
          AiGo는 권리 침해, 개인정보 노출, 부적절한 콘텐츠 신고를 받으면 내용을 확인하고 필요한 경우 게시물을 숨기거나 삭제할 수 있습니다. 사용자는
          본인이 등록한 방문 기록, 사진, 장소 팁을 앱에서 직접 수정하거나 삭제할 수 있습니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-liability">
        <h2 id="terms-liability">책임 제한</h2>
        <p>
          AiGo는 정확한 정보를 제공하기 위해 노력하지만 모든 장소 정보의 완전성, 최신성, 방문 가능성을 보장하지 않습니다. 사용자는 아이의 연령,
          건강 상태, 날씨, 교통, 현장 안전 상황을 고려해 최종 방문 여부를 결정해야 합니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="terms-changes">
        <h2 id="terms-changes">약관 변경</h2>
        <p>
          이 약관이 변경되는 경우 서비스 화면에 변경 내용을 게시합니다. 중요한 변경이 있는 경우 적용 전에 충분한 기간을 두고 안내하며, 필요한 경우
          다시 동의를 받을 수 있습니다.
        </p>
      </section>
    </div>
  );
}
