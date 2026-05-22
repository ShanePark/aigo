alter table "places"
add column if not exists "pricing" jsonb not null default '{}'::jsonb;
