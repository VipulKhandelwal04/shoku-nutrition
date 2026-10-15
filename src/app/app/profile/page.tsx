import Image from 'next/image';
import { requireOnboarded } from '@/lib/auth';
import { getConnections, getEarnedBadges, getFlags, getFoods, getMealsByDay, getRatings, isStravaConfigured } from '@/lib/data/queries';
import { isOn } from '@/lib/flags';
import { BADGES, GOALS, cuisineOf, dayCounts, recommend, streakInfo } from '@/lib/nutrition';
import { CUISINE_CHOICES, cuisinePrefsOf, cuisineSummary } from '@/lib/preferences';
import { Icon } from '@/components/ui/Icon';
import { BrandIcon, Wordmark } from '@/components/brand/Brand';
import { DIETS, RESTRICTIONS, RESTRICTION_SLUGS, bodyOf, pickTargets, type Restriction } from '@/components/app/insights/insights';
import { userToday } from '@/components/app/insights/server';
import type { BodyValues } from './ProfileForms';
import { ProfileMenu } from './ProfileMenu';
import s from './profile.module.css';

export const metadata = { title: 'Profile' };

const GOOGLE_PHOTO = /^https:\/\/lh3\.googleusercontent\.com\//;
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

export default async function ProfilePage() {
  const profile = await requireOnboarded('/app/profile');
  const { today } = await userToday();
  const [mealsByDay, badges, connections, flags, ratings, foods] = await Promise.all([
    getMealsByDay(today, 365), getEarnedBadges(), getConnections(), getFlags(), getRatings(), getFoods(),
  ]);
  const cuisinesOn = isOn(flags, 'cuisines');
  const cuisines = cuisinePrefsOf(profile);
  // The common cuisines plus whatever the catalogue has; anything already chosen stays pickable.
  const cuisineChoices = [...new Set([...CUISINE_CHOICES, ...foods.filter(f => !f.custom).map(f => cuisineOf(f)), ...cuisines.chosen])];
  const activity = { useWorkouts: profile.use_workouts !== false, askFirst: profile.ask_workouts === true };

  const body = bodyOf(profile);
  const recommended = body ? pickTargets(recommend(body)) : null;
  const str = (n: number | null) => (n === null || n === undefined ? '' : String(Number(n)));
  const restrictions = (profile.restrictions ?? []).filter((r): r is Restriction => (RESTRICTION_SLUGS as string[]).includes(r));
  const initial: BodyValues = {
    goal: profile.goal ?? 'fit', sex: profile.sex, age: str(profile.age), height: str(profile.height_cm), weight: str(profile.weight_kg),
    activity: profile.activity, diet: profile.diet ?? 'veg', restrictions,
  };
  const name = profile.display_name || profile.email?.split('@')[0] || 'You';
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const targets = profile.targets!;
  const goal = GOALS[profile.goal ?? 'fit'].label;
  const diet = DIETS.find(d => d.key === (profile.diet ?? 'veg'))?.label ?? 'Veg';
  const since = new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const streak = streakInfo(mealsByDay, today);
  const daysCounted = Object.values(mealsByDay).filter(dayCounts).length;

  const plan = [
    { label: 'Goal and body', value: [goal, profile.weight_kg ? `${Number(profile.weight_kg)} kg` : null].filter(Boolean).join(' · '), sheet: 'body' as const, icon: 'user' as const },
    { label: 'Daily targets', value: `${fmt(targets.kcal)} kcal · ${fmt(targets.p)} g protein`, sheet: 'targets' as const, icon: 'sliders' as const },
    {
      label: 'Food style',
      value: [diet, ...restrictions.map(r => RESTRICTIONS.find(x => x.slug === r)?.label), cuisinesOn ? cuisineSummary(cuisines) : null].filter(Boolean).join(' · '),
      sheet: cuisinesOn ? 'style' as const : 'body' as const, icon: 'leaf' as const,
    },
    {
      label: 'Workouts in meal ideas',
      value: !activity.useWorkouts ? 'Left out' : activity.askFirst ? 'Used · asks you first' : 'Used',
      sheet: 'activity' as const, icon: 'bolt' as const,
    },
  ];

  return (
    <div className={s.wrap}>
      <header className={s.identity}>
        <div className={s.avatarRing}>
          {profile.avatar_url && GOOGLE_PHOTO.test(profile.avatar_url) ? (
            <Image src={profile.avatar_url} alt="" width={96} height={96} className={s.avatar} priority />
          ) : (
            <span className={s.avatar} aria-hidden="true">{initials}</span>
          )}
        </div>
        <h1 className={s.name}>{name}</h1>
        {profile.email && <p className={s.email}>{profile.email}</p>}
      </header>

      {/* Member card, after Cult's pass card: what Shoku is set up to do for you. */}
      <section className={s.member} aria-label="Your Shoku card">
        <Image src="/img/hero.webp" alt="" fill sizes="(max-width: 720px) 100vw, 680px" className={s.cardPhoto} />
        <div className={s.cardTop}>
          <span className={s.cardBrand}><BrandIcon size={26} /> <Wordmark className={s.cardWord} /></span>
          <span className={s.cardSince}>Since {since}</span>
        </div>
        <p className={s.cardGoal}>{goal}</p>
        <dl className={s.cardFacts}>
          <div><dt>Daily target</dt><dd>{fmt(targets.kcal)} <small>kcal</small></dd></div>
          <div><dt>Protein</dt><dd>{fmt(targets.p)} <small>g</small></dd></div>
          <div><dt>Food style</dt><dd className={s.cardText}>{diet}</dd></div>
        </dl>
      </section>

      <dl className={s.stats} aria-label="Your streaks">
        <div><dt><Icon name="flame" size="sm" /> Streak</dt><dd>{streak.current}<small>{streak.current === 1 ? 'day' : 'days'}</small></dd></div>
        <div><dt><Icon name="star" size="sm" /> Best</dt><dd>{streak.best}<small>{streak.best === 1 ? 'day' : 'days'}</small></dd></div>
        <div><dt><Icon name="checkCircle" size="sm" /> Counted</dt><dd>{daysCounted}<small>{daysCounted === 1 ? 'day' : 'days'}</small></dd></div>
        <div><dt><Icon name="bolt" size="sm" /> Badges</dt><dd>{badges.length}<small>of {BADGES.length}</small></dd></div>
      </dl>

      <ProfileMenu
        plan={plan}
        initial={initial}
        targets={targets}
        recommended={recommended}
        isAdmin={profile.role === 'admin'}
        strava={{ configured: isStravaConfigured() && isOn(flags, 'apps', 'strava'), connection: connections.find(c => c.provider === 'strava') ?? null }}
        upcoming={isOn(flags, 'apps', 'upcoming')}
        prefs={{
          cuisines: cuisinesOn ? { value: cuisines, choices: cuisineChoices } : null,
          activity,
          ratings: isOn(flags, 'feedback') || ratings.length ? ratings : null,
          remember: isOn(flags, 'feedback', 'learning') ? profile.remember_feedback !== false : null,
        }}
      />

      <p className={s.foot}>
        <Icon name="google" size="sm" /> Signed in with Google. Nutrition values are estimates; Shoku does not give medical advice.
      </p>
    </div>
  );
}
