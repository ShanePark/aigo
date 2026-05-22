"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { LatLngBoundsExpression, LayerGroup, Map as LeafletMap } from "leaflet";

export type MapPlace = {
  category: string;
  distance: string;
  href: string;
  lat: number;
  lng: number;
  name: string;
  placeId: string;
};

export type MapOrigin = {
  label: string;
  lat: number;
  lng: number;
} | null;

type PlacesMapProps = {
  origin: MapOrigin;
  places: MapPlace[];
};

type MapBounds = {
  maxLat: number;
  maxLng: number;
  minLat: number;
  minLng: number;
};

type LeafletModule = typeof import("leaflet");

export function PlacesMap({ origin, places }: PlacesMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    async function renderMap() {
      const L = await import("leaflet");
      if (disposed || !mapElementRef.current) return;

      const map = getOrCreateMap(L, mapElementRef.current, mapRef);
      const markers = getOrCreateMarkerLayer(L, map, markersRef);
      markers.clearLayers();

      if (origin) {
        L.marker([origin.lat, origin.lng], {
          icon: originIcon(L),
          interactive: false,
          keyboard: false,
          title: origin.label
        }).addTo(markers);
      }

      places.forEach((place, index) => {
        const marker = L.marker([place.lat, place.lng], {
          icon: placeIcon(L, place.category, index + 1),
          keyboard: true,
          title: `${place.name} ${place.distance}`
        });

        marker.bindTooltip(`${place.name} ${place.distance}`, {
          direction: "top",
          offset: [0, -18],
          opacity: 0.92
        });
        marker.on("click", () => {
          window.location.href = place.href;
        });
        marker.addTo(markers);
      });

      const bounds = boundsForLeaflet(origin, places);
      if (bounds) {
        map.fitBounds(bounds, { animate: false, maxZoom: 14, padding: [24, 24] });
      } else {
        map.setView([36.3322, 127.4341], 12);
      }

      map.invalidateSize();
    }

    void renderMap();

    return () => {
      disposed = true;
    };
  }, [origin, places]);

  return (
    <aside className="map-card" aria-label="검색 결과 지도">
      <div className="map-card-head">
        <div>
          <h2>주변 지도</h2>
          <p>{origin?.label ?? "전국 결과"}</p>
        </div>
        <span>{places.length}곳</span>
      </div>
      <div className="map-canvas">
        <div className="leaflet-map" ref={mapElementRef} />
      </div>
    </aside>
  );
}

function getOrCreateMap(L: LeafletModule, element: HTMLDivElement, mapRef: MutableRefObject<LeafletMap | null>) {
  if (mapRef.current) return mapRef.current;

  const map = L.map(element, {
    attributionControl: true,
    scrollWheelZoom: true,
    zoomControl: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  mapRef.current = map;
  return map;
}

function getOrCreateMarkerLayer(L: LeafletModule, map: LeafletMap, markersRef: MutableRefObject<LayerGroup | null>) {
  if (markersRef.current) return markersRef.current;

  const markers = L.layerGroup().addTo(map);
  markersRef.current = markers;
  return markers;
}

function placeIcon(L: LeafletModule, category: string, index: number) {
  return L.divIcon({
    className: `map-place-marker ${markerTone(category)}`,
    html: `<span>${index}</span>`,
    iconAnchor: [16, 16],
    iconSize: [32, 32]
  });
}

function originIcon(L: LeafletModule) {
  return L.divIcon({
    className: "map-origin-marker",
    iconAnchor: [10, 10],
    iconSize: [20, 20]
  });
}

function boundsForLeaflet(origin: MapOrigin, places: MapPlace[]): LatLngBoundsExpression | null {
  const points = [
    ...(origin ? [{ lat: origin.lat, lng: origin.lng }] : []),
    ...places.map((place) => ({ lat: place.lat, lng: place.lng }))
  ];

  if (points.length === 0) return null;

  const bounds = mapBounds(origin, places);
  return [
    [bounds.minLat, bounds.minLng],
    [bounds.maxLat, bounds.maxLng]
  ];
}

function mapBounds(origin: MapOrigin, places: MapPlace[]): MapBounds {
  const points = [
    ...(origin ? [{ lat: origin.lat, lng: origin.lng }] : []),
    ...places.map((place) => ({ lat: place.lat, lng: place.lng }))
  ];

  if (points.length === 0) {
    return { minLat: 36.25, minLng: 127.32, maxLat: 36.43, maxLng: 127.52 };
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPad = Math.max((maxLat - minLat) * 0.18, 0.01);
  const lngPad = Math.max((maxLng - minLng) * 0.18, 0.01);

  return {
    maxLat: Math.min(90, maxLat + latPad),
    maxLng: Math.min(180, maxLng + lngPad),
    minLat: Math.max(-90, minLat - latPad),
    minLng: Math.max(-180, minLng - lngPad)
  };
}

function markerTone(category: string) {
  if (category === "family_restaurant") return "dining";
  if (category === "kids_cafe" || category === "family_cafe") return "kids";
  if (category === "park" || category === "indoor_playground") return "play";
  if (category === "accommodation") return "stay";
  return "visit";
}
