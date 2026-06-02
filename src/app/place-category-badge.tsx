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
import Image from "next/image";

import { accommodationHierarchyForPlace, accommodationTypePathLabel } from "@/app/accommodation-types";
import { placeCategoryLabel } from "@/app/place-category";
import { placeCategoryIconImage } from "@/app/place-category-icon-image";

export { placeCategoryLabel } from "@/app/place-category";
export { placeCategoryIconImage } from "@/app/place-category-icon-image";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  accommodation: Hotel,
  aquarium: PawPrint,
  art_museum: Landmark,
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
  name?: string | null;
  tags?: readonly string[] | null;
};

export function placeCategoryIcon(value: string): LucideIcon {
  return CATEGORY_ICONS[value] ?? MapPin;
}

export function PlaceCategoryBadge({ category, className, name, tags }: PlaceCategoryBadgeProps) {
  const accommodationHierarchy = accommodationHierarchyForPlace(category, { name, tags });
  const accommodationType = accommodationHierarchy?.subtype ?? null;
  const displayCategory = accommodationType?.iconCategory ?? category;
  const Icon = placeCategoryIcon(displayCategory);
  const imageSrc = placeCategoryIconImage(displayCategory);
  const classes = ["category-badge", className].filter(Boolean).join(" ");
  const title = accommodationHierarchy ? accommodationTypePathLabel(accommodationType) : category;

  return (
    <span className={classes} title={title}>
      {imageSrc ? <Image src={imageSrc} alt="" aria-hidden="true" draggable="false" width={18} height={18} /> : <Icon size={14} aria-hidden="true" />}
      {accommodationType?.label ?? placeCategoryLabel(category)}
    </span>
  );
}
