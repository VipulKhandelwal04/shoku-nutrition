'use client';
// Shared shape of the AI Assist "tell us, review, use" sheets (Tailor my plan, Plan my week): a preferences text
// with quick chips, a cancellable request, a problem box with retry, and a review step that takes focus.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_TEXT } from '@/lib/ai/contracts';
import { FINAL_STATUSES, callAi } from './api';
import styles from './ai.module.css';

export type AiPhase = 'input' | 'loading' | 'review';
export type AiProblem = { message: string; retry: boolean };

/** State and actions for a preferences → AI → review sheet that POSTs `{ preferences }` to `endpoint`. */
export function useAiRequest<T>(endpoint: string, say: { loading: string; ready: (data: T) => string }) {
  const [prefs, setPrefs] = useState('');
  const [phase, setPhase] = useState<AiPhase>('input');
  const [result, setResult] = useState<T | null>(null);
  const [problem, setProblem] = useState<AiProblem | null>(null);
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
    setAnnounce(say.loading);
    try {
      const res = await callAi<T>(endpoint, { preferences: prefs.trim() }, c.signal);
      if (c.signal.aborted) return;
      if (!res.ok) { setProblem({ message: res.error, retry: !FINAL_STATUSES.has(res.status) }); setPhase('input'); setAnnounce(''); return; }
      setResult(res.data);
      setPhase('review');
      setAnnounce(say.ready(res.data));
    } catch {
      if (!c.signal.aborted) { setProblem({ message: 'Something went wrong with AI Assist. Try again.', retry: true }); setPhase('input'); }
    }
  }

  function cancel() {
    ctrl.current?.abort();
    setPhase('input');
    setAnnounce('Cancelled.');
  }

  return { prefs, setPrefs, has, toggle, phase, setPhase, result, problem, setProblem, announce, headRef, submit, cancel };
}

type Request = ReturnType<typeof useAiRequest<unknown>>;

/** The input step: preferences textarea, quick chips, and Build / Cancel. */
export function PrefsForm({ id, req, label, placeholder, help, quick, submitLabel, loadingLabel }: {
  id: string; req: Request; label: string; placeholder: string; help: string; quick: string[]; submitLabel: string; loadingLabel: string;
}) {
  const loading = req.phase === 'loading';
  return (
    <form onSubmit={req.submit}>
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <textarea id={id} value={req.prefs} onChange={e => req.setPrefs(e.target.value)} maxLength={MAX_TEXT} rows={3} placeholder={placeholder} disabled={loading} aria-describedby={`${id}-help`} />
        <p className="field-help" id={`${id}-help`}>{help} {req.prefs.length}/{MAX_TEXT}</p>
      </div>
      <div className={styles.chips} role="group" aria-label="Quick preferences">
        {quick.map(q => <button key={q} type="button" className="pill-choice" aria-pressed={req.has(q)} onClick={() => req.toggle(q)} disabled={loading}>{q}</button>)}
      </div>
      {loading ? (
        <div className={styles.loadingInline}>
          <span className={styles.spinner} aria-hidden="true" />
          <strong>{loadingLabel}</strong>
          <button type="button" className="btn-secondary" onClick={req.cancel}>Cancel</button>
        </div>
      ) : (
        <button type="submit" className="btn accent full">{submitLabel}</button>
      )}
    </form>
  );
}

/** The problem box, with Try again when retrying could help. */
export function ProblemBox({ problem, onRetry }: { problem: AiProblem | null; onRetry: () => void }) {
  if (!problem) return null;
  return (
    <div className={styles.problem} role="alert">
      <p>{problem.message}</p>
      {problem.retry && <div className={styles.actions}><button type="button" className="btn-secondary" onClick={onRetry}>Try again</button></div>}
    </div>
  );
}
