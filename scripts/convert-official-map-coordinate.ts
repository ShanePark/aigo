import { pathToFileURL } from "node:url";

type OfficialMapCoordinateArgs = {
  x?: number;
  y?: number;
  crs: SupportedProjectedCrs;
  sourceUrl?: string;
  sourceTitle?: string;
  label?: string;
  json: boolean;
  checkedAt?: string;
};

type SupportedProjectedCrs = "EPSG:5179";

export type OfficialMapCoordinateReport = {
  input: {
    coordinateSystem: SupportedProjectedCrs;
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
    rawProjectedPoint: {
      x: number;
      y: number;
      crs: SupportedProjectedCrs;
    };
  };
};

const supportedCrs = ["EPSG:5179"] as const;

if (isMain()) {
  void main();
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = buildOfficialMapCoordinateReport(args);
    console.log(args.json ? JSON.stringify(report, null, 2) : formatReport(report));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): OfficialMapCoordinateArgs {
  const args: OfficialMapCoordinateArgs = {
    crs: "EPSG:5179",
    json: false
  };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
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
    if (arg.startsWith("--crs=")) {
      args.crs = supportedProjectedCrs(arg.slice("--crs=".length));
      continue;
    }
    if (arg.startsWith("--source-url=")) {
      args.sourceUrl = optionalString(arg.slice("--source-url=".length));
      continue;
    }
    if (arg.startsWith("--source-title=")) {
      args.sourceTitle = optionalString(arg.slice("--source-title=".length));
      continue;
    }
    if (arg.startsWith("--label=")) {
      args.label = optionalString(arg.slice("--label=".length));
      continue;
    }
    if (arg.startsWith("--checked-at=")) {
      args.checkedAt = optionalString(arg.slice("--checked-at=".length));
    }
  }

  if (args.x === undefined || args.y === undefined) {
    throw new Error("Usage: pnpm tsx scripts/convert-official-map-coordinate.ts --x=<projected_x> --y=<projected_y> [--crs=EPSG:5179] [--json]");
  }

  return args;
}

export function buildOfficialMapCoordinateReport(input: OfficialMapCoordinateArgs): OfficialMapCoordinateReport {
  if (input.x === undefined || input.y === undefined) {
    throw new Error("x and y are required.");
  }

  const output = convertProjectedToWgs84(input.x, input.y, input.crs);
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const sourceTitle = input.sourceTitle ?? `${input.crs} official embedded map point`;
  const labelSuffix = input.label ? ` for ${input.label}` : "";
  const sourceSuffix = input.sourceUrl ? ` from ${input.sourceUrl}` : "";
  const basis = `Converted official embedded map point ${input.crs} x=${input.x}, y=${input.y}${labelSuffix}${sourceSuffix} to WGS84.`;

  return {
    input: {
      coordinateSystem: input.crs,
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
      sourceTitle,
      basis,
      ...(input.label ? { addressMatched: input.label } : {}),
      confidence: "high",
      checkedAt,
      rawProjectedPoint: {
        x: input.x,
        y: input.y,
        crs: input.crs
      }
    }
  };
}

export function convertProjectedToWgs84(x: number, y: number, crs: SupportedProjectedCrs = "EPSG:5179") {
  assertFiniteCoordinate(x, "x");
  assertFiniteCoordinate(y, "y");
  if (crs !== "EPSG:5179") throw new Error(`Unsupported CRS: ${crs}`);

  return korea2000UnifiedToWgs84(x, y);
}

function korea2000UnifiedToWgs84(x: number, y: number) {
  const semiMajorAxis = 6_378_137;
  const inverseFlattening = 298.257222101;
  const flattening = 1 / inverseFlattening;
  const eccentricitySquared = 2 * flattening - flattening * flattening;
  const secondEccentricitySquared = eccentricitySquared / (1 - eccentricitySquared);
  const originLatRad = degreesToRadians(38);
  const originLngRad = degreesToRadians(127.5);
  const scaleFactor = 0.9996;
  const falseEasting = 1_000_000;
  const falseNorthing = 2_000_000;
  const meridianOrigin = meridianArc(semiMajorAxis, eccentricitySquared, originLatRad);
  const meridian = meridianOrigin + (y - falseNorthing) / scaleFactor;
  const mu = meridian / (semiMajorAxis * (1 - eccentricitySquared / 4 - (3 * eccentricitySquared ** 2) / 64 - (5 * eccentricitySquared ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - eccentricitySquared)) / (1 + Math.sqrt(1 - eccentricitySquared));
  const footprintLatRad =
    mu +
    (3 * e1) / 2 * Math.sin(2 * mu) -
    (27 * e1 ** 3) / 32 * Math.sin(2 * mu) +
    (21 * e1 ** 2) / 16 * Math.sin(4 * mu) -
    (55 * e1 ** 4) / 32 * Math.sin(4 * mu) +
    (151 * e1 ** 3) / 96 * Math.sin(6 * mu) +
    (1097 * e1 ** 4) / 512 * Math.sin(8 * mu);

  const sinFootprint = Math.sin(footprintLatRad);
  const cosFootprint = Math.cos(footprintLatRad);
  const tanFootprint = Math.tan(footprintLatRad);
  const c1 = secondEccentricitySquared * cosFootprint * cosFootprint;
  const t1 = tanFootprint * tanFootprint;
  const n1 = semiMajorAxis / Math.sqrt(1 - eccentricitySquared * sinFootprint * sinFootprint);
  const r1 = (semiMajorAxis * (1 - eccentricitySquared)) / (1 - eccentricitySquared * sinFootprint * sinFootprint) ** 1.5;
  const d = (x - falseEasting) / (n1 * scaleFactor);

  const latRad =
    footprintLatRad -
    (n1 * tanFootprint) /
      r1 *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * secondEccentricitySquared) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * secondEccentricitySquared - 3 * c1 ** 2) * d ** 6) / 720);
  const lngRad =
    originLngRad +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * secondEccentricitySquared + 24 * t1 ** 2) * d ** 5) / 120) /
      cosFootprint;

  return {
    lat: radiansToDegrees(latRad),
    lng: radiansToDegrees(lngRad)
  };
}

function meridianArc(semiMajorAxis: number, eccentricitySquared: number, latRad: number) {
  return (
    semiMajorAxis *
    ((1 - eccentricitySquared / 4 - (3 * eccentricitySquared ** 2) / 64 - (5 * eccentricitySquared ** 3) / 256) * latRad -
      ((3 * eccentricitySquared) / 8 + (3 * eccentricitySquared ** 2) / 32 + (45 * eccentricitySquared ** 3) / 1024) * Math.sin(2 * latRad) +
      ((15 * eccentricitySquared ** 2) / 256 + (45 * eccentricitySquared ** 3) / 1024) * Math.sin(4 * latRad) -
      ((35 * eccentricitySquared ** 3) / 3072) * Math.sin(6 * latRad))
  );
}

function formatReport(report: OfficialMapCoordinateReport) {
  const lines = [
    `${report.input.coordinateSystem}: x=${report.input.x}, y=${report.input.y}`,
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

function supportedProjectedCrs(value: string): SupportedProjectedCrs {
  const normalized = value.trim().toUpperCase();
  if (supportedCrs.some((crs) => crs === normalized)) return normalized as SupportedProjectedCrs;
  throw new Error(`--crs must be one of: ${supportedCrs.join(", ")}`);
}

function requiredNumber(rawValue: string, key: string) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) throw new Error(`--${key} must be a number`);
  return value;
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function assertFiniteCoordinate(value: number, key: string) {
  if (!Number.isFinite(value)) throw new Error(`${key} must be a finite number`);
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function isMain() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
