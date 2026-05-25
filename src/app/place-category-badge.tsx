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

import { placeCategoryLabel } from "@/app/place-category";

export { placeCategoryLabel } from "@/app/place-category";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  accommodation: Hotel,
  aquarium: PawPrint,
  art_museum: Landmark,
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
  toy_store: Puzzle,
  zoo: PawPrint
};

type PlaceCategoryBadgeProps = {
  category: string;
  className?: string;
};

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
