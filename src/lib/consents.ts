import type { NextRequest } from "next/server";

import type postgres from "postgres";

import { pg } from "@/db/client";
import { PRIVACY_POLICY_CONSENT } from "@/lib/consent-definitions";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

export async function recordPrivacyPolicyConsent(
  userId: string,
  request: NextRequest,
  options: { source?: "signup" | "login" | "account_update" | "admin" } = {},
  executor: SqlExecutor = pg
) {
  await executor`
    insert into user_consents (
      user_id,
      consent_type,
      version,
      document_title,
      document_url,
      document_effective_date,
      consent_text,
      source,
      ip_address,
      user_agent,
      consented_at
    )
    values (
      ${userId},
      ${PRIVACY_POLICY_CONSENT.type},
      ${PRIVACY_POLICY_CONSENT.version},
      ${PRIVACY_POLICY_CONSENT.documentTitle},
      ${PRIVACY_POLICY_CONSENT.documentUrl},
      ${PRIVACY_POLICY_CONSENT.documentEffectiveDate},
      ${PRIVACY_POLICY_CONSENT.consentText},
      ${options.source ?? "signup"},
      ${clientIp(request)},
      ${request.headers.get("user-agent")?.trim() || null},
      now()
    )
    on conflict (user_id, consent_type, version) do nothing
  `;
}

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || request.headers.get("cf-connecting-ip")?.trim() || null;
}
