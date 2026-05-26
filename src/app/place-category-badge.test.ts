import { describe, expect, it } from "vitest";

import { placeCategoryIconImage } from "@/app/place-category-icon-image";
import { placeCategoryLabel } from "@/app/place-category";

describe("place category display helpers", () => {
  it("uses concise Korean labels without slash-combined category names", () => {
    expect(placeCategoryLabel("museum")).toBe("박물관");
    expect(placeCategoryLabel("park")).toBe("공원");
    expect(placeCategoryLabel("shopping_mall")).toBe("쇼핑몰");
    expect(placeCategoryLabel("family_restaurant")).toBe("가족 식당");
  });

  it("is ready to display future split categories before the schema migration", () => {
    expect(placeCategoryLabel("aquarium")).toBe("아쿠아리움");
    expect(placeCategoryLabel("art_museum")).toBe("미술관");
    expect(placeCategoryLabel("playground")).toBe("놀이터");
    expect(placeCategoryLabel("zoo")).toBe("동물원");
  });

  it("uses the generated WebP marker image for zoo places", () => {
    expect(placeCategoryIconImage("zoo")).toBe("/icons/place-categories/zoo.webp");
    expect(placeCategoryIconImage("park")).toBeNull();
  });
});
