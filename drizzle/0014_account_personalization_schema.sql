create table if not exists user_children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  birth_year_month text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_children_birth_year_month_check check (birth_year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint user_children_sort_order_check check (sort_order >= 0)
);

create index if not exists user_children_user_sort_order_idx on user_children (user_id, sort_order);

create table if not exists user_home_locations (
  user_id uuid primary key references users(id) on delete cascade,
  label text not null default 'home',
  lat double precision not null,
  lng double precision not null,
  address_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_home_locations_lat_check check (lat between -90 and 90),
  constraint user_home_locations_lng_check check (lng between -180 and 180)
);

create table if not exists user_search_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  prefer_indoor boolean not null default false,
  prefer_parking boolean not null default false,
  prefer_stroller boolean not null default false,
  prefer_sand_play boolean not null default false,
  prefer_nursing boolean not null default false,
  prefer_baby_chair boolean not null default false,
  preference_mode text not null default 'soft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_search_preferences_preference_mode_check check (preference_mode in ('soft', 'required'))
);
