import { describe, expect, it } from "vitest";

import { buildNaverMapLink, buildPlaceInfoLinks } from "@/lib/place-links";

describe("place info links", () => {
  it("prefers direct parent-facing links before source fallbacks", () => {
    const links = buildPlaceInfoLinks({
      name: "대전 어린이 시설",
      address: "대전광역시 중구",
      roadAddress: null,
      contact: {
        officialUrl: "https://example.go.kr/place",
        reservationUrl: "https://example.go.kr/reserve",
        kakaoPlaceUrl: "https://place.map.kakao.com/123"
      },
      externalRefs: {
        infoLinks: [
          {
            provider: "관광 정보",
            label: "시설 안내",
            url: "https://tour.example.go.kr/place",
            note: "공공 관광 안내 페이지"
          }
        ]
      },
      sources: [
        {
          sourceType: "public_listing",
          title: "공개 목록",
          url: "https://listing.example.com/place",
          summary: "주소와 운영 정보를 확인한 공개 목록입니다."
        }
      ]
    });

    expect(links.map((link) => link.label)).toEqual(["공식 정보", "예약/이용 안내", "시설 안내", "지도/길찾기", "공개 목록"]);
  });

  it("falls back to source URLs and finally public search", () => {
    const sourceLinks = buildPlaceInfoLinks({
      name: "대전 공공 놀이터",
      address: "대전광역시 동구",
      roadAddress: null,
      contact: { officialUrl: null, reservationUrl: null, kakaoPlaceUrl: null },
      externalRefs: {},
      sources: [
        {
          sourceType: "public_agency",
          title: "공공시설 안내",
          url: "https://agency.example.go.kr/playground",
          summary: "공공시설 안내 페이지입니다."
        }
      ]
    });
    const searchFallback = buildPlaceInfoLinks({
      name: "외부 URL 없는 장소",
      address: "대전광역시 중구",
      roadAddress: null,
      contact: { officialUrl: null, reservationUrl: null, kakaoPlaceUrl: null },
      externalRefs: {},
      sources: [{ sourceType: "user_observation", title: null, url: null, summary: "사용자 관찰만 있는 장소입니다." }]
    });

    expect(sourceLinks).toMatchObject([{ label: "공공시설 안내", provider: "agency.example.go.kr" }]);
    expect(searchFallback).toMatchObject([{ label: "공개 검색", provider: "네이버" }]);
    expect(searchFallback[0].url).toContain(encodeURIComponent("외부 URL 없는 장소 대전광역시 중구"));
  });

  it("selects a direct Naver map link for the primary detail CTA", () => {
    const link = buildNaverMapLink({
      name: "토이빌리지",
      address: "대전광역시 중구",
      roadAddress: null,
      contact: {
        officialUrl: "https://example.go.kr/place",
        reservationUrl: null,
        kakaoPlaceUrl: "https://place.map.kakao.com/123"
      },
      externalRefs: {
        infoLinks: [{ provider: "네이버", label: "네이버 플레이스", url: "https://pcmap.place.naver.com/place/123" }]
      },
      sources: [{ sourceType: "public_listing", title: "목록", url: "https://example.com/listing", summary: null }]
    });

    expect(link).toMatchObject({
      label: "네이버 플레이스",
      provider: "네이버",
      url: "https://pcmap.place.naver.com/place/123"
    });
  });

  it("falls back to a Naver map name search CTA when no direct map URL exists", () => {
    const link = buildNaverMapLink({
      name: "외부 URL 없는 장소",
      address: "대전광역시 중구",
      roadAddress: null,
      contact: { officialUrl: null, reservationUrl: null, kakaoPlaceUrl: null },
      externalRefs: {},
      sources: [{ sourceType: "user_observation", title: null, url: null, summary: "사용자 관찰만 있는 장소입니다." }]
    });

    expect(link).toMatchObject({
      label: "네이버 지도 검색",
      provider: "네이버",
      url: `https://map.naver.com/p/search/${encodeURIComponent("외부 URL 없는 장소")}`
    });
  });
});
