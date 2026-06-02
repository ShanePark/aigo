import { createHash } from "node:crypto";

import type postgres from "postgres";

import { pg } from "@/db/client";
import { consentDocumentByType, type ConsentDocument, type ConsentDocumentSection } from "@/lib/consent-documents";
import type { RequiredConsentType } from "@/lib/consent-definitions";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

type ConsentDocumentRow = {
  id: string;
  consentType: RequiredConsentType;
  version: string;
  documentTitle: string;
  documentUrl: string;
  documentEffectiveDate: string | null;
  bodyText: string;
  bodySections: unknown;
  bodySha256: string;
};

export type StoredConsentDocument = ConsentDocument & {
  bodySha256: string;
  id: string;
};

export async function loadCurrentConsentDocument(type: RequiredConsentType, executor: SqlExecutor = pg) {
  const seedDocument = consentDocumentByType(type);
  if (!seedDocument) return null;

  await ensureConsentDocument(seedDocument, executor);

  const rows = await executor<ConsentDocumentRow[]>`
    select
      id::text as id,
      consent_type as "consentType",
      version,
      document_title as "documentTitle",
      document_url as "documentUrl",
      document_effective_date as "documentEffectiveDate",
      body_text as "bodyText",
      body_sections as "bodySections",
      body_sha256 as "bodySha256"
    from consent_documents
    where consent_type = ${type}
      and version = ${seedDocument.version}
      and status = 'active'
    limit 1
  `;
  const row = rows[0];

  return row ? rowToConsentDocument(row, seedDocument) : null;
}

export async function ensureConsentDocument(document: ConsentDocument, executor: SqlExecutor = pg) {
  const bodySha256 = sha256(document.bodyText);

  await executor`
    insert into consent_documents (
      consent_type,
      version,
      document_title,
      document_url,
      document_effective_date,
      body_text,
      body_sections,
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
      ${JSON.stringify(document.sections)}::jsonb,
      ${bodySha256},
      'active'
    )
    on conflict (consent_type, version) do nothing
  `;

  await executor`
    update consent_documents
    set body_sections = ${JSON.stringify(document.sections)}::jsonb
    where consent_type = ${document.type}
      and version = ${document.version}
      and body_sha256 = ${bodySha256}
      and body_sections is null
  `;

  const rows = await executor<Array<{ id: string; bodySha256: string }>>`
    select id::text as id, body_sha256 as "bodySha256"
    from consent_documents
    where consent_type = ${document.type}
      and version = ${document.version}
    limit 1
  `;
  const registeredDocument = rows[0];

  if (!registeredDocument) {
    throw new Error(`Consent document lookup failed for ${document.type} ${document.version}`);
  }

  return registeredDocument;
}

function rowToConsentDocument(row: ConsentDocumentRow, seedDocument: ConsentDocument): StoredConsentDocument {
  if (row.bodySha256 !== sha256(row.bodyText)) {
    throw new Error(`Consent document hash mismatch in DB for ${row.consentType} ${row.version}`);
  }

  return {
    ...seedDocument,
    bodyText: row.bodyText,
    bodySha256: row.bodySha256,
    documentEffectiveDate: row.documentEffectiveDate ?? seedDocument.documentEffectiveDate,
    documentTitle: row.documentTitle,
    documentUrl: row.documentUrl,
    effectiveDateLabel: effectiveDateLabel(row.documentEffectiveDate ?? seedDocument.documentEffectiveDate),
    id: row.id,
    sections: consentDocumentSections(row.bodySections, row.bodyText, row.bodyText === seedDocument.bodyText ? seedDocument.sections : [])
  };
}

function consentDocumentSections(value: unknown, bodyText: string, fallbackSections: ConsentDocumentSection[]) {
  if (isConsentDocumentSections(value)) return value;
  if (fallbackSections.length > 0) return fallbackSections;

  return [
    {
      id: "document-body",
      paragraphs: bodyText.split(/\n{2,}/).filter(Boolean)
    }
  ];
}

function isConsentDocumentSections(value: unknown): value is ConsentDocumentSection[] {
  return Array.isArray(value) && value.every(isConsentDocumentSection);
}

function isConsentDocumentSection(value: unknown): value is ConsentDocumentSection {
  if (!value || typeof value !== "object") return false;

  const section = value as ConsentDocumentSection;
  return typeof section.id === "string";
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function effectiveDateLabel(value: string) {
  const [year, month, day] = value.split("-");

  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}
