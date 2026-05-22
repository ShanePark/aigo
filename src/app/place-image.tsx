"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

type PlaceImageProps = {
  alt: string;
  src?: string | null;
  variant: "detail" | "result";
};

export function PlaceImage({ alt, src, variant }: PlaceImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    if (!src || failed || loaded) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setFailed(true), variant === "detail" ? 9000 : 7000);

    return () => window.clearTimeout(timeout);
  }, [failed, loaded, src, variant]);

  if (!src || failed) {
    return null;
  }

  return (
    <div className={`${variant === "detail" ? "detail-hero-image" : "result-image"} ${loaded ? "is-loaded" : "is-loading"}`}>
      {!loaded ? <ImageIcon className="place-image-placeholder" size={28} aria-hidden="true" /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={variant === "result" ? "lazy" : "eager"}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
