'use client';
import { useId, useState, useTransition } from 'react';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import type { RecipeCard } from '@/lib/ai/candidates';
import { deleteEntries } from '@/lib/data/diary';
import { logRecipe } from '@/lib/data/recipes';
import type { Meal } from '@/lib/nutrition';
import s from './recipes.module.css';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const qty = (n: number) => (Math.round(n * 100) / 100).toString();
const DIET = { veg: 'Veg', egg: 'Egg', nonveg: 'Non-veg' } as const;
const STEP = 0.5;

/**
 * "See recipe": a link-style button that opens the meal detail sheet: ingredients scaled to the servings chosen,
 * steps, nutrition per serving and why it fits. With `canLog`, "Log to {meal}" logs it (Undo in the toast).
 */
export function RecipeButton({ recipe, meal, day, why, canLog, source = 'plan', className = '' }: {
  recipe: RecipeCard;
  meal: Meal;
  day: string;
  why?: string;
  canLog: boolean;
  source?: 'plan' | 'text_ai';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`btn-text ${s.open} ${className}`} onClick={() => setOpen(true)} aria-label={`See the ${recipe.name} recipe`}>
        <Icon name="diary" size="sm" /> {recipe.name}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={recipe.name} labelledBy={`recipe-${recipe.id}`}>
        {open && <Detail recipe={recipe} meal={meal} day={day} why={why} canLog={canLog} source={source} onLogged={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

function Detail({ recipe, meal, day, why, canLog, source, onLogged }: {
  recipe: RecipeCard; meal: Meal; day: string; why?: string; canLog: boolean; source: 'plan' | 'text_ai'; onLogged: () => void;
}) {
  const ids = useId();
  const toast = useToast();
  const [servings, setServings] = useState(1);
  const [pending, start] = useTransition();
  const k = servings / Math.max(1, recipe.servings);
  const n = recipe.perServing;

  const log = () => start(async () => {
    const r = await logRecipe({ recipeId: recipe.id, servings, meal, day, source })
      .catch(() => ({ ok: false as const, error: 'Couldn’t log that. Check your connection.' }));
    if (!r.ok) { toast(r.error); return; }
    const saved = r.data.ids;
    toast(`${recipe.name} logged to ${meal.toLowerCase()}.`, { undo: () => deleteEntries(saved) });
    onLogged();
  });

  return (
    <div className={s.detail}>
      <p className={s.meta}>
        <span className="chip">{recipe.cuisine}</span>
        <span className={`chip ${recipe.diet === 'veg' ? 'ok' : recipe.diet === 'egg' ? 'warn' : 'accent'}`}>{DIET[recipe.diet]}</span>
        <span>Makes {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}</span>
      </p>

      <dl className={s.macros} aria-label="Nutrition per serving">
        <div><dt>kcal</dt><dd>{fmt(n.kcal * servings)}</dd></div>
        <div><dt>Protein</dt><dd>{fmt(n.p * servings)}<small>g</small></dd></div>
        <div><dt>Carbs</dt><dd>{fmt(n.c * servings)}<small>g</small></dd></div>
        <div><dt>Fat</dt><dd>{fmt(n.f * servings)}<small>g</small></dd></div>
      </dl>
      <p className="fine-print">For {qty(servings)} {servings === 1 ? 'serving' : 'servings'}, worked out from the ingredients. Estimates; home cooking varies.</p>

      {why && <p className={s.why}><strong>Why it fits your day</strong> {why}</p>}

      <div className={s.servingsRow}>
        <span className="field-label" id={`${ids}-sv`}>Servings for you</span>
        <div className={s.stepper} role="group" aria-labelledby={`${ids}-sv`}>
          <button type="button" aria-label="Fewer servings" disabled={servings <= STEP} onClick={() => setServings(v => Math.max(STEP, v - STEP))}><Icon name="minus" size="sm" /></button>
          <output aria-live="polite">{qty(servings)}</output>
          <button type="button" aria-label="More servings" disabled={servings >= recipe.servings * 2} onClick={() => setServings(v => Math.min(recipe.servings * 2, v + STEP))}><Icon name="plus" size="sm" /></button>
        </div>
      </div>

      <h3 className={s.h}>Ingredients</h3>
      <ul className={s.ingredients}>
        {recipe.ingredients.map(i => (
          <li key={i.foodId}>
            <FoodTile icon={i.icon} />
            <span className={s.ingName}>{i.name}</span>
            <span className={s.ingQ}>{qty(i.q * k)} {i.unit}</span>
          </li>
        ))}
      </ul>

      <h3 className={s.h}>Steps</h3>
      <ol className={s.steps}>{recipe.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>

      {canLog && (
        <button type="button" className="btn accent full" onClick={log} disabled={pending} aria-busy={pending || undefined}>
          {pending ? 'Logging…' : `Log to ${meal}`}
        </button>
      )}
    </div>
  );
}
