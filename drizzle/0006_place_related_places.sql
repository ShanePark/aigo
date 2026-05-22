create table if not exists place_related_places (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  related_place_id uuid not null references places(id) on delete cascade,
  relation_type text not null default 'nearby',
  note text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_related_places_distinct_check check (place_id <> related_place_id),
  constraint place_related_places_canonical_check check (place_id < related_place_id),
  constraint place_related_places_relation_type_check check (
    relation_type in ('nearby', 'same_building', 'same_site', 'parent_child', 'route_pair')
  )
);

create unique index if not exists place_related_places_pair_unique
  on place_related_places (place_id, related_place_id);
create index if not exists place_related_places_place_id_idx
  on place_related_places (place_id);
create index if not exists place_related_places_related_place_id_idx
  on place_related_places (related_place_id);
