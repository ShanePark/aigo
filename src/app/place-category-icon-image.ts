const CATEGORY_ICON_IMAGES: Record<string, string> = {
  accommodation: "/icons/place-categories/accommodation.webp",
  accommodation_kids_hotel: "/icons/place-categories/accommodation_kids_hotel.webp",
  accommodation_pension: "/icons/place-categories/accommodation_pension.webp",
  accommodation_pool_villa: "/icons/place-categories/accommodation_pool_villa.webp",
  accommodation_resort: "/icons/place-categories/accommodation_resort.webp",
  aquarium: "/icons/place-categories/aquarium.webp",
  art_museum: "/icons/place-categories/art_museum.webp",
  experience_center: "/icons/place-categories/experience_center.webp",
  family_cafe: "/icons/place-categories/family_cafe.webp",
  family_restaurant: "/icons/place-categories/family_restaurant.webp",
  indoor_playground: "/icons/place-categories/indoor_playground.webp",
  kids_cafe: "/icons/place-categories/kids_cafe.webp",
  library: "/icons/place-categories/library.webp",
  museum: "/icons/place-categories/museum.webp",
  park: "/icons/place-categories/park.webp",
  playground: "/icons/place-categories/playground.webp",
  rest_area: "/icons/place-categories/rest_area.webp",
  science_museum: "/icons/place-categories/science_museum.webp",
  shared_childcare: "/icons/place-categories/shared_childcare.webp",
  shopping_mall: "/icons/place-categories/shopping_mall.webp",
  sports_venue: "/icons/place-categories/sports_venue.webp",
  toy_library: "/icons/place-categories/toy_library.webp",
  toy_store: "/icons/place-categories/toy_store.webp",
  zoo: "/icons/place-categories/zoo.webp"
};

export function placeCategoryIconImage(value: string) {
  return CATEGORY_ICON_IMAGES[value] ?? null;
}
