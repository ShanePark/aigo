create table if not exists user_place_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  view_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_place_views_view_count_check check (view_count > 0)
);

create unique index if not exists user_place_views_user_place_unique on user_place_views (user_id, place_id);
create index if not exists user_place_views_user_last_viewed_at_idx on user_place_views (user_id, last_viewed_at desc);
create index if not exists user_place_views_place_id_idx on user_place_views (place_id);
