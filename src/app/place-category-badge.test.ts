import { describe, expect, it } from "vitest";

import { placeCategoryIconImage } from "@/app/place-category-icon-image";
import { placeCategoryLabel } from "@/app/place-category";
import { accommodationTypeForPlace, accommodationTypeForTags } from "@/app/accommodation-types";
import { primaryCategories } from "@/lib/taxonomy";

describe("place category display helpers", () => {
  it("uses concise Korean labels without slash-combined category names", () => {
    expect(placeCategoryLabel("museum")).toBe("박물관");
    expect(placeCategoryLabel("park")).toBe("공원");
    expect(placeCategoryLabel("shopping_mall")).toBe("쇼핑몰");
    expect(placeCategoryLabel("family_restaurant")).toBe("놀이방식당");
  });

  it("is ready to display future split categories before the schema migration", () => {
    expect(placeCategoryLabel("aquarium")).toBe("아쿠아리움");
    expect(placeCategoryLabel("art_museum")).toBe("미술관");
    expect(placeCategoryLabel("playground")).toBe("놀이터");
    expect(placeCategoryLabel("zoo")).toBe("동물원");
  });

  it("uses generated WebP category images for every primary category", () => {
    for (const category of primaryCategories) {
      expect(placeCategoryIconImage(category)).toBe(`/icons/place-categories/${category}.webp`);
    }

    expect(placeCategoryIconImage("unknown_category")).toBeNull();
  });

  it("resolves accommodation subtype display from tags", () => {
    expect(accommodationTypeForTags("accommodation", ["kids", "풀빌라"])?.label).toBe("풀빌라");
    expect(accommodationTypeForTags("accommodation", ["kids_hotel"])?.iconCategory).toBe("accommodation_kids_hotel");
    expect(accommodationTypeForPlace("accommodation", { name: "비발디파크 리조트", tags: [] })?.label).toBe("리조트");
    expect(placeCategoryIconImage("accommodation_pool_villa")).toBe("/icons/place-categories/accommodation_pool_villa.webp");
  });
});
