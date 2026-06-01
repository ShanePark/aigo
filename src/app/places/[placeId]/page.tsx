import {
  ChevronDown,
  Clock,
  ExternalLink,
  History,
  Images,
  MapPin,
  MessageSquareText,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { PlaceImage } from "@/app/place-image";
import { PlaceCategoryBadge, placeCategoryLabel } from "@/app/place-category-badge";
import { BackToSearchLink } from "@/app/places/back-to-search-link";
import { PlaceDetailMap } from "@/app/places/place-detail-map";
import { PlacePublicMemoPanel } from "@/app/places/place-public-memo-panel";
import { safePlaceReturnHref } from "@/app/places/place-return-to";
import { PlaceScoreDialog } from "@/app/places/place-score-dialog";
import { PlaceSaveControls } from "@/app/places/place-save-controls";
import { PlaceVisitPanel } from "@/app/places/place-visit-panel";
import { PlaceViewRecorder } from "@/app/places/place-view-recorder";
import { buildNaverMapLink, buildPlaceInfoLinks } from "@/lib/place-links";
import { getPlaceDetail } from "@/lib/places";
import { pricingEvidenceLabel, pricingItemLabels, pricingNote, pricingSummaryLabel } from "@/lib/pricing";
import { describeReasonCodes } from "@/lib/reasons";
import { scorePlaceIntrinsic } from "@/lib/scoring";

export const dynamic = "force-dynamic";

type PlaceDetailProps = {
  params: Promise<{
    placeId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function relatedPlaceHref(placeId: string, backHref: Route): Route {
  return `/places/${placeId}?returnTo=${encodeURIComponent(backHref)}` as Route;
}

export default async function PlaceDetailPage({ params, searchParams }: PlaceDetailProps) {
  const { placeId } = await params;
  const query = await searchParams;
  const place = await loadPlace(placeId);
  const displaySources = uniqueDisplaySources(place.sources);
  const infoLinks = buildPlaceInfoLinks(place);
  const naverMapLink = buildNaverMapLink(place);
  const reviewLinks = buildReviewLinks(place);
  const priceLabel = pricingSummaryLabel(place.pricing);
  const priceEvidence = pricingEvidenceLabel(place.pricing);
  const priceItems = pricingItemLabels(place.pricing);
  const priceNote = pricingNote(place.pricing);
  const routeSupportChips = routeSupportSummaryChips(place.routeSupport);
  const routeSupportNotes = routeSupportNotesText(place.routeSupport);
  const heroImage = place.primaryImage;
  const galleryImages = place.images;
  const backHref = safePlaceReturnHref(query.returnTo) as Route;
  const primaryInfoLink = infoLinks[0];
  const familySignalChips = detailFamilySignalChips(place);
  const visitSignalChips = detailVisitSignalChips(place);
  const playFeatures = playFeatureEntries(place.playFeatures);
  const addressLabel = place.address ?? place.roadAddress;
  const placeQualityScore = scorePlaceIntrinsic({
    primaryCategory: place.primaryCategory,
    tags: place.tags,
    dataConfidence: place.dataConfidence,
    scoring: place.scoring,
    minRecommendedAgeMonths: place.recommendedAgeMonths.min,
    maxRecommendedAgeMonths: place.recommendedAgeMonths.max,
    indoorType: place.facilities.indoorType,
    parkingAvailable: place.facilities.parkingAvailable,
    strollerFriendly: place.facilities.strollerFriendly,
    nursingRoom: place.facilities.nursingRoom,
    diaperChangingTable: place.facilities.diaperChangingTable,
    kidsToilet: place.facilities.kidsToilet,
    elevator: place.facilities.elevator,
    babyChair: place.facilities.babyChair,
    foodAllowed: place.facilities.foodAllowed,
    visit: place.visit,
    taxonomy: place.taxonomy
  });
  const placeQualityReasons = describeReasonCodes(placeQualityScore.reasonCodes);

  return (
    <div className="page detail-page">
      <PlaceViewRecorder placeId={place.id} />
      <header className="detail-sticky-head">
        <div className="detail-header-actions">
          <PlaceSaveControls placeId={place.id} />
          <div className="detail-header-score">
            <PlaceScoreDialog
              breakdown={placeQualityScore.scoreBreakdown}
              rationale={place.scoring.placeScoreRationale}
              reasons={placeQualityReasons}
              score={placeQualityScore.score}
              storedPlaceScore={place.scoring.placeScore}
              updatedAt={place.scoring.scoreUpdatedAt}
            />
          </div>
        </div>

        <div className="detail-head">
          <div>
            <div className="detail-title-row">
              <BackToSearchLink href={backHref} />
              <h1>{place.name}</h1>
              <PlaceCategoryBadge category={place.primaryCategory} className="detail-category-badge" name={place.name} tags={place.tags} />
            </div>
            <div className="detail-head-meta" aria-label="장소 핵심 정보">
              {addressLabel ? (
                <span className="detail-head-address">
                  <MapPin size={14} aria-hidden="true" />
                  {addressLabel}
                </span>
              ) : null}
              {place.description ? <p className="detail-head-description">{place.description}</p> : null}
              {place.tags.length > 0 ? (
                <div className="detail-head-tags" aria-label="태그">
                  {place.tags.slice(0, 8).map((tag) => (
                    <span key={tag}>{tagLabel(tag)}</span>
                  ))}
                </div>
              ) : null}
              {familySignalChips.length > 0 ? (
                <div className="detail-head-signals" aria-label="아이 동반 신호">
                  {familySignalChips.slice(0, 8).map((chip) => (
                    <span className={`detail-feature-chip ${chip.tone}`} key={chip.label}>
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {naverMapLink || primaryInfoLink ? (
                <div className="detail-head-links" aria-label="외부 정보">
                  {naverMapLink ? (
                    <a href={naverMapLink.url} target="_blank" rel="noreferrer">
                      <MapPin size={14} aria-hidden="true" />
                      지도
                    </a>
                  ) : null}
                  {primaryInfoLink ? (
                    <a href={primaryInfoLink.url} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} aria-hidden="true" />
                      정보
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="detail-media-grid">
        <div className="detail-hero-media">
          <PlaceImage category={place.primaryCategory} src={heroImage?.url} alt={`${place.name} 대표 이미지`} variant="detail" />
          {heroImage?.sourceUrl ? (
            <p className="image-credit">
              이미지 {imageTierLabel(heroImage.displayTier)} 출처:{" "}
              <a href={heroImage.sourceUrl} target="_blank" rel="noreferrer">
                {heroImage.sourceTitle ?? heroImage.creditText}
              </a>
            </p>
          ) : null}
        </div>
        <PlaceDetailMap category={place.primaryCategory} lat={place.lat} lng={place.lng} name={place.name} />
      </section>

      <PlaceVisitPanel placeId={place.id} placeName={place.name} />
      <PlacePublicMemoPanel placeId={place.id} placeName={place.name} />

      {visitSignalChips.length > 0 ? (
        <section className="info-block full">
          <h2>
            <Clock size={18} aria-hidden="true" />
            방문 판단
          </h2>
          <div className="detail-signal-grid">
            {visitSignalChips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        </section>
      ) : null}

      {priceLabel || priceItems.length > 0 || priceNote ? (
        <section className="info-block full">
          <h2>
            <Ticket size={18} aria-hidden="true" />
            가격 정보
          </h2>
          <div className="detail-signal-grid">
            {priceLabel ? <span>{priceLabel}</span> : null}
            {!priceLabel && priceEvidence ? <span>{priceEvidence}</span> : null}
            {priceItems.slice(0, 4).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          {priceNote ? <p className="play-feature-note">{priceNote}</p> : null}
        </section>
      ) : null}

      {routeSupportChips.length > 0 || routeSupportNotes ? (
        <section className="info-block full">
          <h2>
            <MapPin size={18} aria-hidden="true" />
            이동 지원
          </h2>
          {routeSupportChips.length > 0 ? (
            <div className="detail-signal-grid">
              {routeSupportChips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          ) : null}
          {routeSupportNotes ? <p className="play-feature-note">{routeSupportNotes}</p> : null}
        </section>
      ) : null}

      {playFeatures.length > 0 ? (
        <section className="info-block full">
          <h2>놀이시설</h2>
          <div className="play-feature-grid detail-play-feature-grid">
            {playFeatures.map(([key, value]) => (
              <span className={`play-feature-chip ${playFeatureTone(value)}`} key={key}>
                {playFeatureChipLabel(key, value)}
              </span>
            ))}
          </div>
          {typeof place.playFeatures.notes === "string" && place.playFeatures.notes.trim().length > 0 ? (
            <p className="play-feature-note">{place.playFeatures.notes}</p>
          ) : null}
        </section>
      ) : null}

      {place.notes.safety || place.notes.parent ? (
        <section className="info-block full">
          <h2>
            <ShieldCheck size={18} aria-hidden="true" />
            메모
          </h2>
          <div className="note-list">
            {place.notes.safety ? (
              <div>
                <strong>안전</strong>
                <p>{place.notes.safety}</p>
              </div>
            ) : null}
            {place.notes.parent ? (
              <div>
                <strong>부모 관점</strong>
                <p>{place.notes.parent}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {place.relatedPlaces.length > 0 ? (
        <section className="info-block full">
          <h2>관련 장소</h2>
          <div className="related-place-grid">
            {place.relatedPlaces.map((relatedPlace) => (
              <Link className="related-place-card" href={relatedPlaceHref(relatedPlace.placeId, backHref)} key={relatedPlace.relationId}>
                <PlaceImage category={relatedPlace.primaryCategory} src={null} alt={`${relatedPlace.name} 이미지`} variant="result" />
                <div className="related-place-copy">
                  <span>{relationTypeLabel(relatedPlace.relationType)}</span>
                  <strong>{relatedPlace.name}</strong>
                  <small>
                    {placeCategoryLabel(relatedPlace.primaryCategory)}
                    {relatedPlace.distanceMeters !== null ? ` · ${metersLabel(relatedPlace.distanceMeters)}` : null}
                  </small>
                  {relatedPlace.note ? <p>{relatedPlace.note}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {galleryImages.length > 0 ? (
        <section className="image-gallery-section">
          <h2>
            <Images size={18} aria-hidden="true" />
            갤러리
          </h2>
          <div className="image-gallery-grid">
            {galleryImages.map((image) => (
              <article className="image-gallery-card" key={image.id}>
                <PlaceImage category={place.primaryCategory} src={image.url} alt={image.altText ?? `${place.name} 이미지`} variant="result" />
                <div className="image-gallery-copy">
                  {image.sourceUrl ? (
                    <a className="image-source-link" href={image.sourceUrl} target="_blank" rel="noreferrer">
                      {image.sourceTitle ?? image.creditText}
                    </a>
                  ) : null}
                  <details className="image-info-details">
                    <summary>이미지 정보 보기</summary>
                    <div className="visit-row">
                      {image.isPrimary ? <span>대표 이미지</span> : null}
                      <span>{imageTierLabel(image.displayTier)}</span>
                      <span>{imageReviewLabel(image.reviewStatus)}</span>
                    </div>
                    {image.description ? <p>{image.description}</p> : null}
                    {image.visualFeatures.length > 0 ? (
                      <div className="reason-grid">
                        {image.visualFeatures.slice(0, 10).map((feature) => (
                          <span key={feature}>{imageFeatureLabel(feature)}</span>
                        ))}
                      </div>
                    ) : null}
                  </details>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {infoLinks.length > 0 ? (
        <details className="info-block full detail-disclosure">
          <summary>
            <ExternalLink size={18} aria-hidden="true" />
            정보 확인하기
            <span>{infoLinks.length}개 링크</span>
            <ChevronDown className="detail-disclosure-icon" size={16} aria-hidden="true" />
          </summary>
          <div className="source-list">
            {infoLinks.map((infoLink) => (
              <a className="source-row" href={infoLink.url} target="_blank" rel="noreferrer" key={infoLink.key}>
                <span>{infoLink.provider}</span>
                <small>
                  <strong>{infoLink.label}</strong>
                  {infoLink.note ? ` - ${infoLink.note}` : null}
                </small>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        </details>
      ) : null}

      {reviewLinks.length > 0 ? (
        <details className="info-block full detail-disclosure">
          <summary>
            <MessageSquareText size={18} aria-hidden="true" />
            후기 살펴보기
            <span>{reviewLinks.length}개 링크</span>
            <ChevronDown className="detail-disclosure-icon" size={16} aria-hidden="true" />
          </summary>
          <div className="source-list">
            {reviewLinks.map((reviewLink) => (
              <a className="source-row review-link-row" href={reviewLink.url} target="_blank" rel="noreferrer" key={reviewLink.key}>
                <span>{reviewLink.provider}</span>
                <small>
                  <strong>{reviewLink.label}</strong>
                  {reviewLink.note ? ` - ${reviewLink.note}` : null}
                </small>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        </details>
      ) : null}

      <details className="info-block full detail-disclosure" id="detail-sources">
        <summary>
          출처
          <span>{displaySources.length}개 근거</span>
          <ChevronDown className="detail-disclosure-icon" size={16} aria-hidden="true" />
        </summary>
        <div className="source-list">
          {displaySources.map((source) =>
            source.url ? (
              <a key={source.key} className="source-row" href={source.url} target="_blank" rel="noreferrer">
                <span>
                  {source.title ?? source.sourceType}
                  {source.count > 1 ? <em> {source.count}회</em> : null}
                </span>
                <small>{source.summary ?? source.externalId ?? "요약 없음"}</small>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : (
              <div key={source.key} className="source-row source-row-static">
                <span>
                  {source.title ?? source.sourceType}
                  {source.count > 1 ? <em> {source.count}회</em> : null}
                </span>
                <small>{source.summary ?? "요약 없음"}</small>
                <small>{source.externalId ?? "외부 ID 없음"}</small>
              </div>
            )
          )}
          {place.sources.length === 0 ? <p>등록된 출처가 없습니다.</p> : null}
        </div>
      </details>

      <details className="info-block full detail-disclosure">
        <summary>
          <History size={18} aria-hidden="true" />
          변경 이력
          <span>{place.versions.length}개 기록</span>
          <ChevronDown className="detail-disclosure-icon" size={16} aria-hidden="true" />
        </summary>
        <div className="version-list">
          {place.versions.map((version) => (
            <div className="version-row" key={version.id}>
              <span>v{version.versionNumber}</span>
              <strong>{version.action}</strong>
              <small>{version.changeSummary ?? "변경 요약 없음"}</small>
              <time>{new Date(version.createdAt).toLocaleString("ko-KR")}</time>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

async function loadPlace(placeId: string) {
  try {
    return await getPlaceDetail(placeId);
  } catch {
    notFound();
  }
}

type PlaceDetail = Awaited<ReturnType<typeof getPlaceDetail>>;
type Source = PlaceDetail["sources"][number];
type DetailDecisionTone = "negative" | "neutral" | "partial" | "positive" | "unknown";
type DetailChip = {
  label: string;
  tone: DetailDecisionTone;
};

type ReviewLink = {
  key: string;
  label: string;
  note?: string;
  provider: string;
  url: string;
};

function detailFamilySignalChips(place: PlaceDetail) {
  return uniqueChips([recommendedAgeChip(place.recommendedAgeMonths), indoorChip(place.facilities.indoorType), ...knownAmenityChips(place.facilities)].filter(isDetailChip));
}

function detailVisitSignalChips(place: PlaceDetail) {
  return [
    place.visit.averageStayMinutes === null ? null : `체류 ${minutesLabel(place.visit.averageStayMinutes)}`,
    place.visit.parentEffortLevel === null ? null : `부모 피로도 ${scoreLabel(place.visit.parentEffortLevel)}`,
    place.visit.childEngagementLevel === null ? null : `아이 몰입도 ${scoreLabel(place.visit.childEngagementLevel)}`,
    place.visit.rainyDayScore === null ? null : `비 오는 날 ${scoreLabel(place.visit.rainyDayScore)}`,
    place.visit.hotDayScore === null ? null : `더운 날 ${scoreLabel(place.visit.hotDayScore)}`,
    place.visit.coldDayScore === null ? null : `추운 날 ${scoreLabel(place.visit.coldDayScore)}`
  ].filter(isString);
}

function recommendedAgeChip(value: PlaceDetail["recommendedAgeMonths"]): DetailChip | null {
  const label = recommendedAgeShortLabel(value);
  return label ? { label, tone: "neutral" } : null;
}

function indoorChip(value: string): DetailChip | null {
  if (value === "unknown") return null;
  return { label: indoorLabel(value), tone: "neutral" };
}

function knownAmenityChips(facilities: PlaceDetail["facilities"]) {
  return [
    triStateFeatureChip("주차", facilities.parkingAvailable),
    triStateFeatureChip("유모차", facilities.strollerFriendly),
    triStateFeatureChip("수유실", facilities.nursingRoom),
    triStateFeatureChip("기저귀갈이대", facilities.diaperChangingTable),
    triStateFeatureChip("어린이화장실", facilities.kidsToilet),
    triStateFeatureChip("엘리베이터", facilities.elevator),
    triStateFeatureChip("아기의자", facilities.babyChair),
    triStateFeatureChip("간식 가능", facilities.foodAllowed)
  ].filter(isDetailChip);
}

function triStateFeatureChip(label: string, value: string): DetailChip | null {
  if (value === "yes") return { label, tone: "positive" };
  if (value === "partial") return { label: `${label} 일부`, tone: "partial" };
  return null;
}

function isDetailChip(value: DetailChip | null | undefined): value is DetailChip {
  return Boolean(value);
}

function isString(value: string | null): value is string {
  return typeof value === "string";
}

function uniqueChips(chips: DetailChip[]) {
  const seen = new Set<string>();
  return chips.filter((chip) => {
    if (seen.has(chip.label)) return false;
    seen.add(chip.label);
    return true;
  });
}

function recommendedAgeShortLabel(value: PlaceDetail["recommendedAgeMonths"]) {
  if (value.min === null && value.max === null) return null;
  if (value.min === null) return `${value.max}개월 이하`;
  if (value.max === null) return `${value.min}개월 이상`;
  return `${value.min}-${value.max}개월`;
}

function uniqueDisplaySources(sources: Source[]) {
  const grouped = new Map<string, Source & { key: string; count: number }>();

  for (const source of sources) {
    const key = [normalizeSourceValue(source.url), normalizeSourceValue(source.externalId), normalizeSourceValue(source.title)].join("|");
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.summary && source.summary) existing.summary = source.summary;
      continue;
    }
    grouped.set(key, { ...source, key, count: 1 });
  }

  return Array.from(grouped.values());
}

function buildReviewLinks(place: PlaceDetail) {
  const links = [...reviewLinksFromExternalRefs(place.externalRefs), ...reviewLinksFromSources(place.sources)];
  const deduped = new Map<string, ReviewLink>();

  for (const link of links) {
    const key = normalizeSourceValue(link.url);
    if (!key || deduped.has(key)) continue;
    deduped.set(key, { ...link, key });
  }

  return Array.from(deduped.values());
}

function reviewLinksFromExternalRefs(externalRefs: PlaceDetail["externalRefs"]) {
  if (!isRecord(externalRefs) || !Array.isArray(externalRefs.reviewLinks)) return [];

  return externalRefs.reviewLinks.flatMap((item, index): ReviewLink[] => {
    if (typeof item === "string" && isHttpUrl(item)) {
      return [
        {
          key: item,
          label: reviewProviderLabel(item),
          provider: reviewProviderLabel(item),
          url: item
        }
      ];
    }

    if (!isRecord(item) || typeof item.url !== "string" || !isHttpUrl(item.url)) return [];
    const provider = stringValue(item.provider) ?? reviewProviderLabel(item.url);
    const label = stringValue(item.label) ?? stringValue(item.title) ?? provider;
    const note = stringValue(item.note) ?? stringValue(item.summary);

    return [{ key: `${item.url}-${index}`, label, note, provider, url: item.url }];
  });
}

function reviewLinksFromSources(sources: Source[]) {
  return sources.flatMap((source): ReviewLink[] => {
    if (!source.url || !isReviewSource(source)) return [];
    const provider = source.title ?? reviewProviderLabel(source.url);

    return [
      {
        key: source.url,
        label: provider,
        note: source.summary ?? undefined,
        provider: reviewProviderLabel(source.url),
        url: source.url
      }
    ];
  });
}

function isReviewSource(source: Source) {
  const searchable = [source.sourceType, source.title, source.summary, source.url].filter(Boolean).join(" ").toLocaleLowerCase("ko-KR");
  return /review|리뷰|후기|blog|블로그|listing|place|naver|kakao|google|tripadvisor|booking|agoda|yanolja|yeogi/.test(searchable);
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

function reviewProviderLabel(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("blog.naver")) return "네이버 블로그";
    if (hostname.includes("naver")) return "네이버";
    if (hostname.includes("kakao")) return "카카오";
    if (hostname.includes("google")) return "Google";
    if (hostname.includes("tripadvisor")) return "Tripadvisor";
    if (hostname.includes("booking")) return "Booking";
    if (hostname.includes("agoda")) return "Agoda";
    if (hostname.includes("yanolja")) return "야놀자";
    if (hostname.includes("yeogi")) return "여기어때";
    return hostname.replace(/^www\./, "");
  } catch {
    return "후기 링크";
  }
}

function normalizeSourceValue(value: string | null | undefined) {
  return value?.trim().replace(/\/$/, "").toLowerCase() ?? "";
}

function indoorLabel(value: string) {
  const labels: Record<string, string> = {
    indoor: "실내",
    outdoor: "실외",
    mixed: "혼합",
    unknown: "미확인"
  };
  return labels[value] ?? value;
}

function triStateLabel(value: string) {
  const labels: Record<string, string> = {
    yes: "있음",
    partial: "일부",
    no: "없음",
    unknown: "미확인"
  };
  return labels[value] ?? value;
}

function routeSupportSummaryChips(routeSupport: Record<string, unknown>) {
  if (!isRecord(routeSupport)) return [];

  const chips: string[] = [];
  const terminalType = stringValue(routeSupport.terminalType);
  const role = stringValue(routeSupport.routeSupportRole);
  const accessArea = stringValue(routeSupport.accessArea);
  if (terminalType) chips.push(routeSupportTerminalTypeLabel(terminalType));
  if (role) chips.push(routeSupportRoleLabel(role));
  if (accessArea && accessArea !== "unknown") chips.push(`동선 ${routeSupportAccessAreaLabel(accessArea)}`);

  const babyCareLocations = Array.isArray(routeSupport.babyCareLocations) ? routeSupport.babyCareLocations.filter(isRecord) : [];
  for (const location of babyCareLocations.slice(0, 3)) {
    const label = stringValue(location.label);
    if (!label) continue;
    const position = [stringValue(location.floor), routeSupportAccessAreaLabel(stringValue(location.area)), stringValue(location.gate)].filter(Boolean).join(" · ");
    const signals = [
      routeSupportTriStateSignal("수유", stringValue(location.nursingRoom)),
      routeSupportTriStateSignal("기저귀갈이대", stringValue(location.diaperChangingTable)),
      routeSupportTriStateSignal("유모차", stringValue(location.strollerFriendly))
    ]
      .filter(Boolean)
      .join("/");
    chips.push(`${label}${position ? ` (${position})` : ""}${signals ? ` · ${signals}` : ""}`);
  }

  if (isRecord(routeSupport.strollerRental)) {
    const available = stringValue(routeSupport.strollerRental.available);
    if (available && available !== "unknown") chips.push(`유모차 대여 ${triStateLabel(available)}`);
  }

  if (isRecord(routeSupport.prioritySupport)) {
    const securityFastTrack = stringValue(routeSupport.prioritySupport.securityFastTrack);
    const priorityBoarding = stringValue(routeSupport.prioritySupport.priorityBoarding);
    if (securityFastTrack && securityFastTrack !== "unknown") chips.push(`우선보안검색 ${triStateLabel(securityFastTrack)}`);
    if (priorityBoarding && priorityBoarding !== "unknown") chips.push(`우선탑승 ${triStateLabel(priorityBoarding)}`);
  }

  return Array.from(new Set(chips)).slice(0, 10);
}

function routeSupportNotesText(routeSupport: Record<string, unknown>) {
  if (!isRecord(routeSupport)) return undefined;

  const notes = [
    stringValue(routeSupport.notes),
    isRecord(routeSupport.strollerRental) ? stringValue(routeSupport.strollerRental.notes) : undefined,
    isRecord(routeSupport.prioritySupport) ? stringValue(routeSupport.prioritySupport.notes) : undefined
  ].filter(Boolean);

  return notes.length > 0 ? Array.from(new Set(notes)).join(" ") : undefined;
}

function routeSupportTerminalTypeLabel(value: string) {
  const labels: Record<string, string> = {
    airport: "공항",
    rail_station: "철도역",
    bus_terminal: "버스터미널",
    ferry_terminal: "여객터미널",
    highway_rest_area: "고속도로 휴게소",
    service_area: "서비스 에어리어",
    transit_hub: "환승 거점",
    unknown: "이동 거점"
  };
  return labels[value] ?? value;
}

function routeSupportRoleLabel(value: string) {
  const labels: Record<string, string> = {
    primary_terminal: "주요 터미널",
    route_break: "경로 중 휴식",
    transfer_stop: "환승 지점",
    rest_area: "휴게 지점",
    unknown: "이동 지원"
  };
  return labels[value] ?? value;
}

function routeSupportAccessAreaLabel(value: string | undefined) {
  if (!value) return undefined;
  const labels: Record<string, string> = {
    landside: "보안검색 전",
    airside: "보안검색 후",
    both: "보안검색 전/후",
    not_applicable: "일반 구역",
    unknown: "위치 미확인"
  };
  return labels[value] ?? value;
}

function routeSupportTriStateSignal(label: string, value: string | undefined) {
  if (!value || value === "unknown") return undefined;
  return `${label} ${triStateLabel(value)}`;
}

function minutesLabel(value: number | null) {
  return value === null ? "미확인" : `${value}분`;
}

function scoreLabel(value: number | null) {
  return value === null ? "미확인" : `${value}/5`;
}

function metersLabel(value: number) {
  return value < 1000 ? `${value}m` : `${(value / 1000).toFixed(1)}km`;
}

function relationTypeLabel(value: string) {
  const labels: Record<string, string> = {
    nearby: "가까운 곳",
    same_building: "같은 건물",
    same_site: "같은 시설",
    parent_child: "상위/부속",
    route_pair: "함께 보기",
    itinerary_cluster: "일정 묶음"
  };
  return labels[value] ?? "관련 장소";
}

function tagLabel(value: string) {
  const labels: Record<string, string> = {
    adventure_playground: "어드벤처 놀이",
    ballpark_adjacent: "야구장 옆",
    children_playground: "어린이 놀이터",
    daejeon_junggu: "대전 중구",
    indoor_play: "실내 놀이",
    outdoor_playground: "야외 놀이터",
    parking: "주차",
    photo_spot: "사진 스팟",
    sand_play: "모래놀이",
    stroller_walk: "유모차 산책",
    toilet_nearby: "화장실 가까움",
    water_play: "물놀이"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function playFeatureEntries(playFeatures: Record<string, unknown>) {
  const preferredOrder = [
    "slide",
    "swing",
    "babySwing",
    "waterPlayground",
    "sandPlay",
    "climbing",
    "seesaw",
    "trampoline",
    "rideOnToys",
    "playHouse",
    "openLawn",
    "shade",
    "fenced",
    "rubberSurface",
    "strollerPath",
    "toiletNearby"
  ];
  const entries = Object.entries(playFeatures ?? {}).filter(
    ([key, value]) => key !== "evidence" && key !== "notes" && value !== undefined && value !== null && value !== "unknown" && value !== "no" && value !== false
  );
  const order = new Map(preferredOrder.map((key, index) => [key, index]));
  return entries.sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999) || a[0].localeCompare(b[0]));
}

function playFeatureLabel(key: string) {
  const labels: Record<string, string> = {
    slide: "미끄럼틀",
    swing: "그네",
    babySwing: "영아그네",
    waterPlayground: "물놀이터",
    sandPlay: "모래놀이",
    climbing: "클라이밍",
    seesaw: "시소",
    trampoline: "트램폴린",
    rideOnToys: "승용완구",
    playHouse: "놀이집",
    openLawn: "잔디",
    shade: "그늘",
    fenced: "울타리",
    rubberSurface: "탄성포장",
    strollerPath: "유모차길",
    toiletNearby: "화장실 인근"
  };
  return labels[key] ?? key;
}

function playFeatureChipLabel(key: string, value: unknown) {
  const label = playFeatureLabel(key);
  if (value === "partial") return `${label} 일부`;
  if (value === "yes" || value === true) return label;
  if (typeof value === "string" && value.trim().length > 0) return `${label} ${value}`;
  return label;
}

function playFeatureTone(value: unknown) {
  if (value === "yes" || value === true) return "positive";
  if (value === "partial") return "partial";
  if (value === "no" || value === false) return "negative";
  return "unknown";
}

function imageTierLabel(value: string) {
  const labels: Record<string, string> = {
    official: "공식",
    public_agency: "공공",
    public_listing: "목록",
    rights_unclear: "검토",
    unknown: "미확인"
  };
  return labels[value] ?? value;
}

function imageReviewLabel(value: string) {
  const labels: Record<string, string> = {
    pending_review: "검수 대기",
    approved: "검수 완료",
    needs_review: "재검수",
    rejected: "제외"
  };
  return labels[value] ?? value;
}

function imageFeatureLabel(value: string) {
  const labels: Record<string, string> = {
    slide: "미끄럼틀",
    swing: "그네",
    sand_play: "모래놀이",
    ball_pool: "볼풀",
    trampoline: "트램펄린",
    climbing: "클라이밍",
    water_play: "물놀이",
    fountain: "분수",
    stroller_path: "유모차 동선",
    shade: "그늘",
    books: "책/그림책",
    playroom: "놀이방",
    baby_chair: "아기의자"
  };
  return labels[value] ?? value;
}
