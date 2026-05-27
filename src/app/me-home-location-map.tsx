"use client";

import { LocateFixed } from "lucide-react";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

import { installSingleStepWheelZoom, LEAFLET_SCROLL_WHEEL_OPTIONS } from "@/app/leaflet-map-options";

type HomeLocationMapProps = {
  lat: string;
  lng: string;
  onSelect: (location: { lat: string; lng: string }) => void;
};

type LeafletModule = typeof import("leaflet");

const DEFAULT_HOME_MAP_CENTER = { lat: 36.5, lng: 127.8 };
const DEFAULT_HOME_MAP_ZOOM = 7;
const SELECTED_HOME_MAP_ZOOM = 15;

export function MeHomeLocationMap({ lat, lng, onSelect }: HomeLocationMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onSelectRef = useRef(onSelect);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "error">("idle");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let disposed = false;

    async function renderMap() {
      const L = await import("leaflet");
      if (disposed || !elementRef.current) return;

      const selected = coordinatesFromStrings(lat, lng);
      const map = getOrCreateHomeMap(L, elementRef.current, mapRef, (nextLat, nextLng) => {
        onSelectRef.current({ lat: nextLat, lng: nextLng });
      });

      if (selected) {
        markerRef.current = updateHomeMarker(L, map, markerRef.current, selected, (nextLat, nextLng) => {
          onSelectRef.current({ lat: nextLat, lng: nextLng });
        });
        const markerLatLng = markerRef.current.getLatLng();
        if (Math.abs(markerLatLng.lat - selected.lat) > 0.000001 || Math.abs(markerLatLng.lng - selected.lng) > 0.000001) {
          markerRef.current.setLatLng([selected.lat, selected.lng]);
        }
        map.setView([selected.lat, selected.lng], Math.max(map.getZoom(), SELECTED_HOME_MAP_ZOOM), { animate: false });
      } else if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      map.invalidateSize();
      window.requestAnimationFrame(() => {
        if (disposed) return;
        map.invalidateSize();
        if (!selected) {
          map.setView([DEFAULT_HOME_MAP_CENTER.lat, DEFAULT_HOME_MAP_CENTER.lng], DEFAULT_HOME_MAP_ZOOM, { animate: false });
        }
      });
    }

    void renderMap();

    return () => {
      disposed = true;
    };
  }, [lat, lng]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  function moveToCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }

    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = formatCoordinate(position.coords.latitude);
        const nextLng = formatCoordinate(position.coords.longitude);
        mapRef.current?.setView([position.coords.latitude, position.coords.longitude], SELECTED_HOME_MAP_ZOOM, { animate: true });
        onSelect({ lat: nextLat, lng: nextLng });
        setLocationStatus("idle");
      },
      () => {
        setLocationStatus("error");
      },
      { enableHighAccuracy: true, maximumAge: 300000, timeout: 8000 }
    );
  }

  return (
    <div className="me-home-map-card">
      <div className="me-home-map-frame">
        <div className="me-home-map" ref={elementRef} aria-label="집 위치 선택 지도" />
        <button
          className="me-home-map-locate"
          type="button"
          onClick={moveToCurrentLocation}
          disabled={locationStatus === "locating"}
          aria-label={locationStatus === "locating" ? "현재 위치 확인 중" : "현재 위치로 집 위치 후보 이동"}
        >
          <LocateFixed size={16} aria-hidden="true" />
          {locationStatus === "locating" ? "확인 중" : "현재 위치"}
        </button>
      </div>
      {locationStatus === "error" ? <p className="is-error">현재 위치를 가져오지 못했습니다.</p> : null}
    </div>
  );
}

function getOrCreateHomeMap(
  L: LeafletModule,
  element: HTMLDivElement,
  mapRef: MutableRefObject<LeafletMap | null>,
  onSelect: (lat: string, lng: string) => void
) {
  if (mapRef.current) return mapRef.current;

  const map = L.map(element, {
    attributionControl: true,
    ...LEAFLET_SCROLL_WHEEL_OPTIONS,
    zoomControl: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  installSingleStepWheelZoom(L, map, element);
  map.setView([DEFAULT_HOME_MAP_CENTER.lat, DEFAULT_HOME_MAP_CENTER.lng], DEFAULT_HOME_MAP_ZOOM, { animate: false });
  map.on("click", (event) => {
    onSelect(formatCoordinate(event.latlng.lat), formatCoordinate(event.latlng.lng));
  });

  mapRef.current = map;
  return map;
}

function updateHomeMarker(
  L: LeafletModule,
  map: LeafletMap,
  marker: LeafletMarker | null,
  location: { lat: number; lng: number },
  onSelect: (lat: string, lng: string) => void
) {
  if (marker) return marker;

  const nextMarker = L.marker([location.lat, location.lng], {
    draggable: true,
    icon: L.divIcon({
      className: "me-home-map-marker",
      html: "<span></span>",
      iconAnchor: [15, 30],
      iconSize: [30, 30]
    }),
    title: "집 위치"
  }).addTo(map);

  nextMarker.on("dragend", () => {
    const nextLocation = nextMarker.getLatLng();
    onSelect(formatCoordinate(nextLocation.lat), formatCoordinate(nextLocation.lng));
  });

  return nextMarker;
}

function coordinatesFromStrings(lat: string, lng: string) {
  if (!lat.trim() || !lng.trim()) return null;

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) return null;
  return { lat: parsedLat, lng: parsedLng };
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}
