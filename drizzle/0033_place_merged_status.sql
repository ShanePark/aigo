alter table places drop constraint if exists places_status_check;

alter table places
  add constraint places_status_check
  check (status in ('active', 'temporarily_closed', 'closed', 'draft', 'needs_review', 'merged'))
  not valid;
