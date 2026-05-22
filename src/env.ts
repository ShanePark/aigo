export const DEFAULT_DEV_API_KEY = "change-me";

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://aigo:aigo@localhost:5431/aigo",
  apiKey: process.env.AIGO_API_KEY ?? DEFAULT_DEV_API_KEY
};

export function isDefaultDevApiKey(apiKey = env.apiKey) {
  return apiKey === DEFAULT_DEV_API_KEY;
}

export function requiresStrongApiKey() {
  return process.env.NODE_ENV === "production" || process.env.AIGO_REQUIRE_STRONG_API_KEY === "true";
}

export function assertSafeApiKeyForRuntime() {
  if (requiresStrongApiKey() && isDefaultDevApiKey()) {
    throw new Error("AIGO_API_KEY must be set to a non-default value before exposing the AiGo API.");
  }
}
