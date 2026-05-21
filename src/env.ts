export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://aigo:aigo@localhost:5431/aigo",
  apiKey: process.env.AIGO_API_KEY ?? "change-me"
};

