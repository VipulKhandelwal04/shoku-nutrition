'use client';
import { Icon } from '@/components/ui/Icon';
import { useDiary } from './DiaryProvider';
import s from './log.module.css';

const GLASS = 250;

export function WaterPanel() {
  const { water, targets, addWater, isToday } = useDiary();
  const goal = targets.water > 0 ? targets.water : 2500;
  const left = Math.max(0, Math.ceil((goal - water) / GLASS));
  const glasses = 8;
  return (
    <section className={`panel ${s.water}`} aria-labelledby="water-h">
      <div className={s.waterHeading}>
        <h3 id="water-h">Hydration</h3>
        <Icon name="drop" />
      </div>
      <p className={s.waterValue} aria-live="polite">
        {Number((water / 1000).toFixed(2))} <span>/ {Number((goal / 1000).toFixed(2))} L</span>
      </p>
      <div className={s.glasses} role="img" aria-label={`${water} ml of ${goal} ml logged`}>
        {Array.from({ length: glasses }, (_, i) => (
          <Icon key={i} name="glass" className={water / goal > i / glasses ? s.filled : ''} />
        ))}
      </div>
      <div className={s.waterControls}>
        <button type="button" className={`btn-icon ${s.outlined}`} aria-label={`Remove ${GLASS} ml of water`} disabled={water <= 0} onClick={() => addWater(-GLASS)}>
          <Icon name="minus" size="sm" />
        </button>
        <button type="button" className="btn-secondary" disabled={water >= 15000} onClick={() => addWater(GLASS)}>
          <Icon name="plus" size="sm" /> {GLASS} ml
        </button>
      </div>
      <p className={s.subtle}>
        {water >= goal ? 'Hydration goal hit. Nice.' : isToday ? `${left} more ${left === 1 ? 'glass' : 'glasses'} to go.` : `${left} ${left === 1 ? 'glass' : 'glasses'} short of the goal.`}
      </p>
    </section>
  );
}

/** Optional "Done for the day". Streaks count at 3+ meals regardless; this is just a personal close-out. */
export function DoneToggle() {
  const { done, toggleDone, entries, isToday } = useDiary();
  const meals = new Set(entries.map(e => e.meal)).size;
  return (
    <div className={s.mealFooter}>
      <span>{entries.length} {entries.length === 1 ? 'food' : 'foods'} · {meals} {meals === 1 ? 'meal' : 'meals'}</span>
      <button type="button" className={s.doneBtn} aria-pressed={done} disabled={!entries.length && !done} onClick={toggleDone}>
        <Icon name={done ? 'checkCircle' : 'check'} size="sm" />
        {done ? 'Done for the day' : isToday ? 'Mark today done' : 'Mark this day done'}
      </button>
    </div>
  );
}
