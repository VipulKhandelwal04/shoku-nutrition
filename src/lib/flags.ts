// Product feature flags: primary features, each with its own secondary switches. One registry drives the admin
// page, the save schema and every check. Stored in app_settings under the key "flags". Safe to import anywhere.
// AI Assist keeps its own master + per-feature switches (app_settings "ai", admin AI Assist page).

export const FEATURE_FLAGS = {
  workouts: {
    title: 'Workouts',
    body: 'The Workouts panel on Today: calories burned, with half added to the day’s target.',
    children: {
      manual: { title: 'Log by hand', body: 'Members add a class, run or walk themselves.' },
      light_base: { title: 'Light-base suggestion', body: 'Offers to switch the base target to light activity so workouts aren’t counted twice.' },
      timeline: { title: 'Today timeline', body: '“Today so far” on Today: meals and workouts in time order, with a “When?” time on logged workouts.' },
      week: { title: 'Workouts this week', body: '“See week” in the Workouts panel: the last 7 days of workouts with the total burned.' },
    },
  },
  water: {
    title: 'Water',
    body: 'The water tracker on Today.',
    children: {
      weekly: { title: 'Water in the weekly brief', body: 'Progress shows how much water was logged that week.' },
    },
  },
  compare: {
    title: 'Compare',
    body: 'The Compare tab: what was eaten against targets and the day plan.',
    children: {
      groups: { title: 'Food groups tab', body: 'Food groups eaten against the day’s guidance.' },
      nutrients: { title: 'Nutrients tab', body: 'Calories, protein, carbs, fat and fibre against targets.' },
      plan: { title: 'Plan tab', body: 'The day plan, with what is done and what is next.' },
      goal: { title: 'Goal and BMI card', body: 'Goal, targets and BMI band beside the tabs.' },
    },
  },
  progress: {
    title: 'Progress',
    body: 'The Progress tab: streaks and the week at a glance.',
    children: {
      streak: { title: 'Streak and badges', body: 'Day streak (3+ meals counts) and the badges it unlocks.' },
      chart: { title: 'Week chart', body: 'Calories by day against the target, with weekly averages.' },
      brief: { title: 'Weekly brief', body: 'Short notes on the week.' },
    },
  },
  apps: {
    title: 'Connected apps',
    body: 'The Connected apps list in Profile.',
    children: {
      strava: { title: 'Strava', body: 'Connect Strava and import workouts. Disconnecting always stays available.' },
      upcoming: { title: 'Coming-soon apps', body: 'Lists Samsung Health, Apple Health and Garmin as coming soon.' },
    },
  },
  week: {
    title: 'Week plan',
    body: 'A Day | Week toggle on Compare → Plan. Needs Compare and its Plan tab on.',
    children: {
      view: { title: 'Week view', body: 'Seven days built from the day plan, foods rotated for variety, each day kept near the calorie target.' },
      ai: { title: 'Plan my week (AI)', body: 'AI Assist builds seven days, with more protein and carbs on usual training days. Also needs the AI Assist switch.' },
      edit: { title: 'Edit the week', body: 'Swap a meal on any day (saved for that weekday) and log today’s planned meals in one tap. “Back to suggested” always works.' },
    },
  },
  cuisines: {
    title: 'Cuisines',
    body: 'Cuisine preferences in Profile → Food style. Diet, allergies and “no X” stay strict either way.',
    children: {
      ask: { title: 'In Ask Shoku', body: 'Ask Shoku leans toward the member’s cuisines.' },
      plans: { title: 'In Tune my plan', body: 'AI day plans lean toward the member’s cuisines.' },
    },
  },
  feedback: {
    title: 'Meal feedback',
    body: 'Members rate meals: like, okay or not for me, with quick tags and a note. Listed and deletable in Profile.',
    children: {
      meals: { title: 'Rate logged meals', body: 'From a logged food on Today or Diary.' },
      ideas: { title: 'Rate Ask Shoku ideas', body: 'From an idea card in Ask Shoku.' },
      learning: { title: 'Learn from feedback', body: 'Ask Shoku and Tune my plan favour liked foods and push “not for me” down (never removed). Members can turn it off.' },
    },
  },
} as const;

type Registry = typeof FEATURE_FLAGS;
export type PrimaryKey = keyof Registry;
export type SecondaryKey<P extends PrimaryKey> = keyof Registry[P]['children'] & string;
/** Stored shape: { workouts: { on, manual, light_base }, ... }. */
export type FeatureFlags = { [P in PrimaryKey]: { on: boolean } & { [S in SecondaryKey<P>]: boolean } };

export const PRIMARY_KEYS = Object.keys(FEATURE_FLAGS) as PrimaryKey[];
export const secondaryKeys = <P extends PrimaryKey>(p: P) => Object.keys(FEATURE_FLAGS[p].children) as SecondaryKey<P>[];

/** Everything on: a new deployment, or a flag added later, behaves like today until an admin turns it off. */
export const DEFAULT_FLAGS = Object.fromEntries(
  PRIMARY_KEYS.map(p => [p, Object.fromEntries([['on', true], ...secondaryKeys(p).map(s => [s, true])])]),
) as FeatureFlags;

/** Stored JSON → complete flags. Unknown keys are dropped, missing ones default to on, non-booleans are ignored. */
export function mergeFlags(raw: unknown): FeatureFlags {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(PRIMARY_KEYS.map(p => {
    const stored = src[p] && typeof src[p] === 'object' ? (src[p] as Record<string, unknown>) : {};
    const keys = ['on', ...secondaryKeys(p)];
    return [p, Object.fromEntries(keys.map(k => [k, typeof stored[k] === 'boolean' ? stored[k] : true]))];
  })) as FeatureFlags;
}

/** A primary is usable when on; a secondary only when it and its primary are both on. */
export function isOn<P extends PrimaryKey>(flags: FeatureFlags, primary: P, secondary?: SecondaryKey<P>): boolean {
  const f = flags[primary] as Record<string, boolean>;
  return f.on && (secondary ? f[secondary] : true);
}

/** Message for server actions and routes refused because a flag is off. */
export const FLAG_OFF = 'This feature is turned off right now.';
