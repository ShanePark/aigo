import { pathToFileURL } from "node:url";

type CoordinateProvenanceArgs = {
  placeName?: string;
  officialAddress: string;
  officialSourceUrl?: string;
  officialSourceTitle?: string;
  coordinateAddress: string;
  coordinateSourceUrl: string;
  coordinateSourceTitle?: string;
  parentPlaceId?: string;
  parentPlaceName?: string;
  parentSourceUrl?: string;
  parentSourceTitle?: string;
  tenantSourceUrl?: string;
  tenantSourceTitle?: string;
  duplicateRadiusMeters?: number;
  lat: number;
  lng: number;
  level: CoordinateProvenanceLevel;
  checkedAt?: string;
};

type CoordinateProvenanceLevel = "official_embedded_map" | "public_dataset_exact_address" | "public_address_coordinate" | "parent_building_coordinate";

type CoordinateProvenanceDraft = {
  addressMatch: {
    matches: boolean;
    normalizedOfficialAddress: string;
    normalizedCoordinateAddress: string;
    warnings: string[];
  };
  externalRefs: {
    coordinateProvenance: {
      level: CoordinateProvenanceLevel;
      lat: number;
      lng: number;
      coordinateSystem: "WGS84";
      sourceUrl: string;
      sourceTitle?: string;
      basis: string;
      addressMatched: string;
      officialSourceUrl?: string;
      officialSourceTitle?: string;
      confidence: "high" | "medium";
      checkedAt: string;
    };
  };
  parentBuilding?: {
    tenantPlaceName?: string;
    tenantSourceUrl?: string;
    tenantSourceTitle?: string;
    parentPlaceId?: string;
    parentPlaceName?: string;
    parentSourceUrl?: string;
    parentSourceTitle?: string;
    duplicateReview: {
      radiusMeters: number;
      reviewLabels: ["parent_building_coordinate", "same_building_review_only"];
      caution: string;
    };
    warnings: string[];
  };
};

const validLevels = new Set<CoordinateProvenanceLevel>([
  "official_embedded_map",
  "public_dataset_exact_address",
  "public_address_coordinate",
  "parent_building_coordinate"
]);

if (isMain()) {
  try {
    console.log(JSON.stringify(buildCoordinateProvenanceDraft(parseArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): CoordinateProvenanceArgs {
  const raw = new Map<string, string>();

  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match) continue;
    raw.set(match[1], match[2].trim());
  }

  const level = raw.get("level") || "public_address_coordinate";
  if (!validLevels.has(level as CoordinateProvenanceLevel)) {
    throw new Error(`--level must be one of: ${Array.from(validLevels).join(", ")}`);
  }

  return {
    placeName: optionalString(raw.get("place-name")),
    officialAddress: requiredString(raw, "official-address"),
    officialSourceUrl: optionalString(raw.get("official-source-url")),
    officialSourceTitle: optionalString(raw.get("official-source-title")),
    coordinateAddress: requiredString(raw, "coordinate-address"),
    coordinateSourceUrl: requiredString(raw, "coordinate-source-url"),
    coordinateSourceTitle: optionalString(raw.get("coordinate-source-title")),
    parentPlaceId: optionalString(raw.get("parent-place-id")),
    parentPlaceName: optionalString(raw.get("parent-place-name")),
    parentSourceUrl: optionalString(raw.get("parent-source-url")),
    parentSourceTitle: optionalString(raw.get("parent-source-title")),
    tenantSourceUrl: optionalString(raw.get("tenant-source-url")),
    tenantSourceTitle: optionalString(raw.get("tenant-source-title")),
    duplicateRadiusMeters: optionalNumber(raw.get("duplicate-radius-meters"), "duplicate-radius-meters"),
    lat: requiredNumber(raw, "lat"),
    lng: requiredNumber(raw, "lng"),
    level: level as CoordinateProvenanceLevel,
    checkedAt: optionalString(raw.get("checked-at"))
  };
}

export function buildCoordinateProvenanceDraft(input: CoordinateProvenanceArgs): CoordinateProvenanceDraft {
  const normalizedOfficialAddress = normalizeKoreanAddress(input.officialAddress);
  const normalizedCoordinateAddress = normalizeKoreanAddress(input.coordinateAddress);
  const matches = normalizedOfficialAddress === normalizedCoordinateAddress;
  const warnings = matches ? [] : ["Official address and coordinate-source address do not normalize to the same string; verify identity before mutation."];
  const confidence = matches ? "high" : "medium";
  const sourceTitle = input.coordinateSourceTitle ?? "Coordinate source";
  const placePrefix = input.placeName ? `${input.placeName}: ` : "";
  const parentBuilding = input.level === "parent_building_coordinate" ? buildParentBuildingEvidence(input) : undefined;

  return {
    addressMatch: {
      matches,
      normalizedOfficialAddress,
      normalizedCoordinateAddress,
      warnings
    },
    externalRefs: {
      coordinateProvenance: {
        level: input.level,
        lat: input.lat,
        lng: input.lng,
        coordinateSystem: "WGS84",
        sourceUrl: input.coordinateSourceUrl,
        sourceTitle,
        basis: buildBasis(input, matches, placePrefix),
        addressMatched: input.coordinateAddress,
        ...(input.officialSourceUrl ? { officialSourceUrl: input.officialSourceUrl } : {}),
        ...(input.officialSourceTitle ? { officialSourceTitle: input.officialSourceTitle } : {}),
        confidence,
        checkedAt: input.checkedAt ?? new Date().toISOString()
      }
    },
    ...(parentBuilding ? { parentBuilding } : {})
  };
}

function buildBasis(input: CoordinateProvenanceArgs, matches: boolean, placePrefix: string) {
  if (input.level === "parent_building_coordinate") {
    const parentName = input.parentPlaceName ? ` (${input.parentPlaceName})` : "";
    const evidenceNote = input.tenantSourceUrl
      ? "tenant identity/source evidence is recorded separately in parentBuilding."
      : "tenant identity/source evidence still needs manual confirmation.";
    return `${placePrefix}coordinate belongs to the parent building${parentName}; ${evidenceNote}`;
  }

  return matches
    ? `${placePrefix}coordinate source address matches the official/operator address after normalization.`
    : `${placePrefix}coordinate source address differs from the official/operator address; use only after manual identity review.`;
}

function buildParentBuildingEvidence(input: CoordinateProvenanceArgs): NonNullable<CoordinateProvenanceDraft["parentBuilding"]> {
  const radiusMeters = input.duplicateRadiusMeters ?? 80;
  const warnings = [
    ...(!input.parentPlaceName && !input.parentPlaceId ? ["Record the parent building name or existing place id before mutation."] : []),
    ...(!input.parentSourceUrl ? ["Record a parent building source URL before mutation."] : []),
    ...(!input.tenantSourceUrl ? ["Record a tenant official/listing source URL before mutation."] : [])
  ];

  return {
    ...(input.placeName ? { tenantPlaceName: input.placeName } : {}),
    ...(input.tenantSourceUrl ? { tenantSourceUrl: input.tenantSourceUrl } : {}),
    ...(input.tenantSourceTitle ? { tenantSourceTitle: input.tenantSourceTitle } : {}),
    ...(input.parentPlaceId ? { parentPlaceId: input.parentPlaceId } : {}),
    ...(input.parentPlaceName ? { parentPlaceName: input.parentPlaceName } : {}),
    ...(input.parentSourceUrl ? { parentSourceUrl: input.parentSourceUrl } : {}),
    ...(input.parentSourceTitle ? { parentSourceTitle: input.parentSourceTitle } : {}),
    duplicateReview: {
      radiusMeters,
      reviewLabels: ["parent_building_coordinate", "same_building_review_only"],
      caution:
        "Use the parent building coordinate only for conservative same-building duplicate review; do not merge tenant and parent records without tenant-specific identity evidence."
    },
    warnings
  };
}

function normalizeKoreanAddress(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+\s*(?:층|f)\b/gi, " ")
    .replace(/\s+/g, "")
    .replace(/[,.]/g, "")
    .toLowerCase();
}

function requiredString(raw: Map<string, string>, key: string) {
  const value = optionalString(raw.get(key));
  if (!value) throw new Error(`Missing required --${key}=...`);
  return value;
}

function optionalString(value: string | undefined) {
  return value && value.trim() ? value.trim() : undefined;
}

function requiredNumber(raw: Map<string, string>, key: string) {
  const value = Number(raw.get(key));
  if (!Number.isFinite(value)) throw new Error(`--${key} must be a number`);
  return value;
}

function optionalNumber(value: string | undefined, key: string) {
  if (!optionalString(value)) return undefined;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) throw new Error(`--${key} must be a positive number`);
  return numberValue;
}

function isMain() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}
