const CATEGORY_ICON_IMAGES: Record<string, string> = {
  zoo: "/icons/place-categories/zoo.webp"
};

export function placeCategoryIconImage(value: string) {
  return CATEGORY_ICON_IMAGES[value] ?? null;
}
