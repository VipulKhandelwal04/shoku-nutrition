'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { MEALS, shiftDate, totals } from '@/lib/nutrition';
import { fmt, friendlyDate, mealForHour, useLocalHour } from './clientDate';
import { DiaryProvider, useDiary } from './DiaryProvider';
import { MealCards } from './MealCards';
import { useResolvedDay, type LogScreenData } from './TodayView';
import { DoneToggle, WaterPanel } from './WaterPanel';
import s from './log.module.css';

export function DiaryView({ data }: { data: LogScreenData }) {
  const { day, today } = useResolvedDay(data, '/app/diary');
  return (
    <DiaryProvider
      key={day}
      day={day}
      today={today}
      foods={data.foods}
      frequentIds={data.frequentIds}
      targets={data.targets}
      entries={data.entries}
      days={data.days}
      mealsByDay={data.mealsByDay}
      defaultExpanded={[...MEALS]}
      rateMeals={data.rateMeals}
    >
      <DiaryContent serverHour={data.serverHour} />
    </DiaryProvider>
  );
}

const href = (day: string, today: string) => (day === today ? '/app/diary' : `/app/diary?day=${day}`);

function DiaryContent({ serverHour }: { serverHour: number }) {
  const { day, today, isToday, entries, yesterdayEntries, openSearch } = useDiary();
  const router = useRouter();
  const hour = useLocalHour(serverHour);
  const meal = isToday ? mealForHour(hour) : 'Breakfast';
  const t = totals(entries);
  const prev = shiftDate(day, -1);
  const next = shiftDate(day, 1);

  return (
    <div className="stack">
      <header className={s.intro}>
        <div>
          <p className="label">Diary</p>
          <h1>{isToday ? 'Today' : day === shiftDate(today, -1) ? 'Yesterday' : friendlyDate(day, { weekday: true })}</h1>
        </div>
        <nav className={s.dateControl} aria-label="Choose a day">
          <Link className="btn-icon" href={href(prev, today)} aria-label={`Previous day, ${friendlyDate(prev)}`}>
            <Icon name="back" />
          </Link>
          <label htmlFor="diary-date" className="sr-only">Date</label>
          <input
            id="diary-date"
            type="date"
            className={s.dateInput}
            value={day}
            max={today}
            onChange={e => {
              const v = e.target.value;
              if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= today) router.push(href(v, today));
            }}
          />
          {isToday ? (
            <span className="btn-icon" aria-hidden="true" style={{ opacity: 0.3 }}><Icon name="next" /></span>
          ) : (
            <Link className="btn-icon" href={href(next, today)} aria-label={`Next day, ${friendlyDate(next)}`}>
              <Icon name="next" />
            </Link>
          )}
        </nav>
      </header>

      <dl className={`panel ${s.summary}`} aria-label="Day totals">
        {[
          ['Calories', t.kcal, 'kcal'],
          ['Protein', t.p, 'g'],
          ['Carbs', t.c, 'g'],
          ['Fat', t.f, 'g'],
        ].map(([label, n, unit]) => (
          <div key={label as string}>
            <dt>{label}</dt>
            <dd>{fmt(n as number)} <small>{unit}</small></dd>
          </div>
        ))}
      </dl>

      <div className={s.layout}>
        <div>
          {!entries.length && (
            <div className={`note ${s.diaryEmpty}`}>
              <p>
                Nothing logged on {friendlyDate(day)}. Log a meal{yesterdayEntries.length ? ' or repeat one from the day before' : ''}.
              </p>
              <button type="button" className="btn-secondary" onClick={() => openSearch(meal)}>
                <Icon name="plus" size="sm" /> Log a meal
              </button>
            </div>
          )}
          <MealCards full />
          <DoneToggle />
          <p className="fine-print" style={{ marginTop: 16 }}>Nutrition is estimated. Recipes, brands and portions vary.</p>
        </div>
        <aside className="stack">
          <WaterPanel />
        </aside>
      </div>
    </div>
  );
}
