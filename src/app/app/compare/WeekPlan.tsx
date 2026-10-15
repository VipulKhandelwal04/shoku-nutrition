'use client';
// Compare → Plan → Week: seven days built from the day plan. With editing on, any meal can be swapped (saved for
// that weekday, with Undo) and today's meals can be logged in one tap.
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { LogButton } from '@/components/app/insights/LogButton';
import { RecipeButton } from '@/components/app/recipes/MealDetail';
import type { RecipeCard } from '@/lib/ai/candidates';
import { resetWeekDay, restoreWeekDay, saveWeekDay } from '@/lib/data/week';
import { MEALS, type Meal, type Plan } from '@/lib/nutrition';
import s from './compare.module.css';
import { fmt, qty } from '@/lib/format';

export type WeekItem = { foodId: string; name: string; unit: string; q: number; kcal: number };
export type WeekMealView = { meal: Meal; items: WeekItem[]; alternatives: WeekItem[][]; recipe?: RecipeCard };
/** One day card. `training`: a usual training day (the day was fuelled with more protein and carbs). */
export type WeekDayView = { key: string; label: string; weekday: number; kcal: number; saved: boolean; training: boolean; plan: Plan; meals: WeekMealView[] };

const line = (items: WeekItem[]) => items.map(i => `${i.name} ${qty(i.q)} ${i.unit}`).join(' · ');

export function WeekPlan({ days, today, target, canEdit, canLogRecipe = false }: { days: WeekDayView[]; today: string; target: number; canEdit: boolean; canLogRecipe?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();

  const swap = (day: WeekDayView, meal: WeekMealView) => start(async () => {
    const next = meal.alternatives[0];
    if (!next) return;
    const plan = Object.fromEntries(MEALS.map(m => [m, m === meal.meal ? next.map(i => ({ foodId: i.foodId, q: i.q, flex: false })) : day.plan[m]])) as Plan;
    const r = await saveWeekDay({ weekday: day.weekday, plan }).catch(() => ({ ok: false as const, error: 'Couldn’t save that swap. Check your connection.' }));
    if (!r.ok) { toast(r.error); return; }
    const previous = r.data.previous;
    toast(`${meal.meal} swapped for ${weekdayName(day.key)}s.`, {
      undo: async () => { const u = await restoreWeekDay({ weekday: day.weekday, previous }); if (u.ok) router.refresh(); return u; },
    });
    router.refresh();
  });

  const reset = (day: WeekDayView) => start(async () => {
    const previous = day.plan;
    const r = await resetWeekDay(day.weekday);
    if (!r.ok) { toast(r.error); return; }
    toast(`${weekdayName(day.key)} is back to the suggested plan.`, {
      undo: async () => { const u = await restoreWeekDay({ weekday: day.weekday, previous }); if (u.ok) router.refresh(); return u; },
    });
    router.refresh();
  });

  return (
    <>
      <p className={s.panelNote}>
        Seven days from your day plan, each near {fmt(target)} kcal.{canEdit ? ' Swap a meal and it’s saved for that weekday every week.' : ''}
      </p>
      <ol className={s.week} aria-busy={pending || undefined}>
        {days.map((d, i) => (
          <li key={d.key}>
            <details className={s.weekDay} open={i === 0}>
              <summary>
                <span className={s.weekLabel}>{d.label}</span>
                {d.training && <span className="chip">Training</span>}
                {d.saved && <span className="chip accent">Saved</span>}
                <span className={s.weekKcal}>{fmt(d.kcal)} <small>kcal</small></span>
              </summary>
              <ul className={s.weekMeals}>
                {d.meals.map(m => (
                  <li key={m.meal} className={s.weekMeal}>
                    <span className={s.weekMealText}>
                      <span className={s.weekMealName}>{m.meal}</span>
                      <span>{m.items.length ? line(m.items) : 'Nothing planned'}</span>
                      {m.recipe && <RecipeButton recipe={m.recipe} meal={m.meal} day={today} canLog={canLogRecipe && d.key === today} />}
                    </span>
                    <span className={s.weekMealActions}>
                      {canEdit && m.alternatives.length > 0 && (
                        <button type="button" className="btn-text" disabled={pending} onClick={() => swap(d, m)}
                          aria-label={`Swap ${m.meal} on ${d.label} for ${line(m.alternatives[0])}`}>
                          <Icon name="sliders" size="sm" /> Swap
                        </button>
                      )}
                      {d.key === today && m.items.length > 0 && (
                        <LogButton
                          day={today}
                          items={m.items.map(it => ({ meal: m.meal, foodId: it.foodId, quantity: it.q }))}
                          label={`Log planned ${m.meal}: ${line(m.items)}`}
                          done={`Planned ${m.meal.toLowerCase()} logged.`}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {d.saved && (
                <div className={s.weekFoot}>
                  <button type="button" className="btn-text" disabled={pending} onClick={() => reset(d)}>Back to suggested</button>
                </div>
              )}
            </details>
          </li>
        ))}
      </ol>
      <p className="fine-print">A guide, not a prescription. Swaps keep your diet and the foods you skip, and each day stays near your target.</p>
    </>
  );
}

function weekdayName(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });
}
