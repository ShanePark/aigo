"use client";

import { useState } from "react";

type PlaceImageProps = {
  alt: string;
  src?: string | null;
  variant: "detail" | "result";
};

export function PlaceImage({ alt, src, variant }: PlaceImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return null;
  }

  return (
    <div className={variant === "detail" ? "detail-hero-image" : "result-image"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={variant === "result" ? "lazy" : "eager"}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
