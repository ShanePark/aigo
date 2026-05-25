alter table place_visits drop constraint if exists place_visits_rating_check;
alter table place_visits alter column rating type double precision using rating::double precision;
alter table place_visits add constraint place_visits_rating_check
  check (rating between 0.5 and 5 and (rating * 2) = floor(rating * 2));
