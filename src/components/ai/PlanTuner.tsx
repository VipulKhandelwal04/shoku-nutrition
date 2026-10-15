'use client';
import { useId, useState } from 'react';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import type { PlanResponse } from '@/lib/ai/contracts';
import { saveAiPlan } from '@/lib/ai/actions';
import { MEALS } from '@/lib/nutrition';
import { AiBadge } from './AiBadge';
import { PrefsForm, ProblemBox, useAiRequest } from './AiRequest';
import { fmtQ } from './api';
import styles from './ai.module.css';

const QUICK = ['More South Indian', 'No paneer', 'Jain', 'High protein', 'Quick to cook', 'Light dinner'];

/** Entry point to tailor the meal plan with AI Assist ("no paneer", "jain"). Saves only on "Use this plan"; calls onSaved. */
export function PlanTuner({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button type="button" className={`btn-secondary ${styles.tunerButton}`} onClick={() => setOpen(true)}>
        <Icon name="spark" size="sm" />
        Tailor my plan with AI
      </button>
      <Sheet open={open} onClose={close} title="Tailor my plan" labelledBy="ai-plan-title">
        <PlanBody onUse={() => { close(); onSaved?.(); }} />
      </Sheet>
    </>
  );
}

function PlanBody({ onUse }: { onUse: () => void }) {
  const toast = useToast();
  const id = useId();
  const [saving, setSaving] = useState(false);
  const req = useAiRequest<PlanResponse>('/api/ai/plan', { loading: 'Building your plan…', ready: d => `Plan ready: about ${d.kcal} kcal.` });
  const { phase, result, prefs, headRef, submit, setPhase, setProblem } = req;

  async function use() {
    if (!result || saving) return;
    setSaving(true);
    setProblem(null);
    try {
      const res = await saveAiPlan(result.plan, prefs);
      if (!res.ok) {
        setProblem({ message: res.error, retry: false });
        return;
      }
      toast('Your plan is updated', { tone: 'win' });
      onUse();
    } catch {
      setProblem({ message: 'Couldn’t save your plan. Tap “Use this plan” to try again.', retry: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.body} aria-busy={phase === 'loading'}>
      <p className="sr-only" role="status" aria-live="polite">{req.announce}</p>
      <div className={styles.labelRow}>
        <AiBadge />
        <span className={styles.labelText}>AI suggestion: a starting point, not a prescription</span>
      </div>

      {phase !== 'review' && (
        <PrefsForm id={id} req={req} label="How should your plan feel?" placeholder="No paneer, more South Indian, jain"
          help="We keep your diet and calorie target." quick={QUICK} submitLabel="Build my plan" loadingLabel="Building your plan…" />
      )}

      <ProblemBox problem={req.problem} onRetry={() => submit()} />

      {phase === 'review' && result && (
        <section aria-labelledby="ai-plan-review">
          <h3 id="ai-plan-review" ref={headRef} tabIndex={-1} className={styles.planHead}>
            About {result.kcal} kcal <span className="muted">· target {result.target}</span>
          </h3>
          {result.note && <p className="muted">{result.note}</p>}
          {result.cuisines?.length > 0 && <p className="fine-print">Leaning toward {result.cuisines.join(', ')} · from your Food style</p>}
          {result.feedback && <p className="fine-print">Shaped by your meal feedback · turn it off in Profile → Meal feedback</p>}
          {MEALS.map(m => (
            <div key={m} className={styles.planMeal}>
              <p className="label">{m}</p>
              {result.rows[m].length ? (
                <ul className={styles.rows}>
                  {result.rows[m].map(r => (
                    <li key={r.foodId} className={styles.planRow}>
                      <FoodTile icon={r.icon} />
                      <span className={styles.rowInfo}>
                        <strong>{r.name}</strong>
                        <small>{fmtQ(r.q)} {r.unit}</small>
                      </span>
                      <span className={styles.kcal}>{r.kcal}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nothing planned. Keep it light.</p>
              )}
            </div>
          ))}
          <p className="fine-print">Not saved until you tap “Use this plan”. Portions are estimates from the food list; adjust to how you feel.</p>
          <div className={styles.foot}>
            <div className={styles.actions}>
              <button type="button" className="btn-secondary" onClick={() => submit()}>Try again</button>
              <button type="button" className="btn-text" onClick={() => setPhase('input')}>Edit preferences</button>
            </div>
            <button type="button" className="btn accent full" onClick={use} disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Use this plan'}</button>
          </div>
        </section>
      )}
    </div>
  );
}
