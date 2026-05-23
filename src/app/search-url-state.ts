export type SearchParamsRecord = Record<string, string | string[]>;

export type MapViewportSearchRequest = {
  bounds: {
    maxLat: number;
    maxLng: number;
    minLat: number;
    minLng: number;
  };
  center: {
    lat: number;
    lng: number;
  };
};

export const MAP_LOCATION_PARAM_KEYS = ["lat", "lng", "radiusKm", "nearby", "minLat", "minLng", "maxLat", "maxLng"] as const;

const RESET_ON_SEARCH_PARAM_KEYS = ["page", "offset"] as const;

export function searchParamsForViewportSearch(params: SearchParamsRecord, request: MapViewportSearchRequest): SearchParamsRecord {
  const next = cloneSearchParamsRecord(params);

  for (const key of RESET_ON_SEARCH_PARAM_KEYS) delete next[key];
  delete next.nearby;
  delete next.radiusKm;

  next.lat = coordinateParam(request.center.lat);
  next.lng = coordinateParam(request.center.lng);
  next.minLat = coordinateParam(request.bounds.minLat);
  next.minLng = coordinateParam(request.bounds.minLng);
  next.maxLat = coordinateParam(request.bounds.maxLat);
  next.maxLng = coordinateParam(request.bounds.maxLng);

  return next;
}

export function searchParamsWithCurrentLocationState(search: string, formData: FormData): URLSearchParams {
  const params = currentLocationSearchParams(search);
  const shouldPreferCurrentLocationState = hasAnyParam(params);

  for (const [key, value] of formData.entries()) {
    const text = String(value).trim();
    if (text.length === 0) continue;
    if (shouldPreferCurrentLocationState && isMapLocationParam(key)) continue;
    params.set(key, text);
  }

  for (const key of RESET_ON_SEARCH_PARAM_KEYS) params.delete(key);
  return params;
}

function currentLocationSearchParams(search: string) {
  const current = new URLSearchParams(search);
  const params = new URLSearchParams();

  for (const key of MAP_LOCATION_PARAM_KEYS) {
    for (const value of current.getAll(key)) {
      const text = value.trim();
      if (text.length > 0) params.append(key, text);
    }
  }

  return params;
}

function isMapLocationParam(key: string): key is (typeof MAP_LOCATION_PARAM_KEYS)[number] {
  return MAP_LOCATION_PARAM_KEYS.includes(key as (typeof MAP_LOCATION_PARAM_KEYS)[number]);
}

function hasAnyParam(params: URLSearchParams) {
  return Array.from(params.keys()).length > 0;
}

function cloneSearchParamsRecord(params: SearchParamsRecord): SearchParamsRecord {
  const next: SearchParamsRecord = {};
  for (const [key, value] of Object.entries(params)) {
    next[key] = Array.isArray(value) ? [...value] : value;
  }
  return next;
}

function coordinateParam(value: number) {
  return value.toFixed(6);
}
