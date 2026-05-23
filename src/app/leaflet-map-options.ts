import type { Map as LeafletMap } from "leaflet";

type LeafletModule = typeof import("leaflet");
type WheelEventLike = Pick<WheelEvent, "deltaX" | "deltaY" | "deltaZ"> & {
  wheelDelta?: number;
  wheelDeltaY?: number;
};

export const LEAFLET_WHEEL_ZOOM_COOLDOWN_MS = 220;

export const LEAFLET_SCROLL_WHEEL_OPTIONS = {
  scrollWheelZoom: false
} as const;

export function installSingleStepWheelZoom(L: LeafletModule, map: LeafletMap, element: HTMLElement) {
  let lastZoomAt = 0;

  function handleWheel(event: WheelEvent) {
    const direction = wheelZoomDirection(event);
    if (direction === 0) return;

    event.preventDefault();
    event.stopPropagation();

    const now = Date.now();
    if (now - lastZoomAt < LEAFLET_WHEEL_ZOOM_COOLDOWN_MS) return;
    lastZoomAt = now;

    map.setZoomAround(map.mouseEventToContainerPoint(event), map.getZoom() + direction);
  }

  element.addEventListener("wheel", handleWheel, { passive: false });

  const cleanup = () => {
    element.removeEventListener("wheel", handleWheel);
  };
  map.on("unload", cleanup);

  return () => {
    map.off("unload", cleanup);
    cleanup();
  };
}

export function wheelZoomDirection(event: WheelEventLike) {
  const verticalDelta = event.deltaY || (event.wheelDeltaY !== undefined ? -event.wheelDeltaY : -(event.wheelDelta ?? 0));
  if (!Number.isFinite(verticalDelta) || Math.abs(verticalDelta) < 1) return 0;
  if (Math.abs(event.deltaX) > Math.abs(verticalDelta) || event.deltaZ) return 0;

  return verticalDelta < 0 ? 1 : -1;
}
