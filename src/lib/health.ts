import { pg } from "@/db/client";
import { ApiError } from "@/lib/errors";

export type AgentHealthStatus = {
  ok: true;
  service: "aigo-api";
  auth: "ok";
  database: "ok";
  checkedAt: string;
};

export async function getAgentHealth(): Promise<AgentHealthStatus> {
  try {
    await pg`select 1 as ok`;
  } catch {
    throw new ApiError(503, "Database health check failed");
  }

  return {
    ok: true,
    service: "aigo-api",
    auth: "ok",
    database: "ok",
    checkedAt: new Date().toISOString()
  };
}
