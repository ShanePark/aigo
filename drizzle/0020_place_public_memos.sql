create table if not exists place_public_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_public_memos_body_length_check check (length(trim(body)) between 1 and 1000)
);

create unique index if not exists place_public_memos_user_place_unique on place_public_memos (user_id, place_id);
create index if not exists place_public_memos_place_updated_at_idx on place_public_memos (place_id, updated_at desc);
create index if not exists place_public_memos_user_id_idx on place_public_memos (user_id);
