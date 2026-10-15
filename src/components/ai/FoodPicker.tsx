'use client';
import { useId, useMemo, useState } from 'react';
import { FoodTile } from '@/components/ui/Icon';
import { normalise, tokens } from '@/lib/ai/match';
import type { Food } from '@/lib/nutrition';
import styles from './ai.module.css';

/** Inline searchable food chooser used to correct or fill an AI suggestion row. */
export function FoodPicker({ foods, initial, label, onPick }: { foods: Food[]; initial: string; label: string; onPick: (f: Food) => void }) {
  const [q, setQ] = useState(initial);
  const id = useId();
  const index = useMemo(() => foods.map(f => ({ f, hay: `${normalise(f.name)} ${normalise(f.aliases ?? '')} ${tokens(`${f.name} ${f.aliases ?? ''}`).join(' ')}` })), [foods]);
  const results = useMemo(() => {
    const words = tokens(q, true);
    const raw = normalise(q);
    if (!raw) return foods.slice(0, 6);
    return index
      .filter(({ hay }) => hay.includes(raw) || (words.length > 0 && words.every(w => hay.includes(w))))
      .slice(0, 6)
      .map(x => x.f);
  }, [q, index, foods]);

  return (
    <div className={styles.picker}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search dal, roti, paneer…" autoComplete="off" />
      {results.length ? (
        <ul className={styles.pickerList} aria-label="Matching foods">
          {results.map(f => (
            <li key={f.id}>
              <button type="button" className={styles.pickerItem} onClick={() => onPick(f)}>
                <FoodTile icon={f.icon} />
                <span>
                  <strong>{f.name}</strong>
                  <small>1 {f.unit} · {Math.round(f.kcal)} kcal</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-help">No match. Try another word, or remove this item and add it from search later.</p>
      )}
    </div>
  );
}
