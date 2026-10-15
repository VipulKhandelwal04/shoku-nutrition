// Compare → Plan → Week: seven read-only days built from the day plan. Server Component.
import { MEALS, type Food, type Meal } from '@/lib/nutrition';
import type { WeekDay } from '@/lib/ai/plan';
import { unitFor } from '@/components/app/insights/insights';
import s from './compare.module.css';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const qty = (n: number) => (Math.round(n * 100) / 100).toString();

export function WeekPlan({ week, labels, foodsById, target }: { week: WeekDay[]; labels: string[]; foodsById: Map<string, Food>; target: number }) {
  return (
    <>
      <p className={s.panelNote}>Seven days from your day plan. Similar foods take turns for variety; each day stays near {fmt(target)} kcal.</p>
      <ol className={s.week}>
        {week.map((d, i) => (
          <li key={labels[i]}>
            <details className={s.weekDay} open={i === 0}>
              <summary>
                <span className={s.weekLabel}>{labels[i]}</span>
                <span className={s.weekKcal}>{fmt(d.kcal)} <small>kcal</small></span>
              </summary>
              <dl className={s.weekMeals}>
                {MEALS.map((m: Meal) => (
                  <div key={m}>
                    <dt>{m}</dt>
                    <dd>
                      {d.plan[m].length
                        ? d.plan[m].map(item => {
                          const f = foodsById.get(item.foodId);
                          return f ? `${f.name} ${qty(item.q)} ${unitFor(item.q, f.unit)}` : null;
                        }).filter(Boolean).join(' · ')
                        : 'Nothing planned'}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        ))}
      </ol>
      <p className="fine-print">A guide, not a prescription. Log what you actually eat from Today; swaps keep your diet and the foods you skip.</p>
    </>
  );
}
