'use client';
import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/Toast';
import { createCustomFood } from '@/lib/data/diary';
import type { Diet, Food } from '@/lib/nutrition';
import s from './log.module.css';

const MACROS = [
  ['kcal', 'Calories (kcal)', 10000],
  ['p', 'Protein (g)', 1000],
  ['c', 'Carbs (g)', 2000],
  ['f', 'Fat (g)', 1000],
] as const;

export function CustomFoodForm({ initialName, onCreated }: { initialName: string; onCreated: (food: Food) => void }) {
  const toast = useToast();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => Number(fd.get(k) ?? '');
    const input = {
      name: String(fd.get('name') ?? '').trim(),
      unit: String(fd.get('unit') ?? '').trim(),
      grams: num('grams'),
      kcal: num('kcal'),
      p: num('p'),
      c: num('c'),
      f: num('f'),
      diet: (String(fd.get('diet') ?? 'veg') as Diet),
    };
    if (!input.name) return setError('Enter a food name.');
    if (String(fd.get('kcal') ?? '').trim() === '') return setError('Enter the calories per serving.');
    if (!(input.grams > 0)) return setError('Serving weight must be above 0.');
    if (![input.kcal, input.p, input.c, input.f].every(v => Number.isFinite(v) && v >= 0)) return setError('Calories and macros must be 0 or more.');
    setError('');
    setPending(true);
    const r = await createCustomFood(input);
    setPending(false);
    if (!r.ok) { setError(r.error); return; }
    toast(`Saved ${input.name}. Now pick your portion.`);
    onCreated({ id: r.data.id, category: 'Custom', icon: 'bowl', fibre: 0, aliases: '', groups: {}, custom: true, ...input });
  };

  return (
    <form id="custom-food-form" onSubmit={submit} noValidate aria-busy={pending}>
      <p className="muted" style={{ marginBottom: 16 }}>For your own recipe, a packaged food or a quick calorie entry.</p>
      <div className="field">
        <label htmlFor="custom-name">Food name</label>
        <input id="custom-name" name="name" data-autofocus maxLength={100} required defaultValue={initialName} placeholder="e.g. Mum’s rajma" />
      </div>
      <div className={s.portionFields}>
        <div className="field">
          <label htmlFor="custom-unit">Serving name</label>
          <input id="custom-unit" name="unit" maxLength={35} required defaultValue="katori" placeholder="katori, roti, cup" />
        </div>
        <div className="field">
          <label htmlFor="custom-grams">Serving weight (g)</label>
          <input id="custom-grams" name="grams" type="number" inputMode="decimal" min={1} max={5000} required defaultValue={150} />
        </div>
      </div>
      <div className={s.macroInputs}>
        {MACROS.map(([k, label, max]) => (
          <div className="field" key={k}>
            <label htmlFor={`custom-${k}`}>{label}</label>
            <input id={`custom-${k}`} name={k} type="number" inputMode="decimal" min={0} max={max} step="any" required defaultValue={k === 'kcal' ? undefined : 0} placeholder={k === 'kcal' ? 'e.g. 180' : undefined} />
          </div>
        ))}
      </div>
      <div className="field">
        <label htmlFor="custom-diet">Type</label>
        <select id="custom-diet" name="diet" defaultValue="veg">
          <option value="veg">Vegetarian</option>
          <option value="egg">Contains egg</option>
          <option value="nonveg">Non-vegetarian</option>
        </select>
      </div>
      <p className="error-text" role="alert">{error}</p>
      <p className="note">Enter values per serving from your recipe or the label. Unknown macros can stay at 0.</p>
    </form>
  );
}
