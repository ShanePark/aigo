export const PLACE_CATEGORY_LABELS: Record<string, string> = {
  aquarium: "아쿠아리움",
  kids_cafe: "키즈카페",
  indoor_playground: "실내놀이터",
  toy_store: "장난감 가게",
  toy_library: "장난감도서관",
  library: "도서관",
  art_museum: "미술관",
  museum: "박물관",
  science_museum: "과학관",
  experience_center: "체험관",
  park: "공원",
  playground: "놀이터",
  family_cafe: "가족 카페",
  family_restaurant: "놀이방식당",
  sports_venue: "스포츠 시설",
  shopping_mall: "쇼핑몰",
  rest_area: "휴게소",
  accommodation: "키즈 숙소",
  zoo: "동물원"
};

export function placeCategoryLabel(value: string) {
  return PLACE_CATEGORY_LABELS[value] ?? value;
}
