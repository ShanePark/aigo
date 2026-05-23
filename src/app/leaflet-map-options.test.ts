import { describe, expect, it } from "vitest";

import { wheelZoomDirection } from "@/app/leaflet-map-options";

describe("Leaflet map wheel options", () => {
  it("clamps large wheel deltas to one zoom-in step", () => {
    expect(wheelZoomDirection(wheelEvent({ deltaY: -120 }))).toBe(1);
    expect(wheelZoomDirection(wheelEvent({ deltaY: -720 }))).toBe(1);
  });

  it("clamps large wheel deltas to one zoom-out step", () => {
    expect(wheelZoomDirection(wheelEvent({ deltaY: 120 }))).toBe(-1);
    expect(wheelZoomDirection(wheelEvent({ deltaY: 720 }))).toBe(-1);
  });

  it("ignores mostly horizontal wheel input", () => {
    expect(wheelZoomDirection(wheelEvent({ deltaX: 220, deltaY: 20 }))).toBe(0);
  });
});

function wheelEvent(overrides: Partial<Parameters<typeof wheelZoomDirection>[0]>) {
  return {
    deltaX: 0,
    deltaY: 0,
    deltaZ: 0,
    ...overrides
  };
}
