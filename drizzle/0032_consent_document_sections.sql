alter table consent_documents
  add column if not exists body_sections jsonb;
