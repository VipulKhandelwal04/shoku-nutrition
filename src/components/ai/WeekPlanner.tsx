'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { MAX_TEXT, type WeekResponse } from '@/lib/ai/contracts';
import { restoreWeekPlans, saveAiWeek } from '@/lib/data/week';
import { MEALS } from '@/lib/nutrition';
import { AiBadge } from './AiBadge';
import { FINAL_STATUSES, callAi, fmtQ } from './api';
import styles from './ai.module.css';

const QUICK = ['High protein on training days', 'Quick weekday dinners', 'More South Indian', 'No paneer', 'Light dinners'];
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

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

type Phase = 'input' | 'loading' | 'review';

function WeekBody({ onUsed }: { onUsed: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const id = useId();
  const [prefs, setPrefs] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [result, setResult] = useState<WeekResponse | null>(null);
  const [problem, setProblem] = useState<{ message: string; retry: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [announce, setAnnounce] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => { if (phase === 'review') headRef.current?.focus(); }, [phase]);

  const has = (chip: string) => prefs.toLowerCase().includes(chip.toLowerCase());
  const toggle = (chip: string) => setPrefs(p => (has(chip)
    ? p.replace(new RegExp(`(,\\s*)?${chip}`, 'i'), '').replace(/^\s*,\s*/, '').trim()
    : (p.trim() ? `${p.trim().replace(/,$/, '')}, ${chip}` : chip).slice(0, MAX_TEXT)));

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setProblem(null);
    setPhase('loading');
    setAnnounce('Planning your week…');
    try {
      const res = await callAi<WeekResponse>('/api/ai/week', { preferences: prefs.trim() }, c.signal);
      if (c.signal.aborted) return;
      if (!res.ok) { setProblem({ message: res.error, retry: !FINAL_STATUSES.has(res.status) }); setPhase('input'); setAnnounce(''); return; }
      setResult(res.data);
      setPhase('review');
      setAnnounce('Your week is ready to review.');
    } catch {
      if (!c.signal.aborted) { setProblem({ message: 'Something went wrong with AI Assist. Try again.', retry: true }); setPhase('input'); }
    }
  }

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
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      <div className={styles.labelRow}>
        <AiBadge />
        <span className={styles.labelText}>AI suggestion: a starting point, not a prescription</span>
      </div>

      {phase !== 'review' && (
        <form onSubmit={submit}>
          <p className={styles.weekIntro}>Seven days from foods that fit your diet. Days you usually train get a little more protein and carbs.</p>
          <div className="field">
            <label htmlFor={id}>Anything to keep in mind? <span className="muted">(optional)</span></label>
            <textarea id={id} value={prefs} onChange={e => setPrefs(e.target.value)} maxLength={MAX_TEXT} rows={3} placeholder="Quick weekday dinners, no paneer" disabled={phase === 'loading'} aria-describedby={`${id}-help`} />
            <p className="field-help" id={`${id}-help`}>We keep your diet, the foods you skip and your targets. {prefs.length}/{MAX_TEXT}</p>
          </div>
          <div className={styles.chips} role="group" aria-label="Quick preferences">
            {QUICK.map(q => <button key={q} type="button" className="pill-choice" aria-pressed={has(q)} onClick={() => toggle(q)} disabled={phase === 'loading'}>{q}</button>)}
          </div>
          {phase === 'loading' ? (
            <div className={styles.loadingInline}>
              <span className={styles.spinner} aria-hidden="true" />
              <strong>Planning your week…</strong>
              <button type="button" className="btn-secondary" onClick={() => { ctrl.current?.abort(); setPhase('input'); setAnnounce('Cancelled.'); }}>Cancel</button>
            </div>
          ) : (
            <button type="submit" className="btn accent full">Plan my week</button>
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
