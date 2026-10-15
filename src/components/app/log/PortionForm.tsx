'use client';
import { useState, type FormEvent } from 'react';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { MEALS, nutrition, type Meal } from '@/lib/nutrition';
import { dec, fmt } from './clientDate';
import { useDiary, type SheetView } from './DiaryProvider';
import s from './log.module.css';

type PortionView = Extract<SheetView, { kind: 'portion' }>;
type Measure = 'serving' | 'grams';

const MAX_SERVINGS = 100;

export function PortionForm({ view, onDone }: { view: PortionView; onDone: () => void }) {
  const { addPortion, editEntry } = useDiary();
  const { food, entry } = view;
  const [measure, setMeasure] = useState<Measure>('serving');
  const [amount, setAmount] = useState(String(entry?.quantity ?? 1));
  const [meal, setMeal] = useState<Meal>(view.meal);
  const [error, setError] = useState('');

  const n = Number(amount);
  const servings = measure === 'serving' ? n : food.grams > 0 ? n / food.grams : NaN;
  const valid = Number.isFinite(servings) && servings > 0 && servings <= MAX_SERVINGS;
  const preview = nutrition(food, valid ? servings : 0);
  const step = measure === 'serving' ? 0.5 : 10;

  const switchMeasure = (next: Measure) => {
    if (next === measure) return;
    if (Number.isFinite(n) && n > 0) {
      setAmount(next === 'grams' ? String(Math.round(n * food.grams)) : dec(n / food.grams));
    }
    setMeasure(next);
  };
  const bump = (dir: 1 | -1) => {
    const base = Number.isFinite(n) ? n : 0;
    const next = Math.max(step, Math.round((base + dir * step) / step) * step);
    setAmount(dec(next));
    setError('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setError(measure === 'serving' ? `Enter a portion above 0, up to ${MAX_SERVINGS} servings.` : 'Enter grams above 0.');
      return;
    }
    const q = Math.round(servings * 100) / 100;
    if (entry) editEntry(entry, q, meal);
    else addPortion(food, meal, q);
    onDone();
  };

  return (
    <form id="portion-form" onSubmit={submit} noValidate>
      <div className={s.detailHero}>
        <FoodTile icon={food.icon} />
        <div>
          <h3>{food.name}</h3>
          <p>1 {food.unit} = {fmt(food.grams)} g</p>
        </div>
      </div>

      <div className={s.detailMacros} aria-live="polite">
        <div><strong>{fmt(preview.kcal)}</strong><small>kcal</small></div>
        <div><strong>{fmt(preview.p)}<span>g</span></strong><small>Protein</small></div>
        <div><strong>{fmt(preview.c)}<span>g</span></strong><small>Carbs</small></div>
        <div><strong>{fmt(preview.f)}<span>g</span></strong><small>Fat</small></div>
      </div>

      <div className="field">
        <span className="field-label" id="measure-label">Measure</span>
        <div className="seg" role="group" aria-labelledby="measure-label">
          <button type="button" aria-pressed={measure === 'serving'} onClick={() => switchMeasure('serving')}>{food.unit}</button>
          <button type="button" aria-pressed={measure === 'grams'} onClick={() => switchMeasure('grams')}>Grams</button>
        </div>
      </div>

      <div className={s.portionFields}>
        <div className="field">
          <label htmlFor="portion-qty">{measure === 'serving' ? `How many ${food.unit}s` : 'Grams'}</label>
          <div className={s.stepper}>
            <button type="button" onClick={() => bump(-1)} aria-label={`Decrease by ${step}${measure === 'grams' ? ' g' : ''}`}>
              <Icon name="minus" size="sm" />
            </button>
            <input
              id="portion-qty"
              data-autofocus
              type="number"
              inputMode="decimal"
              min={measure === 'serving' ? 0.01 : 1}
              step="any"
              value={amount}
              aria-invalid={!!error}
              aria-describedby="portion-error"
              onChange={e => { setAmount(e.target.value); setError(''); }}
            />
            <button type="button" onClick={() => bump(1)} aria-label={`Increase by ${step}${measure === 'grams' ? ' g' : ''}`}>
              <Icon name="plus" size="sm" />
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="portion-meal">{entry ? 'Meal' : 'Add to'}</label>
          <select id="portion-meal" value={meal} onChange={e => setMeal(e.target.value as Meal)}>
            {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <p id="portion-error" className="error-text" role="alert">{error}</p>
      <p className="note">
        {food.custom ? 'Your own nutrition values.' : 'Estimated nutrition. Home recipes vary, so log oil and extras separately when you can.'}
      </p>
    </form>
  );
}

export function PortionFooter({ view, onDone }: { view: PortionView; onDone: () => void }) {
  const { removeEntry } = useDiary();
  const { entry } = view;
  return (
    <>
      <button type="submit" form="portion-form" className="btn accent full">
        {entry ? 'Save changes' : 'Add to diary'} <Icon name="check" size="sm" />
      </button>
      {entry && (
        <button
          type="button"
          className={`btn-text ${s.removeBtn}`}
          onClick={() => { removeEntry(entry); onDone(); }}
        >
          <Icon name="trash" size="sm" /> Remove food
        </button>
      )}
    </>
  );
}
