import Image from "next/image";

import { accommodationHierarchyForPlace, accommodationTypePathLabel } from "@/app/accommodation-types";
import { placeCategoryLabel } from "@/app/place-category";
import { placeCategoryIconImage } from "@/app/place-category-icon-image";

export { placeCategoryLabel } from "@/app/place-category";
export { placeCategoryIconImage } from "@/app/place-category-icon-image";

type PlaceCategoryBadgeProps = {
  category: string;
  className?: string;
  name?: string | null;
  tags?: readonly string[] | null;
};

export function PlaceCategoryBadge({ category, className, name, tags }: PlaceCategoryBadgeProps) {
  const accommodationHierarchy = accommodationHierarchyForPlace(category, { name, tags });
  const accommodationType = accommodationHierarchy?.subtype ?? null;
  const displayCategory = accommodationType?.iconCategory ?? category;
  const imageSrc = placeCategoryIconImage(displayCategory);
  const classes = ["category-badge", className].filter(Boolean).join(" ");
  const title = accommodationHierarchy ? accommodationTypePathLabel(accommodationType) : category;

  return (
    <span className={classes} title={title}>
      {imageSrc ? <Image src={imageSrc} alt="" aria-hidden="true" draggable="false" width={18} height={18} /> : null}
      {accommodationType?.label ?? placeCategoryLabel(category)}
    </span>
  );
}
