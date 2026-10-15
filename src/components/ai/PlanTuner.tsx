'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { MAX_TEXT, type PlanResponse } from '@/lib/ai/contracts';
import { saveAiPlan } from '@/lib/ai/actions';
import { MEALS } from '@/lib/nutrition';
import { AiBadge } from './AiBadge';
import { FINAL_STATUSES, callAi, fmtQ } from './api';
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

type Phase = 'input' | 'loading' | 'review';

function PlanBody({ onUse }: { onUse: () => void }) {
  const toast = useToast();
  const [prefs, setPrefs] = useState('');
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<Phase>('input');
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [problem, setProblem] = useState<{ message: string; retry: boolean } | null>(null);
  const [announce, setAnnounce] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const id = useId();

  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => { if (phase === 'review') headRef.current?.focus(); }, [phase]);

  const has = (chip: string) => prefs.toLowerCase().includes(chip.toLowerCase());
  function toggle(chip: string) {
    if (has(chip)) {
      setPrefs(p => p.replace(new RegExp(`(,\\s*)?${chip}`, 'i'), '').replace(/^\s*,\s*/, '').trim());
    } else {
      setPrefs(p => (p.trim() ? `${p.trim().replace(/,$/, '')}, ${chip}` : chip).slice(0, MAX_TEXT));
    }
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setProblem(null);
    setPhase('loading');
    setAnnounce('Building your plan…');
    try {
      const res = await callAi<PlanResponse>('/api/ai/plan', { preferences: prefs.trim() }, c.signal);
      if (c.signal.aborted) return;
      if (!res.ok) {
        setProblem({ message: res.error, retry: !FINAL_STATUSES.has(res.status) });
        setPhase('input');
        setAnnounce('');
        return;
      }
      setResult(res.data);
      setPhase('review');
      setAnnounce(`Plan ready: about ${res.data.kcal} kcal.`);
    } catch {
      if (!c.signal.aborted) {
        setProblem({ message: 'Something went wrong with AI Assist. Try again.', retry: true });
        setPhase('input');
      }
    }
  }

  function cancel() {
    ctrl.current?.abort();
    setPhase('input');
    setAnnounce('Cancelled.');
  }

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
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      <div className={styles.labelRow}>
        <AiBadge />
        <span className={styles.labelText}>AI suggestion: a starting point, not a prescription</span>
      </div>

      {phase !== 'review' && (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor={id}>How should your plan feel?</label>
            <textarea id={id} value={prefs} onChange={e => setPrefs(e.target.value)} maxLength={MAX_TEXT} rows={3} placeholder="No paneer, more South Indian, jain" disabled={phase === 'loading'} aria-describedby={`${id}-help`} />
            <p className="field-help" id={`${id}-help`}>We keep your diet and calorie target. {prefs.length}/{MAX_TEXT}</p>
          </div>
          <div className={styles.chips} role="group" aria-label="Quick preferences">
            {QUICK.map(q => (
              <button key={q} type="button" className="pill-choice" aria-pressed={has(q)} onClick={() => toggle(q)} disabled={phase === 'loading'}>{q}</button>
            ))}
          </div>
          {phase === 'loading' ? (
            <div className={styles.loadingInline}>
              <span className={styles.spinner} aria-hidden="true" />
              <strong>Building your plan…</strong>
              <button type="button" className="btn-secondary" onClick={cancel}>Cancel</button>
            </div>
          ) : (
            <button type="submit" className="btn accent full">Build my plan</button>
          )}
        </form>
      )}

      {problem && (
        <div className={styles.problem} role="alert">
          <p>{problem.message}</p>
          {problem.retry && <div className={styles.actions}><button type="button" className="btn-secondary" onClick={() => submit()}>Try again</button></div>}
        </div>
      )}

      {phase === 'review' && result && (
        <section aria-labelledby="ai-plan-review">
          <h3 id="ai-plan-review" ref={headRef} tabIndex={-1} className={styles.planHead}>
            About {result.kcal} kcal <span className="muted">· target {result.target}</span>
          </h3>
          {result.note && <p className="muted">{result.note}</p>}
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
