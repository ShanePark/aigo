create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_check check (role in ('user', 'admin'))
);

create unique index if not exists users_email_unique on users (email);

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_sessions_user_id_idx on auth_sessions (user_id);
create unique index if not exists auth_sessions_token_hash_unique on auth_sessions (token_hash);
create index if not exists auth_sessions_expires_at_idx on auth_sessions (expires_at);

create table if not exists place_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  visited_on date not null,
  rating integer not null,
  review_text text,
  visibility text not null default 'public',
  is_revisit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_visits_rating_check check (rating between 1 and 5),
  constraint place_visits_visibility_check check (visibility in ('public', 'private'))
);

create index if not exists place_visits_user_visited_on_idx on place_visits (user_id, visited_on desc);
create index if not exists place_visits_place_id_idx on place_visits (place_id);
create index if not exists place_visits_place_visibility_idx on place_visits (place_id, visibility);

create table if not exists place_visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references place_visits(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  storage_key text not null,
  original_filename text not null,
  mime_type text not null,
  byte_size integer not null,
  width integer,
  height integer,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  constraint place_visit_photos_visibility_check check (visibility in ('public', 'private')),
  constraint place_visit_photos_mime_type_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint place_visit_photos_byte_size_check check (byte_size > 0 and byte_size <= 10485760),
  constraint place_visit_photos_width_check check (width is null or width > 0),
  constraint place_visit_photos_height_check check (height is null or height > 0)
);

create index if not exists place_visit_photos_visit_id_idx on place_visit_photos (visit_id);
create index if not exists place_visit_photos_user_id_idx on place_visit_photos (user_id);
create index if not exists place_visit_photos_place_id_idx on place_visit_photos (place_id);
create unique index if not exists place_visit_photos_storage_key_unique on place_visit_photos (storage_key);
