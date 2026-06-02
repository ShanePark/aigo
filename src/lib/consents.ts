import type { NextRequest } from "next/server";

import type postgres from "postgres";

import { pg } from "@/db/client";
import { REQUIRED_CONSENTS, type RequiredConsent } from "@/lib/consent-definitions";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;
type ConsentSource = "signup" | "login" | "account_update" | "admin";

export async function recordRequiredConsents(
  userId: string,
  request: NextRequest,
  options: { source?: ConsentSource } = {},
  executor: SqlExecutor = pg
) {
  for (const consent of REQUIRED_CONSENTS) {
    await recordUserConsent(userId, request, consent, options, executor);
  }
}

export async function recordUserConsent(
  userId: string,
  request: NextRequest,
  consent: RequiredConsent,
  options: { source?: ConsentSource } = {},
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
      ${consent.type},
      ${consent.version},
      ${consent.documentTitle},
      ${consent.documentUrl},
      ${consent.documentEffectiveDate},
      ${consent.consentText},
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
