"use client";

import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import type { Map as LeafletMap, Marker } from "leaflet";

type PlaceDetailMapProps = {
  category: string;
  lat: number;
  lng: number;
  name: string;
};

export function PlaceDetailMap({ category, lat, lng, name }: PlaceDetailMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const osmHref = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

  useEffect(() => {
    let disposed = false;

    async function renderMap() {
      const L = await import("leaflet");
      if (disposed || !mapElementRef.current) return;

      const center: [number, number] = [lat, lng];
      const map =
        mapRef.current ??
        L.map(mapElementRef.current, {
          attributionControl: true,
          scrollWheelZoom: true,
          zoomControl: true
        });

      if (!mapRef.current) {
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19
        }).addTo(map);
        mapRef.current = map;
      }

      markerRef.current?.remove();
      markerRef.current = L.marker(center, {
        icon: L.divIcon({
          className: `detail-map-marker ${markerTone(category)}`,
          html: "<span></span>",
          iconAnchor: [15, 30],
          iconSize: [30, 30]
        }),
        keyboard: true,
        title: name
      })
        .bindTooltip(name, {
          direction: "top",
          offset: [0, -28],
          opacity: 0.94
        })
        .addTo(map);

      map.setView(center, 16, { animate: false });
      map.invalidateSize();
    }

    void renderMap();

    return () => {
      disposed = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [category, lat, lng, name]);

  return (
    <section className="detail-map-card" id="detail-map" aria-label="장소 위치 지도">
      <div className="detail-map-canvas">
        <a className="detail-map-open-link" href={osmHref} target="_blank" rel="noreferrer">
          <ExternalLink size={14} aria-hidden="true" />
          크게 보기
        </a>
        <div className="leaflet-map" ref={mapElementRef} />
      </div>
    </section>
  );
}

function markerTone(category: string) {
  if (category === "family_restaurant") return "dining";
  if (category === "kids_cafe" || category === "family_cafe") return "kids";
  if (category === "park" || category === "indoor_playground") return "play";
  if (category === "accommodation") return "stay";
  return "visit";
}
