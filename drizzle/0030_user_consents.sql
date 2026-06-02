create table if not exists user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  consent_type text not null,
  version text not null,
  document_title text not null,
  document_url text not null,
  document_effective_date text,
  consent_text text not null,
  source text not null default 'signup',
  ip_address text,
  user_agent text,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_consents_type_check check (consent_type in ('privacy_policy', 'terms_of_service', 'location_terms', 'marketing')),
  constraint user_consents_source_check check (source in ('signup', 'login', 'account_update', 'admin'))
);

create unique index if not exists user_consents_user_type_version_unique
  on user_consents (user_id, consent_type, version);

create index if not exists user_consents_user_id_idx
  on user_consents (user_id);

create index if not exists user_consents_type_version_idx
  on user_consents (consent_type, version);
