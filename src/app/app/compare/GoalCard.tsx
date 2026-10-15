'use client';
import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';
import { GOALS, type Goal, type Targets } from '@/lib/nutrition';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { applyRecommendedTargets, saveTargets, setGoal } from '@/components/app/insights/actions';
import s from './compare.module.css';
import { fmt } from '@/lib/format';


/** Goal chips (save immediately) and targets vs the recommendation, with a one-tap "use recommended". */
export function GoalCard({ goal, targets, recommended, bmi, bmiNote }: {
  goal: Goal; targets: Targets; recommended: Targets | null; bmi: number | null; bmiNote: string | null;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [shownGoal, setShownGoal] = useOptimistic(goal);
  const differs = !!recommended && (['kcal', 'p', 'c', 'f', 'water'] as const).some(k => recommended[k] !== targets[k]);

  const choose = (g: Goal) => {
    if (g === shownGoal) return;
    start(async () => {
      setShownGoal(g);
      const res = await setGoal(g);
      toast(res.ok ? `Goal set: ${GOALS[g].label}. Your recommendation is updated.` : res.error);
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
      <p className="label">Your goal</p>
      <h2 id="goal-title">{GOALS[shownGoal].label}</h2>
      <div className={s.goalChips} role="group" aria-label="Choose your goal">
        {(Object.keys(GOALS) as Goal[]).map(g => (
          <button key={g} type="button" className="pill-choice" aria-pressed={shownGoal === g} disabled={pending && shownGoal !== g} onClick={() => choose(g)}>
            {GOALS[g].label}
          </button>
        ))}
      </div>
      <p className="muted">{GOALS[shownGoal].blurb}</p>

      <table className={s.targetTable}>
        <caption className="sr-only">Your targets compared with the recommendation</caption>
        <thead>
          <tr><th scope="col"><span className="sr-only">Nutrient</span></th><th scope="col">Yours</th><th scope="col">Recommended</th></tr>
        </thead>
        <tbody>
          {([['kcal', 'Calories', 'kcal'], ['p', 'Protein', 'g'], ['c', 'Carbs', 'g'], ['f', 'Fat', 'g'], ['water', 'Water', 'ml']] as const).map(([k, label, unit]) => (
            <tr key={k} data-diff={recommended && recommended[k] !== targets[k] ? 'true' : undefined}>
              <th scope="row">{label}</th>
              <td>{fmt(targets[k])} <small>{unit}</small></td>
              <td>{recommended ? <>{fmt(recommended[k])} <small>{unit}</small></> : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {bmi !== null && (
        <p className={s.bmiLine}><strong>BMI {bmi.toFixed(1)}</strong> · {bmiNote} <span className="muted">(cut-offs for Indian adults)</span></p>
      )}

      <div className={s.goalActions}>
        {differs ? (
          <button type="button" className="btn accent full" onClick={apply} disabled={pending} aria-busy={pending || undefined}>
            Use recommended targets <Icon name="check" size="sm" />
          </button>
        ) : recommended ? (
          <p className={s.match}><Icon name="checkCircle" size="sm" /> Your targets match this goal</p>
        ) : (
          <p className="muted">Add your body details in your profile to get a recommendation.</p>
        )}
        <Link className="btn-text" href="/app/profile#targets">Edit targets <Icon name="edit" size="sm" /></Link>
      </div>
    </section>
  );
}
