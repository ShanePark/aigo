alter table "places"
add column if not exists "taxonomy" jsonb not null default '{"schemaVersion":1,"sourceBacked":{"familyFitGates":[],"activityTypes":[],"visitUseCases":[],"ageBands":[],"logisticsTags":[],"riskTags":[]},"inferred":{"familyFitGates":[],"activityTypes":[],"visitUseCases":[],"ageBands":[],"logisticsTags":[],"riskTags":[]},"migration":{"legacyTags":[],"broadMappedTags":[],"unmappedTags":[]}}'::jsonb;

create index if not exists places_taxonomy_gin_idx on places using gin (taxonomy);

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
    coalesce(new.play_features::text, '') || ' ' ||
    coalesce(new.taxonomy::text, '')
  );
  return new;
end;
$$;

drop trigger if exists places_set_derived_fields on places;
create trigger places_set_derived_fields
before insert or update of lat, lng, name, address, road_address, description, tags, play_features, taxonomy on places
for each row
execute function set_place_derived_fields();

update places
set taxonomy = taxonomy
where true;
