-- Foods carry a cuisine so suggestions can respect what members cook.
-- Additive: every existing food (catalogue and custom) becomes 'Indian', which is what the catalogue is today.
alter table public.foods add column if not exists cuisine text not null default 'Indian'
  check (char_length(cuisine) between 1 and 40);
