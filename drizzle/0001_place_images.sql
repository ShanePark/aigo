create table if not exists place_images (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  url text not null,
  source_id uuid references place_sources(id) on delete set null,
  source_type text,
  source_title text,
  source_url text,
  credit_text text,
  alt_text text,
  description text,
  visual_features text[] not null default '{}'::text[],
  child_signals jsonb not null default '{}'::jsonb,
  display_tier text not null default 'unknown',
  status text not null default 'active',
  review_status text not null default 'pending_review',
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  width integer,
  height integer,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_images_display_tier_check check (display_tier in ('official', 'public_agency', 'public_listing', 'rights_unclear', 'unknown')),
  constraint place_images_status_check check (status in ('active', 'archived')),
  constraint place_images_review_status_check check (review_status in ('pending_review', 'approved', 'needs_review', 'rejected'))
);

create unique index if not exists place_images_place_url_unique on place_images (place_id, url);
create unique index if not exists place_images_one_primary_active_idx on place_images (place_id) where is_primary and status = 'active';
create index if not exists place_images_place_id_idx on place_images (place_id);
create index if not exists place_images_source_id_idx on place_images (source_id);
create index if not exists place_images_review_status_idx on place_images (review_status);

insert into place_images (
  place_id,
  url,
  source_id,
  source_type,
  source_title,
  source_url,
  credit_text,
  visual_features,
  child_signals,
  display_tier,
  status,
  review_status,
  is_primary,
  sort_order,
  checked_at
)
select
  p.id,
  image.url,
  s.id,
  s.source_type,
  s.title,
  s.url,
  coalesce(s.title, s.source_type, '이미지 출처 미확인'),
  '{}'::text[],
  '{}'::jsonb,
  case
    when concat_ws(' ', s.source_type, s.title, s.url, s.summary) ~* '(official|공식)' then 'official'
    when concat_ws(' ', s.source_type, s.title, s.url, s.summary) ~* '(news|article|보도|기사)' then 'rights_unclear'
    when concat_ws(' ', s.source_type, s.title, s.url, s.summary) ~* '(public_agency|public_tourism|public_open|gu_|city_|tourism|kto|visitkorea|daejeon|donggu|daedeok|seogu|yuseong|science\\.go\\.kr|공공|관광|구청|시청)' then 'public_agency'
    when concat_ws(' ', s.source_type, s.title, s.url, s.summary) ~* '(operator|booking|tabling|ban-life|peton|diningcode|listing|profile|운영)' then 'public_listing'
    else 'unknown'
  end,
  'active',
  'pending_review',
  image.ordinality = 1,
  image.ordinality - 1,
  s.checked_at
from places p
cross join lateral unnest(p.image_urls) with ordinality as image(url, ordinality)
left join lateral (
  select ps.*
  from place_sources ps
  where ps.place_id = p.id
  order by
    (concat_ws(' ', ps.source_type, ps.title, ps.summary) ~* '(image|visual|photo|이미지|사진|비주얼|대표)') desc,
    ps.created_at desc
  limit 1
) s on true
where image.url is not null and image.url <> ''
on conflict (place_id, url) do nothing;
