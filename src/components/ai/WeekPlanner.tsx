'use client';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import type { WeekResponse } from '@/lib/ai/contracts';
import { restoreWeekPlans, saveAiWeek } from '@/lib/data/week';
import { MEALS } from '@/lib/nutrition';
import { AiBadge } from './AiBadge';
import { PrefsForm, ProblemBox, useAiRequest } from './AiRequest';
import { fmtQ } from './api';
import styles from './ai.module.css';
import { fmt } from '@/lib/format';

const QUICK = ['High protein on training days', 'Quick weekday dinners', 'More South Indian', 'No paneer', 'Light dinners'];

/** "Plan my week" (AI Assist): seven days around the member's usual training days. Saves only on "Use this week". */
export function WeekPlanner() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`btn-secondary ${styles.tunerButton}`} onClick={() => setOpen(true)}>
        <Icon name="spark" size="sm" />
        Plan my week with AI
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Plan my week" labelledBy="ai-week-title">
        <WeekBody onUsed={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function WeekBody({ onUsed }: { onUsed: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const id = useId();
  const [saving, setSaving] = useState(false);
  const req = useAiRequest<WeekResponse>('/api/ai/week', { loading: 'Planning your week…', ready: () => 'Your week is ready to review.' });
  const { phase, result, headRef, submit, setPhase, setProblem } = req;

  async function use() {
    if (!result || saving) return;
    setSaving(true);
    setProblem(null);
    try {
      const res = await saveAiWeek({ days: result.days.map(d => ({ weekday: d.weekday, plan: d.plan })) });
      if (!res.ok) { setProblem({ message: res.error, retry: false }); return; }
      const previous = res.data.previous;
      toast('Your week is saved. Swap any meal from the week view.', {
        tone: 'win',
        undo: async () => { const u = await restoreWeekPlans(previous); if (u.ok) router.refresh(); return u; },
      });
      router.refresh();
      onUsed();
    } catch {
      setProblem({ message: 'Couldn’t save your week. Tap “Use this week” to try again.', retry: false });
    } finally {
      setSaving(false);
    }
  }

  const training = result?.trainingDays.length
    ? result.days.filter(d => d.training).map(d => d.label).join(', ')
    : null;

  return (
    <div className={styles.body} aria-busy={phase === 'loading'}>
      <p className="sr-only" role="status" aria-live="polite">{req.announce}</p>
      <div className={styles.labelRow}>
        <AiBadge />
        <span className={styles.labelText}>AI suggestion: a starting point, not a prescription</span>
      </div>

      {phase !== 'review' && (
        <>
          <p className={styles.weekIntro}>Seven days from foods that fit your diet. Days you usually train get a little more protein and carbs.</p>
          <PrefsForm id={id} req={req} label="Anything to keep in mind? (optional)" placeholder="Quick weekday dinners, no paneer"
            help="We keep your diet, the foods you skip and your targets." quick={QUICK} submitLabel="Plan my week" loadingLabel="Planning your week…" />
        </>
      )}

      <ProblemBox problem={req.problem} onRetry={() => submit()} />

      {phase === 'review' && result && (
        <section aria-labelledby="ai-week-review">
          <h3 id="ai-week-review" ref={headRef} tabIndex={-1} className={styles.planHead}>Your week</h3>
          {result.note && <p className="muted">{result.note}</p>}
          <p className="fine-print">
            {training ? `Usual training days: ${training}. They get a little more protein and carbs.` : 'No regular training days in the last four weeks, so every day has the same target.'}
            {result.cuisines.length > 0 && ` Leaning ${result.cuisines.join(', ')}.`}
            {result.feedback && ' Shaped by your meal feedback.'}
          </p>
          <ol className={styles.weekList}>
            {result.days.map(d => (
              <li key={d.weekday}>
                <details className={styles.weekItem}>
                  <summary>
                    <span className={styles.weekDayName}>{d.label}</span>
                    {d.training && <span className="chip accent">Training</span>}
                    <span className={styles.weekDayKcal}>{fmt(d.kcal)} <small>/ {fmt(d.target)} kcal</small></span>
                  </summary>
                  <dl className={styles.weekDayMeals}>
                    {MEALS.map(m => (
                      <div key={m}>
                        <dt>{m}</dt>
                        <dd>{d.rows[m].length ? d.rows[m].map(r => `${r.name} ${fmtQ(r.q)} ${r.unit}`).join(' · ') : 'Nothing planned'}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </li>
            ))}
          </ol>
          <p className="fine-print">Not saved until you tap “Use this week”. It replaces any days you saved before; you can undo.</p>
          <div className={styles.foot}>
            <div className={styles.actions}>
              <button type="button" className="btn-secondary" onClick={() => submit()}>Try again</button>
              <button type="button" className="btn-text" onClick={() => setPhase('input')}>Edit preferences</button>
            </div>
            <button type="button" className="btn accent full" onClick={use} disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Use this week'}</button>
          </div>
        </section>
      )}
    </div>
  );
}
