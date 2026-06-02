drop index if exists visit_events_ua_processed_idx;

alter table visit_events
  drop column if exists ua_processed,
  drop column if exists ua_processed_at;
