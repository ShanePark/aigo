import { describe, expect, it } from "vitest";

import { loadPublicConsentDocument } from "@/lib/consent-document-store";

describe("public consent document loading", () => {
  it("falls back to the seed document when the database is unavailable", async () => {
    const executor = (async () => {
      const error = new AggregateError([], "database unavailable");
      (error as AggregateError & { code: string }).code = "ECONNREFUSED";
      throw error;
    }) as never;

    await expect(loadPublicConsentDocument("privacy_policy", executor)).resolves.toMatchObject({
      documentTitle: "개인정보 처리방침",
      type: "privacy_policy"
    });
  });
});
