'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/Icon';
import { clockIn, clockLabel, dayTimeline } from '@/components/app/insights/insights';
import type { WorkoutRow } from '@/lib/types';
import { fmt } from './clientDate';
import { isTemp, useDiary } from './DiaryProvider';
import s from './log.module.css';

// Times are read on the device's clock, so the list renders after hydration (the server can't know the zone).
const subscribe = () => () => {};
const useMounted = () => useSyncExternalStore(subscribe, () => true, () => false);

/** "Today so far": meals and workouts in time order. Untimed workouts sit where they were recorded. */
export function TodayTimeline({ workouts }: { workouts: WorkoutRow[] }) {
  const { day, isToday, entries } = useDiary();
  const mounted = useMounted();
  const items = useMemo(
    () => (mounted ? dayTimeline(day, entries.filter(e => !isTemp(e.id)), workouts, clockIn()) : []),
    [mounted, day, entries, workouts],
  );

  return (
    <section aria-labelledby="timeline-h">
      <div className="section-heading">
        <h2 id="timeline-h">{isToday ? 'Today so far' : 'The day so far'}</h2>
      </div>
      <div className={`panel ${s.timeline}`}>
        {!mounted ? null : items.length === 0 ? (
          <p className={s.emptyMeal}>Meals and workouts line up here as you log them.</p>
        ) : (
          <ol className={s.timelineList}>
            {items.map(i => (
              <li key={i.key} className={s.timelineItem} data-kind={i.kind}>
                <span className={s.timelineTime}>
                  {i.timed === 'usual' ? 'Usual' : clockLabel(i.at)}
                  {i.kind === 'workout' && i.timed === 'logged' && <small>logged</small>}
                </span>
                <span className={s.timelineDot} aria-hidden="true">
                  <Icon name={i.kind === 'workout' ? (i.source === 'strava' ? 'arrow' : 'flame') : 'bowl'} size="sm" />
                </span>
                <span className={s.timelineText}>
                  {i.kind === 'meal' ? (
                    <>
                      <strong>{i.meal}</strong>
                      <small>{i.names.slice(0, 3).join(' · ')}{i.names.length > 3 ? ` +${i.names.length - 3}` : ''} · {fmt(i.kcal)} kcal</small>
                    </>
                  ) : (
                    <>
                      <strong>{i.label}</strong>
                      <small>{i.minutes} min · {fmt(i.kcal)} kcal burned · {i.source === 'strava' ? 'Strava' : 'by hand'}</small>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
