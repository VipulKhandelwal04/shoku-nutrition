'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { MAX_TEXT, type AskIdea, type AskResponse } from '@/lib/ai/contracts';
import { addEntries, deleteEntries } from '@/lib/data/diary';
import { dateKey } from '@/lib/nutrition';
import { FINAL_STATUSES, callAi, fmtQ } from './api';
import s from './askShoku.module.css';

const PROMPTS = [
  'What can I eat after strength training?',
  'High-protein dinner that fits what’s left today',
  'Quick vegetarian lunch under 500 kcal',
];

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retry: boolean }
  | { kind: 'done'; data: AskResponse };

const n = (v: number) => Math.round(v).toLocaleString('en-IN');

/**
 * Ask Shoku: a search field in the top bar (an icon on phones) that opens a sheet with a grounded answer and
 * up to three meal ideas built from catalogue foods. Logging an idea is one tap and can be undone.
 */
export function AskShoku() {
  const ids = useId();
  const barRef = useRef<HTMLInputElement>(null);
  const sheetInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  // "/" or Cmd/Ctrl+K jumps to Ask Shoku from anywhere that isn't already a text field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const combo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (!combo && (e.key !== '/' || typing)) return;
      if (document.querySelector('dialog[open]') && !open) return;
      e.preventDefault();
      const bar = barRef.current;
      if (bar && bar.offsetParent !== null) bar.focus();
      else setOpen(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open && phase.kind === 'idle') requestAnimationFrame(() => sheetInput.current?.focus());
  }, [open, phase.kind]);

  useEffect(() => () => abort.current?.abort(), []);

  async function ask(text: string) {
    const q = text.trim().slice(0, MAX_TEXT);
    if (q.length < 3) { setPhase({ kind: 'error', message: 'Ask a little more, e.g. “dinner after leg day”.', retry: false }); setOpen(true); return; }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setQuestion(q);
    setAsked(q);
    setOpen(true);
    setPhase({ kind: 'loading' });
    try {
      const r = await callAi<AskResponse>('/api/ai/ask', { question: q, day: dateKey() }, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setPhase(r.ok ? { kind: 'done', data: r.data } : { kind: 'error', message: r.error, retry: !FINAL_STATUSES.has(r.status) });
    } catch {
      /* aborted: a newer question or the sheet closed */
    }
  }

  function submitBar(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  function close() {
    abort.current?.abort();
    setOpen(false);
    if (phase.kind === 'loading') setPhase({ kind: 'idle' });
  }

  return (
    <div className={s.ask}>
      <form role="search" className={s.bar} onSubmit={submitBar} aria-label="Ask Shoku">
        <Icon name="spark" size="sm" className={s.barIcon} />
        <label htmlFor={`${ids}-bar`} className="sr-only">Ask Shoku</label>
        <input
          ref={barRef}
          id={`${ids}-bar`}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={MAX_TEXT}
          placeholder="Ask Shoku · e.g. dinner after leg day"
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <kbd className={s.kbd} aria-hidden="true">/</kbd>
      </form>
      <button type="button" className={`btn-icon ${s.mobileBtn}`} aria-label="Ask Shoku" onClick={() => setOpen(true)}>
        <Icon name="search" />
      </button>

      <Sheet open={open} onClose={close} title="Ask Shoku" labelledBy={`${ids}-title`}>
        <form className={s.sheetForm} onSubmit={e => { e.preventDefault(); void ask(question); }}>
          <label htmlFor={`${ids}-q`} className="sr-only">Your question</label>
          <input
            ref={sheetInput}
            id={`${ids}-q`}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={MAX_TEXT}
            placeholder="What should I eat after my run?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
          />
          <button type="submit" className="btn-add" aria-label="Ask" disabled={phase.kind === 'loading'}><Icon name="arrow" /></button>
        </form>

        {phase.kind === 'idle' && (
          <div className={s.prompts}>
            <p className="label">Try</p>
            <div className={s.promptRow}>
              {PROMPTS.map(p => <button key={p} type="button" className="pill-choice" onClick={() => void ask(p)}>{p}</button>)}
            </div>
            <p className="fine-print">Shoku reads today’s meals, your workouts (including Strava) and your targets, then suggests foods from its catalogue that fit your diet.</p>
          </div>
        )}

        {phase.kind === 'loading' && (
          <div className={s.loading} role="status" aria-live="polite">
            <span className={s.spinner} aria-hidden="true" />
            <span><strong>Reading your day</strong><small>“{asked}”</small></span>
          </div>
        )}

        {phase.kind === 'error' && (
          <div className={s.error} role="alert">
            <p>{phase.message}</p>
            {phase.retry && <button type="button" className="btn-secondary" onClick={() => void ask(asked)}>Try again</button>}
          </div>
        )}

        {phase.kind === 'done' && <Answer data={phase.data} />}
      </Sheet>
    </div>
  );
}

function Answer({ data }: { data: AskResponse }) {
  const c = data.context;
  const used = [
    ...c.workouts.slice(0, 2).map(w => `${w.label} · ${n(w.kcal)} kcal`),
    `Eaten ${n(c.eatenKcal)} of ${n(c.targetKcal)} kcal`,
    `Protein ${n(c.eatenProtein)} / ${n(c.targetProtein)} g`,
    c.diet,
    ...(c.avoiding.length ? [`Avoiding ${c.avoiding.join(', ')}`] : []),
  ];
  return (
    <div className={s.result}>
      {data.answer && <p className={s.answer}>{data.answer}</p>}
      <div className={s.used}>
        <p className="label">What Shoku used</p>
        <ul className={s.usedRow}>{used.map(u => <li key={u} className="chip">{u}</li>)}</ul>
      </div>
      {data.ideas.length > 0 && (
        <ul className={s.ideas}>
          {data.ideas.map((idea, i) => <IdeaCard key={`${idea.title}-${i}`} idea={idea} />)}
        </ul>
      )}
      <p className="fine-print">Ideas use Shoku catalogue foods that fit your diet. Portions are estimates, not medical advice.</p>
    </div>
  );
}

function IdeaCard({ idea }: { idea: AskIdea }) {
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'saving' | 'logged'>('idle');

  async function log() {
    setState('saving');
    const res = await addEntries({
      day: dateKey(),
      items: idea.items.map(i => ({ meal: idea.meal, foodId: i.foodId, quantity: i.q, source: 'text_ai' as const })),
    }).catch(() => ({ ok: false as const, error: 'Couldn’t save that. Check your connection and try again.' }));
    if (!res.ok) { setState('idle'); toast(res.error); return; }
    setState('logged');
    const saved = res.data.ids;
    toast(`${idea.title} logged to ${idea.meal.toLowerCase()}`, {
      undo: async () => {
        const r = await deleteEntries(saved);
        if (r.ok) setState('idle');
        return r;
      },
    });
  }

  return (
    <li className={`panel ${s.idea}`}>
      <div className={s.ideaHead}>
        <h3>{idea.title}</h3>
        <span className="chip accent">{idea.meal}</span>
      </div>
      <p className={s.ideaStats}><b>{n(idea.kcal)}</b> kcal · <b>{n(idea.p)} g</b> protein</p>
      <ul className={s.items}>
        {idea.items.map(i => (
          <li key={i.foodId}>
            <FoodTile icon={i.icon} />
            <span className={s.itemName}>{i.name}<small>{fmtQ(i.q)} {i.unit}</small></span>
            <span className={s.itemKcal}>{n(i.kcal)}<small> kcal</small></span>
          </li>
        ))}
      </ul>
      {idea.why && <p className={s.why}>{idea.why}</p>}
      <button type="button" className={`btn ${state === 'logged' ? '' : 'accent'} full`} onClick={log} disabled={state !== 'idle'} aria-busy={state === 'saving' || undefined}>
        {state === 'logged' ? <><Icon name="check" size="sm" /> Logged</> : state === 'saving' ? 'Logging…' : `Log to ${idea.meal}`}
      </button>
    </li>
  );
}
