"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Images, Info, Maximize2 } from "lucide-react";
import { useRef, useState } from "react";

import { AppModal } from "@/app/app-modal";
import { PlaceImage } from "@/app/place-image";

type GalleryImage = {
  altText: string | null;
  creditText: string;
  description: string | null;
  displayTier: string;
  id: string;
  isPrimary: boolean;
  reviewStatus: string;
  sourceTitle: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  url: string;
  visualFeatures: string[];
};

type PlaceImageGalleryProps = {
  category: string;
  images: GalleryImage[];
  placeName: string;
};

export function PlaceImageGallery({ category, images, placeName }: PlaceImageGalleryProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeImage, setActiveImage] = useState<GalleryImage | null>(null);

  function scrollTrack(direction: "previous" | "next") {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.querySelector<HTMLElement>(".image-gallery-slide");
    const distance = firstCard ? firstCard.offsetWidth + 14 : track.clientWidth * 0.86;
    track.scrollBy({ left: direction === "next" ? distance : -distance, behavior: "smooth" });
  }

  return (
    <section className="image-gallery-section" aria-label={`${placeName} 갤러리`}>
      <div className="image-gallery-heading">
        <h2>
          <Images size={18} aria-hidden="true" />
          갤러리
        </h2>
        {images.length > 1 ? (
          <div className="image-gallery-controls">
            <button aria-label="이전 이미지" onClick={() => scrollTrack("previous")} type="button">
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <button aria-label="다음 이미지" onClick={() => scrollTrack("next")} type="button">
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="image-gallery-viewport">
        <div className="image-gallery-track" ref={trackRef}>
          {images.map((image) => (
            <article className="image-gallery-slide" key={image.id}>
              <button className="image-gallery-expand" onClick={() => setActiveImage(image)} type="button">
                <PlaceImage category={category} src={image.url} alt={image.altText ?? `${placeName} 이미지`} variant="result" />
                <span>
                  <Maximize2 size={15} aria-hidden="true" />
                  크게 보기
                </span>
              </button>

              <details className="image-gallery-info">
                <summary aria-label="이미지 정보 보기">
                  <Info size={15} aria-hidden="true" />
                </summary>
                <div className="image-gallery-info-panel">
                  <div className="visit-row">
                    {image.isPrimary ? <span>대표 이미지</span> : null}
                    <span>{imageTierLabel(image.displayTier, image.sourceType)}</span>
                    <span>{imageReviewLabel(image.reviewStatus)}</span>
                  </div>
                  {image.sourceUrl ? (
                    <a className="image-source-link" href={image.sourceUrl} target="_blank" rel="noreferrer">
                      {image.sourceTitle ?? image.creditText}
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  ) : null}
                  {image.description ? <p>{image.description}</p> : null}
                  {image.visualFeatures.length > 0 ? (
                    <div className="reason-grid">
                      {image.visualFeatures.slice(0, 10).map((feature) => (
                        <span key={feature}>{imageFeatureLabel(feature)}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
            </article>
          ))}
        </div>
      </div>

      <AppModal
        description={activeImage ? imageModalDescription(activeImage) : undefined}
        onClose={() => setActiveImage(null)}
        open={Boolean(activeImage)}
        size="media"
        title={activeImage?.isPrimary ? `${placeName} 대표 이미지` : `${placeName} 이미지`}
      >
        {activeImage ? (
          <div className="image-gallery-modal">
            <PlaceImage category={category} src={activeImage.url} alt={activeImage.altText ?? `${placeName} 이미지 크게 보기`} variant="detail" />
            <div className="image-gallery-modal-meta">
              <div className="visit-row">
                {activeImage.isPrimary ? <span>대표 이미지</span> : null}
                <span>{imageTierLabel(activeImage.displayTier, activeImage.sourceType)}</span>
                <span>{imageReviewLabel(activeImage.reviewStatus)}</span>
              </div>
              {activeImage.description ? <p>{activeImage.description}</p> : null}
              {activeImage.sourceUrl ? (
                <a className="image-source-link" href={activeImage.sourceUrl} target="_blank" rel="noreferrer">
                  {activeImage.sourceTitle ?? activeImage.creditText}
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </AppModal>
    </section>
  );
}

function imageModalDescription(image: GalleryImage) {
  return [imageTierLabel(image.displayTier, image.sourceType), imageReviewLabel(image.reviewStatus)].filter(Boolean).join(" · ");
}

function imageTierLabel(value: string, sourceType: string | null) {
  const labels: Record<string, string> = {
    official: "공식 이미지",
    public_agency: "공공 이미지",
    public_listing: "공개 목록 이미지",
    rights_unclear: "출처 검토 필요",
    unknown: "이미지 출처 미확인"
  };
  if (labels[value]) return labels[value];
  if (sourceType && /lodging|숙박/.test(sourceType.toLocaleLowerCase("ko-KR"))) return "숙박 이미지";
  if (sourceType && /image|photo|visual|이미지|사진/.test(sourceType.toLocaleLowerCase("ko-KR"))) return "출처 기반 이미지";
  return "이미지 출처 미확인";
}

function imageReviewLabel(value: string) {
  const labels: Record<string, string> = {
    pending_review: "검수 대기",
    approved: "검수 완료",
    needs_review: "재검수",
    rejected: "제외"
  };
  return labels[value] ?? "검수 상태 미확인";
}

function imageFeatureLabel(value: string) {
  const labels: Record<string, string> = {
    baby_chair: "아기의자",
    ball_pool: "볼풀",
    books: "책/그림책",
    climbing: "클라이밍",
    fountain: "분수",
    playroom: "놀이방",
    sand_play: "모래놀이",
    shade: "그늘",
    slide: "미끄럼틀",
    stroller_path: "유모차 동선",
    swing: "그네",
    trampoline: "트램펄린",
    water_play: "물놀이"
  };
  return labels[value] ?? value;
}
