-- Plan my week (#10): allow its calls in ai_usage so they count toward the shared daily AI quota.
-- Additive only: existing rows and feature names stay valid.
alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('photo', 'text', 'plan', 'coach', 'ask', 'week'));
