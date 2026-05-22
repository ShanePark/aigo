alter table place_related_places
  drop constraint if exists place_related_places_relation_type_check;

alter table place_related_places
  add constraint place_related_places_relation_type_check check (
    relation_type in ('nearby', 'same_building', 'same_site', 'parent_child', 'route_pair', 'itinerary_cluster')
  );
