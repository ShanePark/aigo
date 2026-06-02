import type { Metadata } from "next";
import { LocateFixed } from "lucide-react";

import { AppPageHeader } from "@/app/page-shell";

export const metadata: Metadata = {
  title: "위치기반서비스 이용약관 | AiGo",
  description: "AiGo 위치기반서비스 이용약관"
};

const effectiveDate = "2026년 6월 3일";

export default function LocationTermsPage() {
  return (
    <div className="page app-page legal-page">
      <AppPageHeader eyebrow={`시행일 ${effectiveDate}`} icon={LocateFixed} title="위치기반서비스 이용약관" />

      <section className="legal-section">
        <p>
          이 약관은 AiGo가 사용자의 현재 위치 또는 저장한 집 위치를 이용해 장소 검색, 거리 표시, 지도 기반 탐색 기능을 제공하는 조건을 정합니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="location-service">
        <h2 id="location-service">제공하는 위치기반서비스</h2>
        <ul>
          <li>현재 위치 또는 사용자가 선택한 위치를 기준으로 가까운 아이 동반 장소를 검색합니다.</li>
          <li>지도 화면에서 보이는 영역을 기준으로 장소 목록을 다시 검색합니다.</li>
          <li>사용자가 저장한 집 위치를 기준으로 거리, 추천 순서, 검색 조건을 보조합니다.</li>
        </ul>
      </section>

      <section className="legal-section" aria-labelledby="location-collection">
        <h2 id="location-collection">위치정보 이용 방식</h2>
        <p>
          현재 위치는 사용자가 브라우저 권한을 허용하고 위치 기능을 사용할 때만 사용됩니다. 현재 위치는 검색 기준점과 거리 계산에 사용되며, 사용자가
          직접 집 위치로 저장하지 않는 한 계정의 집 위치로 저장하지 않습니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="location-storage">
        <h2 id="location-storage">집 위치 저장과 삭제</h2>
        <p>
          사용자가 내 정보 화면에서 집 위치를 저장하면 좌표와 주소 메모가 계정에 저장됩니다. 저장된 집 위치는 검색 편의를 위한 기본 기준점으로
          사용되며, 사용자는 언제든지 내 정보 화면에서 수정하거나 삭제할 수 있습니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="location-third-party">
        <h2 id="location-third-party">외부 지도 서비스</h2>
        <p>
          AiGo는 지도 화면 표시를 위해 OpenStreetMap 타일 등 외부 지도 서비스를 사용할 수 있습니다. 지도 타일 제공자는 지도 표시 과정에서 브라우저
          요청 정보를 처리할 수 있습니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="location-limits">
        <h2 id="location-limits">서비스 한계</h2>
        <p>
          위치정보, 거리, 지도 표시, 경로 판단은 기기와 네트워크 상태, 지도 데이터, 장소 데이터의 최신성에 따라 오차가 있을 수 있습니다. 실제 방문
          가능 여부와 안전성은 현장 상황과 공식 안내를 함께 확인해야 합니다.
        </p>
      </section>

      <section className="legal-section" aria-labelledby="location-changes">
        <h2 id="location-changes">약관 변경</h2>
        <p>
          이 약관이 변경되는 경우 서비스 화면에 변경 내용을 게시합니다. 중요한 변경이 있는 경우 적용 전에 충분한 기간을 두고 안내하며, 필요한 경우
          다시 동의를 받을 수 있습니다.
        </p>
      </section>
    </div>
  );
}
