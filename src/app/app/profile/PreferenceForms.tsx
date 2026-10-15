'use client';
import { useState, useTransition, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { deleteRating } from '@/lib/data/feedback';
import { CUISINE_MODES, MAX_CUISINES, ratingLabel, tagLabel, type CuisinePrefs, type FeedbackRow } from '@/lib/preferences';
import fb from '@/components/app/feedback/feedback.module.css';
import { saveActivityPrefs, saveCuisinePrefs } from './actions';
import s from './profile.module.css';

/** Profile → Food style: how much Ask Shoku and Tune my plan lean toward particular cuisines. */
export function CuisineForm({ initial, choices, onSaved }: { initial: CuisinePrefs; choices: string[]; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (v.mode === 'chosen' && !v.chosen.length) { setError('Pick at least one cuisine, or choose “Open to all”.'); return; }
    start(async () => {
      const res = await saveCuisinePrefs(v);
      if (!res.ok) { setError(res.error); return; }
      toast('Food style saved.');
      onSaved();
    });
  }

  const toggle = (c: string) => {
    setError('');
    const on = v.chosen.includes(c);
    if (!on && v.chosen.length >= MAX_CUISINES) { setError(`Pick up to ${MAX_CUISINES} cuisines.`); return; }
    setV({ ...v, chosen: on ? v.chosen.filter(x => x !== c) : [...v.chosen, c] });
  };

  return (
    <form onSubmit={submit} noValidate className={s.bare}>
      <p className={s.sub}>Shoku leans toward these when it suggests meals. Your diet and the foods you skip always stay strict.</p>
      <fieldset className={s.fieldset}>
        <legend className="field-label">Cuisines</legend>
        <div className={s.modes}>
          {CUISINE_MODES.map(m => (
            <button key={m.key} type="button" className={s.mode} aria-pressed={v.mode === m.key} onClick={() => { setV({ ...v, mode: m.key }); setError(''); }}>
              <strong>{m.label}</strong>
              <small>{m.blurb}</small>
            </button>
          ))}
        </div>
      </fieldset>
      {v.mode === 'chosen' && (
        <fieldset className={s.fieldset}>
          <legend className="field-label">Lean toward</legend>
          <div className={s.pills}>
            {choices.map(c => (
              <button key={c} type="button" className="pill-choice" aria-pressed={v.chosen.includes(c)} onClick={() => toggle(c)}>{c}</button>
            ))}
          </div>
          <p className="field-help">If a cuisine has only a few foods in Shoku yet, ideas also use the rest of the catalogue.</p>
        </fieldset>
      )}
      <p className="error-text" role="alert">{error}</p>
      <button type="submit" className="btn accent full" disabled={pending} aria-busy={pending || undefined}>{pending ? 'Saving…' : 'Save food style'}</button>
    </form>
  );
}

/** Profile → Workouts in meal ideas: two switches that save as soon as they change. */
export function ActivitySwitches({ initial }: { initial: { useWorkouts: boolean; askFirst: boolean } }) {
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();

  const change = (next: typeof v) => {
    const prev = v;
    setV(next);
    start(async () => {
      const res = await saveActivityPrefs(next);
      if (!res.ok) { setV(prev); toast(res.error); }
    });
  };

  const rows = [
    { key: 'useWorkouts' as const, label: 'Use workouts in meal ideas', help: 'Ask Shoku reads today’s workouts, logged or from Strava, to size meals.', disabled: false },
    { key: 'askFirst' as const, label: 'Ask before using workouts', help: 'Ask Shoku checks with you each time before it reads them.', disabled: !v.useWorkouts },
  ];
  return (
    <div className={s.bare} aria-busy={pending || undefined}>
      <p className={s.sub}>You decide what Ask Shoku looks at. Food is never something you have to earn with exercise.</p>
      <ul className={s.switchList}>
        {rows.map(r => (
          <li key={r.key} className={s.switchRow} data-disabled={r.disabled || undefined}>
            <span className={s.rowText}>
              <span className={s.rowLabel} id={`pref-${r.key}`}>{r.label}</span>
              <span className={s.switchHelp}>{r.help}</span>
            </span>
            <button type="button" role="switch" className={s.switch} aria-checked={v[r.key]} aria-labelledby={`pref-${r.key}`}
              disabled={r.disabled} onClick={() => change({ ...v, [r.key]: !v[r.key] })} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Profile → Meal feedback: every rating the member saved, each deletable. */
export function RatingsList({ ratings }: { ratings: FeedbackRow[] }) {
  const toast = useToast();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const shown = ratings.filter(r => !gone.has(r.id));

  async function remove(id: string) {
    setBusy(id);
    const res = await deleteRating(id).catch(() => ({ ok: false as const, error: 'Couldn’t delete that rating. Check your connection.' }));
    setBusy(null);
    if (!res.ok) { toast(res.error); return; }
    setGone(g => new Set(g).add(id));
    toast('Rating deleted.');
  }

  if (!shown.length) return <p className={fb.empty}>No ratings yet. After a meal, open it on Today or in an Ask Shoku idea and tap “How was it?”.</p>;
  return (
    <>
      <p className={s.sub}>What you told Shoku about meals. Only you see these.</p>
      <ul className={fb.list}>
        {shown.map(r => (
          <li key={r.id} className={fb.item}>
            <span className={fb.itemText}>
              <span className={fb.itemTitle}>{r.title}</span>
              <span className={fb.itemMeta}>
                <span className={`chip ${r.rating === 'like' ? 'ok' : ''}`}>{ratingLabel(r.rating)}</span>
                {r.tags.map(t => <span key={t} className="chip">{tagLabel(t)}</span>)}
                <span>{r.meal} · {when(r.created_at)}{r.kind === 'idea' ? ' · Ask Shoku idea' : ''}</span>
              </span>
              {r.note && <span className={fb.itemNote}>“{r.note}”</span>}
            </span>
            <button type="button" className="btn-icon" aria-label={`Delete rating for ${r.title}`} disabled={busy === r.id} onClick={() => remove(r.id)}>
              <Icon name="trash" size="sm" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
