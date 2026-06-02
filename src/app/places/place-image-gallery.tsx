"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageIcon, Images, Info, List, Maximize2 } from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

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

type GalleryMode = "carousel" | "list";

export function PlaceImageGallery({ category, images, placeName }: PlaceImageGalleryProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "center", containScroll: false, loop: images.length > 2, skipSnaps: false });
  const [activeImage, setActiveImage] = useState<GalleryImage | null>(null);
  const [mode, setMode] = useState<GalleryMode>("carousel");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const syncSelectedIndex = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    syncSelectedIndex();
    emblaApi.on("select", syncSelectedIndex);
    emblaApi.on("reInit", syncSelectedIndex);
    return () => {
      emblaApi.off("select", syncSelectedIndex);
      emblaApi.off("reInit", syncSelectedIndex);
    };
  }, [emblaApi, syncSelectedIndex]);

  useEffect(() => {
    if (mode !== "carousel" || !emblaApi) return;
    emblaApi.reInit();
    emblaApi.scrollTo(selectedIndex);
  }, [emblaApi, mode, selectedIndex]);

  const scrollPrevious = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <section className="image-gallery-section" aria-label={`${placeName} 갤러리`}>
      <div className="image-gallery-heading">
        <h2>
          <Images size={18} aria-hidden="true" />
          갤러리
        </h2>
        <div className="image-gallery-actions">
          <div className="image-gallery-mode" role="tablist" aria-label="갤러리 보기 방식">
            <button aria-selected={mode === "carousel"} onClick={() => setMode("carousel")} role="tab" type="button">
              <ImageIcon size={15} aria-hidden="true" />
              한 장씩
            </button>
            <button aria-selected={mode === "list"} onClick={() => setMode("list")} role="tab" type="button">
              <List size={15} aria-hidden="true" />
              목록
            </button>
          </div>
          {images.length > 1 && mode === "carousel" ? (
            <div className="image-gallery-controls">
              <button aria-label="이전 이미지" onClick={scrollPrevious} type="button">
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <button aria-label="다음 이미지" onClick={scrollNext} type="button">
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {mode === "carousel" ? (
        <div className="image-gallery-carousel">
          <div className="image-gallery-viewport" ref={emblaRef}>
            <div className="image-gallery-track">
              {images.map((image, index) => (
                <GalleryImageCard
                  category={category}
                  image={image}
                  isSelected={index === selectedIndex}
                  key={image.id}
                  onExpand={() => setActiveImage(image)}
                  placeName={placeName}
                />
              ))}
            </div>
          </div>
          {images.length > 1 ? (
            <div className="image-gallery-dots" aria-label="이미지 위치">
              {images.map((image, index) => (
                <button
                  aria-label={`${index + 1}번째 이미지 보기`}
                  aria-current={index === selectedIndex ? "true" : undefined}
                  key={image.id}
                  onClick={() => emblaApi?.scrollTo(index)}
                  type="button"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="image-gallery-list">
          {images.map((image) => (
            <GalleryImageCard category={category} image={image} isSelected={false} key={image.id} onExpand={() => setActiveImage(image)} placeName={placeName} />
          ))}
        </div>
      )}

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

function GalleryImageCard({
  category,
  image,
  isSelected,
  onExpand,
  placeName
}: {
  category: string;
  image: GalleryImage;
  isSelected: boolean;
  onExpand: () => void;
  placeName: string;
}) {
  const pointerRef = useRef<{ dragged: boolean; x: number; y: number } | null>(null);

  function handleExpandClick(event: MouseEvent<HTMLButtonElement>) {
    if (pointerRef.current?.dragged) {
      event.preventDefault();
      pointerRef.current = null;
      return;
    }
    pointerRef.current = null;
    onExpand();
  }

  return (
    <article className={`image-gallery-slide ${isSelected ? "is-selected" : "is-neighbor"}`}>
      <button
        className="image-gallery-expand"
        onClick={handleExpandClick}
        onPointerDown={(event) => {
          pointerRef.current = { dragged: false, x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const start = pointerRef.current;
          if (!start) return;
          if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
            start.dragged = true;
          }
        }}
        type="button"
      >
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
