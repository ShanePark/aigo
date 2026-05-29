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
    imageAlt: "서울을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Seoul, Korea, with N Seoul Tower, Gyeongbokgung palace roofs, Han River bridges, and modern high-rises",
    intro: "궁궐, 대형 박물관, 실내 복합몰, 한강 주변까지 선택지가 촘촘한 도시형 가족 나들이 지역입니다."
  },
  {
    slug: "incheon",
    label: "인천",
    regionSido: "인천광역시",
    center: { lat: 37.4563, lng: 126.7052 },
    mapPosition: { x: 30, y: 28 },
    imageSrc: "/images/regions/incheon.webp",
    imageAlt: "인천을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Incheon, Korea, with Songdo skyline, Incheon Bridge, coastal port elements, and airport travel cues",
    intro: "송도와 영종, 도심형 복합시설과 바다를 함께 엮어 반나절부터 당일 나들이까지 보기 좋은 지역입니다."
  },
  {
    slug: "gyeonggi",
    label: "경기",
    regionSido: "경기도",
    center: { lat: 37.4138, lng: 127.5183 },
    mapPosition: { x: 53, y: 31 },
    imageSrc: "/images/regions/gyeonggi.webp",
    imageAlt: "경기를 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Gyeonggi-do, Korea, with Suwon Hwaseong fortress, family parks, modern satellite cities, and green hills",
    intro: "수도권 곳곳의 박물관, 동물원, 대형 공원, 쇼핑몰을 생활권에 맞춰 고르기 좋은 넓은 선택지입니다."
  },
  {
    slug: "gangwon",
    label: "강원",
    regionSido: "강원특별자치도",
    center: { lat: 37.8228, lng: 128.1555 },
    mapPosition: { x: 68, y: 23 },
    imageSrc: "/images/regions/gangwon.webp",
    imageAlt: "강원을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Gangwon, Korea, with Seoraksan mountain ridges, ski resort roofs, pine forests, and East Sea coastline",
    intro: "산과 바다, 리조트형 숙박, 공공 체험시설을 함께 비교하기 좋은 자연 중심 당일·여행 지역입니다."
  },
  {
    slug: "chungbuk",
    label: "충북",
    regionSido: "충청북도",
    center: { lat: 36.8, lng: 127.7 },
    mapPosition: { x: 56, y: 44 },
    imageSrc: "/images/regions/chungbuk.webp",
    imageAlt: "충북을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Chungcheongbuk-do, Korea, with lake scenery, forested inland hills, Cheongju urban landmarks, and family-friendly public buildings",
    intro: "내륙 호수와 수목원, 과학·공공시설을 엮어 조용한 반나절 나들이를 찾기 좋은 지역입니다."
  },
  {
    slug: "sejong",
    label: "세종",
    regionSido: "세종특별자치시",
    center: { lat: 36.48, lng: 127.289 },
    mapPosition: { x: 45, y: 48 },
    imageSrc: "/images/regions/sejong.webp",
    imageAlt: "세종을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Sejong, Korea, with government complex architecture, Geum River paths, planned city blocks, and clean public plazas",
    intro: "국립어린이박물관과 공원, 도서관처럼 아이와 반복 방문하기 좋은 공공 목적지가 강한 지역입니다."
  },
  {
    slug: "daejeon",
    label: "대전",
    regionSido: "대전광역시",
    center: { lat: 36.3504, lng: 127.3845 },
    mapPosition: { x: 52, y: 52 },
    imageSrc: "/images/regions/daejeon.webp",
    imageAlt: "대전을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Daejeon, Korea, with Expo science park landmarks, research district buildings, green parks, and city boulevards",
    intro: "오월드, 한밭수목원, 과학관처럼 아이가 오래 머물기 좋은 대형 방문처를 중심으로 보기 좋은 지역입니다."
  },
  {
    slug: "chungnam",
    label: "충남",
    regionSido: "충청남도",
    center: { lat: 36.5184, lng: 126.8 },
    mapPosition: { x: 33, y: 49 },
    imageSrc: "/images/regions/chungnam.webp",
    imageAlt: "충남을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Chungcheongnam-do, Korea, with Baekje cultural roofs, coastal mudflat scenery, gentle hills, and family travel roads",
    intro: "역사 체험, 바닷가, 공공 전시시설을 당일 코스로 묶기 좋은 서해권 가족 나들이 지역입니다."
  },
  {
    slug: "jeonbuk",
    label: "전북",
    regionSido: "전북특별자치도",
    center: { lat: 35.7175, lng: 127.153 },
    mapPosition: { x: 43, y: 64 },
    imageSrc: "/images/regions/jeonbuk.webp",
    imageAlt: "전북을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Jeonbuk, Korea, with Jeonju hanok village roofs, open farmland, gentle mountains, and cultural museum buildings",
    intro: "한옥·문화시설과 자연형 목적지를 함께 둘러보기 좋은 느긋한 가족 여행 지역입니다."
  },
  {
    slug: "gwangju",
    label: "광주",
    regionSido: "광주광역시",
    center: { lat: 35.1595, lng: 126.8526 },
    mapPosition: { x: 35, y: 76 },
    imageSrc: "/images/regions/gwangju.webp",
    imageAlt: "광주를 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Gwangju, Korea, with Mudeungsan mountain backdrop, cultural art center buildings, city streets, and warm public plazas",
    intro: "문화시설과 산책형 공공 공간을 도시 안에서 가볍게 엮기 좋은 남도권 중심 지역입니다."
  },
  {
    slug: "jeonnam",
    label: "전남",
    regionSido: "전라남도",
    center: { lat: 34.8679, lng: 126.991 },
    mapPosition: { x: 42, y: 82 },
    imageSrc: "/images/regions/jeonnam.webp",
    imageAlt: "전남을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Jeollanam-do, Korea, with island coastline, Suncheon bay reeds, coastal bridges, gardens, and small harbor towns",
    intro: "정원, 갯벌, 섬과 해안 코스를 아이 동반 여행 동선으로 살펴보기 좋은 자연형 지역입니다."
  },
  {
    slug: "daegu",
    label: "대구",
    regionSido: "대구광역시",
    center: { lat: 35.8714, lng: 128.6014 },
    mapPosition: { x: 69, y: 61 },
    imageSrc: "/images/regions/daegu.webp",
    imageAlt: "대구를 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Daegu, Korea, with Palgongsan mountain hints, modern city avenues, cultural landmarks, and warm sunny urban parks",
    intro: "도심 문화시설과 넓은 공원, 실내 fallback을 함께 비교하기 좋은 영남권 대도시 지역입니다."
  },
  {
    slug: "gyeongbuk",
    label: "경북",
    regionSido: "경상북도",
    center: { lat: 36.4919, lng: 128.8889 },
    mapPosition: { x: 75, y: 48 },
    imageSrc: "/images/regions/gyeongbuk.webp",
    imageAlt: "경북을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Gyeongsangbuk-do, Korea, with Gyeongju heritage roofs, Andong traditional village, rolling mountains, and river scenery",
    intro: "역사 유적, 박물관, 자연형 목적지를 아이 눈높이에 맞춰 고르기 좋은 넓은 여행 지역입니다."
  },
  {
    slug: "busan",
    label: "부산",
    regionSido: "부산광역시",
    center: { lat: 35.1796, lng: 129.0756 },
    mapPosition: { x: 79, y: 76 },
    imageSrc: "/images/regions/busan.webp",
    imageAlt: "부산을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Busan, Korea, with Gwangan Bridge, Haeundae beach, colorful hillside village buildings, and coastal high-rises",
    intro: "바다, 아쿠아리움, 대형 복합시설과 숙박을 한 화면에서 비교하기 좋은 해안 대도시 지역입니다."
  },
  {
    slug: "ulsan",
    label: "울산",
    regionSido: "울산광역시",
    center: { lat: 35.5384, lng: 129.3114 },
    mapPosition: { x: 83, y: 68 },
    imageSrc: "/images/regions/ulsan.webp",
    imageAlt: "울산을 상징하는 미니어처 도시 이미지",
    imagePromptSubject: "Ulsan, Korea, with Taehwagang river garden, whale and coastal motifs, modern city architecture, and green park paths",
    intro: "강변 정원, 해양·생태 체험, 공공시설을 중심으로 차분한 가족 나들이를 찾기 좋은 지역입니다."
  },
  {
    slug: "gyeongnam",
    label: "경남",
    regionSido: "경상남도",
    center: { lat: 35.4606, lng: 128.2132 },
    mapPosition: { x: 66, y: 75 },
    imageSrc: "/images/regions/gyeongnam.webp",
    imageAlt: "경남을 상징하는 미니어처 지역 이미지",
    imagePromptSubject: "Gyeongsangnam-do, Korea, with coastal islands, Jinhae cherry blossom streets, family parks, and harbor bridges",
    intro: "해안 도시, 수목원, 공공 체험시설을 주말 당일 코스로 묶어보기 좋은 남해권 지역입니다."
  },
  {
    slug: "jeju",
    label: "제주",
    regionSido: "제주특별자치도",
    center: { lat: 33.4996, lng: 126.5312 },
    mapPosition: { x: 50, y: 94 },
    imageSrc: "/images/regions/jeju.webp",
    imageAlt: "제주를 상징하는 미니어처 섬 이미지",
    imagePromptSubject: "Jeju Island, Korea, with Hallasan mountain, volcanic stone walls, ocean cliffs, tangerine trees, and family resort buildings",
    intro: "박물관, 아쿠아리움, 테마시설, 키즈 숙소를 여행 일정 안에서 함께 비교하기 좋은 섬 지역입니다."
  }
] as const satisfies readonly RegionCatalogItem[];

export type RegionSlug = (typeof KOREA_REGIONS)[number]["slug"];

export function regionBySlug(slug: string | null | undefined) {
  return KOREA_REGIONS.find((region) => region.slug === slug) ?? KOREA_REGIONS[0];
}
