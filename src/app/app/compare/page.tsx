import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOnboarded } from '@/lib/auth';
import { getAiAssist, getEntries, getFlags, getWeekPlans } from '@/lib/data/queries';
import { isOn } from '@/lib/flags';
import { GOALS, MEALS, groupStatus, planCheck, recommend, shiftDate, totals, type Entry, type PlanItem, type PlanItemStatus } from '@/lib/nutrition';
import { FoodTile, Icon } from '@/components/ui/Icon';
import { CompareRow } from '@/components/app/insights/CompareRow';
import { DeviceTimeZone } from '@/components/app/insights/DeviceTimeZone';
import { LogButton } from '@/components/app/insights/LogButton';
import {
  averageDay, bmiBand, groupContributions, bodyOf, energySplit, friendlyDay, groupsOnTrack, nextUp, nutrientStatus,
  parseDayParam, pickTargets, summariseDays, toEntries, unitFor, weekKeys,
} from '@/components/app/insights/insights';
import { getStoredPlan, userToday } from '@/components/app/insights/server';
import ins from '@/components/app/insights/insights.module.css';
import { CompareTabs } from './CompareTabs';
import { GoalCard } from './GoalCard';
import { PlanTunerEntry } from './PlanTunerEntry';
import { WeekPlan, type WeekDayView, type WeekItem } from './WeekPlan';
import { WeekPlanner } from '@/components/ai/WeekPlanner';
import { buildWeek, isoWeekday, keepEligible, parseStoredPlan, planKcal } from '@/lib/ai/plan';
import { matchRecipe, recipeCard } from '@/lib/ai/candidates';
import { memberDayPlan, memberSuggestions, trainingDaysFor } from '@/lib/ai/member';
import { createClient } from '@/lib/supabase/server';
import { RecipeButton } from '@/components/app/recipes/MealDetail';
import s from './compare.module.css';
import { fmt, qty } from '@/lib/format';

export const metadata = { title: 'Compare' };

const PLAN_CHIP: Record<PlanItemStatus, { label: string; tone: string }> = {
  done: { label: 'Done', tone: 'ok' }, partly: { label: 'Partly', tone: '' }, more: { label: 'More', tone: 'accent' }, next: { label: 'Next', tone: '' },
};

export default async function ComparePage({ searchParams }: PageProps<'/app/compare'>) {
  const profile = await requireOnboarded('/app/compare');
  const flags = await getFlags();
  if (!isOn(flags, 'compare')) notFound();
  const sp = await searchParams;
  const { today, tz } = await userToday();
  const period = sp.period === 'week' ? 'week' : 'day';
  const day = period === 'week' ? today : parseDayParam(sp.day, today, today);
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const initialTab = tabParam === 'nutrients' || tabParam === 'plan' ? tabParam : 'groups';
  // Week view is refused (falls back to the day) while the Week plan feature is off.
  const weekOn = isOn(flags, 'week', 'view');
  const planView = weekOn && sp.plan === 'week' ? 'week' : 'day';

  // Hard rules only (diet, restrictions) plus recipes when Meal detail is on: the same candidates every surface uses.
  const [member, ai, storedPlan, savedDays] = await Promise.all([memberSuggestions(profile, { recipes: true }), getAiAssist(), getStoredPlan(), getWeekPlans()]);
  const { set, foodsById } = member;
  const targets = profile.targets!; // requireOnboarded guarantees targets
  const goal = profile.goal ?? 'fit';
  const body = bodyOf(profile);
  const rec = body ? recommend(body) : null;

  // ---- Entries for the period ----
  let entries: Entry[];
  let dayEntries: Entry[];
  let countedDays = 0;
  if (period === 'week') {
    const keys = weekKeys(today);
    const rows = await getEntries(keys[0], today);
    const summaries = summariseDays(keys, rows);
    const avg = averageDay(summaries);
    entries = avg.entries;
    countedDays = avg.days;
    dayEntries = summaries[summaries.length - 1].entries;
  } else {
    entries = toEntries(await getEntries(day, day));
    dayEntries = entries;
  }
  const dayOpen = period === 'day' && day === today;
  const statuses = groupStatus(entries, targets.kcal, dayOpen);
  const onTrack = groupsOnTrack(statuses);
  const t = totals(entries);
  const empty = entries.length === 0;

  // ---- Plan: a day saved in the week plan wins; otherwise the saved (AI-tailored) day plan, or the template ----
  const dayPlan = memberDayPlan(profile, member, storedPlan);
  /** The saved week-plan day for a date's weekday, eligible foods only; null when that weekday isn't saved. */
  const savedFor = (key: string) => {
    const own = parseStoredPlan(savedDays.get(isoWeekday(key)), foodsById);
    return own ? keepEligible(own, set.eligible) : null;
  };
  const savedToday = savedFor(day);
  const plan = savedToday ?? dayPlan;
  const saved = !!parseStoredPlan(storedPlan, foodsById);
  const check = planCheck(plan, dayEntries, foodsById);
  // A plan meal that mostly is one of the member's recipes opens it (recipes are present only when the flag is on).
  const recipeFor = (items: { foodId: string }[]) => {
    const r = set.recipes.length ? matchRecipe(items.map(i => i.foodId), set.recipes) : null;
    return r ? recipeCard(r, foodsById) : undefined;
  };
  const canLogRecipe = isOn(flags, 'recipes', 'log');
  const week = planView === 'week' ? await weekView() : null;

  /** Seven days from today: a saved weekday wins over the generated day; each meal lists its swap options. */
  async function weekView(): Promise<WeekDayView[]> {
    const trainingDays = await trainingDaysFor(await createClient(), today);
    const generated = buildWeek(dayPlan, {
      eligible: set.candidates.map(c => c.food), targetKcal: targets.kcal, trainingDays, startWeekday: isoWeekday(today),
    });
    const toItems = (items: PlanItem[]): WeekItem[] => items.flatMap(i => {
      const f = foodsById.get(i.foodId);
      return f ? [{ foodId: f.id, name: f.name, unit: unitFor(i.q, f.unit), q: i.q, kcal: Math.round(f.kcal * i.q) }] : [];
    });
    const sig = (items: PlanItem[]) => items.map(i => i.foodId).sort().join(',');
    return generated.map((g, i) => {
      const key = shiftDate(today, i);
      const weekday = isoWeekday(key);
      // Saved days always show (and can be reset) even while editing is switched off.
      const own = savedFor(key);
      const plan = own ?? g.plan;
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      const meals = MEALS.map(meal => {
        // Every distinct version of this meal across the generated week, starting after the current one, so
        // repeated swaps walk through them all.
        const versions: PlanItem[][] = [];
        for (const d of generated) if (d.plan[meal].length && !versions.some(v => sig(v) === sig(d.plan[meal]))) versions.push(d.plan[meal]);
        const at = versions.findIndex(v => sig(v) === sig(plan[meal]));
        const alternatives = [...versions.slice(at + 1), ...versions.slice(0, Math.max(0, at))].filter(v => sig(v) !== sig(plan[meal]));
        return { meal, items: toItems(plan[meal]), alternatives: alternatives.map(toItems), recipe: recipeFor(plan[meal]) };
      });
      return { key, label, weekday, kcal: planKcal(plan, foodsById), saved: !!own, training: g.training, plan, meals };
    });
  }
  // Keep the page's period/day when switching between Day and Week plans.
  const planHref = (v: 'day' | 'week') => {
    const q = new URLSearchParams();
    if (period === 'week') q.set('period', 'week');
    else if (day !== today) q.set('day', day);
    q.set('tab', 'plan');
    if (v === 'week') q.set('plan', 'week');
    return `/app/compare?${q}`;
  };
  const hourNow = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz ?? 'Asia/Kolkata' }).format(new Date()));
  const mealNow = hourNow < 11 ? 'Breakfast' : hourNow < 16 ? 'Lunch' : hourNow < 19 ? 'Snacks' : 'Dinner';
  const suggestions = period === 'day' ? nextUp(plan, dayEntries, groupStatus(dayEntries, targets.kcal, dayOpen), foodsById, 3, dayOpen ? mealNow : undefined) : [];

  const dayLabel = friendlyDay(day, today);
  const plateTitle = period === 'week' ? 'Your average plate' : day === today ? 'Today’s plate' : `${dayLabel}’s plate`;
  const periodNote = period === 'week'
    ? `Average of ${countedDays} counted ${countedDays === 1 ? 'day' : 'days'} in the last 7 (3+ meals logged)`
    : dayOpen ? 'Day still open: gaps close as you log' : dayLabel;

  const you = energySplit(t);
  const recSplit = energySplit(rec ?? targets)!;

  // ---- Panels ----
  const emptyNote = empty ? (
    <p className="note">
      {period === 'week'
        ? 'No counted days in the last 7 yet. Log 3 meals in a day and it shows up here.'
        : dayOpen ? 'Nothing logged yet today. Log a meal and watch your plate fill up.' : 'Nothing logged for this day.'}
    </p>
  ) : null;

  const contributions = groupContributions(entries);
  const groupsPanel = (
    <>
      <p className={s.panelNote}>{periodNote} · ICMR-NIN My Plate for the Day, scaled to {fmt(targets.kcal)} kcal</p>
      {emptyNote}
      <ul className={s.contribList}>
        {statuses.map(g => {
          const items = contributions[g.key];
          return (
            <li key={g.key}>
              <div className={s.contribHead}>
                <strong>{g.label}</strong>
                <span className="muted">{g.kind === 'limit' ? 'Up to' : 'At least'} {fmt(g.target)} {g.unit}</span>
              </div>
              <p className={s.contribFoods}>
                {items.length ? items.map(c => `${c.name} ${fmt(c.amount)} ${g.unit}`).join(' · ') : 'Nothing from this group yet.'}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="fine-print">Amounts are raw-weight equivalents estimated from your portions. Custom foods don’t count toward food groups.</p>
    </>
  );

  const fibreTarget = rec?.fibre ?? 25;
  const nutrientsPanel = (
    <>
      <p className={s.panelNote}>{periodNote}</p>
      {emptyNote}
      <CompareRow label="Calories" eaten={t.kcal} target={targets.kcal} unit="kcal" kind="target" status={nutrientStatus(t.kcal, targets.kcal, 'target', dayOpen)} />
      <CompareRow label="Protein" eaten={t.p} target={targets.p} unit="g" kind="atleast" status={nutrientStatus(t.p, targets.p, 'atleast', dayOpen)} />
      <CompareRow label="Carbs" eaten={t.c} target={targets.c} unit="g" kind="target" status={nutrientStatus(t.c, targets.c, 'target', dayOpen)} />
      <CompareRow label="Fat" eaten={t.f} target={targets.f} unit="g" kind="limit" status={nutrientStatus(t.f, targets.f, 'limit', dayOpen)} />
      <CompareRow label="Fibre" eaten={t.fibre} target={fibreTarget} unit="g" kind="atleast" status={nutrientStatus(t.fibre, fibreTarget, 'atleast', dayOpen)} />
    </>
  );

  const planToggle = weekOn ? (
    <nav className={`${s.periodSeg} ${s.planView}`} aria-label="Plan view">
      <Link href={planHref('day')} aria-current={planView === 'day' ? 'page' : undefined} scroll={false}>Day</Link>
      <Link href={planHref('week')} aria-current={planView === 'week' ? 'page' : undefined} scroll={false}>Week</Link>
    </nav>
  ) : null;

  const planPanel = week ? (
    <>
      {planToggle}
      {ai.features.week && isOn(flags, 'week', 'ai') && (
        <div className={s.tuner}>
          <span className="chip accent"><Icon name="spark" size="sm" /> AI Assist</span>
          <WeekPlanner />
        </div>
      )}
      <WeekPlan days={week} today={today} target={targets.kcal} canEdit={isOn(flags, 'week', 'edit')} canLogRecipe={canLogRecipe} />
    </>
  ) : (
    <>
      {planToggle}
      <div className={s.planHead}>
        <div>
          <p className={s.panelNote}>
            {period === 'week' ? 'Today against your plan' : `${dayLabel} against your plan`} · {check.done} of {check.count} items done
          </p>
          <p className="fine-print">
            {savedToday ? `Your saved ${new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })} from your week plan. Check each item before you log it.`
              : saved ? 'Your saved plan, tailored with AI Assist. Check each item before you log it.' : `A ${profile.diet === 'veg' ? 'veg' : profile.diet === 'egg' ? 'eggetarian' : 'non-veg'} day built on ICMR-NIN’s plate, scaled to ${fmt(targets.kcal)} kcal.`}
            {(profile.restrictions ?? []).length > 0 && ' Foods that clearly clash with your restrictions are left out.'}
          </p>
        </div>
        {ai.features.plan && (
          <div className={s.tuner}>
            <span className="chip accent"><Icon name="spark" size="sm" /> AI Assist</span>
            <PlanTunerEntry />
          </div>
        )}
      </div>
      {check.rows.map(row => (
        <div key={row.meal} className={s.meal}>
          <h3 className={s.mealTitle}>{row.meal}</h3>
          {(() => {
            const card = recipeFor(plan[row.meal]);
            return card ? (
              <p className={s.recipeLine}>Recipe: <RecipeButton recipe={card} meal={row.meal} day={day} canLog={canLogRecipe && day <= today} /></p>
            ) : null;
          })()}
          {row.items.length === 0 && <p className="muted">Nothing planned.</p>}
          <ul className={s.planList}>
            {row.items.map(i => (
              <li key={i.foodId} className={s.planItem}>
                <FoodTile icon={i.food.icon} />
                <div className={s.planText}>
                  <strong>{i.food.name}</strong>
                  <small>{qty(i.q)} {unitFor(i.q, i.food.unit)} · {fmt(i.food.kcal * i.q)} kcal{i.eaten > 0 ? ` · ${qty(i.eaten)} logged` : ''}</small>
                </div>
                <span className={`chip ${PLAN_CHIP[i.status].tone}`}>{PLAN_CHIP[i.status].label}</span>
                {i.left > 0 ? (
                  <LogButton day={day} items={[{ meal: row.meal, foodId: i.foodId, quantity: i.left }]}
                    label={`Log ${qty(i.left)} ${unitFor(i.left, i.food.unit)} ${i.food.name} to ${row.meal}`} done={`${i.food.name} logged to ${row.meal}.`} />
                ) : <span className={s.addSpacer} aria-hidden="true" />}
              </li>
            ))}
          </ul>
          {row.extras.length > 0 && (
            <p className={s.extras}>Also logged: {row.extras.map(e => e.food.name).join(', ')}</p>
          )}
        </div>
      ))}
    </>
  );

  return (
    <div>
      <DeviceTimeZone current={tz} />
      <header className={ins.intro}>
        <div>
          <h1>Your plate vs the guide</h1>
          <p>Your meals against your plan and the ICMR-NIN guide for Indians.</p>
        </div>
        <nav className={s.controls} aria-label="Choose the day">
          <div className={s.periodSeg}>
            <Link href="/app/compare" aria-current={period === 'day' ? 'page' : undefined}>Day</Link>
            <Link href="/app/compare?period=week" aria-current={period === 'week' ? 'page' : undefined}>Week</Link>
          </div>
          {period === 'day' && (
            <div className={s.dayNav}>
              <Link className="btn-icon" href={`/app/compare?day=${shiftDate(day, -1)}`} aria-label="Previous day"><Icon name="back" /></Link>
              <span className={s.dayLabel} aria-live="polite">{friendlyDay(day, today, { short: true })}</span>
              {day < today
                ? <Link className="btn-icon" href={`/app/compare?day=${shiftDate(day, 1)}`} aria-label="Next day"><Icon name="next" /></Link>
                : <span className="btn-icon" aria-hidden="true" />}
            </div>
          )}
        </nav>
      </header>

      <div className={s.layout}>
        <div className="stack">
          <section className={`panel ${s.plate}`} aria-labelledby="plate-title">
            <div className={s.plateHead}>
              <h2 id="plate-title">{plateTitle}</h2>
              <span className="muted">{periodNote}</span>
            </div>
            {empty ? (
              <p className={s.bigLine}><span className="display">Fresh plate.</span> {period === 'week' ? 'Your averages land here once a day counts.' : 'Start with one of these.'}</p>
            ) : (
              <p className={s.bigLine}>
                <span className="display">{onTrack} of 7</span> food groups on track
              </p>
            )}
            {!empty && (
              <div className={s.groupRows}>
                {statuses.map(g => (
                  <CompareRow key={g.key} label={g.label} eaten={g.eaten} target={g.target} unit={g.unit} kind={g.kind} status={g.status} />
                ))}
              </div>
            )}
            {period === 'day' && (
              <div className={s.nextUp}>
                <h3>Next up</h3>
                {suggestions.length ? (
                  <ul className={ins.suggest}>
                    {suggestions.map(x => (
                      <li key={x.foodId} className={ins.suggestItem}>
                        <FoodTile icon={x.icon} />
                        <div className={ins.suggestText}>
                          <strong>{x.name}</strong>
                          <small>{qty(x.quantity)} {unitFor(x.quantity, x.unit)} · {fmt(x.kcal)} kcal · {x.meal} · fills {x.fillsLabel.toLowerCase()}</small>
                        </div>
                        <LogButton day={day} items={[{ meal: x.meal, foodId: x.foodId, quantity: x.quantity }]}
                          label={`Log ${qty(x.quantity)} ${unitFor(x.quantity, x.unit)} ${x.name} to ${x.meal}`} done={`${x.name} logged to ${x.meal}.`} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">{empty ? 'Your plan is empty for your food style. Log anything from Today.' : 'Every group your plan covers is on track. Nice work.'}</p>
                )}
              </div>
            )}
          </section>

          <CompareTabs
            initial={initialTab}
            groups={isOn(flags, 'compare', 'groups') ? groupsPanel : null}
            nutrients={isOn(flags, 'compare', 'nutrients') ? nutrientsPanel : null}
            plan={isOn(flags, 'compare', 'plan') ? planPanel : null}
          />
        </div>

        <aside className={`stack ${s.side}`} aria-label="Goal and sources">
          {isOn(flags, 'compare', 'goal') && <GoalCard goal={goal} targets={targets} recommended={rec ? pickTargets(rec) : null} bmi={rec?.bmi ?? null} bmiNote={rec ? bmiBand(rec.bmi) : null} />}

          <section className="panel panel-pad" aria-labelledby="split-title">
            <h3 id="split-title" className={s.sideTitle}>Where your energy comes from</h3>
            <SplitBar label="You" split={you} />
            <SplitBar label={rec ? 'Recommended' : 'Your targets'} split={recSplit} />
            <dl className={s.splitLegend}>
              {(['p', 'c', 'f'] as const).map(k => (
                <div key={k}>
                  <dt><i data-k={k} aria-hidden="true" />{k === 'p' ? 'Protein' : k === 'c' ? 'Carbs' : 'Fat'}</dt>
                  <dd><b>{you ? `${Math.round(you[k])}%` : '–'}</b> <span className="muted">vs {Math.round(recSplit[k])}%</span></dd>
                </div>
              ))}
            </dl>
            <p className="fine-print">ICMR-NIN suggests about 15% of energy from protein and up to 30% from fat.</p>
          </section>

          <section className="panel panel-pad" aria-labelledby="about-title">
            <h3 id="about-title" className={s.sideTitle}>About these numbers</h3>
            <p className="note">
              Calories use the Mifflin-St Jeor estimate and your activity level, adjusted for {GOALS[goal].label.toLowerCase()}.
              Protein uses ICMR’s 0.83 g per kg body weight (1.6 g/kg when building muscle). Fibre uses the WHO minimum of 25 g.
              BMI uses ICMR’s cut-offs for Indian adults. These are general estimates for healthy adults: if you’re pregnant,
              breastfeeding or managing a health condition, use targets from your doctor or dietitian.
            </p>
            <ul className={s.sources}>
              <li><a href="https://www.nin.res.in/brief/Policy%20Brief%20My%20Plate%20J18%2024.pdf" target="_blank" rel="noopener noreferrer">ICMR-NIN · My Plate for the Day <Icon name="arrow" size="sm" /><span className="sr-only"> (opens in a new tab)</span></a></li>
              <li><a href="https://nutritionconnect.org/resource-center/dietary-guidelines-indians-2024-edition-icmr-nin" target="_blank" rel="noopener noreferrer">ICMR-NIN · Dietary Guidelines for Indians 2024 <Icon name="arrow" size="sm" /><span className="sr-only"> (opens in a new tab)</span></a></li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SplitBar({ label, split }: { label: string; split: { p: number; c: number; f: number } | null }) {
  return (
    <div className={s.split}>
      <div className={s.splitLabel}><span>{label}</span>{!split && <span>No meals yet</span>}</div>
      <div className={s.splitBar} role="img" aria-label={split ? `${label}: protein ${Math.round(split.p)}%, carbs ${Math.round(split.c)}%, fat ${Math.round(split.f)}%` : `${label}: no meals yet`}>
        {split && (['p', 'c', 'f'] as const).map(k => <span key={k} data-k={k} style={{ width: `${split[k]}%` }} />)}
      </div>
    </div>
  );
}
