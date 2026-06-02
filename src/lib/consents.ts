import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";

import type postgres from "postgres";

import { pg } from "@/db/client";
import { consentDocumentByType, type ConsentDocument } from "@/lib/consent-documents";
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
  const document = consentDocumentByType(consent.type);

  if (!document || document.version !== consent.version) {
    throw new Error(`Consent document is not registered for ${consent.type} ${consent.version}`);
  }

  const registeredDocument = await ensureConsentDocument(document, executor);

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
      ${registeredDocument.id},
      ${consent.documentTitle},
      ${consent.documentUrl},
      ${consent.documentEffectiveDate},
      ${registeredDocument.bodySha256},
      ${consent.consentText},
      ${options.source ?? "signup"},
      ${clientIp(request)},
      ${request.headers.get("user-agent")?.trim() || null},
      now()
    )
    on conflict (user_id, consent_type, version) do nothing
  `;
}

async function ensureConsentDocument(document: ConsentDocument, executor: SqlExecutor) {
  const bodySha256 = sha256(document.bodyText);

  await executor`
    insert into consent_documents (
      consent_type,
      version,
      document_title,
      document_url,
      document_effective_date,
      body_text,
      body_sha256,
      status
    )
    values (
      ${document.type},
      ${document.version},
      ${document.documentTitle},
      ${document.documentUrl},
      ${document.documentEffectiveDate},
      ${document.bodyText},
      ${bodySha256},
      'active'
    )
    on conflict (consent_type, version) do nothing
  `;

  const rows = await executor<{ id: string; body_sha256: string }[]>`
    select id, body_sha256
    from consent_documents
    where consent_type = ${document.type}
      and version = ${document.version}
    limit 1
  `;
  const registeredDocument = rows[0];

  if (!registeredDocument) {
    throw new Error(`Consent document lookup failed for ${document.type} ${document.version}`);
  }

  if (registeredDocument.body_sha256 !== bodySha256) {
    throw new Error(`Consent document hash mismatch for ${document.type} ${document.version}`);
  }

  return { bodySha256, id: registeredDocument.id };
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || request.headers.get("cf-connecting-ip")?.trim() || null;
}
