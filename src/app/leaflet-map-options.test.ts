import { describe, expect, it } from "vitest";

import { LEAFLET_WHEEL_PX_PER_ZOOM_LEVEL } from "@/app/leaflet-map-options";

describe("Leaflet map wheel options", () => {
  it("keeps a common mouse-wheel tick to one snapped zoom level", () => {
    expect(snappedWheelZoomDelta(120)).toBe(1);
  });
});

function snappedWheelZoomDelta(wheelDelta: number) {
  const scaledDelta = wheelDelta / (LEAFLET_WHEEL_PX_PER_ZOOM_LEVEL * 4);
  const rawDelta = (4 * Math.log(2 / (1 + Math.exp(-Math.abs(scaledDelta))))) / Math.LN2;

  return Math.ceil(rawDelta);
}
