"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { LatLngBoundsExpression, LayerGroup, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

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

type SavedMapView = {
  lat: number;
  lng: number;
  zoom: number;
};

type LeafletModule = typeof import("leaflet");

const DEFAULT_MAP_CENTER = { lat: 36.3322, lng: 127.4341 };
const DEFAULT_MAP_ZOOM = 13;
const MAP_VIEW_STORAGE_KEY = "aigo:places-map-view:v2";
let highlightedResultTimer: number | undefined;

export function PlacesMap({ origin, places }: PlacesMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const placeMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const initializedViewKeyRef = useRef<string | null>(null);
  const hoveredCardPlaceIdRef = useRef<string | null>(null);
  const viewKeyRef = useRef(mapViewKey(origin));

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

      const viewKey = mapViewKey(origin);
      const shouldApplyMapView = initializedViewKeyRef.current !== viewKey;
      viewKeyRef.current = viewKey;
      const map = getOrCreateMap(L, mapElementRef.current, mapRef, viewKeyRef);
      const markers = getOrCreateMarkerLayer(L, map, markersRef);
      markers.clearLayers();
      placeMarkersRef.current.clear();

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
        marker.on("mouseover focus", () => {
          marker.getElement()?.classList.add("is-hovered");
          revealResultCard(place.placeId);
        });
        marker.on("mouseout blur", () => {
          marker.getElement()?.classList.remove("is-hovered");
        });
        marker.on("click", () => {
          window.location.href = place.href;
        });
        marker.addTo(markers);
        placeMarkersRef.current.set(place.placeId, marker);
      });

      if (shouldApplyMapView) {
        const savedView = loadSavedMapView(viewKey);
        if (savedView) {
          map.setView([savedView.lat, savedView.lng], savedView.zoom, { animate: false });
        } else {
          setInitialMapView(map, origin, places);
        }
        initializedViewKeyRef.current = viewKey;
      }

      map.invalidateSize();
    }

    void renderMap();

    return () => {
      disposed = true;
    };
  }, [origin, places]);

  useEffect(() => {
    function handleCardEnter(event: Event) {
      const card = resultCardFromEvent(event);
      if (!card) return;

      const placeId = card.dataset.mapPlaceId;
      const lat = Number(card.dataset.mapPlaceLat);
      const lng = Number(card.dataset.mapPlaceLng);
      if (!placeId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

      hoveredCardPlaceIdRef.current = placeId;
      focusMapPlace(mapRef.current, placeMarkersRef.current, { lat, lng, placeId });
    }

    function handleCardLeave(event: Event) {
      const card = resultCardFromEvent(event);
      if (!card) return;

      const relatedTarget = relatedNodeFromEvent(event);
      if (relatedTarget && card.contains(relatedTarget)) return;

      const placeId = card.dataset.mapPlaceId;
      if (placeId && hoveredCardPlaceIdRef.current === placeId) {
        hoveredCardPlaceIdRef.current = null;
        clearMapMarkerHighlight(placeMarkersRef.current, placeId);
      }
    }

    document.addEventListener("pointerover", handleCardEnter);
    document.addEventListener("focusin", handleCardEnter);
    document.addEventListener("pointerout", handleCardLeave);
    document.addEventListener("focusout", handleCardLeave);

    return () => {
      document.removeEventListener("pointerover", handleCardEnter);
      document.removeEventListener("focusin", handleCardEnter);
      document.removeEventListener("pointerout", handleCardLeave);
      document.removeEventListener("focusout", handleCardLeave);
    };
  }, []);

  return (
    <aside className="map-card" aria-label="검색 결과 지도">
      <div className="map-canvas">
        <span className="map-count-badge">{places.length}곳</span>
        <div className="leaflet-map" ref={mapElementRef} />
      </div>
    </aside>
  );
}

function getOrCreateMap(
  L: LeafletModule,
  element: HTMLDivElement,
  mapRef: MutableRefObject<LeafletMap | null>,
  viewKeyRef: MutableRefObject<string>
) {
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

  map.on("moveend zoomend", () => {
    saveMapView(viewKeyRef.current, map);
  });

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

function revealResultCard(placeId: string) {
  const card = document.getElementById(`place-card-${placeId}`);
  if (!card) return;

  document.querySelectorAll(".result-card.is-map-highlighted").forEach((element) => {
    element.classList.remove("is-map-highlighted");
  });
  card.classList.add("is-map-highlighted");

  const scroller = card.closest("[data-results-scroll]") as HTMLElement | null;
  if (scroller) {
    const cardRect = card.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const centeredTop = scroller.scrollTop + cardRect.top - scrollerRect.top - (scroller.clientHeight - cardRect.height) / 2;
    scroller.scrollTo({ top: Math.max(0, centeredTop), behavior: "smooth" });
  } else {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (highlightedResultTimer) window.clearTimeout(highlightedResultTimer);
  highlightedResultTimer = window.setTimeout(() => {
    card.classList.remove("is-map-highlighted");
  }, 2200);
}

function resultCardFromEvent(event: Event) {
  if (!(event.target instanceof Element)) return null;
  return event.target.closest<HTMLElement>("[data-map-place-card]");
}

function relatedNodeFromEvent(event: Event) {
  if (!("relatedTarget" in event)) return null;
  return event.relatedTarget instanceof Node ? event.relatedTarget : null;
}

function focusMapPlace(map: LeafletMap | null, markers: Map<string, LeafletMarker>, place: { lat: number; lng: number; placeId: string }) {
  if (!map) return;

  map.panTo([place.lat, place.lng], { animate: true, duration: 0.45 });
  clearMapMarkerHighlight(markers);
  markers.get(place.placeId)?.getElement()?.classList.add("is-hovered");
}

function clearMapMarkerHighlight(markers: Map<string, LeafletMarker>, placeId?: string) {
  const markerElements = placeId ? [markers.get(placeId)?.getElement()] : Array.from(markers.values()).map((marker) => marker.getElement());

  markerElements.forEach((element) => {
    element?.classList.remove("is-hovered");
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

function setInitialMapView(map: LeafletMap, origin: MapOrigin, places: MapPlace[]) {
  if (origin) {
    map.setView([origin.lat, origin.lng], initialZoomForOrigin(origin, places), { animate: false });
    return;
  }

  const bounds = boundsForLeaflet(origin, places);
  if (bounds) {
    map.fitBounds(bounds, { animate: false, maxZoom: DEFAULT_MAP_ZOOM, padding: [24, 24] });
    return;
  }

  map.setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_ZOOM, { animate: false });
}

function initialZoomForOrigin(origin: NonNullable<MapOrigin>, places: MapPlace[]) {
  const farthestKm = places.reduce((max, place) => Math.max(max, distanceKm(origin.lat, origin.lng, place.lat, place.lng)), 0);

  if (farthestKm <= 2) return 15;
  if (farthestKm <= 5) return 14;
  return DEFAULT_MAP_ZOOM;
}

function mapViewKey(origin: MapOrigin) {
  if (!origin) return "nationwide";
  return `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}`;
}

function loadSavedMapView(viewKey: string): SavedMapView | null {
  const storage = mapViewStorage();
  if (!storage) return null;

  try {
    const saved = storage.getItem(MAP_VIEW_STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved) as Partial<Record<string, SavedMapView>>;
    const view = parsed[viewKey];
    if (!view || !Number.isFinite(view.lat) || !Number.isFinite(view.lng) || !Number.isFinite(view.zoom)) return null;
    return view;
  } catch {
    return null;
  }
}

function saveMapView(viewKey: string, map: LeafletMap) {
  const storage = mapViewStorage();
  if (!storage) return;

  const center = map.getCenter();
  const nextView = {
    lat: center.lat,
    lng: center.lng,
    zoom: map.getZoom()
  };

  try {
    const saved = storage.getItem(MAP_VIEW_STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as Partial<Record<string, SavedMapView>>) : {};
    storage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify({ ...parsed, [viewKey]: nextView }));
  } catch {
    try {
      storage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify({ [viewKey]: nextView }));
    } catch {
      // Storage may be blocked in embedded or private browser contexts; in-memory map state still preserves same-page category switches.
    }
  }
}

function mapViewStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
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
