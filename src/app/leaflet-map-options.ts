export const LEAFLET_WHEEL_PX_PER_ZOOM_LEVEL = 120;

export const LEAFLET_SCROLL_WHEEL_OPTIONS = {
  scrollWheelZoom: true,
  // Leaflet's default 60px threshold can snap a common 120px mouse-wheel tick to two zoom levels.
  wheelPxPerZoomLevel: LEAFLET_WHEEL_PX_PER_ZOOM_LEVEL
} as const;
