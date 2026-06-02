alter table places
  add column if not exists public_view_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'places_public_view_count_check'
  ) then
    alter table places
      add constraint places_public_view_count_check check (public_view_count >= 0);
  end if;
end $$;

create table if not exists place_view_dedupes (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  dedupe_kind text not null,
  dedupe_key_hash text not null,
  last_counted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_view_dedupes_kind_check check (dedupe_kind in ('user', 'device', 'ip'))
);

create unique index if not exists place_view_dedupes_place_key_unique on place_view_dedupes (place_id, dedupe_key_hash);
create index if not exists place_view_dedupes_place_expires_at_idx on place_view_dedupes (place_id, expires_at);
create index if not exists places_public_view_count_idx on places (public_view_count desc);
