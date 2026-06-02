import { pathToFileURL } from "node:url";

type RoughmapCoordinateArgs = {
  url?: string;
  key?: string;
  x?: number;
  y?: number;
  label?: string;
  json: boolean;
  checkedAt?: string;
};

type RoughmapPayload = {
  name?: string;
  placeX?: string | number;
  placeY?: string | number;
  markerData?: {
    label?: string;
    x?: string | number;
    y?: string | number;
  };
};

export type RoughmapCoordinateReport = {
  input: {
    coordinateSystem: "WCONGNAMUL";
    x: number;
    y: number;
    label?: string;
    sourceUrl?: string;
  };
  output: {
    coordinateSystem: "WGS84";
    lat: number;
    lng: number;
  };
  provenanceText: string;
  coordinateProvenance: {
    level: "official_embedded_map";
    lat: number;
    lng: number;
    coordinateSystem: "WGS84";
    sourceUrl?: string;
    sourceTitle: string;
    basis: string;
    addressMatched?: string;
    confidence: "high";
    checkedAt: string;
  };
};

const roughmapBaseUrl = "https://t1.kakaocdn.net/roughmap";

if (isMain()) {
  void main();
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = await buildRoughmapCoordinateReport(args);
    console.log(args.json ? JSON.stringify(report, null, 2) : formatReport(report));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): RoughmapCoordinateArgs {
  const args: RoughmapCoordinateArgs = { json: false };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg.startsWith("--url=")) {
      args.url = arg.slice("--url=".length).trim();
      continue;
    }
    if (arg.startsWith("--key=")) {
      args.key = arg.slice("--key=".length).trim();
      continue;
    }
    if (arg.startsWith("--x=")) {
      args.x = requiredNumber(arg.slice("--x=".length), "x");
      continue;
    }
    if (arg.startsWith("--y=")) {
      args.y = requiredNumber(arg.slice("--y=".length), "y");
      continue;
    }
    if (arg.startsWith("--label=")) {
      args.label = arg.slice("--label=".length).trim();
      continue;
    }
    if (arg.startsWith("--checked-at=")) {
      args.checkedAt = arg.slice("--checked-at=".length).trim();
    }
  }

  if (args.url && args.key) throw new Error("Use either --url or --key, not both.");
  if ((args.x === undefined) !== (args.y === undefined)) throw new Error("Use --x and --y together.");
  if (!args.url && !args.key && (args.x === undefined || args.y === undefined)) {
    throw new Error("Usage: pnpm tsx scripts/convert-roughmap-coordinate.ts --url=<roughmapJsonUrl> [--json] or --x=<WCONGNAMUL_X> --y=<WCONGNAMUL_Y> [--label=...]");
  }

  return args;
}

export async function buildRoughmapCoordinateReport(input: RoughmapCoordinateArgs, fetchImpl: typeof fetch = fetch) {
  if (input.url || input.key) {
    const sourceUrl = input.url ?? `${roughmapBaseUrl}/${input.key}.json`;
    const payload = await fetchRoughmapPayload(sourceUrl, fetchImpl);
    const x = firstNumber(payload.placeX, payload.markerData?.x);
    const y = firstNumber(payload.placeY, payload.markerData?.y);
    if (x === undefined || y === undefined) throw new Error(`Roughmap payload at ${sourceUrl} did not include placeX/placeY or markerData.x/y.`);

    return buildReport({
      x,
      y,
      label: input.label || payload.markerData?.label || payload.name,
      sourceUrl,
      checkedAt: input.checkedAt
    });
  }

  return buildReport({
    x: input.x as number,
    y: input.y as number,
    label: input.label,
    checkedAt: input.checkedAt
  });
}

export function convertWcongnamulToWgs84(x: number, y: number) {
  assertFiniteCoordinate(x, "x");
  assertFiniteCoordinate(y, "y");

  return congnamulToWgs84(x, y);
}

function buildReport(input: { x: number; y: number; label?: string; sourceUrl?: string; checkedAt?: string }): RoughmapCoordinateReport {
  const output = convertWcongnamulToWgs84(input.x, input.y);
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const labelSuffix = input.label ? ` for ${input.label}` : "";
  const sourceSuffix = input.sourceUrl ? ` from ${input.sourceUrl}` : "";
  const basis = `Converted Daum/Kakao roughmap WCONGNAMUL x=${input.x}, y=${input.y}${labelSuffix}${sourceSuffix} to WGS84 using the Kakao Maps Transverse Mercator parameters.`;

  return {
    input: {
      coordinateSystem: "WCONGNAMUL",
      x: input.x,
      y: input.y,
      ...(input.label ? { label: input.label } : {}),
      ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {})
    },
    output: {
      coordinateSystem: "WGS84",
      ...output
    },
    provenanceText: basis,
    coordinateProvenance: {
      level: "official_embedded_map",
      lat: output.lat,
      lng: output.lng,
      coordinateSystem: "WGS84",
      ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
      sourceTitle: "Daum/Kakao roughmap embedded coordinate",
      basis,
      ...(input.label ? { addressMatched: input.label } : {}),
      confidence: "high",
      checkedAt
    }
  };
}

async function fetchRoughmapPayload(sourceUrl: string, fetchImpl: typeof fetch): Promise<RoughmapPayload> {
  const response = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Failed to fetch roughmap JSON: HTTP ${response.status} ${response.statusText}`);

  const body = await response.text();
  const match = /daum\.roughmap\.onDataLoad\("([^"]+)"\);?/.exec(body.trim());
  if (!match) throw new Error("Roughmap response did not match daum.roughmap.onDataLoad(\"...\").");

  return JSON.parse(decodeURIComponent(match[1])) as RoughmapPayload;
}

function firstNumber(...values: Array<string | number | undefined>) {
  for (const value of values) {
    const numberValue = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return undefined;
}

function congnamulToWgs84(x: number, y: number) {
  const corrected = applyCongnamulCorrection(0.4 * x, 0.4 * y);
  const bessel = besselTmToGeographic(corrected.x, corrected.y);
  const besselCartesian = geographicToCartesian({
    lat: bessel.lat,
    lng: bessel.lng,
    semiMajorAxis: 6_377_397.155,
    inverseFlattening: 299.152813
  });
  const wgs84Cartesian = besselToWgs84Cartesian(besselCartesian);

  return cartesianToGeographic({
    ...wgs84Cartesian,
    semiMajorAxis: 6_378_137,
    inverseFlattening: 298.257223563
  });
}

function applyCongnamulCorrection(x: number, y: number) {
  const correctionZones = [
    { minX: 112_500, minY: -50_000, maxX: 146_000, maxY: 3_000, offsetX: 0, offsetY: 50_000 },
    { minX: 146_000, minY: -50_000, maxX: 191_600, maxY: 8_600, offsetX: 0, offsetY: 50_000 },
    { minX: 130_000, minY: 44_000, maxX: 145_000, maxY: 58_000, offsetX: 0, offsetY: 10_000 },
    { minX: 532_500, minY: 437_500, maxX: 557_500, maxY: 462_500, offsetX: -70_378, offsetY: -136 },
    { minX: 625_000, minY: 412_500, maxX: 650_000, maxY: 437_500, offsetX: -144_738, offsetY: -2_161 },
    { minX: -12_500, minY: 462_500, maxX: 5_000, maxY: 512_500, offsetX: 23_510, offsetY: -111 },
    { minX: 191_600, minY: -50_000, maxX: 194_200, maxY: 2_700, offsetX: 0, offsetY: 50_000 },
    { minX: 194_200, minY: -50_000, maxX: 200_000, maxY: 8_600, offsetX: 0, offsetY: 50_000 }
  ];

  for (const zone of correctionZones) {
    const minX = zone.minX + zone.offsetX;
    const maxX = zone.maxX + zone.offsetX;
    const minY = zone.minY + zone.offsetY;
    const maxY = zone.maxY + zone.offsetY;
    if (minX <= x && x <= maxX && minY <= y && y <= maxY) {
      return { x: x - zone.offsetX, y: y - zone.offsetY };
    }
  }

  return { x, y };
}

function besselTmToGeographic(x: number, y: number) {
  const sin = Math.sin;
  const cos = Math.cos;
  const pow = Math.pow;
  const sqrt = Math.sqrt;
  const semiMajorAxis = 6_377_397.155;
  let flattening = 1 / 299.152813;
  const falseNorthing = 500_000;
  const falseEasting = 200_000;
  const scaleFactor = 1;
  const originLat = 38;
  const originLng = 127 + 10.405 / 3600;
  const radPerDegree = Math.atan(1) / 45;
  let originLatRad = originLat * radPerDegree;
  const originLngRad = originLng * radPerDegree;
  flattening = 1 / flattening;
  const semiMinorAxis = (semiMajorAxis * (flattening - 1)) / flattening;
  const eccentricitySquared = (pow(semiMajorAxis, 2) - pow(semiMinorAxis, 2)) / pow(semiMajorAxis, 2);
  let secondEccentricitySquared = (pow(semiMajorAxis, 2) - pow(semiMinorAxis, 2)) / pow(semiMinorAxis, 2);
  const thirdFlattening = (semiMajorAxis - semiMinorAxis) / (semiMajorAxis + semiMinorAxis);
  const meridianOrigin = meridianArc(semiMajorAxis, thirdFlattening, originLatRad);
  const meridionalDistance = (y + meridianOrigin * scaleFactor - falseNorthing) / scaleFactor;
  let footpointLat = meridionalDistance / meridianRadiusAtLatitude(semiMajorAxis, eccentricitySquared, 0);

  for (let i = 1; i <= 5; i += 1) {
    const arc = meridianArc(semiMajorAxis, thirdFlattening, footpointLat);
    const radius = meridianRadiusAtLatitude(semiMajorAxis, eccentricitySquared, footpointLat);
    footpointLat += (meridionalDistance - arc) / radius;
  }

  const meridianRadius = meridianRadiusAtLatitude(semiMajorAxis, eccentricitySquared, footpointLat);
  const primeVerticalRadius = semiMajorAxis / sqrt(1 - eccentricitySquared * pow(sin(footpointLat), 2));
  const tanFootpoint = sin(footpointLat) / cos(footpointLat);
  secondEccentricitySquared *= pow(cos(footpointLat), 2);
  const adjustedX = x - falseEasting;
  const latTerm2 = tanFootpoint / (2 * meridianRadius * primeVerticalRadius * pow(scaleFactor, 2));
  const latTerm4 = (tanFootpoint * (5 + 3 * pow(tanFootpoint, 2) + secondEccentricitySquared - 4 * pow(secondEccentricitySquared, 2) - 9 * pow(tanFootpoint, 2) * secondEccentricitySquared)) / (24 * meridianRadius * pow(primeVerticalRadius, 3) * pow(scaleFactor, 4));
  const latTerm6 =
    (tanFootpoint *
      (61 +
        90 * pow(tanFootpoint, 2) +
        46 * secondEccentricitySquared +
        45 * pow(tanFootpoint, 4) -
        252 * pow(tanFootpoint, 2) * secondEccentricitySquared -
        3 * pow(secondEccentricitySquared, 2) +
        100 * pow(secondEccentricitySquared, 3) -
        66 * pow(tanFootpoint, 2) * pow(secondEccentricitySquared, 2) -
        90 * pow(tanFootpoint, 4) * secondEccentricitySquared +
        88 * pow(secondEccentricitySquared, 4) +
        225 * pow(tanFootpoint, 4) * pow(secondEccentricitySquared, 2) +
        84 * pow(tanFootpoint, 2) * pow(secondEccentricitySquared, 3) -
        192 * pow(tanFootpoint, 2) * pow(secondEccentricitySquared, 4))) /
    (720 * meridianRadius * pow(primeVerticalRadius, 5) * pow(scaleFactor, 6));
  const latTerm8 = (tanFootpoint * (1385 + 3633 * pow(tanFootpoint, 2) + 4095 * pow(tanFootpoint, 4) + 1575 * pow(tanFootpoint, 6))) / (40320 * meridianRadius * pow(primeVerticalRadius, 7) * pow(scaleFactor, 8));
  originLatRad = footpointLat - pow(adjustedX, 2) * latTerm2 + pow(adjustedX, 4) * latTerm4 - pow(adjustedX, 6) * latTerm6 + pow(adjustedX, 8) * latTerm8;

  const lngTerm1 = 1 / (primeVerticalRadius * cos(footpointLat) * scaleFactor);
  const lngTerm3 = (1 + 2 * pow(tanFootpoint, 2) + secondEccentricitySquared) / (6 * pow(primeVerticalRadius, 3) * cos(footpointLat) * pow(scaleFactor, 3));
  const lngTerm5 =
    (5 +
      6 * secondEccentricitySquared +
      28 * pow(tanFootpoint, 2) -
      3 * pow(secondEccentricitySquared, 2) +
      8 * pow(tanFootpoint, 2) * secondEccentricitySquared +
      24 * pow(tanFootpoint, 4) -
      4 * pow(secondEccentricitySquared, 3) +
      4 * pow(tanFootpoint, 2) * pow(secondEccentricitySquared, 2) +
      24 * pow(tanFootpoint, 2) * pow(secondEccentricitySquared, 3)) /
    (120 * pow(primeVerticalRadius, 5) * cos(footpointLat) * pow(scaleFactor, 5));
  const lngTerm7 = (61 + 662 * pow(tanFootpoint, 2) + 1320 * pow(tanFootpoint, 4) + 720 * pow(tanFootpoint, 6)) / (5040 * pow(primeVerticalRadius, 7) * cos(footpointLat) * pow(scaleFactor, 7));
  const lngOffset = adjustedX * lngTerm1 - pow(adjustedX, 3) * lngTerm3 + pow(adjustedX, 5) * lngTerm5 - pow(adjustedX, 7) * lngTerm7;

  return { lat: originLatRad / radPerDegree, lng: (originLngRad + lngOffset) / radPerDegree };
}

function meridianArc(semiMajorAxis: number, thirdFlattening: number, latitudeRadians: number) {
  const pow = Math.pow;
  return (
    semiMajorAxis * (1 - thirdFlattening + (5 * (pow(thirdFlattening, 2) - pow(thirdFlattening, 3))) / 4 + (81 * (pow(thirdFlattening, 4) - pow(thirdFlattening, 5))) / 64) * latitudeRadians -
    ((3 * semiMajorAxis * (thirdFlattening - pow(thirdFlattening, 2) + (7 * (pow(thirdFlattening, 3) - pow(thirdFlattening, 4))) / 8 + (55 * pow(thirdFlattening, 5)) / 64)) / 2) * Math.sin(2 * latitudeRadians) +
    ((15 * semiMajorAxis * (pow(thirdFlattening, 2) - pow(thirdFlattening, 3) + (3 * (pow(thirdFlattening, 4) - pow(thirdFlattening, 5))) / 4)) / 16) * Math.sin(4 * latitudeRadians) -
    ((35 * semiMajorAxis * (pow(thirdFlattening, 3) - pow(thirdFlattening, 4) + (11 * pow(thirdFlattening, 5)) / 16)) / 48) * Math.sin(6 * latitudeRadians) +
    ((315 * semiMajorAxis * (pow(thirdFlattening, 4) - pow(thirdFlattening, 5))) / 512) * Math.sin(8 * latitudeRadians)
  );
}

function meridianRadiusAtLatitude(semiMajorAxis: number, eccentricitySquared: number, latitudeRadians: number) {
  return (semiMajorAxis * (1 - eccentricitySquared)) / Math.pow(Math.sqrt(1 - eccentricitySquared * Math.pow(Math.sin(latitudeRadians), 2)), 3);
}

function geographicToCartesian(input: { lat: number; lng: number; semiMajorAxis: number; inverseFlattening: number }) {
  let flattening = 1 / input.inverseFlattening;
  const radPerDegree = Math.atan(1) / 45;
  const latRad = input.lat * radPerDegree;
  const lngRad = input.lng * radPerDegree;
  flattening = 1 / flattening;
  const semiMinorAxis = (input.semiMajorAxis * (flattening - 1)) / flattening;
  const eccentricitySquared = (Math.pow(input.semiMajorAxis, 2) - Math.pow(semiMinorAxis, 2)) / Math.pow(input.semiMajorAxis, 2);
  const primeVerticalRadius = input.semiMajorAxis / Math.sqrt(1 - eccentricitySquared * Math.pow(Math.sin(latRad), 2));

  return {
    x: primeVerticalRadius * Math.cos(latRad) * Math.cos(lngRad),
    y: primeVerticalRadius * Math.cos(latRad) * Math.sin(lngRad),
    z: (Math.pow(semiMinorAxis, 2) / Math.pow(input.semiMajorAxis, 2)) * primeVerticalRadius * Math.sin(latRad)
  };
}

function besselToWgs84Cartesian(input: { x: number; y: number; z: number }) {
  const radPerDegree = Math.atan(1) / 45;
  const dx = 115.8;
  const dy = -474.99;
  const dz = -674.11;
  const rx = (1.16 / 3600) * radPerDegree;
  const ry = (-2.31 / 3600) * radPerDegree;
  const rz = (-1.63 / 3600) * radPerDegree;
  const scale = -6.43e-6;
  const scaledX = (input.x - dx) * (1 + scale);
  const scaledY = (input.y - dy) * (1 + scale);
  const scaledZ = (input.z - dz) * (1 + scale);

  return {
    x: (scaledX - rz * scaledY + ry * scaledZ) / (1 + scale),
    y: (rz * scaledX + scaledY - rx * scaledZ) / (1 + scale),
    z: (-ry * scaledX + rx * scaledY + scaledZ) / (1 + scale)
  };
}

function cartesianToGeographic(input: { x: number; y: number; z: number; semiMajorAxis: number; inverseFlattening: number }) {
  let flattening = 1 / input.inverseFlattening;
  const radPerDegree = Math.atan(1) / 45;
  flattening = 1 / flattening;
  const semiMinorAxis = (input.semiMajorAxis * (flattening - 1)) / flattening;
  const eccentricitySquared = (Math.pow(input.semiMajorAxis, 2) - Math.pow(semiMinorAxis, 2)) / Math.pow(input.semiMajorAxis, 2);
  let lngRad = Math.atan(input.y / input.x);
  const horizontalRadius = Math.sqrt(input.x * input.x + input.y * input.y);
  let primeVerticalRadius = input.semiMajorAxis;
  let height = 0;
  let previousLat = 0;
  let latRad = 0;

  for (let i = 0; i < 30; i += 1) {
    const projectedZ = (Math.pow(semiMinorAxis, 2) / Math.pow(input.semiMajorAxis, 2) * primeVerticalRadius + height) ** 2 - input.z * input.z;
    latRad = Math.atan(input.z / Math.sqrt(projectedZ));
    if (Math.abs(latRad - previousLat) < 1e-18) break;
    const sqrt = Math.sqrt;
    const sinLat = Math.sin(latRad);
    primeVerticalRadius = input.semiMajorAxis / sqrt(1 - eccentricitySquared * sinLat * sinLat);
    height = horizontalRadius / Math.cos(latRad) - primeVerticalRadius;
    previousLat = latRad;
  }

  if (input.x < 0) lngRad = Math.PI + lngRad;
  let lng = lngRad / radPerDegree;
  if (lng < 0) lng += 360;

  return { lat: latRad / radPerDegree, lng };
}

function formatReport(report: RoughmapCoordinateReport) {
  const lines = [
    `WCONGNAMUL: x=${report.input.x}, y=${report.input.y}`,
    `WGS84: lat=${report.output.lat}, lng=${report.output.lng}`,
    `Label: ${report.input.label ?? "unknown"}`,
    `Source: ${report.input.sourceUrl ?? "manual x/y input"}`,
    `Provenance: ${report.provenanceText}`,
    "",
    "coordinateProvenance:",
    JSON.stringify(report.coordinateProvenance, null, 2)
  ];

  return lines.join("\n");
}

function requiredNumber(rawValue: string, key: string) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) throw new Error(`--${key} must be a number`);
  return value;
}

function assertFiniteCoordinate(value: number, key: string) {
  if (!Number.isFinite(value)) throw new Error(`${key} must be a finite number`);
}

function isMain() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
