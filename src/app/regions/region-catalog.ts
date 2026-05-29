export const REGION_MAJOR_CATEGORIES = [
  "zoo",
  "aquarium",
  "museum",
  "science_museum",
  "art_museum",
  "experience_center",
  "shopping_mall",
  "accommodation",
  "library"
] as const;

export type RegionCatalogItem = {
  center: {
    lat: number;
    lng: number;
  };
  imageAlt: string;
  imagePromptSubject: string;
  imageSrc: string;
  label: string;
  mapPosition: {
    x: number;
    y: number;
  };
  regionSido: string;
  slug: string;
};

export const KOREA_REGIONS = [
  {
    slug: "seoul",
    label: "서울",
    regionSido: "서울특별시",
    center: { lat: 37.5665, lng: 126.978 },
    mapPosition: { x: 44, y: 25 },
    imageSrc: "/images/regions/seoul.webp",
    imageAlt: "서울을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Seoul, Korea, with N Seoul Tower, Gyeongbokgung palace roofs, Han River bridges, and modern high-rises"
  },
  {
    slug: "incheon",
    label: "인천",
    regionSido: "인천광역시",
    center: { lat: 37.4563, lng: 126.7052 },
    mapPosition: { x: 30, y: 28 },
    imageSrc: "/images/regions/incheon.webp",
    imageAlt: "인천을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Incheon, Korea, with Songdo skyline, Incheon Bridge, coastal port elements, and airport travel cues"
  },
  {
    slug: "gyeonggi",
    label: "경기",
    regionSido: "경기도",
    center: { lat: 37.4138, lng: 127.5183 },
    mapPosition: { x: 53, y: 31 },
    imageSrc: "/images/regions/gyeonggi.webp",
    imageAlt: "경기를 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Gyeonggi-do, Korea, with Suwon Hwaseong fortress, family parks, modern satellite cities, and green hills"
  },
  {
    slug: "gangwon",
    label: "강원",
    regionSido: "강원특별자치도",
    center: { lat: 37.8228, lng: 128.1555 },
    mapPosition: { x: 68, y: 23 },
    imageSrc: "/images/regions/gangwon.webp",
    imageAlt: "강원을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Gangwon, Korea, with Seoraksan mountain ridges, ski resort roofs, pine forests, and East Sea coastline"
  },
  {
    slug: "chungbuk",
    label: "충북",
    regionSido: "충청북도",
    center: { lat: 36.8, lng: 127.7 },
    mapPosition: { x: 56, y: 44 },
    imageSrc: "/images/regions/chungbuk.webp",
    imageAlt: "충북을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Chungcheongbuk-do, Korea, with lake scenery, forested inland hills, Cheongju urban landmarks, and family-friendly public buildings"
  },
  {
    slug: "sejong",
    label: "세종",
    regionSido: "세종특별자치시",
    center: { lat: 36.48, lng: 127.289 },
    mapPosition: { x: 45, y: 48 },
    imageSrc: "/images/regions/sejong.webp",
    imageAlt: "세종을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Sejong, Korea, with government complex architecture, Geum River paths, planned city blocks, and clean public plazas"
  },
  {
    slug: "daejeon",
    label: "대전",
    regionSido: "대전광역시",
    center: { lat: 36.3504, lng: 127.3845 },
    mapPosition: { x: 52, y: 52 },
    imageSrc: "/images/regions/daejeon.webp",
    imageAlt: "대전을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Daejeon, Korea, with Expo science park landmarks, research district buildings, green parks, and city boulevards"
  },
  {
    slug: "chungnam",
    label: "충남",
    regionSido: "충청남도",
    center: { lat: 36.5184, lng: 126.8 },
    mapPosition: { x: 33, y: 49 },
    imageSrc: "/images/regions/chungnam.webp",
    imageAlt: "충남을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Chungcheongnam-do, Korea, with Baekje cultural roofs, coastal mudflat scenery, gentle hills, and family travel roads"
  },
  {
    slug: "jeonbuk",
    label: "전북",
    regionSido: "전북특별자치도",
    center: { lat: 35.7175, lng: 127.153 },
    mapPosition: { x: 43, y: 64 },
    imageSrc: "/images/regions/jeonbuk.webp",
    imageAlt: "전북을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Jeonbuk, Korea, with Jeonju hanok village roofs, open farmland, gentle mountains, and cultural museum buildings"
  },
  {
    slug: "gwangju",
    label: "광주",
    regionSido: "광주광역시",
    center: { lat: 35.1595, lng: 126.8526 },
    mapPosition: { x: 35, y: 76 },
    imageSrc: "/images/regions/gwangju.webp",
    imageAlt: "광주를 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Gwangju, Korea, with Mudeungsan mountain backdrop, cultural art center buildings, city streets, and warm public plazas"
  },
  {
    slug: "jeonnam",
    label: "전남",
    regionSido: "전라남도",
    center: { lat: 34.8679, lng: 126.991 },
    mapPosition: { x: 42, y: 82 },
    imageSrc: "/images/regions/jeonnam.webp",
    imageAlt: "전남을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Jeollanam-do, Korea, with island coastline, Suncheon bay reeds, coastal bridges, gardens, and small harbor towns"
  },
  {
    slug: "daegu",
    label: "대구",
    regionSido: "대구광역시",
    center: { lat: 35.8714, lng: 128.6014 },
    mapPosition: { x: 69, y: 61 },
    imageSrc: "/images/regions/daegu.webp",
    imageAlt: "대구를 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Daegu, Korea, with Palgongsan mountain hints, modern city avenues, cultural landmarks, and warm sunny urban parks"
  },
  {
    slug: "gyeongbuk",
    label: "경북",
    regionSido: "경상북도",
    center: { lat: 36.4919, lng: 128.8889 },
    mapPosition: { x: 75, y: 48 },
    imageSrc: "/images/regions/gyeongbuk.webp",
    imageAlt: "경북을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Gyeongsangbuk-do, Korea, with Gyeongju heritage roofs, Andong traditional village, rolling mountains, and river scenery"
  },
  {
    slug: "busan",
    label: "부산",
    regionSido: "부산광역시",
    center: { lat: 35.1796, lng: 129.0756 },
    mapPosition: { x: 79, y: 76 },
    imageSrc: "/images/regions/busan.webp",
    imageAlt: "부산을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Busan, Korea, with Gwangan Bridge, Haeundae beach, colorful hillside village buildings, and coastal high-rises"
  },
  {
    slug: "ulsan",
    label: "울산",
    regionSido: "울산광역시",
    center: { lat: 35.5384, lng: 129.3114 },
    mapPosition: { x: 83, y: 68 },
    imageSrc: "/images/regions/ulsan.webp",
    imageAlt: "울산을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Ulsan, Korea, with Taehwagang river garden, whale and coastal motifs, modern city architecture, and green park paths"
  },
  {
    slug: "gyeongnam",
    label: "경남",
    regionSido: "경상남도",
    center: { lat: 35.4606, lng: 128.2132 },
    mapPosition: { x: 66, y: 75 },
    imageSrc: "/images/regions/gyeongnam.webp",
    imageAlt: "경남을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Gyeongsangnam-do, Korea, with coastal islands, Jinhae cherry blossom streets, family parks, and harbor bridges"
  },
  {
    slug: "jeju",
    label: "제주",
    regionSido: "제주특별자치도",
    center: { lat: 33.4996, lng: 126.5312 },
    mapPosition: { x: 50, y: 94 },
    imageSrc: "/images/regions/jeju.webp",
    imageAlt: "제주를 상징하는 미니어처 섬 이미지",
    imagePromptSubject: "Jeju Island, Korea, with Hallasan mountain, volcanic stone walls, ocean cliffs, tangerine trees, and family resort buildings"
  }
] as const satisfies readonly RegionCatalogItem[];

export type RegionSlug = (typeof KOREA_REGIONS)[number]["slug"];

export function regionBySlug(slug: string | null | undefined) {
  return KOREA_REGIONS.find((region) => region.slug === slug) ?? KOREA_REGIONS[0];
}
