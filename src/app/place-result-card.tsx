"use client";

import { MapPin, Star, Target } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { UrlObject } from "url";

import { PlaceCategoryBadge } from "@/app/place-category-badge";
import { PlaceImage } from "@/app/place-image";
import { PlaceSaveControls } from "@/app/places/place-save-controls";

export type PlaceResultCardMetric = {
  icon?: "distance" | "evaluation" | "relevance";
  key: string;
  label?: string;
  title?: string;
  tone?: string;
  value: string;
};

export type PlaceResultCardDate = {
  label: string;
  value: string;
};

type PlaceResultCardProps = {
  category: string;
  className?: string;
  dates?: PlaceResultCardDate[];
  href: string | UrlObject;
  id?: string;
  imageAlt: string;
  imageUrl?: string | null;
  keywords?: string[];
  mapLat?: number;
  mapLng?: number;
  metricAriaLabel?: string;
  metrics?: PlaceResultCardMetric[];
  name: string;
  placeId?: string;
  rank?: number;
  rankTotal?: number;
  savePlaceId?: string;
  showImageCategory?: boolean;
  summary: string;
  tags?: readonly string[] | null;
};

const metricIcons: Record<NonNullable<PlaceResultCardMetric["icon"]>, ReactNode> = {
  distance: <MapPin size={13} aria-hidden="true" />,
  evaluation: <Star size={13} aria-hidden="true" />,
  relevance: <Target size={13} aria-hidden="true" />
};

export function PlaceResultCard({
  category,
  className,
  dates = [],
  href,
  id,
  imageAlt,
  imageUrl,
  keywords = [],
  mapLat,
  mapLng,
  metricAriaLabel,
  metrics = [],
  name,
  placeId,
  rank,
  rankTotal,
  savePlaceId,
  showImageCategory = false,
  summary,
  tags
}: PlaceResultCardProps) {
  const classes = ["result-card", className].filter(Boolean).join(" ");
  const hasImageMeta = typeof rank === "number" || showImageCategory;
  const shouldShowRankTotal = typeof rankTotal === "number" && rankTotal > 0 && rankTotal <= 999;
  const rankText = typeof rank === "number" ? (shouldShowRankTotal ? `${rank}/${rankTotal}` : String(rank)) : null;
  const rankAriaLabel = typeof rank === "number" ? (typeof rankTotal === "number" && rankTotal > 0 ? `${rankTotal}개 중 ${rank}번째 결과` : `${rank}번째 결과`) : undefined;

  return (
    <article className={classes} data-map-place-card={placeId ? "true" : undefined} data-map-place-id={placeId} data-map-place-lat={mapLat} data-map-place-lng={mapLng} id={id}>
      <Link className="result-card-main" href={href as UrlObject}>
        <div className="result-image-frame">
          <PlaceImage category={category} src={imageUrl} alt={imageAlt} variant="result" />
          {hasImageMeta ? (
            <span className="result-image-meta">
              {typeof rank === "number" ? (
                <span className="rank-badge" aria-label={rankAriaLabel}>
                  {rankText}
                </span>
              ) : null}
              {showImageCategory ? <PlaceCategoryBadge category={category} className="category-pill result-image-category" name={name} tags={tags} /> : null}
            </span>
          ) : null}
        </div>
        <div className="result-card-body">
          <div className="result-card-topline">
            <PlaceCategoryBadge category={category} className="category-pill" name={name} tags={tags} />
            {metrics.length > 0 ? (
              <div className="result-metric-row" aria-label={metricAriaLabel}>
                {metrics.map((metric) => (
                  <span className={`result-metric-pill metric-${metric.key} ${metric.tone ?? ""}`} title={metric.title} key={metric.key}>
                    {metric.icon ? metricIcons[metric.icon] : null}
                    {metric.label ? <span className="result-metric-label">{metric.label}</span> : null}
                    <strong>{metric.value}</strong>
                  </span>
                ))}
              </div>
            ) : null}
            {dates.length > 0 ? (
              <div className="admin-place-date-row" aria-label="등록 및 수정일">
                {dates.map((date) => (
                  <span key={date.label}>
                    <small>{date.label}</small>
                    {date.value}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <h3>{name}</h3>
          <p className="result-card-summary">{summary}</p>
          {keywords.length > 0 ? (
            <div className="keyword-row" aria-label="키워드">
              {keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
      {savePlaceId ? <PlaceSaveControls compact placeId={savePlaceId} /> : null}
    </article>
  );
}
