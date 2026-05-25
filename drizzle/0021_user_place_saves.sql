create table if not exists user_place_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  want_to_go boolean not null default false,
  hearted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_place_saves_active_state_check check (want_to_go or hearted)
);

create unique index if not exists user_place_saves_user_place_unique on user_place_saves (user_id, place_id);
create index if not exists user_place_saves_user_updated_at_idx on user_place_saves (user_id, updated_at desc);
create index if not exists user_place_saves_place_hearted_idx on user_place_saves (place_id) where hearted;
