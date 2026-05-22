"use client";

import { LocateFixed } from "lucide-react";
import { useState } from "react";

export function NearbySearchButton() {
  const [status, setStatus] = useState<"idle" | "locating" | "denied" | "unsupported">("idle");

  function findNearby() {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const params = new URLSearchParams(window.location.search);
        params.set("lat", coords.latitude.toFixed(6));
        params.set("lng", coords.longitude.toFixed(6));
        params.set("radiusKm", "20");
        params.set("nearby", "1");
        params.set("sort", "distance");
        params.delete("page");
        window.location.href = `/?${params.toString()}`;
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 300000, timeout: 8000 }
    );
  }

  return (
    <div className="nearby-control">
      <button className="nearby-button" type="button" onClick={findNearby} disabled={status === "locating"}>
        <LocateFixed size={16} aria-hidden="true" />
        {status === "locating" ? "위치 확인 중" : "내 주변 찾기"}
      </button>
      {status === "denied" ? <span>위치 권한을 허용하면 주변 장소를 볼 수 있어요.</span> : null}
      {status === "unsupported" ? <span>이 브라우저에서는 위치 확인을 지원하지 않아요.</span> : null}
    </div>
  );
}
