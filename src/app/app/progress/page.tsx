import Image from 'next/image';
import Link from 'next/link';
import { requireOnboarded } from '@/lib/auth';
import { getDays, getEarnedBadges, getEntries, getMealsByDay } from '@/lib/data/queries';
import { BADGES, MEALS_FOR_A_COUNTED_DAY, earnedBadges, shiftDate, streakInfo } from '@/lib/nutrition';
import { Icon } from '@/components/ui/Icon';
import { DeviceTimeZone } from '@/components/app/insights/DeviceTimeZone';
import { friendlyDay, parseDayParam, summariseDays, weekKeys, weekStats, weekdayShort } from '@/components/app/insights/insights';
import { userToday } from '@/components/app/insights/server';
import ins from '@/components/app/insights/insights.module.css';
import s from './progress.module.css';

export const metadata = { title: 'Progress' };

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

export default async function ProgressPage({ searchParams }: PageProps<'/app/progress'>) {
  const profile = await requireOnboarded('/app/progress');
  const sp = await searchParams;
  const { today, tz } = await userToday();
  const end = parseDayParam(sp.week, today, today);
  const keys = weekKeys(end);
  const targets = profile.targets!;

  const [mealsByDay, rows, days, recorded] = await Promise.all([
    getMealsByDay(today, 400), getEntries(keys[0], end), getDays(keys[0], end), getEarnedBadges(),
  ]);
  const streak = streakInfo(mealsByDay, today);
  const earned = new Set<string>([...recorded, ...earnedBadges(streak.best)]);
  const summaries = summariseDays(keys, rows, days);
  const stats = weekStats(summaries, targets.kcal);
  const isNew = Object.keys(mealsByDay).length === 0;
  const left = Math.max(0, MEALS_FOR_A_COUNTED_DAY - streak.mealsToday);

  const streakMsg = streak.todayCounted
    ? 'Today counts. See you tomorrow.'
    : streak.mealsToday
      ? `${left} more ${left === 1 ? 'meal' : 'meals'} today ${streak.current ? `makes it ${streak.current + 1}` : 'starts your streak'}.`
      : streak.current ? `Log 3 meals today to make it ${streak.current + 1}.` : 'Log 3 meals in a day to start one.';

  const max = Math.max(targets.kcal, ...summaries.map(d => d.totals.kcal), 1) * 1.12;
  const weekLabel = `${friendlyDay(keys[0], today, { short: true })} – ${friendlyDay(end, today, { short: true })}`;

  return (
    <div>
      <DeviceTimeZone current={tz} />
      <header className={ins.intro}>
        <div>
          <h1>Progress</h1>
          <p>{MEALS_FOR_A_COUNTED_DAY} meals logged and the day counts. No need to close anything.</p>
        </div>
      </header>

      <div className="stack">
        {isNew && (
          <section className={`panel ${s.welcome}`} aria-labelledby="first-week">
            <Image src="/img/breakfast.webp" alt="" fill sizes="(max-width: 760px) 100vw, 1180px" className={s.welcomeImg} />
            <div className={s.welcomeBody}>
              <p className={ins.eyebrow}>Week one starts now</p>
              <h2 id="first-week">Your first streak is three meals away.</h2>
              <p>Log breakfast, lunch and dinner today and you’re on the board. Your week chart, averages and badges fill in from here.</p>
              <Link href="/app" className="btn accent">Log a meal <Icon name="arrow" size="sm" /></Link>
            </div>
          </section>
        )}

        <section className={`panel ${s.streak}`} aria-labelledby="streak-title">
          <div className={s.streakNow}>
            <span className={s.streakNum} aria-hidden="true">{streak.current}</span>
            <div>
              <h2 id="streak-title"><span className="sr-only">{streak.current} </span>Day streak</h2>
              <p>{streakMsg} Best: {streak.best} {streak.best === 1 ? 'day' : 'days'}.</p>
            </div>
          </div>
          <ul className={s.badges} aria-label="Streak badges">
            {BADGES.map(b => {
              const got = earned.has(b.id);
              return (
                <li key={b.id} className={s.badge} data-got={got || undefined}>
                  <span className={s.badgeMark} aria-hidden="true">{got ? <Icon name="bolt" size="sm" /> : b.days}</span>
                  <strong>{b.name}</strong>
                  <small>{got ? 'Unlocked' : `${b.days} days in a row`}</small>
                  <span className="sr-only">{got ? '' : ': locked'}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {!isNew && (
          <>
            <div className={s.stats}>
              <section className="panel">
                <p className="label">Days that counted</p>
                <p className={s.statBig}>{stats.countedDays}<span> / 7</span></p>
                <p className="muted">{stats.loggedDays > stats.countedDays ? `${stats.loggedDays} days with something logged.` : 'Show up daily. It adds up.'}</p>
              </section>
              <section className="panel">
                <p className="label">Average calories</p>
                <p className={s.statBig}>{stats.avgKcal === null ? '–' : fmt(stats.avgKcal)}<span> kcal</span></p>
                <p className="muted">A day, counted days only · target {fmt(targets.kcal)}</p>
              </section>
              <section className="panel">
                <p className="label">Average protein</p>
                <p className={s.statBig}>{stats.avgProtein === null ? '–' : fmt(stats.avgProtein)}<span> g</span></p>
                <p className="muted">A day, counted days only · target {fmt(targets.p)} g</p>
              </section>
            </div>

            <section className={`panel ${s.chartPanel}`} aria-labelledby="week-title">
              <div className="section-heading">
                <div>
                  <h2 id="week-title">Your week in meals</h2>
                  <p>{weekLabel}</p>
                </div>
                <nav className={s.weekNav} aria-label="Change week">
                  <Link className="btn-icon" href={`/app/progress?week=${shiftDate(end, -7)}`} aria-label="Previous week"><Icon name="back" /></Link>
                  {end < today
                    ? <Link className="btn-icon" href={end >= shiftDate(today, -7) ? '/app/progress' : `/app/progress?week=${shiftDate(end, 7)}`} aria-label="Next week"><Icon name="next" /></Link>
                    : <span className="btn-icon" aria-hidden="true" />}
                </nav>
              </div>
              <div className={s.chart} role="img" aria-label={`Calories by day against your ${fmt(targets.kcal)} kcal target. ${summaries.map(d => `${weekdayShort(d.day)}: ${d.entries.length ? `${fmt(d.totals.kcal)} kcal` : 'nothing logged'}${d.counted ? ', counted' : ''}`).join('; ')}.`}>
                <div className={s.targetLine} style={{ bottom: `${(targets.kcal / max) * 100}%` }} aria-hidden="true"><span>Target</span></div>
                {summaries.map(d => (
                  <div key={d.day} className={s.col} aria-hidden="true">
                    <span className={s.barLabel}>{d.entries.length ? fmt(d.totals.kcal) : '–'}</span>
                    <div className={s.bar} data-counted={d.counted || undefined} style={{ height: `${Math.max(1, (d.totals.kcal / max) * 100)}%` }} />
                    <span className={s.barDay} data-today={d.day === today || undefined}>{weekdayShort(d.day)}</span>
                  </div>
                ))}
              </div>
              <div className={s.legend}>
                <span><i className={s.legendSolid} aria-hidden="true" />Counted day (3+ meals)</span>
                <span><i className={s.legendStriped} aria-hidden="true" />Still building</span>
                <span><i className={s.legendLine} aria-hidden="true" />Your target</span>
              </div>
            </section>

            <section className="panel panel-pad" aria-labelledby="brief-title">
              <h2 id="brief-title" className={s.briefTitle}>This week, in brief</h2>
              <div className={s.insight}>
                <Icon name="drop" />
                <div>
                  <strong>{fmt(stats.water)} ml of water logged</strong>
                  <p className="muted">That’s what you recorded, about {fmt(stats.water / 7)} ml a day against {fmt(targets.water)} ml. Missing logs don’t mean you didn’t drink.</p>
                </div>
              </div>
              <div className={s.insight}>
                <Icon name="star" />
                <div>
                  {stats.bestDay ? (
                    <>
                      <strong>Best day: {friendlyDay(stats.bestDay.day, today)}</strong>
                      <p className="muted">{fmt(stats.bestDay.totals.kcal)} kcal and {fmt(stats.bestDay.totals.p)} g protein, closest to your target.</p>
                    </>
                  ) : (
                    <>
                      <strong>Your best day is still ahead</strong>
                      <p className="muted">Log 3 meals in a day and we’ll spotlight it here.</p>
                    </>
                  )}
                </div>
              </div>
              <div className={s.insight}>
                <Icon name="checkCircle" />
                <div>
                  <strong>{stats.countedDays} of 7 days counted</strong>
                  <p className="muted">Averages use counted days only. Lighter days still show in the chart.</p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
