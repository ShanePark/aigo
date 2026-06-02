import type { NextRequest } from "next/server";

import type postgres from "postgres";

import { pg } from "@/db/client";
import { loadCurrentConsentDocument } from "@/lib/consent-document-store";
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
  const document = await loadCurrentConsentDocument(consent.type, executor);

  if (!document || document.version !== consent.version) {
    throw new Error(`Consent document is not registered in DB for ${consent.type} ${consent.version}`);
  }

  await executor`
    insert into user_consents (
      user_id,
      consent_type,
      version,
      document_id,
      document_title,
      document_url,
      document_effective_date,
      document_body_sha256,
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
      ${document.id},
      ${document.documentTitle},
      ${document.documentUrl},
      ${document.documentEffectiveDate},
      ${document.bodySha256},
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
