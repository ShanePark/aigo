create table if not exists user_social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  provider_email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_social_accounts_provider_check check (provider in ('kakao', 'naver'))
);

create unique index if not exists user_social_accounts_provider_user_unique on user_social_accounts (provider, provider_user_id);
create unique index if not exists user_social_accounts_user_provider_unique on user_social_accounts (user_id, provider);
create index if not exists user_social_accounts_user_id_idx on user_social_accounts (user_id);
