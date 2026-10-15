'use client';
import { useState, useTransition, type FormEvent } from 'react';
import { ACTIVITY, GOALS, type Activity, type Diet, type Goal, type Sex, type Targets } from '@/lib/nutrition';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { applyRecommendedTargets, saveTargets } from '@/components/app/insights/actions';
import { DIETS, RESTRICTIONS, type Restriction } from '@/components/app/insights/insights';
import { BODY_RANGES, TARGET_KEYS, TARGET_RANGES, rangeError, type TargetKey } from '@/components/app/insights/schemas';
import { saveProfile } from './actions';
import s from './profile.module.css';

export type BodyValues = { goal: Goal; sex: Sex | null; age: string; height: string; weight: string; activity: Activity | null; diet: Diet; restrictions: Restriction[] };

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

export function BodyForm({ initial }: { initial: BodyValues }) {
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<'sex' | 'age' | 'height' | 'weight' | 'activity' | 'form', string>>>({});
  const [offer, setOffer] = useState<Targets | null>(null);
  const [pending, start] = useTransition();
  const patch = (p: Partial<BodyValues>) => setV(prev => ({ ...prev, ...p }));

  const check = (k: 'age' | 'height' | 'weight', value: string) => {
    const r = BODY_RANGES[k];
    return rangeError(value, r.min, r.max, r.label, r.unit, { int: k === 'age' });
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs = {
      age: check('age', v.age), height: check('height', v.height), weight: check('weight', v.weight),
      sex: v.sex ? '' : 'Pick one: it changes the calorie estimate.', activity: v.activity ? '' : 'Pick an activity level.',
    };
    setErrors(errs);
    const first = (['sex', 'age', 'height', 'weight', 'activity'] as const).find(k => errs[k]);
    if (first) { document.getElementById(`pf-${first}`)?.focus(); return; }
    start(async () => {
      const res = await saveProfile({
        goal: v.goal, sex: v.sex!, age: Number(v.age), height: Number(v.height), weight: Number(v.weight),
        activity: v.activity!, diet: v.diet, restrictions: v.restrictions,
      });
      if (!res.ok) { setErrors({ form: res.error }); return; }
      setOffer(res.data.differs ? res.data.recommended : null);
      toast(res.data.differs ? 'Profile saved. Your recommendation changed: see below.' : 'Profile saved.');
    });
  }

  const apply = () => start(async () => {
    const res = await applyRecommendedTargets();
    if (!res.ok) { toast(res.error); return; }
    setOffer(null);
    const prev = res.data.previous;
    toast('Targets updated.', prev ? { undo: async () => { const r = await saveTargets(prev); if (!r.ok) toast(r.error); } } : undefined);
  });

  return (
    <form onSubmit={submit} noValidate aria-labelledby="body-title" className={`panel panel-pad ${s.card}`}>
      <h2 id="body-title">Goal and body</h2>
      <p className={s.sub}>We use these to estimate your targets. Change them any time.</p>

      <fieldset className={s.fieldset}>
        <legend className="field-label">Goal</legend>
        <div className={s.pills}>
          {(Object.keys(GOALS) as Goal[]).map(g => (
            <button key={g} type="button" className="pill-choice" aria-pressed={v.goal === g} onClick={() => patch({ goal: g })}>{GOALS[g].label}</button>
          ))}
        </div>
      </fieldset>

      <fieldset className={s.fieldset}>
        <legend className="field-label">Calculate my energy as</legend>
        <div className={s.pills} id="pf-sex" tabIndex={-1}>
          {(['female', 'male'] as Sex[]).map(x => (
            <button key={x} type="button" className="pill-choice" aria-pressed={v.sex === x} onClick={() => { patch({ sex: x }); setErrors(e => ({ ...e, sex: '' })); }}>
              {x === 'female' ? 'Female' : 'Male'}
            </button>
          ))}
        </div>
        <p className="error-text" role="alert">{errors.sex}</p>
      </fieldset>

      <div className={s.grid3}>
        {(['age', 'height', 'weight'] as const).map(k => {
          const r = BODY_RANGES[k];
          const err = errors[k] ?? '';
          return (
            <div className="field" key={k}>
              <label htmlFor={`pf-${k}`}>{r.label} <span className="muted">({r.unit})</span></label>
              <input id={`pf-${k}`} type="number" inputMode={k === 'weight' ? 'decimal' : 'numeric'} min={r.min} max={r.max} step={k === 'weight' ? 0.1 : 1}
                value={v[k]} aria-invalid={!!err || undefined} aria-describedby={`pf-${k}-help`}
                onChange={e => { patch({ [k]: e.target.value } as Partial<BodyValues>); if (errors[k]) setErrors(x => ({ ...x, [k]: check(k, e.target.value) })); }}
                onBlur={e => setErrors(x => ({ ...x, [k]: check(k, e.target.value) }))} />
              <p className={err ? 'error-text' : 'field-help'} id={`pf-${k}-help`}>{err || `${r.min}–${r.max} ${r.unit}`}</p>
            </div>
          );
        })}
      </div>

      <div className="field">
        <label htmlFor="pf-activity">Activity</label>
        <select id="pf-activity" value={v.activity ?? ''} aria-invalid={!!errors.activity || undefined}
          onChange={e => { patch({ activity: e.target.value as Activity }); setErrors(x => ({ ...x, activity: '' })); }}>
          <option value="" disabled>Pick one</option>
          {(Object.keys(ACTIVITY) as Activity[]).map(a => <option key={a} value={a}>{ACTIVITY[a].label}</option>)}
        </select>
        <p className="error-text" role="alert">{errors.activity}</p>
      </div>

      <fieldset className={s.fieldset}>
        <legend className="field-label">Food style</legend>
        <div className={s.pills}>
          {DIETS.map(x => (
            <button key={x.key} type="button" className="pill-choice" aria-pressed={v.diet === x.key} onClick={() => patch({ diet: x.key })}>{x.label}</button>
          ))}
        </div>
      </fieldset>

      <fieldset className={s.fieldset}>
        <legend className="field-label">Skip in suggestions <span className="muted">(optional)</span></legend>
        <div className={s.pills}>
          {RESTRICTIONS.map(r => {
            const on = v.restrictions.includes(r.slug);
            return (
              <button key={r.slug} type="button" className="pill-choice" aria-pressed={on}
                onClick={() => patch({ restrictions: on ? v.restrictions.filter(x => x !== r.slug) : [...v.restrictions, r.slug] })}>{r.label}</button>
            );
          })}
        </div>
        <p className="field-help">Suggestions skip foods that clearly clash. Recipes vary, so check what’s in your bowl.</p>
      </fieldset>

      <p className="error-text" role="alert">{errors.form}</p>
      <button type="submit" className="btn accent" disabled={pending} aria-busy={pending || undefined}>{pending ? 'Saving…' : 'Save profile'}</button>

      {offer && (
        <div className={s.offer} role="region" aria-label="New recommendation">
          <p><strong>New recommendation:</strong> {fmt(offer.kcal)} kcal · {fmt(offer.p)} g protein · {fmt(offer.c)} g carbs · {fmt(offer.f)} g fat · {fmt(offer.water)} ml water</p>
          <div className={s.offerActions}>
            <button type="button" className="btn-secondary" onClick={apply} disabled={pending}><Icon name="check" size="sm" /> Use these targets</button>
            <button type="button" className="btn-text" onClick={() => setOffer(null)}>Keep mine</button>
          </div>
        </div>
      )}
    </form>
  );
}

export function TargetsForm({ initial, recommended }: { initial: Targets; recommended: Targets | null }) {
  const toast = useToast();
  const toStrings = (t: Targets) => Object.fromEntries(TARGET_KEYS.map(k => [k, String(t[k])])) as Record<TargetKey, string>;
  const [v, setV] = useState(() => toStrings(initial));
  const [errors, setErrors] = useState<Partial<Record<TargetKey | 'form', string>>>({});
  const [pending, start] = useTransition();
  const err = (k: TargetKey, value: string) => { const r = TARGET_RANGES[k]; return rangeError(value, r.min, r.max, r.label, r.unit, { int: true }); };

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs = Object.fromEntries(TARGET_KEYS.map(k => [k, err(k, v[k])])) as Record<TargetKey, string>;
    setErrors(errs);
    const first = TARGET_KEYS.find(k => errs[k]);
    if (first) { document.getElementById(`tg-${first}`)?.focus(); return; }
    const next = Object.fromEntries(TARGET_KEYS.map(k => [k, Number(v[k])])) as Targets;
    start(async () => {
      const res = await saveTargets(next);
      if (!res.ok) { setErrors({ form: res.error }); return; }
      toast('Targets saved.', { undo: async () => { const r = await saveTargets(initial); if (r.ok) setV(toStrings(initial)); else toast(r.error); } });
    });
  }

  return (
    <form id="targets" onSubmit={submit} noValidate aria-labelledby="targets-title" className={`panel panel-pad ${s.card}`}>
      <h2 id="targets-title">Daily targets</h2>
      <p className={s.sub}>Set your own numbers, or start from the recommendation. These are not a prescribed diet.</p>
      <div className={s.gridTargets}>
        {TARGET_KEYS.map(k => {
          const r = TARGET_RANGES[k];
          const e = errors[k] ?? '';
          return (
            <div className="field" key={k}>
              <label htmlFor={`tg-${k}`}>{r.label} <span className="muted">({r.unit})</span></label>
              <input id={`tg-${k}`} type="number" inputMode="numeric" min={r.min} max={r.max} step={1} value={v[k]}
                aria-invalid={!!e || undefined} aria-describedby={`tg-${k}-help`}
                onChange={ev => { const x = ev.target.value; setV(p => ({ ...p, [k]: x })); setErrors(p => ({ ...p, [k]: err(k, x) })); }} />
              <p className={e ? 'error-text' : 'field-help'} id={`tg-${k}-help`}>
                {e || `${r.min}–${r.max}${recommended ? ` · rec. ${fmt(recommended[k])}` : ''}`}
              </p>
            </div>
          );
        })}
      </div>
      <p className="error-text" role="alert">{errors.form}</p>
      <div className={s.offerActions}>
        <button type="submit" className="btn accent" disabled={pending} aria-busy={pending || undefined}>{pending ? 'Saving…' : 'Save targets'}</button>
        {recommended && (
          <button type="button" className="btn-secondary" onClick={() => { setV(toStrings(recommended)); setErrors({}); }}>Fill in recommended</button>
        )}
      </div>
      <p className="fine-print" style={{ marginTop: 14 }}>Pregnant, breastfeeding or managing a condition? Use targets from your doctor or dietitian.</p>
    </form>
  );
}
