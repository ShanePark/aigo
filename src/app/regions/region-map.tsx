"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import type { LatLngBoundsExpression, LayerGroup, Map as LeafletMap } from "leaflet";

import { installSingleStepWheelZoom, LEAFLET_SCROLL_WHEEL_OPTIONS } from "@/app/leaflet-map-options";
import type { RegionCatalogItem } from "@/app/regions/region-catalog";

type RegionMapProps = {
  regions: readonly RegionCatalogItem[];
  selectedSlug: string;
};

type LeafletModule = typeof import("leaflet");

const KOREA_BOUNDS = [
  [33.0, 124.6],
  [38.7, 131.2]
] satisfies LatLngBoundsExpression;

export function RegionMap({ regions, selectedSlug }: RegionMapProps) {
  const router = useRouter();
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let disposed = false;

    async function renderMap() {
      const L = await import("leaflet");
      if (disposed || !mapElementRef.current) return;

      const map = getOrCreateRegionMap(L, mapElementRef.current, mapRef);
      const markers = getOrCreateRegionMarkers(L, map, markersRef);
      markers.clearLayers();

      regions.forEach((region) => {
        const marker = L.marker([region.center.lat, region.center.lng], {
          icon: regionIcon(L, region, region.slug === selectedSlug),
          keyboard: true,
          title: `${region.label} 대표 장소 보기`
        });

        marker.on("click", () => router.push(`/regions?region=${region.slug}`));
        marker.on("keypress", (event) => {
          const key = event.originalEvent instanceof KeyboardEvent ? event.originalEvent.key : "";
          if (key === "Enter" || key === " ") router.push(`/regions?region=${region.slug}`);
        });
        marker.addTo(markers);
      });

      const selected = regions.find((region) => region.slug === selectedSlug);
      if (selected) {
        map.setView([selected.center.lat, selected.center.lng], selected.slug === "jeju" ? 8 : 7, { animate: false });
      } else {
        map.fitBounds(KOREA_BOUNDS, { animate: false, padding: [18, 18] });
      }
      map.invalidateSize();
    }

    void renderMap();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, [regions, router, selectedSlug]);

  return <div className="region-leaflet-map leaflet-map" ref={mapElementRef} />;
}

function getOrCreateRegionMap(L: LeafletModule, element: HTMLDivElement, mapRef: MutableRefObject<LeafletMap | null>) {
  if (mapRef.current) return mapRef.current;

  const map = L.map(element, {
    attributionControl: true,
    maxBounds: KOREA_BOUNDS,
    maxBoundsViscosity: 0.65,
    zoomControl: true,
    ...LEAFLET_SCROLL_WHEEL_OPTIONS
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 12,
    minZoom: 5
  }).addTo(map);
  installSingleStepWheelZoom(L, map, element);
  map.fitBounds(KOREA_BOUNDS, { animate: false, padding: [18, 18] });
  mapRef.current = map;
  return map;
}

function getOrCreateRegionMarkers(L: LeafletModule, map: LeafletMap, markersRef: MutableRefObject<LayerGroup | null>) {
  if (markersRef.current) return markersRef.current;

  const markers = L.layerGroup().addTo(map);
  markersRef.current = markers;
  return markers;
}

function regionIcon(L: LeafletModule, region: RegionCatalogItem, active: boolean) {
  return L.divIcon({
    className: `region-leaflet-marker ${active ? "is-active" : ""}`,
    html: `<span class="region-leaflet-marker-image"><img src="${region.imageSrc}" alt="" aria-hidden="true" draggable="false" /></span><span class="region-leaflet-marker-label">${region.label}</span>`,
    iconAnchor: [28, 28],
    iconSize: [56, 66]
  });
}
