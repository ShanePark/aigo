import { pathToFileURL } from "node:url";

type CoordinateProvenanceArgs = {
  placeName?: string;
  officialAddress: string;
  officialSourceUrl?: string;
  officialSourceTitle?: string;
  coordinateAddress: string;
  coordinateSourceUrl: string;
  coordinateSourceTitle?: string;
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
        basis: matches
          ? `${placePrefix}coordinate source address matches the official/operator address after normalization.`
          : `${placePrefix}coordinate source address differs from the official/operator address; use only after manual identity review.`,
        addressMatched: input.coordinateAddress,
        ...(input.officialSourceUrl ? { officialSourceUrl: input.officialSourceUrl } : {}),
        ...(input.officialSourceTitle ? { officialSourceTitle: input.officialSourceTitle } : {}),
        confidence,
        checkedAt: input.checkedAt ?? new Date().toISOString()
      }
    }
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

function isMain() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}
