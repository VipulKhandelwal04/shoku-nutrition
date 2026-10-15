-- Recipes in the catalogue (#13): admins author recipes from catalogue foods. Nutrition is never stored; the app
-- computes it from the ingredients. Members can't read recipes yet (admin-only select) and drafts start hidden.
-- Additive: a new table, nothing existing changes.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  cuisine text not null default 'Indian' check (char_length(cuisine) between 1 and 40),
  servings int not null default 1 check (servings between 1 and 20),
  -- Ordered steps, one per element.
  steps text[] not null default '{}' check (cardinality(steps) between 1 and 30),
  -- Ordered ingredients: [{ "foodId": "<foods.id>", "q": <servings of that food for the whole recipe> }].
  ingredients jsonb not null check (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) between 1 and 30),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_active_idx on public.recipes (active, name);

alter table public.recipes enable row level security;
create policy "recipes: admin read" on public.recipes for select using (public.is_admin());
create policy "recipes: admin write" on public.recipes for all using (public.is_admin()) with check (public.is_admin());
