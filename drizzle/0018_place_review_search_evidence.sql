alter table "places"
add column if not exists "review_search_evidence" jsonb not null default '[]'::jsonb;
