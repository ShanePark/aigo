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

export function PlacesMap({ origin, places }: PlacesMapProps) {
  const bounds = mapBounds(origin, places);
  const mapUrl = osmEmbedUrl(bounds);

  return (
    <aside className="map-card" aria-label="검색 결과 지도">
      <div className="map-card-head">
        <div>
          <h2>주변 지도</h2>
          <p>{origin?.label ?? "대전역/원도심 기준"}</p>
        </div>
        <span>{places.length}곳</span>
      </div>
      <div className="map-canvas">
        <iframe src={mapUrl} title="주변 장소 지도" loading="lazy" />
        <div className="map-overlay">
          {origin ? <span className="map-origin-marker" style={pointStyle(origin.lat, origin.lng, bounds)} /> : null}
          {places.map((place, index) => (
            <a
              className={`map-place-marker ${markerTone(place.category)}`}
              href={place.href}
              key={place.placeId}
              style={pointStyle(place.lat, place.lng, bounds)}
              title={`${place.name} ${place.distance}`}
            >
              <span>{index + 1}</span>
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
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

function osmEmbedUrl(bounds: MapBounds) {
  const params = new URLSearchParams({
    bbox: [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat].map((value) => value.toFixed(6)).join(","),
    layer: "mapnik"
  });

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

function pointStyle(lat: number, lng: number, bounds: MapBounds) {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
  const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 100;

  return {
    left: `${clamp(x, 4, 96)}%`,
    top: `${clamp(y, 4, 96)}%`
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function markerTone(category: string) {
  if (category === "family_restaurant") return "dining";
  if (category === "kids_cafe" || category === "family_cafe") return "kids";
  if (category === "park" || category === "indoor_playground") return "play";
  if (category === "accommodation") return "stay";
  return "visit";
}
