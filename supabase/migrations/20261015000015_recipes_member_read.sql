-- Meal detail (#15): signed-in members can read ACTIVE recipes (drafts stay admin-only). Writes stay admin-only.
-- Additive: one new select policy; policies are OR'd with "recipes: admin read".
create policy "recipes: members read active" on public.recipes for select to authenticated using (active);
