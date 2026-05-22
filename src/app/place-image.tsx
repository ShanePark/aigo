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
  accommodation: "/placeholders/default-accommodation.png",
  aquarium_zoo: "/placeholders/default-visit.png",
  experience_center: "/placeholders/default-visit.png",
  family_cafe: "/placeholders/default-kids-cafe.png",
  family_restaurant: "/placeholders/default-family-restaurant.png",
  indoor_playground: "/placeholders/default-playground.png",
  kids_cafe: "/placeholders/default-kids-cafe.png",
  library: "/placeholders/default-visit.png",
  museum: "/placeholders/default-visit.png",
  park: "/placeholders/default-playground.png",
  rest_area: "/placeholders/default-visit.png",
  science_museum: "/placeholders/default-visit.png",
  shopping_mall: "/placeholders/default-visit.png",
  sports_venue: "/placeholders/default-visit.png",
  toy_library: "/placeholders/default-toy-store.png",
  toy_store: "/placeholders/default-toy-store.png"
};

const GENERIC_FALLBACK_PLACE_IMAGE = "/placeholders/default-visit.png";

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

  return (
    <div className={`${wrapperClass} ${stateClass} ${sourceClass}`} aria-label={!imageSrc ? alt : undefined}>
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
