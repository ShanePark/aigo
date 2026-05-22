import { pg } from "@/db/client";
import { searchPlaces } from "@/lib/places";
import type { SearchPlacesInput } from "@/lib/schemas";

type Scenario = {
  id: string;
  label: string;
  intent: string;
  input: SearchPlacesInput;
};

type AuditArgs = {
  json: boolean;
  limit: number;
  scenarioIds: Set<string>;
};

const daejeonStation = {
  lat: 36.3326,
  lng: 127.4344,
  label: "Daejeon Station"
};

const childAgeMonths = [32, 7, 7];

const familyLogistics = {
  parkingAvailable: true,
  strollerFriendly: true,
  nursingRoom: true
};

const scenarios: Scenario[] = [
  {
    id: "after-daycare-indoor",
    label: "After daycare indoor fallback",
    intent: "Short, low-effort indoor places near old downtown with toddler activity and infant logistics.",
    input: {
      visitContext: "afterDaycare",
      origin: daejeonStation,
      radiusKm: 15,
      childAgeMonths,
      preferences: {
        ...familyLogistics,
        indoorTypes: ["indoor", "mixed"],
        babyChair: true
      },
      primaryCategories: ["kids_cafe", "indoor_playground", "shopping_mall", "toy_store", "library"],
      sort: "recommended",
      limit: 8,
      offset: 0
    }
  },
  {
    id: "nearby-now-kids",
    label: "Nearby now kids",
    intent: "Places that should rank well for a same-day nearby kid outing.",
    input: {
      visitContext: "nearbyNow",
      origin: daejeonStation,
      radiusKm: 8,
      query: "키즈카페",
      childAgeMonths,
      preferences: {
        ...familyLogistics,
        indoorTypes: ["indoor", "mixed"]
      },
      sort: "recommended",
      limit: 8,
      offset: 0
    }
  },
  {
    id: "nearby-playground",
    label: "Nearby playground",
    intent: "A playground search should strongly prefer close low-friction play over farther destination content.",
    input: {
      visitContext: "nearbyNow",
      origin: daejeonStation,
      radiusKm: 15,
      query: "놀이터",
      childAgeMonths,
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true
      },
      primaryCategories: ["park", "indoor_playground", "kids_cafe"],
      sort: "recommended",
      limit: 8,
      offset: 0
    }
  },
  {
    id: "playroom-restaurant",
    label: "Playroom restaurant",
    intent: "Meal-plus-play candidates should still be close enough that dinner logistics stay easy.",
    input: {
      visitContext: "afterDaycare",
      origin: daejeonStation,
      radiusKm: 20,
      query: "놀이방식당",
      childAgeMonths,
      preferences: {
        parkingAvailable: true,
        babyChair: true
      },
      primaryCategories: ["family_restaurant", "family_cafe"],
      sort: "recommended",
      limit: 8,
      offset: 0
    }
  },
  {
    id: "rainy-day",
    label: "Rainy day",
    intent: "Rain-safe options should beat exposed outdoor places unless the objective place score is overwhelming.",
    input: {
      visitContext: "rainyDay",
      origin: daejeonStation,
      radiusKm: 30,
      query: "실내",
      childAgeMonths,
      preferences: {
        ...familyLogistics,
        indoorTypes: ["indoor", "mixed"]
      },
      sort: "recommended",
      limit: 8,
      offset: 0
    }
  },
  {
    id: "stay-destination",
    label: "Stay destination",
    intent: "Lodging should lean more on stored quality, public evidence, and kid content than raw proximity.",
    input: {
      origin: daejeonStation,
      radiusKm: 250,
      query: "키즈숙소",
      childAgeMonths,
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true
      },
      primaryCategories: ["accommodation"],
      sort: "recommended",
      limit: 8,
      offset: 0
    }
  },
  {
    id: "weekend-half-day-public",
    label: "Weekend half-day public facilities",
    intent: "Repeatable museums, libraries, experience centers, malls, and parks for a half-day family plan.",
    input: {
      visitContext: "weekendHalfDay",
      origin: daejeonStation,
      radiusKm: 50,
      query: "어린이",
      childAgeMonths,
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true
      },
      primaryCategories: ["science_museum", "museum", "experience_center", "library", "shopping_mall", "park"],
      sort: "recommended",
      limit: 8,
      offset: 0
    }
  },
  {
    id: "day-trip-nature",
    label: "Day-trip nature",
    intent: "Longer outdoor/day-trip candidates should need distance fit, toilets, stroller practicality, and safety notes.",
    input: {
      visitContext: "dayTrip",
      origin: daejeonStation,
      radiusKm: 80,
      childAgeMonths,
      preferences: {
        parkingAvailable: true,
        strollerFriendly: true,
        nursingRoom: true
      },
      primaryCategories: ["park", "rest_area", "experience_center", "science_museum"],
      sort: "recommended",
      limit: 8,
      offset: 0
    }
  }
];

function parseArgs(argv: string[]): AuditArgs {
  const scenarioIds = new Set<string>();
  let json = false;
  let limit = 8;

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (Number.isInteger(value) && value > 0) limit = Math.min(value, 50);
      continue;
    }

    if (arg.startsWith("--scenario=")) {
      for (const id of arg.slice("--scenario=".length).split(",")) {
        if (id.trim()) scenarioIds.add(id.trim());
      }
    }
  }

  return { json, limit, scenarioIds };
}

function selectedScenarios(args: AuditArgs) {
  if (args.scenarioIds.size === 0) return scenarios;
  return scenarios.filter((scenario) => args.scenarioIds.has(scenario.id));
}

function topReasons(item: Awaited<ReturnType<typeof searchPlaces>>["items"][number]) {
  return item.reasons
    .slice(0, 4)
    .map((reason) => reason.labelKo)
    .join(", ");
}

function dataGaps(item: Awaited<ReturnType<typeof searchPlaces>>["items"][number]) {
  const gaps: string[] = [];
  if (item.scoring.placeScore === null) gaps.push("placeScore");
  if (item.scoring.externalRatingScore === null) gaps.push("externalRating");
  if (item.scoring.searchEvidenceScore === null) gaps.push("searchEvidence");
  if (item.scoreBreakdown.openingHours < 0) gaps.push("hoursPenalty");
  if (item.reasonCodes.includes("OPENING_HOURS_UNKNOWN")) gaps.push("hoursUnknown");
  if (item.reasonCodes.some((code) => code.endsWith("_UNKNOWN"))) gaps.push("amenityUnknown");
  return gaps.length ? gaps.join(",") : "-";
}

function formatBreakdown(item: Awaited<ReturnType<typeof searchPlaces>>["items"][number]) {
  const breakdown = item.scoreBreakdown as typeof item.scoreBreakdown & { queryMatch?: number };
  return [
    `quality ${breakdown.placeQuality}`,
    `external ${breakdown.externalEvidence}`,
    `distance ${breakdown.distance}`,
    `context ${breakdown.context}`,
    `match ${breakdown.match}`,
    `age ${breakdown.age}`,
    `prefs ${breakdown.preferences}`,
    `hours ${breakdown.openingHours}`,
    `visit ${breakdown.visitFit}`,
    `query ${breakdown.queryMatch ?? 0}`
  ].join("; ");
}

function formatMarkdown(results: Awaited<ReturnType<typeof runAudit>>) {
  const lines: string[] = [];
  lines.push(`# AiGo Scoring Audit`);
  lines.push("");
  lines.push(`Generated: ${results.generatedAt}`);
  lines.push(`Origin: ${daejeonStation.label} (${daejeonStation.lat}, ${daejeonStation.lng})`);
  lines.push(`Child ages: ${childAgeMonths.join(", ")} months`);
  lines.push("");

  for (const scenario of results.scenarios) {
    lines.push(`## ${scenario.label}`);
    lines.push("");
    lines.push(scenario.intent);
    lines.push("");
    lines.push("| Rank | Score | Place | Category | Distance | Stored | Breakdown | Gaps | Reasons |");
    lines.push("| ---: | ---: | --- | --- | ---: | --- | --- | --- | --- |");

    scenario.items.forEach((item, index) => {
      const stored =
        item.scoring.placeScore === null
          ? "-"
          : `${item.scoring.placeScore}/10` +
            (item.scoring.externalRatingScore === null ? "" : `, ext ${item.scoring.externalRatingScore}/10`);
      const distance = item.distanceKm === null || item.distanceKm === undefined ? "-" : `${item.distanceKm.toFixed(1)} km`;
      const cells = [
        index + 1,
        item.score,
        escapePipe(item.name),
        item.primaryCategory,
        distance,
        stored,
        escapePipe(formatBreakdown(item)),
        dataGaps(item),
        escapePipe(topReasons(item))
      ];
      lines.push(`| ${cells.join(" | ")} |`);
    });

    if (scenario.items.length === 0) {
      lines.push("No results.");
    }

    lines.push("");
  }

  return lines.join("\n");
}

function escapePipe(value: string) {
  return value.replaceAll("|", "\\|");
}

async function runAudit(args: AuditArgs) {
  const activeScenarios = selectedScenarios(args);
  const results = [];

  for (const scenario of activeScenarios) {
    const result = await searchPlaces({
      ...scenario.input,
      limit: args.limit
    });
    results.push({
      id: scenario.id,
      label: scenario.label,
      intent: scenario.intent,
      input: result.meta.search,
      items: result.items
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    origin: daejeonStation,
    childAgeMonths,
    scenarios: results
  };
}

const args = parseArgs(process.argv.slice(2));

try {
  const results = await runAudit(args);
  console.log(args.json ? JSON.stringify(results, null, 2) : formatMarkdown(results));
} finally {
  await pg.end({ timeout: 5 });
}
