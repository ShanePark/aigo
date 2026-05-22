alter table places add column if not exists place_score double precision;
alter table places add column if not exists place_score_rationale text;
alter table places add column if not exists external_rating_score double precision;
alter table places add column if not exists external_review_count integer;
alter table places add column if not exists search_evidence_score double precision;
alter table places add column if not exists score_signals jsonb not null default '{}'::jsonb;
alter table places add column if not exists score_updated_at timestamptz;

alter table places drop constraint if exists places_place_score_range;
alter table places add constraint places_place_score_range check (place_score is null or place_score between 0 and 10);

alter table places drop constraint if exists places_external_rating_score_range;
alter table places add constraint places_external_rating_score_range check (external_rating_score is null or external_rating_score between 0 and 10);

alter table places drop constraint if exists places_external_review_count_nonnegative;
alter table places add constraint places_external_review_count_nonnegative check (external_review_count is null or external_review_count >= 0);

alter table places drop constraint if exists places_search_evidence_score_range;
alter table places add constraint places_search_evidence_score_range check (search_evidence_score is null or search_evidence_score between 0 and 10);

create index if not exists places_place_score_idx on places (place_score desc) where place_score is not null;
create index if not exists places_score_updated_at_idx on places (score_updated_at desc) where score_updated_at is not null;
