'use client';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { deleteRating, rateMeal } from '@/lib/data/feedback';
import { FEEDBACK_TAGS, MAX_NOTE, RATINGS, type FeedbackInput, type FeedbackTag, type Rating } from '@/lib/preferences';
import s from './feedback.module.css';

export type FeedbackSubject = Pick<FeedbackInput, 'kind' | 'entryId' | 'title' | 'meal' | 'foodIds'>;

/**
 * "How was it?": like / okay / not for me, optional quick tags and a short note. Used for a logged food (in the
 * diary's edit sheet) and for an Ask Shoku idea card. Saving shows a toast with Undo.
 */
export function FeedbackForm({ subject, onDone, compact = false }: { subject: FeedbackSubject; onDone?: () => void; compact?: boolean }) {
  const ids = useId();
  const toast = useToast();
  const [rating, setRating] = useState<Rating | null>(null);
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) { setError('Pick how it felt first.'); return; }
    start(async () => {
      const res = await rateMeal({ ...subject, rating, tags, note: note.trim() || undefined })
        .catch(() => ({ ok: false as const, error: 'Couldn’t save your rating. Check your connection.' }));
      if (!res.ok) { setError(res.error); return; }
      const id = res.data.id;
      toast('Thanks. Shoku saved how it felt.', { undo: () => deleteRating(id) });
      onDone?.();
    });
  }

  return (
    <form className={`${s.form} ${compact ? s.compact : ''}`} onSubmit={submit} noValidate>
      <fieldset className={s.fieldset}>
        <legend className="field-label">How was {subject.kind === 'idea' ? 'this idea' : 'it'}?</legend>
        <div className={s.ratings}>
          {RATINGS.map(r => (
            <button key={r.key} type="button" className="pill-choice" aria-pressed={rating === r.key}
              onClick={() => { setRating(r.key); setError(''); }}>{r.label}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className={s.fieldset}>
        <legend className="field-label">Anything to remember? <span className="muted">(optional)</span></legend>
        <div className={s.tags}>
          {FEEDBACK_TAGS.map(t => {
            const on = tags.includes(t.key);
            return (
              <button key={t.key} type="button" className={`pill-choice ${s.tag}`} aria-pressed={on}
                onClick={() => setTags(on ? tags.filter(x => x !== t.key) : [...tags, t.key])}>{t.label}</button>
            );
          })}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${ids}-note`}>A short note <span className="muted">(optional)</span></label>
        <textarea id={`${ids}-note`} rows={2} maxLength={MAX_NOTE} value={note} onChange={e => setNote(e.target.value)}
          placeholder="e.g. more spice next time" />
      </div>
      <p className="error-text" role="alert">{error}</p>
      <button type="submit" className={`btn accent ${compact ? '' : 'full'}`} disabled={pending} aria-busy={pending || undefined}>
        {pending ? 'Saving…' : <>Save <Icon name="check" size="sm" /></>}
      </button>
      <p className="fine-print">Only you see this. You can delete it any time in Profile → Meal feedback.</p>
    </form>
  );
}
