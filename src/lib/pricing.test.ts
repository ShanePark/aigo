import { describe, expect, it } from "vitest";

import { pricingEvidenceLabel, pricingItemLabels, pricingSummaryLabel } from "@/lib/pricing";

describe("pricing helpers", () => {
  it("formats a price summary with required freshness context", () => {
    const pricing = {
      summary: "어린이 2시간 15,000원",
      basisDate: "2026-05-22",
      staleAfterDays: 90
    };

    expect(pricingSummaryLabel(pricing, { now: new Date("2026-06-01T00:00:00.000Z") })).toBe("어린이 2시간 15,000원 · 가격 기준일 2026-05-22");
    expect(pricingEvidenceLabel(pricing, { now: new Date("2026-10-01T00:00:00.000Z") })).toBe("가격 기준일 2026-05-22 · 재확인 필요");
  });

  it("falls back to the first structured item and flags missing verification dates", () => {
    const pricing = {
      items: [{ label: "보호자 입장", amount: 4000, unit: "guardian" }]
    };

    expect(pricingItemLabels(pricing)).toEqual(["보호자 입장: 4,000원 / guardian"]);
    expect(pricingSummaryLabel(pricing)).toBe("보호자 입장: 4,000원 / guardian · 확인일 미등록");
  });

  it("formats non-KRW local currency amounts", () => {
    const pricing = {
      currency: "PHP",
      items: [
        { label: "데이패스", amount: 2500, unit: "person" },
        { label: "어린이 입장", amount: 1200, currency: "USD" }
      ]
    };

    expect(pricingItemLabels(pricing)).toEqual(["데이패스: PHP 2,500 / person", "어린이 입장: US$1,200"]);
  });
});
