import type { PlaceTaxonomy } from "@/lib/taxonomy";

export type LegacyPrimaryCategory = "park" | "museum";
export type SplitPrimaryCategory = "playground" | "park" | "art_museum" | "museum";
export type SplitConfidence = "high" | "medium" | "low";

export type PrimaryCategorySplitAuditRow = {
  id: string;
  name: string;
  primary_category: LegacyPrimaryCategory;
  tags: string[] | null;
  description: string | null;
  parent_notes: string | null;
  safety_notes: string | null;
  play_features: Record<string, unknown> | null;
  taxonomy: PlaceTaxonomy | null;
  region_sido: string | null;
  region_sigungu: string | null;
  address: string | null;
  road_address: string | null;
};

export type PrimaryCategorySplitSuggestion = {
  id: string;
  name: string;
  currentPrimaryCategory: LegacyPrimaryCategory;
  suggestedPrimaryCategory: SplitPrimaryCategory | "needs_review";
  confidence: SplitConfidence;
  reasonCodes: string[];
  evidence: string[];
  region: string | null;
  address: string | null;
};

export type PrimaryCategorySplitAudit = {
  generatedAt: string;
  total: number;
  countsByCurrentCategory: Record<string, number>;
  countsBySuggestion: Record<string, number>;
  items: PrimaryCategorySplitSuggestion[];
};

export const legacySplitPrimaryCategories = ["park", "museum"] as const satisfies readonly LegacyPrimaryCategory[];

const artMuseumTerms = ["미술관", "아트센터", "아트 센터", "갤러리", "gallery", "art museum", "art center"];
const playgroundTerms = [
  "놀이터",
  "어린이공원",
  "물놀이터",
  "모래놀이터",
  "유아숲",
  "숲놀이터",
  "미끄럼틀",
  "그네",
  "시소",
  "정글짐",
  "playground"
];
const playgroundPlayFeatureKeys = [
  "slide",
  "swing",
  "seesaw",
  "sandPlay",
  "sand_play",
  "waterPlayground",
  "water_play",
  "climbing",
  "jungleGym",
  "outdoorPlayground",
  "playground"
];
const broadParkNameTerms = [
  "수목원",
  "식물원",
  "공원",
  "대공원",
  "자연휴양림",
  "산림욕장",
  "치유의숲",
  "행복숲",
  "화목원",
  "군립공원",
  "관광지",
  "화석산지",
  "테마공원",
  "호수공원",
  "문화체육공원",
  "해양누리공원",
  "아리랑대공원",
  "어린이대공원"
];

export function buildPrimaryCategorySplitAudit(rows: PrimaryCategorySplitAuditRow[], generatedAt = new Date().toISOString()): PrimaryCategorySplitAudit {
  const items = rows.map(suggestPrimaryCategorySplit);
  return {
    generatedAt,
    total: items.length,
    countsByCurrentCategory: countBy(items.map((item) => item.currentPrimaryCategory)),
    countsBySuggestion: countBy(items.map((item) => item.suggestedPrimaryCategory)),
    items
  };
}

export function suggestPrimaryCategorySplit(row: PrimaryCategorySplitAuditRow): PrimaryCategorySplitSuggestion {
  const text = searchableText(row);
  const taxonomyActivityTypes = taxonomyValues(row.taxonomy, "activityTypes");
  const evidence: string[] = [];
  const reasonCodes: string[] = [];
  let suggestedPrimaryCategory: PrimaryCategorySplitSuggestion["suggestedPrimaryCategory"] = "needs_review";
  let confidence: SplitConfidence = "low";

  if (row.primary_category === "park") {
    const termEvidence = matchingTerms(text, playgroundTerms);
    const nameTermEvidence = matchingTerms(row.name.toLowerCase(), playgroundTerms);
    const playFeatureEvidence = matchingPlayFeatureKeys(row.play_features);
    const taxonomyEvidence = taxonomyActivityTypes.filter((value) => /playground|sand_play|water_play|outdoor_play/.test(value));
    const hasPlaygroundEvidence = termEvidence.length > 0 || playFeatureEvidence.length > 0 || taxonomyEvidence.length > 0;
    const hasBroadParkName = matchingTerms(row.name.toLowerCase(), broadParkNameTerms).length > 0;
    if (hasPlaygroundEvidence && hasBroadParkName && nameTermEvidence.length === 0) {
      suggestedPrimaryCategory = "park";
      confidence = "medium";
      reasonCodes.push("BROAD_PARK_PLAYGROUND_CONTEXT_ONLY");
      evidence.push(...formatTermEvidence("playground", termEvidence));
      evidence.push(...playFeatureEvidence.map((key) => `playFeatures:${key}`));
      evidence.push(...taxonomyEvidence.map((value) => `taxonomy.activityTypes:${value}`));
    } else if (hasPlaygroundEvidence) {
      suggestedPrimaryCategory = "playground";
      confidence = nameTermEvidence.length > 0 ? "high" : "medium";
      reasonCodes.push("PLAYGROUND_EVIDENCE");
      evidence.push(...formatTermEvidence("playground", termEvidence));
      evidence.push(...playFeatureEvidence.map((key) => `playFeatures:${key}`));
      evidence.push(...taxonomyEvidence.map((value) => `taxonomy.activityTypes:${value}`));
    } else {
      suggestedPrimaryCategory = "park";
      confidence = "medium";
      reasonCodes.push("NO_PLAYGROUND_EVIDENCE");
    }
  }

  if (row.primary_category === "museum") {
    const termEvidence = matchingTerms(text, artMuseumTerms);
    const nameTermEvidence = matchingTerms(row.name.toLowerCase(), artMuseumTerms);
    if (nameTermEvidence.length > 0) {
      suggestedPrimaryCategory = "art_museum";
      confidence = "high";
      reasonCodes.push("ART_MUSEUM_TERM_MATCH");
      evidence.push(...formatTermEvidence("art_museum", nameTermEvidence));
    } else if (termEvidence.length > 0) {
      suggestedPrimaryCategory = "museum";
      confidence = "medium";
      reasonCodes.push("ART_MUSEUM_CONTEXT_ONLY");
      evidence.push(...formatTermEvidence("art_museum", termEvidence));
    } else {
      suggestedPrimaryCategory = "museum";
      confidence = "medium";
      reasonCodes.push("NO_ART_MUSEUM_EVIDENCE");
    }
  }

  return {
    id: row.id,
    name: row.name,
    currentPrimaryCategory: row.primary_category,
    suggestedPrimaryCategory,
    confidence,
    reasonCodes,
    evidence: Array.from(new Set(evidence)).slice(0, 10),
    region: [row.region_sido, row.region_sigungu].filter(Boolean).join(" ") || null,
    address: row.road_address ?? row.address
  };
}

function searchableText(row: PrimaryCategorySplitAuditRow) {
  return [
    row.name,
    row.description,
    row.parent_notes,
    row.safety_notes,
    ...(row.tags ?? []),
    JSON.stringify(row.play_features ?? {}),
    JSON.stringify(row.taxonomy ?? {})
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchingTerms(text: string, terms: string[]) {
  return terms.filter((term) => matchesTerm(text, term));
}

function formatTermEvidence(label: string, terms: string[]) {
  return terms.map((term) => `${label}:${term}`);
}

function matchesTerm(text: string, term: string) {
  const normalizedTerm = term.toLowerCase();
  if (!/[a-z]/i.test(normalizedTerm)) return text.includes(normalizedTerm);
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`, "i").test(text);
}

function matchingPlayFeatureKeys(playFeatures: Record<string, unknown> | null) {
  if (!playFeatures) return [];
  return playgroundPlayFeatureKeys.filter((key) => truthyFeature(playFeatures[key]));
}

function truthyFeature(value: unknown) {
  return value === true || value === "yes" || value === "available" || value === "source_backed";
}

function taxonomyValues(taxonomy: PlaceTaxonomy | null, family: "activityTypes") {
  return Array.from(
    new Set([...(taxonomy?.sourceBacked?.[family] ?? []), ...(taxonomy?.inferred?.[family] ?? [])].map((value) => String(value)))
  );
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
