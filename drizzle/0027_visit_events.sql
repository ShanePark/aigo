create table if not exists visit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_source text not null default 'app',
  user_id uuid references users(id) on delete set null,
  place_id uuid references places(id) on delete set null,
  request_path text,
  http_method text,
  ip_address text,
  user_agent text,
  device_key_hash text,
  search_input jsonb not null default '{}'::jsonb,
  search_result_count integer,
  search_result_total integer,
  event_meta jsonb not null default '{}'::jsonb,
  user_agent_analysis jsonb not null default '{}'::jsonb,
  ua_processed boolean not null default false,
  ua_processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint visit_events_type_check check (event_type in ('place_detail_view', 'place_search')),
  constraint visit_events_source_check check (event_source in ('app', 'v1')),
  constraint visit_events_search_result_count_check check (search_result_count is null or search_result_count >= 0),
  constraint visit_events_search_result_total_check check (search_result_total is null or search_result_total >= 0)
);

create index if not exists visit_events_created_at_idx on visit_events (created_at desc);
create index if not exists visit_events_event_type_created_at_idx on visit_events (event_type, created_at desc);
create index if not exists visit_events_user_id_created_at_idx on visit_events (user_id, created_at desc);
create index if not exists visit_events_place_id_created_at_idx on visit_events (place_id, created_at desc);
create index if not exists visit_events_ua_processed_idx on visit_events (ua_processed, created_at)
  where ua_processed = false;
