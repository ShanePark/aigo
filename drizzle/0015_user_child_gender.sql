alter table user_children
  add column if not exists gender text not null default 'boy';

alter table user_children
  drop constraint if exists user_children_gender_check;

alter table user_children
  add constraint user_children_gender_check check (gender in ('boy', 'girl'));
