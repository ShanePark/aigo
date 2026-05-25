import { buildSearchInput, type HomeSearchSort } from "@/app/home-search-state";
import {
  searchParamsForCurrentLocation,
  searchParamsForHomeLocation,
  searchParamsWithQueryValue,
  type SearchParamsRecord
} from "@/app/search-url-state";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";

type LocationSearchKind = "current" | "home";

type BuildLocationSearchStateOptions = {
  activeInput: SearchPlacesInput;
  activeParams: SearchParamsRecord;
  activeSort: HomeSearchSort;
  formQuery?: string | null;
  kind: LocationSearchKind;
  location: {
    lat: number;
    lng: number;
  };
};

export function buildLocationSearchState({
  activeInput,
  activeParams,
  activeSort,
  formQuery,
  kind,
  location
}: BuildLocationSearchStateOptions) {
  const sort = homeSort(activeInput.sort, activeSort);
  const paramsWithQuery = searchParamsWithQueryValue(activeParams, formQuery);
  const nextParams =
    kind === "home"
      ? searchParamsForHomeLocation(paramsWithQuery, location, { sort })
      : searchParamsForCurrentLocation(paramsWithQuery, location, { sort });
  const nextSearchInput = searchPlacesSchema.parse(buildSearchInput(nextParams));
  const label = kind === "home" ? "집 위치" : "현재 위치";

  return {
    input: {
      ...nextSearchInput,
      filterByRadius: true,
      offset: 0,
      origin: {
        lat: location.lat,
        lng: location.lng,
        label
      },
      radiusKm: nextSearchInput.radiusKm ?? activeInput.radiusKm ?? 80,
      sort,
      viewportBounds: undefined
    } satisfies SearchPlacesInput,
    params: nextParams
  };
}

function homeSort(sort: SearchPlacesInput["sort"], fallback: HomeSearchSort) {
  return sort === "recommended" || sort === "distance" || sort === "rating" ? sort : fallback;
}
