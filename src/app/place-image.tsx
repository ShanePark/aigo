"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PlaceImageProps = {
  alt: string;
  src?: string | null;
  variant: "detail" | "result";
};

export function PlaceImage({ alt, src, variant }: PlaceImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    const image = imageRef.current;
    if (!src || !image?.complete) return;
    if (image.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setFailed(true);
    }
  }, [src]);

  const wrapperClass = variant === "detail" ? "detail-hero-image" : "result-image";
  const stateClass = !src || failed ? "is-missing" : loaded ? "is-loaded" : "is-loading";

  return (
    <div className={`${wrapperClass} ${stateClass}`} aria-label={!src || failed ? alt : undefined}>
      {!loaded || failed ? <ImageIcon className="place-image-placeholder" size={28} aria-hidden="true" /> : null}
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          loading={variant === "result" ? "lazy" : "eager"}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
