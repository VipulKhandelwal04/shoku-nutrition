-- Ghee becomes its own catalogue food, and "Cooking oil" stops listing ghee as a search alias. Before this, the
-- lactose-free rule matched oil through that alias and ruled out almost every recipe for lactose-free members.
-- Same values as the seed (src/lib/seed-foods.ts): 1 teaspoon = 5 g, 45 kcal, 5 g fat. Only touches oil's
-- aliases if they are still the seeded ones (an admin's edit wins).
insert into public.foods (id, name, category, unit, grams, kcal, p, c, f, fibre, diet, icon, aliases, groups, cuisine)
values ('ghee', 'Ghee', 'Cooking', 'teaspoon', 5, 45, 0, 0, 5, 0, 'veg', 'glass', 'desi ghee clarified butter', '{"oil":5}'::jsonb, 'Indian')
on conflict (id) do nothing;
update public.foods set aliases = 'olive sunflower mustard groundnut', updated_at = now()
where id = 'oil' and owner_id is null and aliases = 'ghee olive sunflower mustard';
