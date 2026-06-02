export type SearchParamsRecord = Record<string, string | string[]>;
type SearchParamsLike = Record<string, string | string[] | undefined>;

export const CLIENT_SEARCH_EVENT = "aigo:client-search";

export type ClientSearchEventDetail = {
  params: SearchParamsRecord;
};

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

export const MAP_LOCATION_PARAM_KEYS = ["lat", "lng", "radiusKm", "nearby", "home", "minLat", "minLng", "maxLat", "maxLng"] as const;

const RESET_ON_SEARCH_PARAM_KEYS = ["page", "offset"] as const;
const CATEGORY_PARAM_KEYS = ["category", "categoryGroup", "categoryGroups"] as const;
const VIEWPORT_PARAM_KEYS = ["minLat", "minLng", "maxLat", "maxLng"] as const;

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

export function searchParamsWithQueryValue(params: SearchParamsRecord, query: string | null | undefined): SearchParamsRecord {
  const next = cloneSearchParamsRecord(params);
  const text = query?.trim();

  if (text) {
    next.query = text;
  } else {
    delete next.query;
  }

  return next;
}

export function searchParamsForCurrentLocation(
  params: SearchParamsRecord,
  location: { lat: number; lng: number },
  options: { radiusKm?: string; sort?: string } = {}
): SearchParamsRecord {
  const next = cloneSearchParamsRecord(params);

  for (const key of RESET_ON_SEARCH_PARAM_KEYS) delete next[key];
  for (const key of VIEWPORT_PARAM_KEYS) delete next[key];

  next.lat = coordinateParam(location.lat);
  next.lng = coordinateParam(location.lng);
  next.nearby = "1";
  delete next.home;

  if (options.radiusKm) {
    next.radiusKm = options.radiusKm;
  }
  if (options.sort) {
    next.sort = options.sort;
  }

  return next;
}

export function searchParamsForHomeLocation(
  params: SearchParamsRecord,
  location: { lat: number; lng: number },
  options: { radiusKm?: string; sort?: string } = {}
): SearchParamsRecord {
  const next = cloneSearchParamsRecord(params);

  for (const key of RESET_ON_SEARCH_PARAM_KEYS) delete next[key];
  for (const key of VIEWPORT_PARAM_KEYS) delete next[key];

  next.lat = coordinateParam(location.lat);
  next.lng = coordinateParam(location.lng);
  next.home = "1";
  delete next.nearby;

  if (options.radiusKm) {
    next.radiusKm = options.radiusKm;
  }
  if (options.sort) {
    next.sort = options.sort;
  }

  return next;
}

export function hasMapLocationParams(params: SearchParamsLike) {
  return MAP_LOCATION_PARAM_KEYS.some((key) => hasParamValue(params[key]));
}

export function clearMapLocationParamsForTextSearch(params: URLSearchParams | FormData, previousSearch = "") {
  const query = params.get("query");
  if (typeof query !== "string" || query.trim().length === 0) return params;

  for (const key of MAP_LOCATION_PARAM_KEYS) params.delete(key);
  if (!hasPreviousTextQuery(previousSearch)) {
    for (const key of CATEGORY_PARAM_KEYS) params.delete(key);
  }
  return params;
}

export function searchParamsWithCurrentLocationState(search: string, formData: FormData): URLSearchParams {
  const params = currentLocationSearchParams(search);
  const shouldPreferCurrentLocationState = hasAnyParam(params);

  for (const [key, value] of formData.entries()) {
    const text = String(value).trim();
    if (text.length === 0) continue;
    if (shouldPreferCurrentLocationState && isMapLocationParam(key)) continue;
    if (isMultiValueFormParam(key)) {
      params.append(key, text);
    } else {
      params.set(key, text);
    }
  }

  for (const key of RESET_ON_SEARCH_PARAM_KEYS) params.delete(key);
  return params;
}

export function searchParamsRecordFromURLSearchParams(params: URLSearchParams): SearchParamsRecord {
  const record: SearchParamsRecord = {};

  for (const key of params.keys()) {
    const values = params.getAll(key).filter((value) => value.trim().length > 0);
    if (values.length === 1) {
      record[key] = values[0];
    } else if (values.length > 1) {
      record[key] = values;
    }
  }

  return record;
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

function isMultiValueFormParam(key: string) {
  return key === "accommodationType" || key === "category" || key === "categoryGroups";
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

function hasPreviousTextQuery(search: string) {
  if (!search) return false;
  return Boolean(new URLSearchParams(search).get("query")?.trim());
}

function hasParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.some((item) => item.trim().length > 0);
  return Boolean(value?.trim());
}
