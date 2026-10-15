'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AiLogSheet, CoachLine } from '@/components/ai';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { MEALS_FOR_A_COUNTED_DAY, exerciseCredit, shiftDate, streakInfo, totals, type Diet, type Food, type Meal, type Targets } from '@/lib/nutrition';
import type { AiAssistStatus, DayRow, EntryRow } from '@/lib/types';
import { fmt, friendlyDate, greeting, mealForHour, useClientToday, useLocalHour } from './clientDate';
import { DiaryProvider, useDiary } from './DiaryProvider';
import { TodayTimeline } from './TodayTimeline';
import { MealCards } from './MealCards';
import { DoneToggle, WaterPanel } from './WaterPanel';
import { WorkoutsPanel, type WorkoutsData } from './WorkoutsPanel';
import s from './log.module.css';

export type LogScreenData = {
  /** Feature flag: rate a logged food ("How was it?"). */
  rateMeals?: boolean;
  serverToday: string;
  serverHour: number;
  requestedDay: string | null;
  foods: Food[];
  entries: EntryRow[];
  days: DayRow[];
  mealsByDay: Record<string, number>;
  frequentIds: string[];
  targets: Targets;
  diet: Diet;
};

/**
 * Resolves the day from the browser clock (users are in India; the server only guesses), guards against
 * future days, and fetches a different window if the browser's day falls outside what the server loaded.
 */
export function useResolvedDay(data: Pick<LogScreenData, 'serverToday' | 'requestedDay'>, basePath: string) {
  const router = useRouter();
  const today = useClientToday(data.serverToday);
  const future = !!data.requestedDay && data.requestedDay > today;
  const day = data.requestedDay && !future ? data.requestedDay : today;
  const outside = !data.requestedDay && (day > shiftDate(data.serverToday, 1) || day < shiftDate(data.serverToday, -1));
  useEffect(() => {
    if (future) router.replace(basePath);
    else if (outside) router.replace(`${basePath}?day=${day}`);
  }, [future, outside, day, basePath, router]);
  return { day, today };
}

const STAPLES = ['chapati', 'dal', 'rice', 'curd', 'idli', 'banana', 'poha', 'egg', 'sabzi', 'chai'];
const dietAllows = (diet: Diet, f: Food) => diet === 'nonveg' || f.diet === 'veg' || (diet === 'egg' && f.diet === 'egg');

/** Which Today panels feature flags leave on. */
export type TodayShow = { workouts: boolean; water: boolean };

export function TodayView({ data, ai, workouts, show }: { data: LogScreenData; ai: AiAssistStatus; workouts: WorkoutsData; show: TodayShow }) {
  const { day, today } = useResolvedDay(data, '/app');
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
      rateMeals={data.rateMeals}
    >
      <TodayContent data={data} ai={ai} workouts={workouts} show={show} />
    </DiaryProvider>
  );
}

function TodayContent({ data, ai, workouts, show }: { data: LogScreenData; ai: AiAssistStatus; workouts: WorkoutsData; show: TodayShow }) {
  const { day, isToday, today, openSearch, foodsById, quickAdd, openPortion, aiLogged } = useDiary();
  const router = useRouter();
  const hour = useLocalHour(data.serverHour);
  const meal = mealForHour(hour);
  const [aiMode, setAiMode] = useState<'photo' | 'text' | null>(null);
  const showPhoto = ai.available && ai.features.photo;
  const showText = ai.available && ai.features.text;

  // Frozen on mount so the rail never reshuffles under the pointer after a quick add.
  const [usuals] = useState(() => {
    const mine = data.frequentIds.map(id => foodsById.get(id)).filter((f): f is Food => !!f).slice(0, 8);
    if (mine.length) return { foods: mine, starter: false };
    const staples = STAPLES.map(id => foodsById.get(id)).filter((f): f is Food => !!f && dietAllows(data.diet, f)).slice(0, 6);
    return { foods: staples, starter: true };
  });

  return (
    <div className="stack">
      <header className={s.intro}>
        <div>
          <p className="label">{isToday ? friendlyDate(day, { weekday: true }) : 'Looking back'}</p>
          <h1>{isToday ? greeting(hour) : friendlyDate(day, { weekday: true })}</h1>
        </div>
        {!isToday && (
          <Link href="/app" className="btn-secondary">Back to today <Icon name="arrow" size="sm" /></Link>
        )}
      </header>

      <div>
        <Hero meal={meal} today={today} burned={workouts.workouts.filter(w => w.day === day).reduce((n, w) => n + w.kcal, 0)} onLog={() => openSearch(meal)} aiPills={(showPhoto || showText) ? (
          <div className={s.aiGroup} role="group" aria-label="AI Assist">
            <span className={s.aiBadge}><Icon name="spark" size="sm" /> AI Assist</span>
            <div className={s.aiPills}>
              {showPhoto && (
                <button type="button" className={s.pill} onClick={() => setAiMode('photo')} aria-label="Snap plate with AI Assist">
                  <Icon name="camera" size="sm" /> Snap plate
                </button>
              )}
              {showText && (
                <button type="button" className={s.pill} onClick={() => setAiMode('text')} aria-label="Type it with AI Assist">
                  <Icon name="type" size="sm" /> Type it
                </button>
              )}
            </div>
          </div>
        ) : null} />
        {ai.available && ai.features.coach && (
          <div className={s.coach}><CoachLine day={day} /></div>
        )}
      </div>

      <div className={s.layout}>
        <div className="stack">
          <section aria-labelledby="usuals-h">
            <div className="section-heading">
              <div>
                <h2 id="usuals-h">Your usuals</h2>
                <p>{usuals.starter ? 'Popular picks to get you going. Your most-logged foods land here.' : `Tap + to log 1 serving to ${meal.toLowerCase()}. Tap a name for portions.`}</p>
              </div>
            </div>
            <ul className={s.rail}>
              {usuals.foods.map(f => (
                <li key={f.id} className={s.usual}>
                  <button type="button" className={s.usualMain} onClick={() => openPortion(f, meal)} aria-label={`Choose a portion of ${f.name}`}>
                    <FoodTile icon={f.icon} />
                    <strong>{f.name.split(',')[0]}</strong>
                    <small><b>{fmt(f.kcal)}</b> kcal · 1 {f.unit}</small>
                  </button>
                  <button
                    type="button"
                    className={`btn-add ${s.usualPlus}`}
                    aria-label={`Add 1 ${f.unit} ${f.name} to ${meal.toLowerCase()}`}
                    onClick={() => quickAdd(f, meal)}
                  >
                    <Icon name="plus" size="sm" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="meals-h">
            <div className="section-heading">
              <h2 id="meals-h">{isToday ? 'Today’s meals' : 'Meals'}</h2>
              <Link href={isToday ? '/app/diary' : `/app/diary?day=${day}`} className="btn-text">Open diary <Icon name="next" size="sm" /></Link>
            </div>
            <MealCards />
            <DoneToggle />
          </section>
          {show.workouts && workouts.timeline && <TodayTimeline workouts={workouts.workouts} />}
        </div>
        {(show.workouts || show.water) && (
          <aside className="stack">
            {show.workouts && <WorkoutsPanel day={day} isToday={isToday} data={workouts} />}
            {show.water && <WaterPanel />}
          </aside>
        )}
      </div>

      {showPhoto && (
        <AiLogSheet open={aiMode === 'photo'} onClose={() => setAiMode(null)} mode="photo" day={day} meal={meal} foods={data.foods}
          onLogged={ids => { aiLogged(ids, meal); router.refresh(); }} />
      )}
      {showText && (
        <AiLogSheet open={aiMode === 'text'} onClose={() => setAiMode(null)} mode="text" day={day} meal={meal} foods={data.foods}
          onLogged={ids => { aiLogged(ids, meal); router.refresh(); }} />
      )}
    </div>
  );
}

const C = 2 * Math.PI * 108;

function Hero({ meal, today, burned, onLog, aiPills }: { meal: Meal; today: string; burned: number; onLog: () => void; aiPills: ReactNode }) {
  const { entries, targets, mealsByDay, isToday, day } = useDiary();
  const t = totals(entries);
  // Half of the day's logged burn is added to the target (see EXERCISE_CREDIT).
  const credit = exerciseCredit(burned);
  const target = targets.kcal + credit;
  const left = target - t.kcal;
  const over = left < 0;
  const proteinLeft = targets.p - t.p;
  const pct = target > 0 ? Math.min(t.kcal / target, 1) : 0;
  const streak = streakInfo(mealsByDay, today);
  const mealsLogged = new Set(entries.map(e => e.meal)).size;
  const toCount = Math.max(0, MEALS_FOR_A_COUNTED_DAY - mealsLogged);

  const progressLine = isToday
    ? toCount === 0 ? 'Today counts. Streak safe.' : `${toCount} more ${toCount === 1 ? 'meal' : 'meals'} to count today`
    : toCount === 0 ? 'This day counted toward your streak.' : `${mealsLogged} of ${MEALS_FOR_A_COUNTED_DAY} meals logged on ${friendlyDate(day)}`;

  const macros = [
    { k: 'p' as const, label: 'Protein', color: 'var(--protein)' },
    { k: 'c' as const, label: 'Carbs', color: 'var(--carbs)' },
    { k: 'f' as const, label: 'Fat', color: 'var(--fat)' },
  ];

  return (
    <section className={s.hero} aria-label={isToday ? 'Today’s calories' : `Calories on ${friendlyDate(day)}`}>
      <Image className={s.heroPhoto} src="/img/hero.webp" alt="" fill preload sizes="(max-width: 1000px) 100vw, 1180px" />
      <div className={s.heroBody}>
        <div className={s.heroTop}>
          {isToday && streak.current > 0 && (
            <span className={s.streakChip}><Icon name="bolt" size="sm" />{streak.current}-day streak</span>
          )}
          <span className={`${s.countLine} ${toCount === 0 ? s.counted : ''}`}>
            {toCount === 0 && <Icon name="checkCircle" size="sm" />}{progressLine}
          </span>
        </div>
        <h2 className={s.heroTitle}>
          <span className={`${s.num} ${over ? s.over : ''}`}>{fmt(Math.abs(left))}</span>
          {over ? 'kcal over' : 'kcal to go'}
        </h2>
        <p className={s.heroSub}>
          <b>{fmt(t.kcal)}</b> of {fmt(target)} kcal eaten{credit > 0 && <> · <span className={s.heroBurn}>+{fmt(credit)} from workouts</span></>} · {proteinLeft > 0 ? <><b>{fmt(proteinLeft)} g</b> protein to go</> : 'protein target hit'}
        </p>
        <div className={s.macros}>
          {macros.map(m => {
            const goal = targets[m.k];
            const val = t[m.k];
            return (
              <div key={m.k} className={s.macro}>
                <span className={s.macroName}>{m.label}</span>
                <div className={s.track} role="progressbar" aria-label={`${m.label} eaten`} aria-valuenow={Math.round(val)} aria-valuemin={0} aria-valuemax={Math.max(goal, Math.round(val))} aria-valuetext={`${Math.round(val)} of ${goal} g`}>
                  <div className={s.fill} style={{ background: m.color, transform: `scaleX(${goal > 0 ? Math.min(val / goal, 1) : 0})` }} />
                </div>
                <span className={s.macroVal}>{fmt(val)}<span> / {fmt(goal)}g</span></span>
              </div>
            );
          })}
        </div>
        <div className={s.heroActions}>
          <button type="button" className="btn accent big" onClick={onLog}>
            {isToday ? `Log ${meal.toLowerCase()}` : 'Add food'} <Icon name="plus" size="sm" />
          </button>
          {aiPills}
        </div>
      </div>
      <div className={s.heroRing}>
        <div className={s.ringWrap} role="img" aria-label={`${fmt(t.kcal)} of ${fmt(target)} calories eaten`}>
          <svg viewBox="0 0 240 240" className={s.ring} aria-hidden="true">
            <circle className={s.ringTrack} cx="120" cy="120" r="108" />
            <circle className={s.ringProgress} cx="120" cy="120" r="108" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
          </svg>
          <div className={s.ringCopy}>
            <span className={s.ringNumber}>{fmt(t.kcal)}</span>
            <span className={s.ringLabel}>kcal eaten</span>
          </div>
        </div>
      </div>
    </section>
  );
}

