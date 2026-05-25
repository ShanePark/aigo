type PlaceLinkContact = {
  officialUrl: string | null;
  reservationUrl: string | null;
  kakaoPlaceUrl: string | null;
};

type PlaceLinkSource = {
  sourceType: string;
  title: string | null;
  url: string | null;
  summary: string | null;
};

export type PlaceLinkInput = {
  name: string;
  address: string | null;
  roadAddress: string | null;
  contact: PlaceLinkContact;
  externalRefs: unknown;
  sources: PlaceLinkSource[];
};

export type PlaceInfoLink = {
  key: string;
  label: string;
  note?: string;
  provider: string;
  url: string;
};

type RankedPlaceInfoLink = PlaceInfoLink & { rank: number };

export function buildPlaceInfoLinks(place: PlaceLinkInput) {
  const links = [
    ...infoLinksFromContact(place.contact),
    ...infoLinksFromExternalRefs(place.externalRefs),
    ...infoLinksFromSources(place.sources)
  ];
  const deduped = new Map<string, RankedPlaceInfoLink>();

  for (const link of links) {
    const key = normalizeLinkKey(link.url);
    if (!key) continue;
    const existing = deduped.get(key);
    if (!existing || link.rank < existing.rank) deduped.set(key, { ...link, key });
  }

  if (deduped.size === 0) {
    const fallback = infoLinkFromPublicSearch(place);
    deduped.set(normalizeLinkKey(fallback.url), fallback);
  }

  return Array.from(deduped.values())
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .map(stripRank);
}

export function buildNaverMapLink(place: PlaceLinkInput): PlaceInfoLink | undefined {
  const links = [
    ...infoLinksFromContact(place.contact),
    ...infoLinksFromExternalRefs(place.externalRefs),
    ...naverMapLinksFromExternalRefs(place.externalRefs),
    ...infoLinksFromSources(place.sources)
  ].filter((link) => isNaverMapUrl(link.url));
  const deduped = new Map<string, RankedPlaceInfoLink>();

  for (const link of links) {
    const key = normalizeLinkKey(link.url);
    if (!key) continue;
    const existing = deduped.get(key);
    if (!existing || link.rank < existing.rank) deduped.set(key, { ...link, key });
  }

  const [best] = Array.from(deduped.values()).sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
  if (best) return stripRank(best);
  return naverMapSearchLink(place);
}

function stripRank(link: RankedPlaceInfoLink): PlaceInfoLink {
  return {
    key: link.key,
    label: link.label,
    note: link.note,
    provider: link.provider,
    url: link.url
  };
}

function infoLinkFromPublicSearch(place: PlaceLinkInput): RankedPlaceInfoLink {
  const query = [place.name, place.roadAddress ?? place.address].filter(Boolean).join(" ");
  const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
  return {
    key: url,
    label: "공개 검색",
    note: "공식/출처 URL이 없을 때 부모가 공개 정보를 확인할 수 있는 검색 링크입니다.",
    provider: "네이버",
    rank: 9,
    url
  };
}

function naverMapSearchLink(place: PlaceLinkInput): PlaceInfoLink | undefined {
  const query = stringValue(place.name);
  if (!query) return undefined;
  const url = `https://map.naver.com/p/search/${encodeURIComponent(query)}`;

  return {
    key: normalizeLinkKey(url),
    label: "네이버 지도 검색",
    note: "직접 장소 링크가 없을 때 장소명으로 네이버 지도에서 검색합니다.",
    provider: "네이버",
    url
  };
}

function infoLinksFromContact(contact: PlaceLinkContact): RankedPlaceInfoLink[] {
  const links: RankedPlaceInfoLink[] = [];

  if (contact.officialUrl) {
    links.push({
      key: contact.officialUrl,
      label: "공식 정보",
      note: "운영자가 직접 제공하는 장소 정보입니다.",
      provider: providerLabel(contact.officialUrl),
      rank: 0,
      url: contact.officialUrl
    });
  }
  if (contact.reservationUrl) {
    links.push({
      key: contact.reservationUrl,
      label: "예약/이용 안내",
      note: "예약, 회차, 이용 조건을 확인할 수 있습니다.",
      provider: providerLabel(contact.reservationUrl),
      rank: 1,
      url: contact.reservationUrl
    });
  }
  if (contact.kakaoPlaceUrl) {
    links.push({
      key: contact.kakaoPlaceUrl,
      label: "지도/길찾기",
      note: "지도 앱에서 위치와 이동 정보를 확인할 수 있습니다.",
      provider: providerLabel(contact.kakaoPlaceUrl),
      rank: 3,
      url: contact.kakaoPlaceUrl
    });
  }

  return links;
}

function infoLinksFromExternalRefs(externalRefs: unknown): RankedPlaceInfoLink[] {
  if (!isRecord(externalRefs) || !Array.isArray(externalRefs.infoLinks)) return [];

  return externalRefs.infoLinks.flatMap((item, index): RankedPlaceInfoLink[] => {
    if (typeof item === "string" && isHttpUrl(item)) {
      return [
        {
          key: item,
          label: providerLabel(item),
          provider: providerLabel(item),
          rank: 2,
          url: item
        }
      ];
    }

    if (!isRecord(item) || typeof item.url !== "string" || !isHttpUrl(item.url)) return [];
    const provider = stringValue(item.provider) ?? providerLabel(item.url);
    const label = stringValue(item.label) ?? stringValue(item.title) ?? provider;
    const note = stringValue(item.note) ?? stringValue(item.summary);

    return [{ key: `${item.url}-${index}`, label, note, provider, rank: 2, url: item.url }];
  });
}

function naverMapLinksFromExternalRefs(externalRefs: unknown): RankedPlaceInfoLink[] {
  if (!isRecord(externalRefs)) return [];
  const links: RankedPlaceInfoLink[] = [];
  const directKeys = ["naverMapUrl", "naverPlaceUrl", "naverUrl"];

  directKeys.forEach((key, index) => {
    const value = externalRefs[key];
    if (typeof value !== "string" || !isHttpUrl(value)) return;
    links.push({
      key: value,
      label: "네이버지도",
      note: "네이버 지도 장소 페이지입니다.",
      provider: "네이버",
      rank: 2 + index / 100,
      url: value
    });
  });

  for (const collectionKey of ["mapLinks", "reviewLinks"]) {
    const collection = externalRefs[collectionKey];
    if (!Array.isArray(collection)) continue;
    links.push(
      ...collection.flatMap((item, index): RankedPlaceInfoLink[] => {
        if (typeof item === "string" && isHttpUrl(item)) {
          return [{ key: item, label: providerLabel(item), provider: providerLabel(item), rank: 3 + index / 100, url: item }];
        }
        if (!isRecord(item) || typeof item.url !== "string" || !isHttpUrl(item.url)) return [];
        const provider = stringValue(item.provider) ?? providerLabel(item.url);
        const label = stringValue(item.label) ?? stringValue(item.title) ?? provider;
        const note = stringValue(item.note) ?? stringValue(item.summary);

        return [{ key: `${item.url}-${collectionKey}-${index}`, label, note, provider, rank: 3 + index / 100, url: item.url }];
      })
    );
  }

  return links;
}

function infoLinksFromSources(sources: PlaceLinkSource[]): RankedPlaceInfoLink[] {
  return sources.flatMap((source): RankedPlaceInfoLink[] => {
    if (!source.url) return [];
    const rank = sourceRank(source.sourceType);
    return [
      {
        key: source.url,
        label: source.title ?? sourceTypeLabel(source.sourceType),
        note: source.summary ?? undefined,
        provider: providerLabel(source.url),
        rank,
        url: source.url
      }
    ];
  });
}

function sourceRank(sourceType: string) {
  if (/official|operator/.test(sourceType)) return sourceType.includes("image_source") ? 6 : 2;
  if (/public_agency|public_tourism/.test(sourceType)) return 5;
  if (/listing|news|place|map|kakao|naver|google/.test(sourceType)) return 6;
  return 7;
}

function sourceTypeLabel(sourceType: string) {
  const labels: Record<string, string> = {
    official_site: "공식 정보",
    operator_page: "운영자 정보",
    public_agency: "공공기관 정보",
    public_tourism: "관광/공공 정보",
    public_listing: "공개 목록 정보",
    public_news: "공개 기사 정보",
    official_image_source: "공식 이미지 출처",
    public_listing_image_source: "공개 이미지 출처"
  };
  return labels[sourceType] ?? sourceType;
}

function providerLabel(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("naver")) return "네이버";
    if (hostname.includes("kakao")) return "카카오";
    if (hostname.includes("google")) return "Google";
    if (hostname.includes("daejeon")) return "대전 공공";
    if (hostname.includes("tour")) return "관광 정보";
    return hostname.replace(/^www\./, "");
  } catch {
    return "정보 링크";
  }
}

function normalizeLinkKey(value: string | null | undefined) {
  return value?.trim().replace(/\/$/, "").toLowerCase() ?? "";
}

function isNaverMapUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      hostname === "naver.me" ||
      hostname.endsWith(".naver.me") ||
      hostname === "map.naver.com" ||
      hostname.endsWith(".map.naver.com") ||
      hostname === "place.naver.com" ||
      hostname.endsWith(".place.naver.com")
    );
  } catch {
    return false;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
