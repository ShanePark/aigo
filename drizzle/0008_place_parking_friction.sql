alter table places
  add column if not exists parking_friction_level text not null default 'unknown',
  add column if not exists peak_parking_window text,
  add column if not exists parking_wait_note text;
