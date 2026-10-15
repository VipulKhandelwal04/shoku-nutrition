'use client';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { MAX_TEXT, type AiSuggestion, type SuggestResponse } from '@/lib/ai/contracts';
import { addEntries, deleteEntries } from '@/lib/data/diary';
import { BADGES, MEALS, type Food, type Meal } from '@/lib/nutrition';
import { createClient } from '@/lib/supabase/client';
import { AiBadge } from './AiBadge';
import { FINAL_STATUSES, callAi, downscaleImage, fmtQ, stepQ } from './api';
import { FoodPicker } from './FoodPicker';
import styles from './ai.module.css';

export type AiLogSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 'photo' = snap a plate (Gemini vision); 'text' = "2 rotis, dal and curd". */
  mode: 'photo' | 'text';
  day: string; // YYYY-MM-DD the entries are logged to
  meal: Meal; // default meal; the user can change it per item before confirming
  foods: Food[]; // catalogue + custom foods visible to the user (for matching and manual correction)
  /** Called after the user confirms and entries are saved, with the new entry ids (for Undo). */
  onLogged?: (entryIds: string[]) => void;
};

const LOW_CONFIDENCE = 0.6;
const EXAMPLES = ['2 rotis, dal and a katori of curd', 'Masala dosa with sambar', 'Poha and a cup of chai', 'Chicken biryani and salad'];

/** Snap or type a meal, review AI Assist's suggestions, then log them. Every row is editable before saving. */
export function AiLogSheet(props: AiLogSheetProps) {
  const { open, onClose, mode } = props;
  return (
    <Sheet open={open} onClose={onClose} title={mode === 'photo' ? 'Snap your plate' : 'Type your meal'} labelledBy="ai-log-title">
      {/* The Sheet renders children only while open, so each opening starts fresh. */}
      <AiLogBody key={mode} {...props} />
    </Sheet>
  );
}

type Row = AiSuggestion & { key: string; meal: Meal; picking: boolean };
type Phase = 'input' | 'loading' | 'review' | 'saving';
type Problem = { message: string; retry: boolean };

function AiLogBody({ mode, day, meal, foods, onLogged, onClose }: AiLogSheetProps) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('input');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [keepPhoto, setKeepPhoto] = useState(true);
  const [announce, setAnnounce] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLHeadingElement>(null);
  const ids = { text: useId(), file: useId(), keep: useId() };
  const foodsById = useMemo(() => new Map(foods.map(f => [f.id, f])), [foods]);

  // Abort an in-flight request when the sheet closes; free the preview URL when the photo changes.
  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => { if (phase === 'review') reviewRef.current?.focus(); }, [phase]);

  async function analyse(body: FormData | Record<string, unknown>) {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setProblem(null);
    setPhase('loading');
    setAnnounce(mode === 'photo' ? 'Reading your plate…' : 'Reading your meal…');
    try {
      const res = await callAi<SuggestResponse>(mode === 'photo' ? '/api/ai/photo' : '/api/ai/parse', body, c.signal);
      if (c.signal.aborted) return;
      if (!res.ok) return showProblem(res.error, !FINAL_STATUSES.has(res.status));
      if (!res.data.items.length) {
        return showProblem(mode === 'photo' ? 'AI Assist couldn’t spot any food in that photo. Try a clearer, closer shot.' : 'AI Assist couldn’t find any food in that. Try naming the dishes.', true);
      }
      setRows(res.data.items.map((s, i) => ({ ...s, key: `${i}-${s.foodId ?? s.name}`, meal, picking: s.foodId === null })));
      setNote(res.data.note);
      setPhase('review');
      const n = res.data.items.length;
      setAnnounce(`Found ${n} ${n === 1 ? 'food' : 'foods'}. Check them before saving.`);
    } catch {
      if (!c.signal.aborted) showProblem('Something went wrong with AI Assist. Try again.', true);
    }
  }

  function showProblem(message: string, retry: boolean) {
    setProblem({ message, retry });
    setPhase('input');
    setAnnounce('');
  }

  function cancel() {
    ctrl.current?.abort();
    setPhase('input');
    setAnnounce('Cancelled.');
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return showProblem('Choose a photo (JPG, PNG or WebP).', true);
    try {
      const blob = await downscaleImage(file, 1024, 0.8);
      const url = URL.createObjectURL(blob);
      setPhoto({ blob, url });
      sendPhoto(blob);
    } catch (err) {
      showProblem(err instanceof Error ? err.message : 'This photo couldn’t be opened.', true);
    }
  }

  function sendPhoto(blob: Blob) {
    const fd = new FormData();
    fd.set('image', new File([blob], 'meal.jpg', { type: 'image/jpeg' }));
    fd.set('meal', meal);
    fd.set('day', day);
    void analyse(fd);
  }

  function onText(e: FormEvent) {
    e.preventDefault();
    if (text.trim().length < 2) return showProblem('Tell AI Assist what you ate, like “2 rotis and dal”.', true);
    void analyse({ text: text.trim(), meal, day });
  }

  function retry() {
    if (mode === 'photo' && photo) sendPhoto(photo.blob);
    else if (mode === 'text' && text.trim()) void analyse({ text: text.trim(), meal, day });
    else setProblem(null);
  }

  const update = (key: string, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows(rs => rs.filter(r => r.key !== key));

  const unmatched = rows.filter(r => !r.foodId).length;
  const totalKcal = Math.round(rows.reduce((n, r) => n + (r.foodId ? (foodsById.get(r.foodId)?.kcal ?? 0) * r.quantity : 0), 0));

  async function save() {
    if (!rows.length || unmatched) return;
    setPhase('saving');
    setProblem(null);
    const supabase = mode === 'photo' && photo && keepPhoto ? createClient() : null;
    let photoPath: string | undefined;
    let photoMissed = false;
    if (supabase && photo) {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error('signed out');
        const path = `${data.user.id}/${day}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from('meal-photos').upload(path, photo.blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        photoPath = path;
      } catch {
        photoMissed = true; // Log the food anyway; the photo is optional.
      }
    }
    const res = await addEntries({
      day,
      items: rows.map(r => ({ meal: r.meal, foodId: r.foodId!, quantity: r.quantity, source: mode === 'photo' ? 'photo_ai' : 'text_ai', photoPath })),
    }).catch(() => ({ ok: false as const, error: 'Couldn’t save that. Check your connection and try again.' }));
    if (!res.ok) {
      if (supabase && photoPath) void supabase.storage.from('meal-photos').remove([photoPath]);
      setProblem({ message: res.error, retry: false });
      setPhase('review');
      return;
    }
    const n = res.data.ids.length;
    const saved = res.data.ids;
    const badge = [...BADGES].reverse().find(b => res.data.newBadges.includes(b.id));
    const message = badge ? `${badge.name} unlocked` : `${n} ${n === 1 ? 'food' : 'foods'} logged${photoMissed ? ' (photo not saved)' : ''}`;
    toast(message, {
      tone: badge ? 'win' : undefined,
      undo: async () => {
        await deleteEntries(saved);
        if (supabase && photoPath) await supabase.storage.from('meal-photos').remove([photoPath]);
      },
    });
    onLogged?.(saved);
    onClose();
  }

  const busy = phase === 'loading' || phase === 'saving';

  return (
    <div className={styles.body} aria-busy={busy}>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      <div className={styles.labelRow}>
        <AiBadge />
        <span className={styles.labelText}>AI suggestion: check before saving</span>
      </div>

      {phase !== 'review' && phase !== 'saving' && (
        <>
          {mode === 'photo' ? (
            <div className={styles.photoArea}>
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={photo.url} alt="Your plate" className={styles.preview} />
              ) : (
                <label htmlFor={ids.file} className={styles.drop}>
                  <Icon name="camera" />
                  <span>Take a photo or choose one</span>
                  <small>Your plate, from above, in good light</small>
                </label>
              )}
              {/* No `capture` attribute: Android then offers both the camera and the gallery. */}
              <input ref={fileRef} id={ids.file} type="file" accept="image/*" className="sr-only" onChange={e => { void onFile(e.target.files?.[0]); e.target.value = ''; }} disabled={busy} />
              {phase === 'loading' && (
                <div className={styles.loadingOverlay}>
                  <span className={styles.spinner} aria-hidden="true" />
                  <strong>Reading your plate…</strong>
                  <button type="button" className="btn-secondary" onClick={cancel}>Cancel</button>
                </div>
              )}
              {photo && phase === 'input' && (
                <div className={styles.actions}>
                  <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}><Icon name="camera" size="sm" />Choose another</button>
                  <button type="button" className="btn accent" onClick={() => sendPhoto(photo.blob)}>Read my plate</button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={onText} className={styles.textForm}>
              <div className="field">
                <label htmlFor={ids.text}>What did you eat?</label>
                <textarea id={ids.text} value={text} onChange={e => setText(e.target.value)} maxLength={MAX_TEXT} rows={3} placeholder="2 rotis, dal and a katori of curd" disabled={busy} aria-describedby={`${ids.text}-help`} />
                <p className="field-help" id={`${ids.text}-help`}>English or Hinglish is fine. {text.length}/{MAX_TEXT}</p>
              </div>
              <div className={styles.chips} role="group" aria-label="Examples">
                {EXAMPLES.map(ex => (
                  <button key={ex} type="button" className="pill-choice" onClick={() => setText(ex)} disabled={busy}>{ex}</button>
                ))}
              </div>
              {phase === 'loading' ? (
                <div className={styles.loadingInline}>
                  <span className={styles.spinner} aria-hidden="true" />
                  <strong>Reading your meal…</strong>
                  <button type="button" className="btn-secondary" onClick={cancel}>Cancel</button>
                </div>
              ) : (
                <button type="submit" className="btn accent full">Read my meal</button>
              )}
            </form>
          )}
        </>
      )}

      {problem && (
        <div className={styles.problem} role="alert">
          <p>{problem.message}</p>
          <p className="muted">You can always search for foods manually instead.</p>
          <div className={styles.actions}>
            {problem.retry && (mode === 'photo' ? photo : text.trim()) && phase !== 'saving' && (
              <button type="button" className="btn-secondary" onClick={retry}>Try again</button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      )}

      {(phase === 'review' || phase === 'saving') && (
        <section aria-labelledby="ai-review-title">
          <div className={styles.reviewHead}>
            {photo && mode === 'photo' && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={photo.url} alt="Your plate" className={styles.thumb} />
            )}
            <div>
              <h3 id="ai-review-title" ref={reviewRef} tabIndex={-1}>Here’s what AI Assist found</h3>
              <p className="muted">{note ?? 'Portions are estimates. Adjust anything that looks off.'}</p>
            </div>
          </div>

          <ul className={styles.rows}>
            {rows.map(r => {
              const f = r.foodId ? foodsById.get(r.foodId) : undefined;
              const label = f?.name ?? r.name;
              return (
                <li key={r.key} className={styles.row}>
                  <div className={styles.rowTop}>
                    <FoodTile icon={f?.icon ?? 'bowl'} />
                    <div className={styles.rowInfo}>
                      <strong>{f ? f.name : `“${r.name}”`}</strong>
                      <small>
                        {f ? `${fmtQ(r.quantity)} ${f.unit} · ${Math.round(f.kcal * r.quantity)} kcal` : 'Not in the food list yet: pick the closest food'}
                      </small>
                      <span className={styles.flags}>
                        {!f && <span className="chip warn">Pick a food</span>}
                        {f && r.confidence < LOW_CONFIDENCE && <span className="chip warn">Not sure: check this</span>}
                        {f && r.matchedBy === 'name' && r.confidence >= LOW_CONFIDENCE && <span className="chip">Matched “{r.name}”</span>}
                      </span>
                    </div>
                    <button type="button" className="btn-icon" onClick={() => remove(r.key)} aria-label={`Remove ${label}`} disabled={phase === 'saving'}>
                      <Icon name="trash" size="sm" />
                    </button>
                  </div>

                  {f && (
                    <button type="button" className="btn-text" onClick={() => update(r.key, { picking: !r.picking })} aria-expanded={r.picking}>
                      {r.picking ? 'Keep this food' : 'Change food'}
                    </button>
                  )}
                  {r.picking && (
                    <FoodPicker foods={foods} initial={r.name} label={`Search foods for ${r.name}`} onPick={food => update(r.key, { foodId: food.id, picking: false, matchedBy: 'id', confidence: 1 })} />
                  )}

                  <div className={styles.controls}>
                    <div className={styles.stepper} role="group" aria-label={`Servings of ${label}`}>
                      <button type="button" className="btn-icon" onClick={() => update(r.key, { quantity: stepQ(r.quantity, -1) })} disabled={r.quantity <= 0.25 || phase === 'saving'} aria-label={`Less ${label}`}><Icon name="minus" size="sm" /></button>
                      <output aria-live="polite">{fmtQ(r.quantity)} <span>{f?.unit ?? 'serving'}</span></output>
                      <button type="button" className="btn-icon" onClick={() => update(r.key, { quantity: stepQ(r.quantity, 1) })} disabled={r.quantity >= 20 || phase === 'saving'} aria-label={`More ${label}`}><Icon name="plus" size="sm" /></button>
                    </div>
                    <select value={r.meal} onChange={e => update(r.key, { meal: e.target.value as Meal })} aria-label={`Meal for ${label}`} className={styles.mealSelect} disabled={phase === 'saving'}>
                      {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>

          {!rows.length && <p className="note">Nothing left to log. Close this, or try again with another {mode === 'photo' ? 'photo' : 'description'}.</p>}

          {mode === 'photo' && photo && (
            <label htmlFor={ids.keep} className={styles.keep}>
              <input id={ids.keep} type="checkbox" checked={keepPhoto} onChange={e => setKeepPhoto(e.target.checked)} disabled={phase === 'saving'} />
              Save this photo with the entries (only you can see it)
            </label>
          )}

          <div className={styles.foot}>
            <p className={styles.total}>
              {unmatched ? `Pick a food for ${unmatched} ${unmatched === 1 ? 'item' : 'items'} to continue` : `About ${totalKcal} kcal`}
            </p>
            <button type="button" className="btn accent full" onClick={save} disabled={!rows.length || unmatched > 0 || phase === 'saving'}>
              {phase === 'saving' ? 'Saving…' : `Log ${rows.length} ${rows.length === 1 ? 'food' : 'foods'}`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
