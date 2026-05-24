"use client";

import { LocateFixed } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { LatLngBoundsExpression, LayerGroup, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

import { installSingleStepWheelZoom, LEAFLET_SCROLL_WHEEL_OPTIONS } from "@/app/leaflet-map-options";

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
  autoLocateOnInitialLoad?: boolean;
  isViewportSearchPending?: boolean;
  onInitialLocationSearch?: (location: UserLocation) => void;
  onViewportSearch?: (request: ViewportSearchRequest) => void;
  origin: MapOrigin;
  places: MapPlace[];
  preserveViewOnUpdate?: boolean;
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

type UserLocation = {
  lat: number;
  lng: number;
};

export type ViewportSearchRequest = {
  bounds: MapBounds;
  center: {
    lat: number;
    lng: number;
  };
};

type LeafletModule = typeof import("leaflet");

const DEFAULT_MAP_CENTER = { lat: 36.3322, lng: 127.4341 };
const DEFAULT_MAP_ZOOM = 9;
const MAP_VIEW_STORAGE_KEY = "aigo:places-map-view:v3";
let highlightedResultTimer: number | undefined;
let initialGeolocationRequest: Promise<GeolocationPosition> | null = null;

export function PlacesMap({
  autoLocateOnInitialLoad = false,
  isViewportSearchPending = false,
  onInitialLocationSearch,
  onViewportSearch,
  origin,
  places,
  preserveViewOnUpdate = false
}: PlacesMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const placeMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const userLocationMarkerRef = useRef<LeafletMarker | null>(null);
  const initializedViewKeyRef = useRef<string | null>(null);
  const initialLocationRequestedRef = useRef(false);
  const hoveredCardPlaceIdRef = useRef<string | null>(null);
  const locationRequestTimerRef = useRef<number | null>(null);
  const locationRequestTokenRef = useRef(0);
  const viewKeyRef = useRef(mapViewKey(origin));
  const [viewportSearchRequest, setViewportSearchRequest] = useState<ViewportSearchRequest | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "denied" | "unsupported">("idle");

  const focusCurrentLocation = useCallback(
    async (lat: number, lng: number, options: { runSearch?: boolean } = {}) => {
      const map = mapRef.current;
      if (!map) {
        setLocationStatus("idle");
        return;
      }

      const L = await import("leaflet");
      const target = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6))
      };

      userLocationMarkerRef.current = updateUserLocationMarker(L, map, userLocationMarkerRef.current, target);
      const targetZoom = Math.max(map.getZoom(), 15);
      if (options.runSearch) {
        viewKeyRef.current = mapViewKey({ ...target, label: "현재 위치" });
      }
      map.flyTo([target.lat, target.lng], targetZoom, { animate: true, duration: 0.65 });

      if (options.runSearch) {
        onInitialLocationSearch?.(target);
      } else {
        if (locationRequestTimerRef.current) window.clearTimeout(locationRequestTimerRef.current);
        locationRequestTimerRef.current = window.setTimeout(() => {
          setViewportSearchRequest(buildViewportSearchRequest(map));
          locationRequestTimerRef.current = null;
        }, 720);
      }
      setLocationStatus("idle");
    },
    [onInitialLocationSearch]
  );

  const requestInitialLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }

    const requestToken = ++locationRequestTokenRef.current;
    setLocationStatus("locating");
    void getInitialGeolocationPosition().then(
      ({ coords }) => {
        if (locationRequestTokenRef.current !== requestToken) return;
        void focusCurrentLocation(coords.latitude, coords.longitude, { runSearch: true });
      },
      () => {
        if (locationRequestTokenRef.current !== requestToken) return;
        setLocationStatus("denied");
      }
    );
  }, [focusCurrentLocation]);

  useEffect(() => {
    return () => {
      if (locationRequestTimerRef.current) window.clearTimeout(locationRequestTimerRef.current);
      locationRequestTokenRef.current += 1;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
      userLocationMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    async function renderMap() {
      const L = await import("leaflet");
      if (disposed || !mapElementRef.current) return;

      const viewKey = mapViewKey(origin);
      const shouldApplyMapView = initializedViewKeyRef.current !== viewKey && !(preserveViewOnUpdate && mapRef.current);
      const shouldRequestInitialLocation =
        autoLocateOnInitialLoad && !initialLocationRequestedRef.current && initializedViewKeyRef.current === null;
      viewKeyRef.current = viewKey;
      const map = getOrCreateMap(L, mapElementRef.current, mapRef, viewKeyRef, (changedMap) => {
        setViewportSearchRequest(buildViewportSearchRequest(changedMap));
      });
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
      }
      initializedViewKeyRef.current = viewKey;

      map.invalidateSize();
      setViewportSearchRequest(null);

      if (shouldRequestInitialLocation) {
        initialLocationRequestedRef.current = true;
        requestInitialLocation();
      }
    }

    void renderMap();

    return () => {
      disposed = true;
    };
  }, [autoLocateOnInitialLoad, origin, places, preserveViewOnUpdate, requestInitialLocation]);

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

  function moveToCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }

    const requestToken = ++locationRequestTokenRef.current;
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (locationRequestTokenRef.current !== requestToken) return;
        void focusCurrentLocation(coords.latitude, coords.longitude);
      },
      () => {
        if (locationRequestTokenRef.current !== requestToken) return;
        setLocationStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 300000, timeout: 8000 }
    );
  }

  const locationStatusLabel = locationStatusMessage(locationStatus);

  return (
    <aside className="map-card" aria-label="검색 결과 지도">
      <div className="map-canvas">
        <div className="map-overlay-strip">
          <span className="map-count-chip">{places.length}곳</span>
          {viewportSearchRequest ? (
            <button
              className="map-search-button"
              type="button"
              onClick={() => onViewportSearch?.(viewportSearchRequest)}
              disabled={isViewportSearchPending || !onViewportSearch}
            >
              {isViewportSearchPending ? "검색 중" : "이 화면 검색"}
            </button>
          ) : null}
        </div>
        <div className="map-location-control">
          <button
            aria-label={locationStatus === "locating" ? "현재 위치 확인 중" : "내 위치로 지도 이동"}
            className="map-location-button"
            disabled={locationStatus === "locating"}
            onClick={moveToCurrentLocation}
            title="내 위치로 지도 이동"
            type="button"
          >
            <LocateFixed size={17} aria-hidden="true" />
          </button>
          {locationStatusLabel ? (
            <span className="map-location-status" aria-live="polite">
              {locationStatusLabel}
            </span>
          ) : null}
        </div>
        <div className="leaflet-map" ref={mapElementRef} />
      </div>
    </aside>
  );
}

function locationStatusMessage(status: "idle" | "locating" | "denied" | "unsupported") {
  if (status === "locating") return "위치 확인 중";
  if (status === "denied") return "위치 권한 필요";
  if (status === "unsupported") return "위치 미지원";
  return null;
}

function getOrCreateMap(
  L: LeafletModule,
  element: HTMLDivElement,
  mapRef: MutableRefObject<LeafletMap | null>,
  viewKeyRef: MutableRefObject<string>,
  onViewportChanged: (map: LeafletMap) => void
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

  map.on("moveend zoomend", () => {
    saveMapView(viewKeyRef.current, map);
  });
  map.on("dragend zoomend", () => {
    onViewportChanged(map);
  });

  mapRef.current = map;
  return map;
}

function buildViewportSearchRequest(map: LeafletMap): ViewportSearchRequest {
  const bounds = map.getBounds();
  const center = map.getCenter();

  return {
    bounds: {
      minLat: Number(bounds.getSouth().toFixed(6)),
      minLng: Number(bounds.getWest().toFixed(6)),
      maxLat: Number(bounds.getNorth().toFixed(6)),
      maxLng: Number(bounds.getEast().toFixed(6))
    },
    center: {
      lat: Number(center.lat.toFixed(6)),
      lng: Number(center.lng.toFixed(6))
    }
  };
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

function userLocationIcon(L: LeafletModule) {
  return L.divIcon({
    className: "map-user-location-marker",
    html: "<span></span>",
    iconAnchor: [14, 14],
    iconSize: [28, 28]
  });
}

function updateUserLocationMarker(
  L: LeafletModule,
  map: LeafletMap,
  marker: LeafletMarker | null,
  location: {
    lat: number;
    lng: number;
  }
) {
  if (marker) {
    marker.setLatLng([location.lat, location.lng]);
    return marker;
  }

  return L.marker([location.lat, location.lng], {
    icon: userLocationIcon(L),
    interactive: false,
    keyboard: false,
    title: "내 위치"
  }).addTo(map);
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

function getInitialGeolocationPosition() {
  initialGeolocationRequest ??= new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 300000, timeout: 8000 });
  });
  return initialGeolocationRequest;
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
