'use client';
import Image from 'next/image';
import { useMemo } from 'react';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { MEALS, type Food, type Meal } from '@/lib/nutrition';
import { MEAL_IMG, fmt } from './clientDate';
import { useDiary } from './DiaryProvider';
import s from './log.module.css';

export type SearchFilter = 'all' | 'frequent';

/**
 * Ranks foods for a query: exact name, then name starts-with, then a word starts-with, then contains,
 * then alias/category matches. Within a rank, the user's frequent foods come first.
 */
export function rankFoods(foods: Food[], query: string, frequent: string[]): Food[] {
  const q = query.trim().toLowerCase();
  const freq = new Map(frequent.map((id, i) => [id, i]));
  const fr = (f: Food) => freq.get(f.id) ?? Number.MAX_SAFE_INTEGER;
  const scored: { f: Food; score: number }[] = [];
  for (const f of foods) {
    let score = 0;
    if (q) {
      const name = f.name.toLowerCase();
      const extra = `${f.aliases ?? ''} ${f.category ?? ''}`.toLowerCase();
      if (name === q) score = 0;
      else if (name.startsWith(q)) score = 1;
      else if (name.split(/[\s,()-]+/).some(w => w.startsWith(q))) score = 2;
      else if (name.includes(q)) score = 3;
      else if (extra.split(/\s+/).some(w => w.startsWith(q))) score = 4;
      else if (extra.includes(q)) score = 5;
      else continue;
    }
    scored.push({ f, score });
  }
  return scored.sort((a, b) => a.score - b.score || fr(a.f) - fr(b.f) || a.f.name.localeCompare(b.f.name)).map(x => x.f);
}

export function servingLine(f: Food) {
  return `1 ${f.unit} (${fmt(f.grams)} g) · ${fmt(f.kcal)} kcal`;
}

export function FoodSearch({ meal, frequent, query, setQuery, filter, setFilter, vegOnly, setVegOnly, onMeal, onPick, onCustom }: {
  meal: Meal;
  /** Frequent ids frozen when the sheet opened, so results never jump under the pointer after a quick add. */
  frequent: string[];
  query: string;
  setQuery: (q: string) => void;
  filter: SearchFilter;
  setFilter: (f: SearchFilter) => void;
  vegOnly: boolean;
  setVegOnly: (v: boolean) => void;
  onMeal: (m: Meal) => void;
  onPick: (f: Food) => void;
  onCustom: () => void;
}) {
  const { foods, quickAdd } = useDiary();
  const results = useMemo(() => {
    let list = foods;
    if (filter === 'frequent') {
      const set = new Set(frequent);
      list = list.filter(f => set.has(f.id));
    }
    if (vegOnly) list = list.filter(f => f.diet === 'veg');
    return rankFoods(list, query, frequent);
  }, [foods, filter, frequent, vegOnly, query]);

  const emptyCopy = query.trim()
    ? `No match for “${query.trim()}” yet.`
    : filter === 'frequent'
      ? 'Foods you log often will show up here.'
      : 'No foods to show.';

  return (
    <div>
      <div className={s.sheetBanner}>
        <Image src={MEAL_IMG[meal]} alt="" fill sizes="540px" />
        <span>{meal}</span>
      </div>

      <div className={s.mealSwitch} role="group" aria-label="Log to meal">
        <div className="seg">
          {MEALS.map(m => (
            <button key={m} type="button" aria-pressed={m === meal} onClick={() => onMeal(m)}>{m}</button>
          ))}
        </div>
      </div>

      <div className={s.searchInput}>
        <Icon name="search" />
        <label htmlFor="food-search" className="sr-only">Search foods</label>
        <input
          id="food-search"
          data-autofocus
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Dal, roti, paneer…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className={s.filterRow} role="group" aria-label="Filter foods">
        <button type="button" className="pill-choice" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
        <button type="button" className="pill-choice" aria-pressed={filter === 'frequent'} onClick={() => setFilter('frequent')}>Frequent</button>
        <button type="button" className={`pill-choice ${s.vegChip}`} aria-pressed={vegOnly} onClick={() => setVegOnly(!vegOnly)}>Veg</button>
      </div>

      {results.length ? (
        <>
          <p className={s.resultHeading} aria-live="polite">
            {results.length} {results.length === 1 ? 'food' : 'foods'} · + adds 1 serving · tap a name for portions
          </p>
          <ul className={s.results}>
            {results.map(f => (
              <li key={f.id} className={s.result}>
                <FoodTile icon={f.icon} />
                <button type="button" className={s.resultMain} onClick={() => onPick(f)}>
                  <strong>{f.name}</strong>
                  <small>{servingLine(f)}</small>
                </button>
                <button
                  type="button"
                  className="btn-add"
                  aria-label={`Add 1 ${f.unit} ${f.name} to ${meal.toLowerCase()}`}
                  onClick={() => quickAdd(f, meal)}
                >
                  <Icon name="plus" size="sm" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className={s.searchEmpty} aria-live="polite">
          <Icon name="search" />
          <p>{emptyCopy}</p>
          <button type="button" className="btn-secondary" onClick={onCustom}>Add it as your own food</button>
        </div>
      )}

      {results.length > 0 && (
        <p className={s.customLink}>
          <button type="button" className="btn-text" onClick={onCustom}>Can’t find it? Add your own food</button>
        </p>
      )}
    </div>
  );
}
