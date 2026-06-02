import { analyzePendingVisitEventUserAgents, userAgentAnalysisLimitSchema } from "@/lib/visit-events";
import { pg } from "@/db/client";

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length);
const limit = userAgentAnalysisLimitSchema.parse(limitArg ?? process.env.AIGO_UA_ANALYSIS_LIMIT ?? 250);
const result = await analyzePendingVisitEventUserAgents(limit);

console.log(`processed ${result.processedCount} visit event user agents`);
await pg.end();
