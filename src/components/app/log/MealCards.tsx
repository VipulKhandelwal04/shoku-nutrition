'use client';
import Image from 'next/image';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { MEALS, totals, type Meal } from '@/lib/nutrition';
import type { EntryRow } from '@/lib/types';
import { MEAL_IMG, dec, fmt } from './clientDate';
import { isTemp, useDiary } from './DiaryProvider';
import s from './log.module.css';

/** The four meal cards. `full` = always expanded (Diary); otherwise each card toggles (Today). */
export function MealCards({ full = false }: { full?: boolean }) {
  return (
    <div className={s.mealList}>
      {MEALS.map(m => <MealCard key={m} meal={m} full={full} />)}
    </div>
  );
}

function summary(entries: EntryRow[]) {
  if (!entries.length) return 'What’s on your plate?';
  const names = entries.slice(0, 2).map(e => e.food.name.split(',')[0]).join(' · ');
  return entries.length > 2 ? `${names} +${entries.length - 2}` : names;
}

function MealCard({ meal, full }: { meal: Meal; full: boolean }) {
  const { entries: all, yesterdayEntries, expanded, toggleMeal, openSearch, openEntry, removeEntry, repeat } = useDiary();
  const entries = all.filter(e => e.meal === meal);
  const total = totals(entries);
  const open = full || expanded.has(meal);
  const yday = entries.length ? [] : yesterdayEntries.filter(e => e.meal === meal);
  const itemsId = `meal-items-${meal}`;

  const focusAfterRemoval = (i: number) => {
    const next = entries[i + 1] ?? entries[i - 1];
    return next && !isTemp(next.id) ? `item-${next.id}` : `add-${meal}`;
  };

  return (
    <article className={s.mealCard} aria-labelledby={`meal-h-${meal}`}>
      <div className={s.mealHeader}>
        <Image className={s.mealPhoto} src={MEAL_IMG[meal]} alt="" width={64} height={64} sizes="64px" />
        {full ? (
          <div className={s.mealTitle}>
            <h3 id={`meal-h-${meal}`}>{meal}</h3>
            <p>{entries.length} {entries.length === 1 ? 'food' : 'foods'} logged</p>
          </div>
        ) : (
          <button
            type="button"
            className={s.mealTitle}
            aria-expanded={open}
            aria-controls={itemsId}
            data-focus={`meal-${meal}`}
            onClick={() => toggleMeal(meal)}
          >
            <h3 id={`meal-h-${meal}`}>{meal}</h3>
            <p>{summary(entries)}</p>
          </button>
        )}
        <span className={s.mealTotal}>{fmt(total.kcal)} <span>kcal</span></span>
        <button type="button" className="btn-add" data-focus={`add-${meal}`} aria-label={`Add food to ${meal}`} onClick={() => openSearch(meal)}>
          <Icon name="plus" size="sm" />
        </button>
      </div>

      {yday.length > 0 && (
        <div className={s.repeatRow}>
          <button type="button" className={s.repeatChip} onClick={() => repeat(meal)}>
            <Icon name="arrow" size="sm" />
            Repeat yesterday’s {meal.toLowerCase()} · {fmt(totals(yday).kcal)} kcal
          </button>
        </div>
      )}

      <div id={itemsId} hidden={!open}>
        {entries.length ? (
          <ul className={s.mealItems}>
            {entries.map((e, i) => {
              const temp = isTemp(e.id);
              const name = e.food.name;
              return (
                <li key={e.id} className={s.mealItem} data-pending={temp || undefined}>
                  <FoodTile icon={e.food.icon} />
                  <button
                    type="button"
                    className={s.mealItemInfo}
                    data-focus={`item-${e.id}`}
                    aria-disabled={temp || undefined}
                    aria-label={temp ? `${name}, saving` : `Edit ${name}, ${dec(e.quantity)} ${e.food.unit}`}
                    onClick={() => openEntry(e)}
                  >
                    <strong>{name}</strong>
                    <small>{temp ? 'Saving…' : `${dec(e.quantity)} ${e.food.unit} · ${fmt(e.food.grams * e.quantity)} g`}</small>
                  </button>
                  <span className={s.itemKcal}>{fmt(e.food.kcal * e.quantity)}</span>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={`Remove ${name}`}
                    disabled={temp}
                    onClick={() => removeEntry(e, focusAfterRemoval(i))}
                  >
                    <Icon name="trash" size="sm" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : all.length ? (
          // On an empty day the page says "nothing logged" once; per-meal lines only help once other meals have food.
          <p className={s.emptyMeal}>Nothing here yet.</p>
        ) : null}
      </div>
    </article>
  );
}
