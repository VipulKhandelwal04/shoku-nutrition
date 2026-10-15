'use client';
import Link from 'next/link';
import { useId, useState, type CSSProperties } from 'react';
import type { EnergyDay } from '@/lib/activity-energy';
import { fmt } from '@/lib/format';
import s from './energy.module.css';

const dateLabel = (day: string, full = false) => new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', full
  ? { weekday: 'long', day: 'numeric', month: 'short' }
  : { weekday: 'short' });
const value = (n: number | null) => n === null ? 'Not logged' : `${fmt(n)} kcal`;

/** Two series on one scale. This shows recorded exercise, never a claimed daily calorie deficit. */
export function EnergyComparison({ days }: { days: EnergyDay[] }) {
  const id = useId();
  const [selected, setSelected] = useState(days.at(-1)?.day);
  const current = days.find(d => d.day === selected) ?? days.at(-1);
  const foodDays = days.filter(d => d.intake !== null).length;
  const activityDays = days.filter(d => d.burned !== null).length;
  const intake = days.reduce((sum, d) => sum + (d.intake ?? 0), 0);
  const burned = days.reduce((sum, d) => sum + (d.burned ?? 0), 0);
  const scale = Math.max(500, Math.ceil(Math.max(...days.flatMap(d => [d.intake ?? 0, d.burned ?? 0])) / 500) * 500);
  const week = days.length > 1;
  return (
    <section id="energy" className={`panel ${s.panel}`} aria-labelledby={`${id}-title`}>
      <div className={s.heading}>
        <div><h2 id={`${id}-title`}>Food &amp; activity</h2><p>{week ? 'Last 7 days' : current ? dateLabel(current.day, true) : 'Your day'} · recorded calories</p></div>
        <Link className="btn-text" href="/app#activity">Log or sync activity</Link>
      </div>
      <dl className={s.totals}>
        <div><dt><i className={s.foodKey} aria-hidden="true" />Food intake</dt><dd>{foodDays ? fmt(intake) : '—'} <small>kcal</small><p>{foodDays ? `${foodDays} ${foodDays === 1 ? 'day' : 'days'} with meals logged` : 'No meals logged'}</p></dd></div>
        <div><dt><i className={s.burnKey} aria-hidden="true" />Workout calories</dt><dd>{activityDays ? fmt(burned) : '—'} <small>kcal</small><p>{activityDays ? `${days.reduce((n, d) => n + d.sessions, 0)} workouts · ${fmt(days.reduce((n, d) => n + d.minutes, 0))} min` : 'No activity logged'}</p></dd></div>
      </dl>
      {foodDays || activityDays ? (
        <>
          <div className={s.mobileScale} aria-hidden="true"><span>0 kcal</span><span>{fmt(scale)} kcal</span></div>
          <div className={s.plot}>
            <div className={s.axis} aria-hidden="true"><span>{fmt(scale)}</span><span>{fmt(scale / 2)}</span><span>0</span></div>
            <div className={s.scroll}>
              <div className={`${s.columns} ${week ? s.week : s.day}`} role="group" aria-label="Choose a day to compare calories">
                {days.map(d => (
                  <button key={d.day} className={s.column} type="button" aria-pressed={d.day === current?.day} onClick={() => setSelected(d.day)}
                    aria-label={`${dateLabel(d.day, true)}: food intake ${value(d.intake)}, workout calories ${value(d.burned)}`}>
                    <span className={s.bars} aria-hidden="true">
                      <span className={s.foodBar} style={{ '--amount': `${(d.intake ?? 0) / scale * 100}%` } as CSSProperties} />
                      <span className={s.burnBar} style={{ '--amount': `${(d.burned ?? 0) / scale * 100}%` } as CSSProperties} />
                    </span>
                    <span className={s.date}>{dateLabel(d.day)} <small>{Number(d.day.slice(-2))}</small></span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {current && <p className={s.detail} aria-live="polite"><strong>{dateLabel(current.day, true)}</strong><span>Food: {value(current.intake)} · Workouts: {value(current.burned)}</span></p>}
        </>
      ) : (
        <p className={s.empty}>Log a meal and connect Strava or add a workout. Your recorded intake and activity will appear together here.</p>
      )}
      <p className={s.note}>Exercise only, not total daily burn. Missing logs are not zero.</p>
      <details className={s.data}>
        <summary>Daily numbers & sources</summary>
        <div className={s.tableScroll}><table><caption className="sr-only">Recorded food intake and workout calories</caption><thead><tr><th scope="col">Day</th><th scope="col">Food intake</th><th scope="col">Workouts</th><th scope="col">Source</th></tr></thead><tbody>
          {days.map(d => <tr key={d.day}><th scope="row">{dateLabel(d.day, true)}</th><td>{value(d.intake)}</td><td>{value(d.burned)}</td><td>{d.sessions ? [d.imported ? 'Strava' : '', d.sessions > d.imported ? 'By hand' : ''].filter(Boolean).join(' + ') : 'Not logged'}</td></tr>)}
        </tbody></table></div>
      </details>
    </section>
  );
}
