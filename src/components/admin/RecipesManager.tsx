'use client';
import { useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { createRecipe, deleteRecipe, setRecipeActive, updateRecipe } from '@/lib/admin/actions';
import { MAX_INGREDIENTS, MAX_STEPS, type FieldErrors } from '@/lib/admin/schemas';
import { DEFAULT_CUISINE, cuisineOf, recipeNutrition, type Food } from '@/lib/nutrition';
import type { FoodRow, RecipeRow } from '@/lib/types';
import s from './admin.module.css';
import { ConfirmDialog, Switch, useAdminAction } from './primitives';

const DIET_LABEL = { veg: 'Veg', egg: 'Egg', nonveg: 'Non-veg' } as const;
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Admin → Recipes: author recipes from catalogue foods. Members don't see recipes yet. */
export function RecipesManager({ recipes, foods }: { recipes: RecipeRow[]; foods: FoodRow[] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<{ recipe: RecipeRow | null; n: number }>({ recipe: null, n: 0 });
  const { run, pending } = useAdminAction();
  const foodsById = useMemo(() => new Map<string, Food>(foods.map(f => [f.id, f])), [foods]);
  const cuisines = useMemo(() => [...new Set([...foods.map(f => cuisineOf(f)), ...recipes.map(r => r.cuisine)])].sort(), [foods, recipes]);
  const q = query.trim().toLowerCase();
  const rows = recipes.filter(r => !q || r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q));

  const edit = (recipe: RecipeRow | null) => { setTarget(t => ({ recipe, n: t.n + 1 })); setOpen(true); };
  const toggle = (r: RecipeRow) => run(() => setRecipeActive(r.id, !r.active), { undo: () => setRecipeActive(r.id, r.active) });

  return (
    <>
      <div className={s.toolbar} role="search" aria-label="Filter recipes">
        <div className={s.search}>
          <label htmlFor="recipe-q" className="sr-only">Search recipes</label>
          <Icon name="search" size="sm" />
          <input id="recipe-q" type="search" placeholder="Search name or cuisine" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" />
        </div>
        <button type="button" className="btn accent" onClick={() => edit(null)}><Icon name="plus" size="sm" />Add recipe</button>
      </div>

      <div className={s.tableWrap}>
        {recipes.length === 0 ? (
          <div className={s.empty}>
            <strong>No recipes yet</strong>
            <p>Build a recipe from catalogue foods. Nutrition is worked out from the ingredients, so it always matches the catalogue.</p>
            <button type="button" className="btn-secondary" onClick={() => edit(null)}><Icon name="plus" size="sm" />Add the first recipe</button>
          </div>
        ) : rows.length === 0 ? (
          <div className={s.empty}>
            <strong>No matches</strong>
            <p>Nothing fits that search.</p>
            <button type="button" className="btn-secondary" onClick={() => setQuery('')}>Clear search</button>
          </div>
        ) : (
          <table className={s.table} style={{ minWidth: 760 }}>
            <caption>{rows.length} of {recipes.length} recipes · nutrition per serving, computed from ingredients · members can’t see recipes yet</caption>
            <thead>
              <tr>
                <th scope="col">Recipe</th>
                <th scope="col">Cuisine</th>
                <th scope="col" className={s.num}>Serves</th>
                <th scope="col" className={s.num}>kcal</th>
                <th scope="col" className={s.num}>Protein</th>
                <th scope="col">Diet</th>
                <th scope="col">Active</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const n = recipeNutrition(r.ingredients, r.servings, foodsById);
                return (
                  <tr key={r.id} className={r.active ? undefined : s.inactiveRow}>
                    <th scope="row" className={s.rowHead}>
                      <div className={s.cellMain}>
                        <FoodTile icon="plate" />
                        <div>
                          <strong>{r.name}</strong>
                          <span>{r.ingredients.length} ingredients · {r.steps.length} steps{n.missing.length ? ` · ${n.missing.length} missing` : ''}</span>
                        </div>
                      </div>
                    </th>
                    <td className={s.nowrap}>{r.cuisine}</td>
                    <td className={s.num}>{r.servings}</td>
                    <td className={s.num}>{fmt(n.perServing.kcal)}</td>
                    <td className={s.num}>{fmt(n.perServing.p)} g</td>
                    <td><span className={`chip ${n.diet === 'veg' ? 'ok' : n.diet === 'egg' ? 'warn' : 'accent'}`}>{DIET_LABEL[n.diet]}</span></td>
                    <td><Switch pressed={r.active} hideLabel label={`${r.name} active`} disabled={pending} onChange={() => toggle(r)} /></td>
                    <td>
                      <div className={s.actions}>
                        <button type="button" className="btn-icon" aria-label={`Edit ${r.name}`} onClick={() => edit(r)}><Icon name="edit" size="sm" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <RecipeSheet key={target.n} recipe={target.recipe} open={open} foods={foods} foodsById={foodsById} cuisines={cuisines} onClose={() => setOpen(false)} />
    </>
  );
}

type Draft = { name: string; cuisine: string; servings: string; steps: string; ingredients: { foodId: string; q: string }[]; active: boolean };

function toDraft(r: RecipeRow | null): Draft {
  if (!r) return { name: '', cuisine: DEFAULT_CUISINE, servings: '2', steps: '', ingredients: [{ foodId: '', q: '1' }], active: false };
  return { name: r.name, cuisine: r.cuisine, servings: String(r.servings), steps: r.steps.join('\n'), ingredients: r.ingredients.map(i => ({ foodId: i.foodId, q: String(i.q) })), active: r.active };
}

function RecipeSheet({ recipe, open, foods, foodsById, cuisines, onClose }: {
  recipe: RecipeRow | null; open: boolean; foods: FoodRow[]; foodsById: Map<string, Food>; cuisines: string[]; onClose: () => void;
}) {
  const isNew = recipe === null;
  const [d, setD] = useState<Draft>(() => toDraft(recipe));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, pending } = useAdminAction();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD(p => ({ ...p, [k]: v })); setErrors({}); };
  const setIng = (i: number, patch: Partial<Draft['ingredients'][number]>) => set('ingredients', d.ingredients.map((x, n) => (n === i ? { ...x, ...patch } : x)));

  // Live nutrition from the ingredients picked so far: what members will see, never typed in.
  const picked = d.ingredients.filter(i => i.foodId && Number(i.q) > 0).map(i => ({ foodId: i.foodId, q: Number(i.q) }));
  const n = recipeNutrition(picked, Number(d.servings) || 1, foodsById);
  const options = useMemo(() => [...foods].sort((a, b) => a.name.localeCompare(b.name)), [foods]);

  function submit() {
    const payload = {
      ...(recipe ? { id: recipe.id } : {}),
      name: d.name, cuisine: d.cuisine, servings: d.servings, active: d.active,
      steps: d.steps.split('\n'),
      ingredients: d.ingredients.filter(i => i.foodId || i.q.trim()).map(i => ({ foodId: i.foodId, q: i.q })),
    };
    run(() => (isNew ? createRecipe(payload) : updateRecipe(payload)), {
      onDone: r => { if (r.ok) onClose(); else setErrors(r.fieldErrors ?? { _: r.error }); },
    });
  }

  const err = (key: string) => (errors[key] ? <p className="error-text" style={{ marginTop: 6 }}>{errors[key]}</p> : null);
  const ingErr = Object.entries(errors).find(([k]) => k.startsWith('ingredients'))?.[1];

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={isNew ? 'Add recipe' : 'Edit recipe'}
        labelledBy="recipe-sheet-title"
        footer={
          <div className={s.footRow}>
            {!isNew && <button type="button" className="btn-text" onClick={() => setConfirmDelete(true)} disabled={pending}><Icon name="trash" size="sm" />Delete</button>}
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" form="recipe-form" className="btn accent" disabled={pending}>{pending ? 'Saving…' : isNew ? 'Add recipe' : 'Save'}</button>
          </div>
        }
      >
        <div className={s.preview} aria-label="Nutrition per serving, from the ingredients" aria-live="polite">
          <FoodTile icon="plate" />
          <div style={{ minWidth: 0 }}>
            <strong>{d.name.trim() || 'New recipe'}</strong>
            <span>Per serving · {fmt(n.perServing.p)} g protein · {fmt(n.perServing.c)} g carbs · {fmt(n.perServing.f)} g fat · {DIET_LABEL[n.diet]}</span>
          </div>
          <div className={s.previewKcal}>{fmt(n.perServing.kcal)}<small>kcal</small></div>
        </div>

        <form id="recipe-form" noValidate onSubmit={e => { e.preventDefault(); submit(); }}>
          {errors._ && <p className="error-text" role="alert">{errors._}</p>}
          <div className={s.formGrid}>
            <div className={`field ${s.span2}`}>
              <label htmlFor="recipe-name">Name</label>
              <input id="recipe-name" value={d.name} onChange={e => set('name', e.target.value)} maxLength={120} autoComplete="off" aria-invalid={!!errors.name || undefined} />
              {err('name')}
            </div>
            <div className="field">
              <label htmlFor="recipe-cuisine">Cuisine</label>
              <input id="recipe-cuisine" value={d.cuisine} onChange={e => set('cuisine', e.target.value)} list="recipe-cuisines" maxLength={40} autoComplete="off" />
              <datalist id="recipe-cuisines">{cuisines.map(c => <option key={c} value={c} />)}</datalist>
              {err('cuisine')}
            </div>
            <div className="field">
              <label htmlFor="recipe-servings">Serves</label>
              <input id="recipe-servings" type="number" inputMode="numeric" min={1} max={20} step={1} value={d.servings} onChange={e => set('servings', e.target.value)} aria-invalid={!!errors.servings || undefined} />
              {err('servings')}
            </div>
          </div>

          <fieldset className={s.fieldset}>
            <legend>Ingredients <span className="muted">(for the whole recipe, in each food’s servings)</span></legend>
            <ul className={s.ingList}>
              {d.ingredients.map((ing, i) => {
                const f = foodsById.get(ing.foodId);
                return (
                  <li key={i} className={s.ingRow}>
                    <div className="field">
                      <label htmlFor={`ing-food-${i}`} className="sr-only">Ingredient {i + 1}</label>
                      <select id={`ing-food-${i}`} value={ing.foodId} onChange={e => setIng(i, { foodId: e.target.value })}>
                        <option value="">Pick a food</option>
                        {options.map(o => <option key={o.id} value={o.id}>{o.name}{o.active ? '' : ' (hidden)'}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`ing-q-${i}`} className="sr-only">Quantity of ingredient {i + 1}</label>
                      <div className={s.unitInput}>
                        <input id={`ing-q-${i}`} type="number" inputMode="decimal" min={0.25} step={0.25} value={ing.q} onChange={e => setIng(i, { q: e.target.value })} />
                        <span aria-hidden="true">{f?.unit ?? 'srv'}</span>
                      </div>
                    </div>
                    <button type="button" className="btn-icon" aria-label={`Remove ingredient ${i + 1}`} disabled={d.ingredients.length === 1}
                      onClick={() => set('ingredients', d.ingredients.filter((_, n2) => n2 !== i))}>
                      <Icon name="trash" size="sm" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {ingErr && <p className="error-text">{ingErr}</p>}
            {n.missing.length > 0 && <p className="error-text">Not in the catalogue any more: {n.missing.join(', ')}.</p>}
            <button type="button" className="btn-secondary" disabled={d.ingredients.length >= MAX_INGREDIENTS} onClick={() => set('ingredients', [...d.ingredients, { foodId: '', q: '1' }])}>
              <Icon name="plus" size="sm" />Add ingredient
            </button>
          </fieldset>

          <div className="field">
            <label htmlFor="recipe-steps">Steps <span className="muted">(one per line, in order)</span></label>
            <textarea id="recipe-steps" rows={6} value={d.steps} onChange={e => set('steps', e.target.value)} aria-invalid={!!errors.steps || undefined}
              placeholder={'Rinse and pressure-cook the dal.\nTemper cumin and garlic in oil.\nPour over the dal and simmer.'} />
            <p className="field-help">Up to {MAX_STEPS} steps.</p>
            {err('steps')}
          </div>

          <div className="field">
            <Switch pressed={d.active} label={d.active ? 'Active' : 'Hidden draft'} onChange={v => set('active', v)} />
            <p className="field-help">Only active recipes will reach members once recipes go live. Members can’t see any recipe yet.</p>
          </div>
        </form>
      </Sheet>

      {recipe && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete ${recipe.name}?`}
          confirmLabel="Delete recipe"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => run(() => deleteRecipe(recipe.id), { onDone: r => { setConfirmDelete(false); if (r.ok) onClose(); } })}
        >
          <p>This removes the recipe for good. To keep it for later, hide it instead.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
