-- Ask Shoku learns from feedback (#7): the member's "Remember meal feedback" switch.
-- Additive: defaults to on, so ratings members already gave start shaping suggestions.
alter table public.profiles add column if not exists remember_feedback boolean not null default true;
