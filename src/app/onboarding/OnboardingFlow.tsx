'use client';
import Image from 'next/image';
import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { ACTIVITY, GOALS, recommend, type Activity, type Diet, type Goal, type Sex } from '@/lib/nutrition';
import { Icon } from '@/components/ui/Icon';
import { DIETS, bmiBand } from '@/components/app/insights/insights';
import { RESTRICTIONS, type Restriction } from '@/lib/restrictions';
import { BODY_RANGES, TARGET_KEYS, TARGET_RANGES, rangeError, type TargetKey } from '@/components/app/insights/schemas';
import { completeOnboarding } from './actions';
import s from './onboarding.module.css';

export type Draft = {
  goal: Goal | null; sex: Sex | null; age: string; height: string; weight: string; activity: Activity | null;
  diet: Diet; restrictions: Restriction[];
  /** Target inputs as typed. Null until the user reaches the last step. */
  targets: Record<TargetKey, string> | null;
  /** Body details the targets were computed from; when they change, targets are recomputed. */
  basis: string | null;
};

const STEPS = ['welcome', 'goal', 'body', 'activity', 'food', 'targets'] as const;
type Step = (typeof STEPS)[number];
const CUISINES: Record<Step, { image: string; label: string }> = {
  welcome: { image: 'indian', label: 'Indian · A little of everything' },
  goal: { image: 'japanese', label: 'Japanese · Balance in a bowl' },
  body: { image: 'mediterranean', label: 'Mediterranean · Fresh and familiar' },
  activity: { image: 'mexican', label: 'Mexican · Full of colour' },
  food: { image: 'thai', label: 'Thai · Find your flavour' },
  targets: { image: 'italian', label: 'Italian · Make it your own' },
};
const TITLES: Record<Step, string> = { welcome: 'Welcome', goal: 'Your goal', body: 'Your body', activity: 'How you move', food: 'How you eat', targets: 'Your targets' };

type BodyField = 'age' | 'height' | 'weight';
const bodyError = (d: Draft, k: BodyField) => {
  const r = BODY_RANGES[k];
  return rangeError(d[k], r.min, r.max, r.label, r.unit, { int: k === 'age' });
};

export function OnboardingFlow({ firstName, initial }: { firstName: string | null; initial: Draft }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [adjust, setAdjust] = useState(false);
  const [serverError, setServerError] = useState('');
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const focusedStep = useRef(step);
  const current = STEPS[step];

  // Move focus to the heading when the step actually changes, for screen readers.
  // Comparing against the last focused step (not a first-render flag) keeps the
  // initial step from being focused under React Strict Mode's double-mount, which
  // would otherwise draw a focus ring on the welcome heading at load.
  useEffect(() => {
    if (focusedStep.current === step) return;
    focusedStep.current = step;
    heading.current?.focus();
  }, [step]);

  const patch = (p: Partial<Draft>) => setD(prev => ({ ...prev, ...p }));
  const body = d.goal && d.sex && d.activity && !bodyError(d, 'age') && !bodyError(d, 'height') && !bodyError(d, 'weight')
    ? { goal: d.goal, sex: d.sex, activity: d.activity, age: Number(d.age), height: Number(d.height), weight: Number(d.weight) }
    : null;
  const rec = body ? recommend(body) : null;

  function focusFirstInvalid(keys: string[]) {
    requestAnimationFrame(() => {
      const el = keys.map(k => document.getElementById(`ob-${k}`)).find(Boolean);
      el?.focus();
    });
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (current === 'goal' && !d.goal) e.goal = 'Pick the goal that fits you best.';
    if (current === 'body') {
      if (!d.sex) e.sex = 'Pick one: it changes the calorie estimate.';
      for (const k of ['age', 'height', 'weight'] as const) { const m = bodyError(d, k); if (m) e[k] = k === 'age' && Number(d.age) < 18 && d.age !== '' ? 'Shoku is for adults 18 and over.' : m; }
    }
    if (current === 'activity' && !d.activity) e.activity = 'Pick the closest match. You can change it later.';
    if (current === 'targets' && d.targets) {
      for (const k of TARGET_KEYS) {
        const r = TARGET_RANGES[k];
        const m = rangeError(d.targets[k], r.min, r.max, r.label, r.unit, { int: true });
        if (m) e[`t-${k}`] = m;
      }
    }
    return e;
  }

  function next(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setTouched(t => ({ ...t, ...Object.fromEntries(Object.keys(e).map(k => [k, true])) }));
      if (e['t-kcal'] || e['t-p'] || e['t-c'] || e['t-f'] || e['t-water']) setAdjust(true);
      focusFirstInvalid(Object.keys(e));
      return;
    }
    if (current === 'targets') return finish();
    const to = step + 1;
    if (STEPS[to] === 'targets' && rec) {
      const basis = JSON.stringify(body);
      if (!d.targets || d.basis !== basis) {
        patch({ targets: { kcal: String(rec.kcal), p: String(rec.p), c: String(rec.c), f: String(rec.f), water: String(rec.water) }, basis });
      }
    }
    setStep(to);
  }

  function back() {
    setErrors({});
    setStep(n => Math.max(0, n - 1));
  }

  function finish() {
    if (!body || !d.targets) return;
    setServerError('');
    const t = d.targets;
    start(async () => {
      const res = await completeOnboarding({
        ...body, diet: d.diet, restrictions: d.restrictions,
        targets: { kcal: Number(t.kcal), p: Number(t.p), c: Number(t.c), f: Number(t.f), water: Number(t.water) },
      });
      if (res && !res.ok) setServerError(res.error);
    });
  }

  const fieldError = (k: string) => (touched[k] ? errors[k] ?? '' : '');
  const liveCheck = (k: BodyField, value: string) => {
    if (!touched[k]) return;
    const r = BODY_RANGES[k];
    setErrors(e => ({ ...e, [k]: rangeError(value, r.min, r.max, r.label, r.unit, { int: k === 'age' }) }));
  };

  return (
    <main className={s.shell} data-opaque-page data-cuisine={CUISINES[current].image}>
      <div className={s.photo} aria-hidden="true">
        <Image key={current} src={`/img/onboarding/${CUISINES[current].image}.webp`} alt="" fill loading="eager" quality={60} sizes="(max-aspect-ratio: 3/2) 150vh, 100vw" />
      </div>
      <p className={s.cuisine} aria-hidden="true">{CUISINES[current].label}</p>
      <div className={s.top}>
        <button type="button" className="btn-icon" onClick={back} aria-label="Back to the previous step" hidden={step === 0}>
          <Icon name="back" />
        </button>
        <div className={s.steps}>
          <p className={s.stepLabel}>Step {step + 1} of {STEPS.length}<span className="sr-only">: {TITLES[current]}</span></p>
          <ol className={s.dots} aria-hidden="true">
            {STEPS.map((k, i) => <li key={k} data-state={i < step ? 'done' : i === step ? 'now' : 'next'} />)}
          </ol>
        </div>
        <span className={s.brand} aria-hidden="true">Shoku</span>
      </div>

      <form className={s.card} onSubmit={next} noValidate aria-labelledby="ob-title">
        {current === 'welcome' && (
          <StepBody title={`Hi ${firstName ?? 'there'}. Let’s set up your meals.`} headingRef={heading}>
            <ul className={s.promises}>
              <li><Icon name="bolt" /><span><strong>Log Indian plates in seconds.</strong> Roti, dal, poha and biryani are already in the food list.</span></li>
              <li><Icon name="plate" /><span><strong>See what your day still needs.</strong> Food groups and targets scaled to you.</span></li>
              <li><Icon name="star" /><span><strong>Three meals, one day.</strong> Log three meals and the day counts toward your streak.</span></li>
            </ul>
            <p className={s.fine}>Six quick steps, about a minute. Shoku is built for adults 18 and over.</p>
          </StepBody>
        )}

        {current === 'goal' && (
          <StepBody title="What are you training for?" headingRef={heading} sub="This sets your calories and protein. Switch any time.">
            <ChoiceGroup<Goal> value={d.goal} options={Object.keys(GOALS) as Goal[]}
              onChange={g => { patch({ goal: g }); setErrors(e => ({ ...e, goal: '' })); }}
              groupClass={s.bigChoices} optionClass={s.bigChoice} label="Goal" id="ob-goal"
              describedBy={errors.goal ? 'ob-goal-err' : undefined}
              render={g => <><strong>{GOALS[g].label}</strong><span>{GOALS[g].blurb}</span></>} />
            <p className="error-text" id="ob-goal-err" role="alert">{errors.goal}</p>
          </StepBody>
        )}

        {current === 'body' && (
          <StepBody title="The basics" headingRef={heading} sub="Used only to estimate what your body needs. Never shared.">
            <div className="field">
              <span className="field-label" id="ob-sex-label">Calculate my energy as</span>
              <ChoiceGroup<Sex> value={d.sex} options={['female', 'male'] as Sex[]}
                onChange={x => { patch({ sex: x }); setErrors(e => ({ ...e, sex: '' })); }}
                groupClass={s.pills} optionClass="pill-choice" labelId="ob-sex-label" id="ob-sex"
                render={x => (x === 'female' ? 'Female' : 'Male')} />
              <p className="error-text" role="alert">{errors.sex}</p>
            </div>
            <div className={s.bodyGrid}>
              {(['age', 'height', 'weight'] as const).map(k => {
                const r = BODY_RANGES[k];
                const err = fieldError(k);
                return (
                  <div className="field" key={k}>
                    <label htmlFor={`ob-${k}`}>{r.label} <span className="muted">({r.unit})</span></label>
                    <input
                      id={`ob-${k}`} name={k} type="number" inputMode={k === 'weight' ? 'decimal' : 'numeric'}
                      min={r.min} max={r.max} step={k === 'weight' ? 0.1 : 1} value={d[k]} required
                      autoComplete="off" aria-invalid={!!err || undefined} aria-describedby={`ob-${k}-help`}
                      onChange={e => { patch({ [k]: e.target.value } as Partial<Draft>); liveCheck(k, e.target.value); }}
                      onBlur={e => { setTouched(t => ({ ...t, [k]: true })); const m = bodyError({ ...d, [k]: e.target.value }, k); setErrors(x => ({ ...x, [k]: m })); }}
                    />
                    <p className={err ? 'error-text' : 'field-help'} id={`ob-${k}-help`}>{err || `${r.min}–${r.max} ${r.unit}`}</p>
                  </div>
                );
              })}
            </div>
          </StepBody>
        )}

        {current === 'activity' && (
          <StepBody title="How active is a normal week?" headingRef={heading} sub="Count workouts, sport and active work. Be honest: you can change it later.">
            <ChoiceGroup<Activity> value={d.activity} options={Object.keys(ACTIVITY) as Activity[]}
              onChange={a => { patch({ activity: a }); setErrors(e => ({ ...e, activity: '' })); }}
              groupClass={s.listChoices} optionClass={s.bigChoice} label="Activity level" id="ob-activity"
              render={a => { const [title, detail] = ACTIVITY[a].label.split(' · '); return <><strong>{title}</strong>{detail && <span>{detail}</span>}</>; }} />
            <p className="error-text" role="alert">{errors.activity}</p>
          </StepBody>
        )}

        {current === 'food' && (
          <StepBody title="What’s on your plate?" headingRef={heading} sub="We use this to suggest foods and build your plan.">
            <ChoiceGroup<Diet> value={d.diet} options={DIETS.map(x => x.key)}
              onChange={k => patch({ diet: k })}
              groupClass={s.bigChoices} optionClass={s.bigChoice} label="Food style"
              render={k => { const x = DIETS.find(o => o.key === k)!; return <><strong>{x.label}</strong><span>{x.blurb}</span></>; }} />
            <div className="field" style={{ marginTop: 24 }}>
              <span className="field-label" id="ob-restr-label">Anything to skip? <span className="muted">(optional, pick any)</span></span>
              <div className={s.pills} role="group" aria-labelledby="ob-restr-label">
                {RESTRICTIONS.map(r => {
                  const on = d.restrictions.includes(r.slug);
                  return (
                    <button key={r.slug} type="button" className="pill-choice" aria-pressed={on}
                      onClick={() => patch({ restrictions: on ? d.restrictions.filter(x => x !== r.slug) : [...d.restrictions, r.slug] })}>
                      {r.label}
                    </button>
                  );
                })}
              </div>
              <p className="field-help">Suggestions skip foods that clearly clash. Recipes vary, so check what’s in your bowl.</p>
            </div>
          </StepBody>
        )}

        {current === 'targets' && rec && d.targets && (
          <StepBody title="Your daily targets" headingRef={heading} sub={`Built for ${GOALS[d.goal ?? 'fit'].label.toLowerCase()}. ${GOALS[d.goal ?? 'fit'].blurb}`}>
            <div className={s.kcal}>
              <span className="display">{Number(d.targets.kcal).toLocaleString('en-IN')}</span>
              <span className={s.kcalUnit}>kcal a day</span>
            </div>
            <dl className={s.macroGrid}>
              {(['p', 'c', 'f', 'water'] as const).map(k => (
                <div key={k}>
                  <dt>{TARGET_RANGES[k].label}</dt>
                  <dd><span className="display">{Number(d.targets![k]).toLocaleString('en-IN')}</span> {TARGET_RANGES[k].unit}</dd>
                </div>
              ))}
            </dl>
            <p className={s.explain}>
              We estimate what you burn from your age, height, weight and activity, then adjust for your goal.
              Protein is 0.83 g per kg of body weight (1.6 g when building muscle), fat is about 30% of energy
              and carbs fill the rest.
            </p>

            <button type="button" className="btn-text" aria-expanded={adjust} aria-controls="ob-adjust" onClick={() => setAdjust(a => !a)}>
              <Icon name="sliders" size="sm" /> {adjust ? 'Hide adjustments' : 'Adjust targets'}
            </button>
            <div id="ob-adjust" hidden={!adjust} className={s.adjust}>
              {TARGET_KEYS.map(k => {
                const r = TARGET_RANGES[k];
                const err = errors[`t-${k}`] ?? '';
                return (
                  <div className="field" key={k}>
                    <label htmlFor={`ob-t-${k}`}>{r.label} <span className="muted">({r.unit})</span></label>
                    <input id={`ob-t-${k}`} type="number" inputMode="numeric" min={r.min} max={r.max ?? undefined} step={1} value={d.targets![k]}
                      aria-invalid={!!err || undefined} aria-describedby={`ob-t-${k}-help`}
                      onChange={e => {
                        const v = e.target.value;
                        setD(prev => ({ ...prev, targets: { ...prev.targets!, [k]: v } }));
                        setErrors(x => ({ ...x, [`t-${k}`]: rangeError(v, r.min, r.max, r.label, r.unit, { int: true }) }));
                      }} />
                    <p className={err ? 'error-text' : 'field-help'} id={`ob-t-${k}-help`}>{err || `${r.max === null ? `At least ${r.min}` : `${r.min}–${r.max}`} ${r.unit}`}</p>
                  </div>
                );
              })}
              <button type="button" className="btn-secondary" onClick={() => { patch({ targets: { kcal: String(rec.kcal), p: String(rec.p), c: String(rec.c), f: String(rec.f), water: String(rec.water) } }); setErrors({}); }}>
                Reset to recommended
              </button>
            </div>

            <div className={s.bmi}>
              <span className="label">BMI</span>
              <strong className="display">{rec.bmi.toFixed(1)}</strong>
              <span>{bmiBand(rec.bmi)}</span>
            </div>
            <p className="fine-print">
              For Indian adults we use lower BMI cut-offs: 23 and 25 instead of the usual 25 and 30. BMI is a rough screen, not a diagnosis.
            </p>
            <p className="note" style={{ marginTop: 16 }}>
              These are general estimates for healthy adults. Pregnant, breastfeeding or managing a condition? Use targets from your doctor or dietitian.
            </p>
            <p className="error-text" role="alert" style={{ marginTop: 12 }}>{serverError}</p>
          </StepBody>
        )}

        <div className={s.actions}>
          {step > 0 && <button type="button" className="btn-secondary" onClick={back}>Back</button>}
          <button type="submit" className="btn accent big" disabled={pending} aria-busy={pending || undefined}>
            {current === 'welcome' ? 'Let’s go' : current === 'targets' ? (pending ? 'Saving…' : 'Start tracking') : 'Continue'}
            <Icon name="arrow" size="sm" />
          </button>
        </div>
      </form>
    </main>
  );
}

function StepBody({ title, sub, headingRef, children }: { title: string; sub?: string; headingRef: RefObject<HTMLHeadingElement | null>; children: ReactNode }) {
  return (
    <>
      <h1 id="ob-title" ref={headingRef} tabIndex={-1}>{title}</h1>
      {sub && <p className={s.sub}>{sub}</p>}
      <div className={s.content}>{children}</div>
    </>
  );
}

/** One-of-N choice as a real ARIA radiogroup: roving tab stop, arrow/Home/End selection, Tab enters at the chosen option. */
function ChoiceGroup<T extends string>({ value, options, onChange, groupClass, optionClass, label, labelId, id, describedBy, render }: {
  value: T | null; options: readonly T[]; onChange: (v: T) => void;
  groupClass: string; optionClass: string; label?: string; labelId?: string; id?: string; describedBy?: string;
  render: (v: T) => ReactNode;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = value ? options.indexOf(value) : -1;
  const pick = (i: number) => { const n = (i + options.length) % options.length; onChange(options[n]); refs.current[n]?.focus(); };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); pick(i + 1); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); pick(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); pick(0); }
    else if (e.key === 'End') { e.preventDefault(); pick(options.length - 1); }
  };
  return (
    <div className={groupClass} role="radiogroup" aria-label={label} aria-labelledby={labelId} id={id} aria-describedby={describedBy} tabIndex={-1}>
      {options.map((v, i) => (
        <button key={v} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={value === v}
          tabIndex={value === v || (selected === -1 && i === 0) ? 0 : -1} className={optionClass}
          onClick={() => onChange(v)} onKeyDown={e => onKeyDown(e, i)}>
          {render(v)}
        </button>
      ))}
    </div>
  );
}
