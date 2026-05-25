const DEFAULT_SEARCH_MAP_VIEW_KEY = "36.5000,127.8000";
const MAP_VIEW_STORAGE_KEY = "aigo:places-map-view:v4";
const RESET_MAP_ZOOM = 12;

export const DEFAULT_SEARCH_MAP_CENTER = { lat: 36.5, lng: 127.8 };

export function saveResetMapViewToStorage(storage: Pick<Storage, "getItem" | "setItem">, lat: number, lng: number) {
  const saved = storage.getItem(MAP_VIEW_STORAGE_KEY);
  const parsed = saved ? (JSON.parse(saved) as Record<string, unknown>) : {};
  storage.setItem(
    MAP_VIEW_STORAGE_KEY,
    JSON.stringify({
      ...parsed,
      [DEFAULT_SEARCH_MAP_VIEW_KEY]: {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        zoom: RESET_MAP_ZOOM
      }
    })
  );
}
