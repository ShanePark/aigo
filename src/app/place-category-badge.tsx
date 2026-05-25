import {
  BookOpen,
  Car,
  Coffee,
  Dumbbell,
  FerrisWheel,
  FlaskConical,
  Gamepad2,
  Hotel,
  Landmark,
  MapPin,
  PawPrint,
  Puzzle,
  ShoppingBag,
  Trees,
  Utensils
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  kids_cafe: "키즈카페",
  indoor_playground: "실내놀이터",
  toy_store: "장난감 가게",
  toy_library: "장난감도서관",
  library: "도서관",
  museum: "박물관/미술관",
  science_museum: "과학관",
  experience_center: "체험관",
  aquarium_zoo: "동물/아쿠아리움",
  park: "공원/놀이터",
  family_cafe: "가족 카페",
  family_restaurant: "놀이방/가족 식당",
  sports_venue: "스포츠/야구장",
  shopping_mall: "쇼핑/몰",
  rest_area: "휴게소/쉼터",
  accommodation: "키즈 숙소"
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  accommodation: Hotel,
  aquarium_zoo: PawPrint,
  experience_center: FerrisWheel,
  family_cafe: Coffee,
  family_restaurant: Utensils,
  indoor_playground: Gamepad2,
  kids_cafe: Coffee,
  library: BookOpen,
  museum: Landmark,
  park: Trees,
  playground: Trees,
  public_child_facility: Puzzle,
  rest_area: Car,
  science_museum: FlaskConical,
  shopping_mall: ShoppingBag,
  sports_venue: Dumbbell,
  theme_park: FerrisWheel,
  toy_library: Puzzle,
  toy_store: Puzzle
};

type PlaceCategoryBadgeProps = {
  category: string;
  className?: string;
};

export function placeCategoryLabel(value: string) {
  return CATEGORY_LABELS[value] ?? value;
}

export function placeCategoryIcon(value: string): LucideIcon {
  return CATEGORY_ICONS[value] ?? MapPin;
}

export function PlaceCategoryBadge({ category, className }: PlaceCategoryBadgeProps) {
  const Icon = placeCategoryIcon(category);
  const classes = ["category-badge", className].filter(Boolean).join(" ");

  return (
    <span className={classes} title={category}>
      <Icon size={14} aria-hidden="true" />
      {placeCategoryLabel(category)}
    </span>
  );
}
