alter table places
  add column if not exists reservation_required text not null default 'unknown',
  add column if not exists walk_in_available text not null default 'unknown',
  add column if not exists session_based text not null default 'unknown',
  add column if not exists same_day_availability_known text not null default 'unknown';
