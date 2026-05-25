"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PlaceImageProps = {
  alt: string;
  category?: string | null;
  src?: string | null;
  variant: "detail" | "result";
};

const FALLBACK_PLACE_IMAGES: Record<string, string> = {
  accommodation: "/placeholders/default-accommodation.webp",
  aquarium: "/placeholders/default-aquarium-zoo.webp",
  art_museum: "/placeholders/default-museum.webp",
  experience_center: "/placeholders/default-visit.webp",
  family_cafe: "/placeholders/default-kids-cafe.webp",
  family_restaurant: "/placeholders/default-family-restaurant.webp",
  indoor_playground: "/placeholders/default-playground.webp",
  kids_cafe: "/placeholders/default-kids-cafe.webp",
  library: "/placeholders/default-library.webp",
  museum: "/placeholders/default-museum.webp",
  park: "/placeholders/default-playground.webp",
  playground: "/placeholders/default-playground.webp",
  rest_area: "/placeholders/default-visit.webp",
  science_museum: "/placeholders/default-visit.webp",
  shopping_mall: "/placeholders/default-shopping-mall.webp",
  sports_venue: "/placeholders/default-visit.webp",
  toy_library: "/placeholders/default-toy-store.webp",
  toy_store: "/placeholders/default-toy-store.webp",
  zoo: "/placeholders/default-aquarium-zoo.webp"
};

const GENERIC_FALLBACK_PLACE_IMAGE = "/placeholders/default-visit.webp";

export function fallbackPlaceImageForCategory(category: string | null | undefined) {
  return category ? (FALLBACK_PLACE_IMAGES[category] ?? GENERIC_FALLBACK_PLACE_IMAGE) : GENERIC_FALLBACK_PLACE_IMAGE;
}

export function PlaceImage({ alt, category, src, variant }: PlaceImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const fallbackSrc = fallbackPlaceImageForCategory(category);
  const imageSrc = src && !failedSources.includes(src) ? src : !failedSources.includes(fallbackSrc) ? fallbackSrc : null;
  const isFallbackSource = Boolean(imageSrc && imageSrc === fallbackSrc && imageSrc !== src);

  useEffect(() => {
    setFailedSources([]);
    setLoaded(false);
  }, [fallbackSrc, src]);

  useEffect(() => {
    const image = imageRef.current;
    if (!imageSrc || !image?.complete) return;
    if (image.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setFailedSources((current) => (current.includes(imageSrc) ? current : [...current, imageSrc]));
    }
  }, [imageSrc]);

  const wrapperClass = variant === "detail" ? "detail-hero-image" : "result-image";
  const stateClass = !imageSrc ? "is-missing" : loaded ? "is-loaded" : "is-loading";
  const sourceClass = isFallbackSource ? "is-fallback-source" : "is-original-source";
  const showFallbackUnderlay = Boolean(imageSrc && imageSrc !== fallbackSrc && !failedSources.includes(fallbackSrc));
  const underlayClass = showFallbackUnderlay ? "has-fallback-underlay" : "no-fallback-underlay";

  return (
    <div className={`${wrapperClass} ${stateClass} ${sourceClass} ${underlayClass}`} aria-label={!imageSrc ? alt : undefined}>
      {showFallbackUnderlay ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="place-image-fallback-underlay" src={fallbackSrc} alt="" aria-hidden="true" loading="eager" />
      ) : null}
      {!imageSrc || !loaded ? <ImageIcon className="place-image-placeholder" size={28} aria-hidden="true" /> : null}
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imageRef}
          src={imageSrc}
          alt={alt}
          loading={variant === "result" ? "lazy" : "eager"}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setFailedSources((current) => (current.includes(imageSrc) ? current : [...current, imageSrc]));
          }}
        />
      ) : null}
    </div>
  );
}
