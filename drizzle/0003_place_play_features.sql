alter table places
add column if not exists play_features jsonb not null default '{}'::jsonb;

create index if not exists places_play_features_gin_idx on places using gin (play_features);

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
    coalesce(array_to_string(new.tags, ' '), '') || ' ' ||
    coalesce(new.play_features::text, '')
  );
  return new;
end;
$$;

drop trigger if exists places_set_derived_fields on places;
create trigger places_set_derived_fields
before insert or update of lat, lng, name, address, road_address, description, tags, play_features on places
for each row
execute function set_place_derived_fields();

update places
set play_features = play_features
where true;
