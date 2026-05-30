export const REGION_MAJOR_CATEGORIES = [
  "zoo",
  "aquarium",
  "museum",
  "science_museum",
  "art_museum",
  "experience_center",
  "park",
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
  iconSrc?: string;
  imagePromptSubject: string;
  imageSrc: string;
  intro: string;
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
    iconSrc: "/images/region-icons/seoul.webp",
    imageAlt: "서울을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Seoul, Korea, with N Seoul Tower, Gyeongbokgung palace roofs, Han River bridges, and modern high-rises",
    intro: "한강과 동네 공원이 촘촘해, 짧은 가족 나들이가 쉬운 도시예요."
  },
  {
    slug: "incheon",
    label: "인천",
    regionSido: "인천광역시",
    center: { lat: 37.4563, lng: 126.7052 },
    mapPosition: { x: 30, y: 28 },
    imageSrc: "/images/regions/incheon.webp",
    iconSrc: "/images/region-icons/incheon.webp",
    imageAlt: "인천을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Incheon, Korea, with Songdo skyline, Incheon Bridge, coastal port elements, and airport travel cues",
    intro: "공항의 설렘과 바다 바람이 만나는, 가볍게 떠나기 좋은 인천이에요."
  },
  {
    slug: "gyeonggi",
    label: "경기",
    regionSido: "경기도",
    center: { lat: 37.4138, lng: 127.5183 },
    mapPosition: { x: 53, y: 31 },
    imageSrc: "/images/regions/gyeonggi.webp",
    iconSrc: "/images/region-icons/gyeonggi.webp",
    imageAlt: "경기를 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Gyeonggi-do, Korea, with Suwon Hwaseong fortress, family parks, modern satellite cities, and green hills",
    intro: "큰 도시의 편리함과 강·숲 바람이 가까운, 주말 선택지가 넓은 경기예요."
  },
  {
    slug: "gangwon",
    label: "강원",
    regionSido: "강원특별자치도",
    center: { lat: 37.8228, lng: 128.1555 },
    mapPosition: { x: 68, y: 23 },
    imageSrc: "/images/regions/gangwon.webp",
    iconSrc: "/images/region-icons/gangwon.webp",
    imageAlt: "강원을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Gangwon, Korea, with Seoraksan mountain ridges, ski resort roofs, pine forests, and East Sea coastline",
    intro: "바다도 숲도 가까워 아이와 숨 크게 쉬기 좋은 강원이에요."
  },
  {
    slug: "chungbuk",
    label: "충북",
    regionSido: "충청북도",
    center: { lat: 36.8, lng: 127.7 },
    mapPosition: { x: 56, y: 44 },
    imageSrc: "/images/regions/chungbuk.webp",
    iconSrc: "/images/region-icons/chungbuk.webp",
    imageAlt: "충북을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Chungcheongbuk-do, Korea, with lake scenery, forested inland hills, Cheongju urban landmarks, and family-friendly public buildings",
    intro: "호수 바람과 산길이 가까워 아이와 쉬어가기 좋은 충북이에요."
  },
  {
    slug: "sejong",
    label: "세종",
    regionSido: "세종특별자치시",
    center: { lat: 36.48, lng: 127.289 },
    mapPosition: { x: 45, y: 48 },
    imageSrc: "/images/regions/sejong.webp",
    iconSrc: "/images/region-icons/sejong.webp",
    imageAlt: "세종을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Sejong, Korea, with government complex architecture, Geum River paths, planned city blocks, and clean public plazas",
    intro: "젊은 계획도시의 초록 동선을 따라 아이와 가볍게 쉬어가기 좋아요."
  },
  {
    slug: "daejeon",
    label: "대전",
    regionSido: "대전광역시",
    center: { lat: 36.3504, lng: 127.3845 },
    mapPosition: { x: 52, y: 52 },
    imageSrc: "/images/regions/daejeon.webp",
    iconSrc: "/images/region-icons/daejeon.webp",
    imageAlt: "대전을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Daejeon, Korea, with Expo science park landmarks, research district buildings, green parks, and city boulevards",
    intro: "과학의 호기심과 숲길 쉼표가 가까운, 가뿐한 가족 나들이 도시예요."
  },
  {
    slug: "chungnam",
    label: "충남",
    regionSido: "충청남도",
    center: { lat: 36.5184, lng: 126.8 },
    mapPosition: { x: 33, y: 49 },
    imageSrc: "/images/regions/chungnam.webp",
    iconSrc: "/images/region-icons/chungnam.webp",
    imageAlt: "충남을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Chungcheongnam-do, Korea, with Baekje cultural roofs, coastal mudflat scenery, gentle hills, and family travel roads",
    intro: "바다와 들, 백제의 결이 가까워 아이와 느긋하게 고르기 좋은 충남이에요."
  },
  {
    slug: "jeonbuk",
    label: "전북",
    regionSido: "전북특별자치도",
    center: { lat: 35.7175, lng: 127.153 },
    mapPosition: { x: 43, y: 64 },
    imageSrc: "/images/regions/jeonbuk.webp",
    iconSrc: "/images/region-icons/jeonbuk.webp",
    imageAlt: "전북을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Jeonbuk, Korea, with Jeonju hanok village roofs, open farmland, gentle mountains, and cultural museum buildings",
    intro: "바다와 들, 산길이 가까워 아이와 천천히 쉬어가기 좋은 전북이에요."
  },
  {
    slug: "gwangju",
    label: "광주",
    regionSido: "광주광역시",
    center: { lat: 35.1595, lng: 126.8526 },
    mapPosition: { x: 35, y: 76 },
    imageSrc: "/images/regions/gwangju.webp",
    iconSrc: "/images/region-icons/gwangju.webp",
    imageAlt: "광주를 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Gwangju, Korea, with Mudeungsan mountain backdrop, cultural art center buildings, city streets, and warm public plazas",
    intro: "예술과 민주, 맛과 축제가 가까워 아이와 밝게 걷기 좋은 광주예요."
  },
  {
    slug: "jeonnam",
    label: "전남",
    regionSido: "전라남도",
    center: { lat: 34.8679, lng: 126.991 },
    mapPosition: { x: 42, y: 82 },
    imageSrc: "/images/regions/jeonnam.webp",
    iconSrc: "/images/region-icons/jeonnam.webp",
    imageAlt: "전남을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Jeollanam-do, Korea, with island coastline, Suncheon bay reeds, coastal bridges, gardens, and small harbor towns",
    intro: "바다와 들, 맛있는 한 끼가 이어지는 느긋한 가족 나들이예요."
  },
  {
    slug: "daegu",
    label: "대구",
    regionSido: "대구광역시",
    center: { lat: 35.8714, lng: 128.6014 },
    mapPosition: { x: 69, y: 61 },
    imageSrc: "/images/regions/daegu.webp",
    iconSrc: "/images/region-icons/daegu.webp",
    imageAlt: "대구를 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Daegu, Korea, with Palgongsan mountain hints, modern city avenues, cultural landmarks, and warm sunny urban parks",
    intro: "강바람과 음악이 살랑이는 대구, 아이와 천천히 쉬어가기 좋아요."
  },
  {
    slug: "gyeongbuk",
    label: "경북",
    regionSido: "경상북도",
    center: { lat: 36.4919, lng: 128.8889 },
    mapPosition: { x: 75, y: 48 },
    imageSrc: "/images/regions/gyeongbuk.webp",
    iconSrc: "/images/region-icons/gyeongbuk.webp",
    imageAlt: "경북을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Gyeongsangbuk-do, Korea, with Gyeongju heritage roofs, Andong traditional village, rolling mountains, and river scenery",
    intro: "산·강·바다와 옛이야기가 넓게 펼쳐지는 느긋한 가족 여행지예요."
  },
  {
    slug: "busan",
    label: "부산",
    regionSido: "부산광역시",
    center: { lat: 35.1796, lng: 129.0756 },
    mapPosition: { x: 79, y: 76 },
    imageSrc: "/images/regions/busan.webp",
    iconSrc: "/images/region-icons/busan.webp",
    imageAlt: "부산을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Busan, Korea, with Gwangan Bridge, Haeundae beach, colorful hillside village buildings, and coastal high-rises",
    intro: "바다와 산길, 축제 기운이 가까워 아이와 산뜻하게 움직이기 좋은 도시예요."
  },
  {
    slug: "ulsan",
    label: "울산",
    regionSido: "울산광역시",
    center: { lat: 35.5384, lng: 129.3114 },
    mapPosition: { x: 83, y: 68 },
    imageSrc: "/images/regions/ulsan.webp",
    iconSrc: "/images/region-icons/ulsan.webp",
    imageAlt: "울산을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Ulsan, Korea, with Taehwagang river garden, whale and coastal motifs, modern city architecture, and green park paths",
    intro: "산업도시의 활기와 바다·강·산 산책이 함께 있는 시원한 울산이에요."
  },
  {
    slug: "gyeongnam",
    label: "경남",
    regionSido: "경상남도",
    center: { lat: 35.4606, lng: 128.2132 },
    mapPosition: { x: 66, y: 75 },
    imageSrc: "/images/regions/gyeongnam.webp",
    iconSrc: "/images/region-icons/gyeongnam.webp",
    imageAlt: "경남을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Gyeongsangnam-do, Korea, with coastal islands, Jinhae cherry blossom streets, family parks, and harbor bridges",
    intro: "바다와 숲길, 강바람이 번갈아 반기는 느긋한 가족 나들이권이에요."
  },
  {
    slug: "jeju",
    label: "제주",
    regionSido: "제주특별자치도",
    center: { lat: 33.4996, lng: 126.5312 },
    mapPosition: { x: 50, y: 94 },
    imageSrc: "/images/regions/jeju.webp",
    iconSrc: "/images/region-icons/jeju.webp",
    imageAlt: "제주를 상징하는 미니어처 섬 이미지",
    imagePromptSubject: "Jeju Island, Korea, with Hallasan mountain, volcanic stone walls, ocean cliffs, tangerine trees, and family resort buildings",
    intro: "바다와 오름, 숲길이 가까워 하루 기분을 가볍게 바꾸는 섬이에요."
  }
] as const satisfies readonly RegionCatalogItem[];

export type RegionSlug = (typeof KOREA_REGIONS)[number]["slug"];

export function regionBySlug(slug: string | null | undefined) {
  return KOREA_REGIONS.find((region) => region.slug === slug) ?? KOREA_REGIONS[0];
}
