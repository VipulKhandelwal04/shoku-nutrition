import type { Metadata } from 'next';
import { RecipesManager } from '@/components/admin/RecipesManager';
import s from '@/components/admin/admin.module.css';
import { adminFoods, adminRecipes } from '@/lib/admin/queries';

export const metadata: Metadata = { title: 'Recipes' };

export default async function RecipesPage() {
  const [recipes, foods] = await Promise.all([adminRecipes(), adminFoods()]);
  return (
    <>
      <div className={s.head}>
        <div>
          <p className="label">Catalogue</p>
          <h1>Recipes</h1>
          <p>Recipes are built from catalogue foods, and their nutrition is always worked out from the ingredients. New recipes start as hidden drafts. Members can’t see recipes yet.</p>
        </div>
      </div>
      <RecipesManager recipes={recipes} foods={foods} />
    </>
  );
}
