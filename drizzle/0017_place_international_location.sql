alter table "places"
add column if not exists "country_code" text,
add column if not exists "country_name" text,
add column if not exists "city" text,
add column if not exists "locality" text,
add column if not exists "local_currency" text;
