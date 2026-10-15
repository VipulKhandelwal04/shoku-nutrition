'use client';
import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';
import { ACTIVITY, GOALS, energyRecommendation, type BodyProfile, type Macros, type Goal, type Targets } from '@/lib/nutrition';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { applyRecommendedTargets, saveTargets, setGoal } from '@/components/app/insights/actions';
import s from './compare.module.css';
import { fmt } from '@/lib/format';


/** Goal chips (save immediately) and targets vs the recommendation, with a one-tap "use recommended". */
export function GoalCard({ goal, targets, recommended, bmi, bmiNote, body, logged, loggedLabel, waterLogged, periodNote }: {
  waterLogged: number | null; periodNote: string;
  body: BodyProfile | null; logged: Macros | null; loggedLabel: string;
  goal: Goal; targets: Targets; recommended: Targets | null; bmi: number | null; bmiNote: string | null;
}) {
  const estimate = body ? energyRecommendation(body) : null;
  const toast = useToast();
  const [pending, start] = useTransition();
  const [shownGoal, setShownGoal] = useOptimistic(goal);
  const differs = !!recommended && (['kcal', 'p', 'c', 'f', 'water'] as const).some(k => recommended[k] !== targets[k]);

  const choose = (g: Goal) => {
    if (g === shownGoal) return;
    start(async () => {
      setShownGoal(g);
      const res = await setGoal(g);
      toast(res.ok ? `Goal set: ${GOALS[g].label}. Recommended daily targets applied.` : res.error);
    });
  };

  const apply = () => start(async () => {
    const res = await applyRecommendedTargets();
    if (!res.ok) { toast(res.error); return; }
    const prev = res.data.previous;
    toast('Targets updated to the recommendation.', prev ? { undo: async () => { const r = await saveTargets(prev); return r; } } : undefined);
  });

  return (
    <section className={`panel ${s.goalCard}`} aria-labelledby="goal-title">

      <h2 id="goal-title">{GOALS[shownGoal].label}</h2>
      <p className={s.goalSummary}>{fmt(targets.kcal)} kcal daily target</p>
      <p className="fine-print">{differs ? 'Custom or earlier targets active. Apply the current recommendation below to update all comparisons.' : recommended ? 'Using the current estimated recommendation.' : 'Saved targets; complete your profile for a recommendation.'}</p>
      <table className={s.targetTable}>
        <caption className="sr-only">Daily targets and logged intake</caption>
        <thead><tr><th scope="col">Nutrient</th><th scope="col">Daily target</th><th scope="col">{loggedLabel}</th></tr></thead>
        <tbody>{([['kcal', 'Calories', 'kcal'], ['p', 'Protein', 'g'], ['c', 'Carbs', 'g'], ['f', 'Fat', 'g']] as const).map(([k, label, unit]) => (
          <tr key={k}><th scope="row">{label}</th><td>{fmt(targets[k])} <small>{unit}</small></td><td>{logged ? <>{fmt(logged[k])} <small>{unit}</small></> : '—'}</td></tr>
        ))}<tr><th scope="row">Water</th><td>{fmt(targets.water)} <small>ml</small></td><td>{waterLogged === null ? '—' : <>{fmt(waterLogged)} <small>ml</small></>}</td></tr></tbody>
      </table>
      <p className="fine-print">{periodNote} Logged intake is estimated from meal portions. An empty log does not mean you ate nothing.</p>
      <details className={s.disclosure}><summary>Recommendation &amp; goal settings</summary>
      <p className="fine-print">Changing your goal replaces your daily targets with the new recommendation.</p>
      <div className={s.goalChips} role="group" aria-label="Choose your goal">
        {(Object.keys(GOALS) as Goal[]).map(g => (
          <button key={g} type="button" className="pill-choice" aria-pressed={shownGoal === g} disabled={pending} onClick={() => choose(g)}>{GOALS[g].label}</button>
        ))}
      </div>
      {body && estimate && <div className={s.calculation}>
        <p>{body.age} years · {body.sex} · {fmt(body.height)} cm · {fmt(body.weight)} kg · {ACTIVITY[body.activity].label} activity</p>
        <dl>
          <div><dt>Estimated resting burn</dt><dd>{fmt(Math.round(estimate.bmr))} kcal</dd></div>
          <div><dt>Estimated maintenance (×{ACTIVITY[body.activity].factor})</dt><dd>{fmt(Math.round(estimate.maintenance))} kcal</dd></div>
          <div><dt>Goal adjustment, including rounding</dt><dd>{estimate.adjustment > 0 ? '+' : ''}{fmt(Math.round(estimate.adjustment))} kcal</dd></div>
          <div><dt>Recommended daily intake</dt><dd>{fmt(estimate.kcal)} kcal</dd></div>
        </dl>
        <p>Shoku uses Mifflin–St Jeor resting energy and an activity multiplier. Weight loss subtracts up to 500 kcal, with a floor at estimated resting burn or 1,200 kcal; muscle gain adds 10%. Calories round to the nearest 10, rounding up if needed to preserve the floor. The floor can reduce or remove the deficit.</p>
        <p>These are estimates, not measured needs. Activity is already included; recorded workout calories are not automatically added to this target.</p>
        <a className="btn-text" href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer">Calorie equation source</a>
      </div>}
      {recommended && <p className="fine-print">Current recommendation: {fmt(recommended.p)} g protein · {fmt(recommended.c)} g carbs · {fmt(recommended.f)} g fat. Protein uses the higher of 0.83 g/kg or 15% of calories (1.6 g/kg for muscle gain); fat uses 30%, and carbs take the remainder. Water is a fixed 2,500 ml default, not a body-based estimate.</p>}
      {bmi !== null && (
        <p className={s.bmiLine}><strong>BMI {bmi.toFixed(1)}</strong> · {bmiNote} <span className="muted">(cut-offs for Indian adults)</span></p>
      )}

      <div className={s.goalActions}>
        {differs ? (
          <button type="button" className="btn accent full" onClick={apply} disabled={pending} aria-busy={pending || undefined}>
            Use recommended targets <Icon name="check" size="sm" />
          </button>
        ) : recommended ? (
          <p className={s.match}><Icon name="checkCircle" size="sm" /> Recommended targets are active</p>
        ) : (
          <p className="muted">Add your body details in your profile to get a recommendation.</p>
        )}
        <Link className="btn-text" href="/app/profile#targets">Edit targets <Icon name="edit" size="sm" /></Link>
      </div>
      </details>
    </section>
  );
}
