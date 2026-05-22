create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  primary_category text not null,
  tags text[] not null default '{}'::text[],
  description text,
  address text,
  road_address text,
  region_sido text,
  region_sigungu text,
  region_dong text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  geo geography(Point, 4326) not null,
  phone text,
  official_url text,
  reservation_url text,
  kakao_place_url text,
  kakao_place_id text,
  external_refs jsonb not null default '{}'::jsonb,
  image_urls text[] not null default '{}'::text[],
  status text not null default 'active',
  data_confidence text not null default 'unknown',
  min_recommended_age_months integer,
  max_recommended_age_months integer,
  indoor_type text not null default 'unknown',
  stroller_friendly text not null default 'unknown',
  parking_available text not null default 'unknown',
  nursing_room text not null default 'unknown',
  diaper_changing_table text not null default 'unknown',
  kids_toilet text not null default 'unknown',
  elevator text not null default 'unknown',
  baby_chair text not null default 'unknown',
  food_allowed text not null default 'unknown',
  average_stay_minutes integer,
  parent_effort_level integer,
  child_engagement_level integer,
  rainy_day_score integer,
  hot_day_score integer,
  cold_day_score integer,
  safety_notes text,
  parent_notes text,
  opening_hours jsonb,
  search_text text not null default '',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_verified_at timestamptz
);

create or replace function set_place_derived_fields()
returns trigger
language plpgsql
as $$
begin
  new.geo := ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography;
  new.search_text := trim(
    both ' ' from
    coalesce(new.name, '') || ' ' ||
    coalesce(new.address, '') || ' ' ||
    coalesce(new.road_address, '') || ' ' ||
    coalesce(new.description, '') || ' ' ||
    coalesce(array_to_string(new.tags, ' '), '')
  );
  return new;
end;
$$;

drop trigger if exists places_set_derived_fields on places;
create trigger places_set_derived_fields
before insert or update of lat, lng, name, address, road_address, description, tags on places
for each row
execute function set_place_derived_fields();

create unique index if not exists places_slug_unique on places (slug);
create unique index if not exists places_kakao_place_id_unique on places (kakao_place_id);
create index if not exists places_geo_idx on places using gist (geo);
create index if not exists places_primary_category_idx on places (primary_category);
create index if not exists places_tags_idx on places using gin (tags);
create index if not exists places_region_idx on places (region_sido, region_sigungu);
create index if not exists places_name_trgm_idx on places using gin (name gin_trgm_ops);
create index if not exists places_search_text_trgm_idx on places using gin (search_text gin_trgm_ops);

create table if not exists place_sources (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  source_type text not null,
  title text,
  url text,
  external_id text,
  summary text,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists place_sources_place_id_idx on place_sources (place_id);
create index if not exists place_sources_url_idx on place_sources (url);

create table if not exists place_versions (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  version_number integer not null,
  action text not null,
  actor text not null default 'agent',
  change_summary text,
  snapshot jsonb not null,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (place_id, version_number)
);

create index if not exists place_versions_place_id_idx on place_versions (place_id);
create index if not exists place_versions_created_at_idx on place_versions (created_at desc);
